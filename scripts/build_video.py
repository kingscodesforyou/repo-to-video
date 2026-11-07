#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_video.py (v4) - 视觉导演制构建流水线：
1. 分析目标仓库并拉取实时 GitHub 数据
2. 严格校验 workspace/storyboard.json (v4 Visual Choreography Schema)，彻底移除默认模板降级
3. 调用 Index-TTS 生成配音并计算短语级/动作节拍级时间锚点 (phrase_timings / beat_timings)
4. 组装 Remotion 渲染配置 (build_props.json / build_props.first_shot.json / build_props.pilot.json)
5. 支持首镜样板审核 (--first-shot) 与全片视觉 QA (--run-qa)
"""

import os
import re
import sys
import json
import shutil
import argparse
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Tuple

# 确保脚本所在目录加入导入路径
sys.path.insert(0, str(Path(__file__).parent.resolve()))

FORBIDDEN_LEGACY_CARD_TYPES = {
    "compare",
    "points",
    "skill_grid",
    "skill_card",
    "tier_list",
    "matrix_compare",
}

FORBIDDEN_CARD_FIELDS = {
    "stack_items",
    "pain_points",
    "magic_points",
    "raw_inputs",
    "distilled_outputs",
}


def number_to_chinese_thousands(stars: int) -> str:
    """将 68542 转为中文口播习惯的 '六万八千五百多'"""
    wan = stars // 10000
    qian = (stars % 10000) // 1000
    bai = ((stars % 1000) // 500) * 5
    cn_map = {0: "零", 1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七", 8: "八", 9: "九"}
    if wan > 0:
        res = f"{cn_map.get(wan, str(wan))}万"
        if qian > 0:
            res += f"{cn_map.get(qian, str(qian))}千"
            if bai > 0:
                res += f"{cn_map.get(bai, str(bai))}百"
        res += "多"
        return res
    return str(stars)


def validate_storyboard_v4(storyboard_path: Path) -> Dict[str, Any]:
    """
    v4 分镜 Schema 强校验门禁：
    - 严禁缺失 storyboard.json 时自动降级生成简化版默认分镜
    - 强制检查每个镜头的 visual_intent, art_direction, visual_world, visual_choreography
    - 拦截卡片堆砌字段与超标元素预算
    """
    if not storyboard_path.exists():
        print("\n" + "=" * 76)
        print("[✗] 致命错误: 未找到正式分镜文件 workspace/storyboard.json！")
        print("    repo-to-video v4 已废除 generate_default_storyboard() 自动降级机制。")
        print("    请严格按照四角色导演工作流先生成并校验分镜：")
        print("      1. Agent 1 (Scriptwriter · agents/scriptwriter.md) -> 生成 workspace/script_draft.json")
        print("      2. Agent 2 (Visual Director · agents/visual_director.md) -> 生成 workspace/storyboard.json")
        print("    分镜 Schema 规范详见: references/scene-schema.md")
        print("=" * 76 + "\n")
        sys.exit(1)

    try:
        data = json.loads(storyboard_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[✗] 分镜 JSON 解析失败 ({storyboard_path}): {e}")
        sys.exit(1)

    scenes = data.get("scenes")
    if not isinstance(scenes, list) or len(scenes) == 0:
        print("[✗] 分镜校验失败: 'scenes' 必须是非空数组。")
        sys.exit(1)

    errors: List[str] = []
    warnings: List[str] = []
    continuity_groups: List[str] = []

    for idx, scene in enumerate(scenes):
        sid = scene.get("id") or f"scene_{idx + 1}"
        prefix = f"Scene[{idx + 1}:{sid}]"

        # 1. 检查是否退化为旧版卡片模板
        stype = scene.get("type", "")
        if stype in FORBIDDEN_LEGACY_CARD_TYPES and not scene.get("visual_choreography"):
            errors.append(
                f"{prefix} 使用了已被废弃的平面卡片模板 type='{stype}'，且缺少 visual_choreography。"
            )

        scene_data = scene.get("data") or {}
        if isinstance(scene_data, dict):
            legacy_keys = FORBIDDEN_CARD_FIELDS.intersection(scene_data.keys())
            if legacy_keys and not scene.get("visual_choreography"):
                errors.append(
                    f"{prefix} 包含旧版卡片堆砌字段 {sorted(legacy_keys)}，请重构为 visual_world + visual_choreography。"
                )

        # 2. 检查核心叙事与视觉意图
        narration = (scene.get("narration") or "").strip()
        if not narration:
            errors.append(f"{prefix} 缺少口播文案 'narration'。")

        visual_intent = (scene.get("visual_intent") or "").strip()
        if not visual_intent:
            errors.append(f"{prefix} 缺少 'visual_intent'（必须明确交代本镜头的视觉表达意图）。")

        # 3. 检查 art_direction
        art = scene.get("art_direction")
        if not isinstance(art, dict):
            errors.append(f"{prefix} 缺少 'art_direction' 对象。")
        else:
            for req_key in ("style", "lighting", "material", "accent_color"):
                if not art.get(req_key):
                    errors.append(f"{prefix}.art_direction 缺少必填字段 '{req_key}'。")
            accent = str(art.get("accent_color", ""))
            if accent and not re.match(r"^#[0-9A-Fa-f]{6}$", accent):
                errors.append(
                    f"{prefix}.art_direction.accent_color ('{accent}') 必须是标准 6 位 HEX 颜色（如 '#78A9FF'）。"
                )
            budget = art.get("element_budget", 4)
            if isinstance(budget, (int, float)) and budget > 5:
                errors.append(
                    f"{prefix}.art_direction.element_budget={budget} 超出反 PPT 元素预算上限 (<= 5)。"
                )

        # 4. 检查 visual_world
        world = scene.get("visual_world")
        if not isinstance(world, dict):
            errors.append(f"{prefix} 缺少 'visual_world' 对象。")
        else:
            if not world.get("environment"):
                errors.append(f"{prefix}.visual_world 缺少 'environment'（空间环境定义）。")
            if not world.get("primary_object"):
                errors.append(f"{prefix}.visual_world 缺少 'primary_object'（核心实体装置）。")
            sec_objs = world.get("secondary_objects")
            if not isinstance(sec_objs, list) or len(sec_objs) == 0:
                errors.append(f"{prefix}.visual_world.secondary_objects 必须是非空列表。")
            elif len(sec_objs) > 4:
                errors.append(
                    f"{prefix}.visual_world.secondary_objects 数量 ({len(sec_objs)}) 过多，同屏次要物体不得超过 4 个。"
                )

        # 5. 检查 visual_choreography (核心！)
        choreo = scene.get("visual_choreography")
        if not isinstance(choreo, list) or len(choreo) == 0:
            errors.append(f"{prefix} 缺少 'visual_choreography' 动作节拍序列。")
        else:
            for b_idx, beat in enumerate(choreo):
                b_prefix = f"{prefix}.visual_choreography[{b_idx}]"
                if not isinstance(beat, dict):
                    errors.append(f"{b_prefix} 必须是对象。")
                    continue
                for b_key in ("beat", "action", "target", "description"):
                    if not beat.get(b_key):
                        errors.append(f"{b_prefix} 缺少必填字段 '{b_key}'。")
                if not beat.get("camera") and b_idx == 0:
                    warnings.append(f"{b_prefix} 建议显式指定 'camera' 运镜方式（如 'slow_dolly_in'）。")

        # 6. 检查 text_overlays 克制原则
        overlays = scene.get("text_overlays")
        if overlays is not None:
            if not isinstance(overlays, list):
                errors.append(f"{prefix}.text_overlays 必须是数组。")
            elif len(overlays) > 3:
                errors.append(
                    f"{prefix}.text_overlays 数量 ({len(overlays)}) 过多，违反反 PPT 极简字幕批注原则 (最多 3 条)。"
                )
            else:
                for o_idx, ov in enumerate(overlays):
                    if isinstance(ov, dict) and len(str(ov.get("text", ""))) > 24:
                        warnings.append(
                            f"{prefix}.text_overlays[{o_idx}] 文字过长 ({len(str(ov.get('text', '')))} 字)，建议精炼在 14 字以内。"
                        )

        cg = scene.get("continuity_group")
        if cg:
            continuity_groups.append(f"{sid}({cg})")

    if warnings:
        print("\n[!] 视觉导演规范提示 (Warnings):")
        for w in warnings:
            print(f"    - {w}")

    if errors:
        print("\n" + "=" * 76)
        print(f"[✗] 分镜 Schema (v4) 校验未通过，共发现 {len(errors)} 处问题：")
        for err in errors:
            print(f"    ✗ {err}")
        print("\n请由 Visual Director (agents/visual_director.md) 修复 workspace/storyboard.json 后重试。")
        print("=" * 76 + "\n")
        sys.exit(1)

    print(f"[✓] v4 Visual Choreography 分镜校验通过! 共 {len(scenes)} 个镜头。")
    if continuity_groups:
        print(f"[✓] 连续空间叙事编组: {' -> '.join(continuity_groups)}")
    return data


def audit_storyboard_facts(profile: dict, storyboard_path: Path):
    """
    强制文案数字审查门禁：
    核验分镜剧本中的 GitHub Star 数等关键指标是否与 GitHub API 实时数据一致。
    """
    gh = profile.get("github_stats") or {}
    stars = gh.get("stars")
    stars_fmt = gh.get("stars_formatted")
    if not stars or not storyboard_path.exists():
        return

    raw_text = storyboard_path.read_text(encoding="utf-8")
    updated_text = raw_text
    cn_stars = number_to_chinese_thousands(stars)

    stale_patterns = [
        (r"48,000\+?\s*Star", f"{stars_fmt} Star"),
        (r"48000\+?\s*Star", f"{stars_fmt} Star"),
        (r"四万八千多?颗?星", f"{cn_stars}颗星"),
        (r"四万八千星", f"{cn_stars}颗星"),
    ]
    fixes = 0
    for pat, repl in stale_patterns:
        if re.search(pat, updated_text, flags=re.I):
            updated_text = re.sub(pat, repl, updated_text, flags=re.I)
            fixes += 1

    if fixes > 0:
        storyboard_path.write_text(updated_text, encoding="utf-8")
        print(f"[!] 文案审查门禁拦截并修正了 {fixes} 处过时 Star 数字 -> 已更新为实时数据: {stars_fmt} ({cn_stars}颗星)")
    else:
        print(f"[✓] 文案数字审查通过: 当前实时 Star 数为 {stars:,} ({stars_fmt})")


def main():
    parser = argparse.ArgumentParser(description="repo-to-video v4 Visual Director build runner")
    parser.add_argument("--repo", required=True, help="Target repository directory or URL")
    parser.add_argument("--workspace", default="workspace", help="Workspace folder for assets")
    parser.add_argument("--tts-url", default="http://192.168.8.106:8712/tts", help="Index-TTS URL")
    parser.add_argument("--voice", default="yali.wav", help="Index-TTS voice timbre (default: yali.wav)")
    parser.add_argument("--emo-alpha", type=float, default=1.0, help="Emotion alpha factor")
    parser.add_argument("--speed", type=float, default=0.9, help="Speech speed factor (default: 0.9)")
    parser.add_argument("--fps", type=int, default=30, help="Target FPS")
    parser.add_argument(
        "--first-shot",
        action="store_true",
        help="First Shot Approval mode: build & render only the 1st benchmark shot (out/first_shot.mp4) and keyframe sheet",
    )
    parser.add_argument("--pilot", action="store_true", help="Build only the pilot cut (~30s preview)")
    parser.add_argument("--pilot-scenes", type=int, default=3, help="Max scenes to include in pilot preview")
    parser.add_argument("--render-pilot", action="store_true", help="Render out/pilot.mp4 automatically")
    parser.add_argument("--run-qa", action="store_true", help="Run visual_qa.py Contact Sheet & motion audit after build")
    args = parser.parse_args()

    workspace_dir = Path(args.workspace).resolve()
    workspace_dir.mkdir(parents=True, exist_ok=True)
    audio_dir = workspace_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    # 1. 扫描仓库
    print("\n=== [1/4] 分析目标仓库与实时 GitHub 数据核查 ===")
    from analyze_repo import analyze_repository
    profile = analyze_repository(args.repo)
    profile_path = workspace_dir / "repo_profile.json"
    profile_path.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[+] 项目类型判定: {profile['type']}")

    # 2. 严格校验 v4 分镜剧本（无正式分镜立即终止，绝不自动生成简化模板）
    print("\n=== [2/4] 校验 v4 视觉导演分镜剧本 (storyboard.json) ===")
    storyboard_path = workspace_dir / "storyboard.json"
    validate_storyboard_v4(storyboard_path)
    audit_storyboard_facts(profile, storyboard_path)

    # 3. 语音合成与短语级/节拍级时间锚点对齐
    print(f"\n=== [3/4] 局域网 Index-TTS 配音与短语级时间锚点对齐 (语速: {args.speed}x) ===")
    from tts_generator import process_storyboard
    if args.first_shot:
        max_scenes = 1
    elif args.pilot:
        max_scenes = args.pilot_scenes
    else:
        max_scenes = None

    process_storyboard(
        storyboard_path=str(storyboard_path),
        output_dir=str(audio_dir),
        tts_url=args.tts_url,
        voice=args.voice,
        emo_alpha=args.emo_alpha,
        speed=args.speed,
        fps=args.fps,
        allow_fallback=True,
        max_scenes=max_scenes
    )

    # 4. 组装 Remotion 配置
    print("\n=== [4/4] 组装 Remotion 渲染参数 (build_props.json) ===")
    storyboard_data = json.loads(storyboard_path.read_text(encoding="utf-8"))
    durations_data = json.loads((audio_dir / "durations.json").read_text(encoding="utf-8"))

    # 自动将音频同步到模板与工作区的 public/audio 目录以供 staticFile 读取
    for target_pub in [Path("public/audio").resolve(), (Path(__file__).parent.parent / "templates" / "public" / "audio").resolve()]:
        target_pub.mkdir(parents=True, exist_ok=True)
        for wav_file in audio_dir.glob("*.wav"):
            shutil.copy2(wav_file, target_pub / wav_file.name)

    assembled_scenes = []
    source_scenes = storyboard_data["scenes"][:len(durations_data["scenes"])]
    for s, dur in zip(source_scenes, durations_data["scenes"]):
        scene_type = s.get("type") or ("choreographed_v4" if s.get("visual_choreography") else "title_card")
        assembled_scenes.append({
            **s,
            "type": scene_type,
            "durationInFrames": dur["frame_count"],
            "audioFrames": int(round(dur["duration_sec"] * args.fps)),
            "durationSec": dur["duration_sec"],
            "startFrame": dur["start_frame"],
            "audioUrl": f"audio/{dur['audio_file']}",
            "phrase_timings": dur.get("phrase_timings", []),
            "word_timings": dur.get("word_timings", []),
            "beat_timings": dur.get("beat_timings", []),
        })

    global_art_direction = storyboard_data.get("global_art_direction") or {
        "aesthetic": "Premium Editorial Tech Explainer",
        "default_theme": "dark_cinematic",
        "palette": {
            "background_dark": "#0B0D12",
            "background_light": "#F6F5F0",
            "surface_dark": "#131722",
            "surface_light": "#FFFFFF",
            "text_primary_dark": "#F3F4F6",
            "text_primary_light": "#111318",
            "muted": "#8B95A5",
            "primary_accent": "#78A9FF",
        },
        "lighting_preset": "soft_studio",
        "camera_philosophy": "continuous_narrative_flow",
        "max_element_budget": 4,
    }

    build_props = {
        "schemaVersion": storyboard_data.get("schema_version", "4.0"),
        "title": storyboard_data.get("video_title") or profile.get("readme_title", profile["name"]),
        "repoName": storyboard_data.get("repo_name") or profile["name"],
        "repoUrl": storyboard_data.get("repo_url") or profile.get("repo_path", ""),
        "repoType": storyboard_data.get("repo_type") or profile["type"],
        "chapters": storyboard_data.get("chapters", []),
        "globalArtDirection": global_art_direction,
        "fps": args.fps,
        "totalFrames": durations_data["total_frames"],
        "scenes": assembled_scenes,
    }

    props_path = workspace_dir / "build_props.json"
    props_path.write_text(json.dumps(build_props, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[+] Remotion 配置文件构建完成: {props_path}")
    print(f"[+] 视频总帧数: {durations_data['total_frames']} 帧 ({durations_data['total_seconds']} 秒)")

    # 生成首镜样板配置 (First Shot Approval)
    if assembled_scenes:
        first_scene = assembled_scenes[0]
        first_shot_props = {
            **build_props,
            "totalFrames": first_scene.get("durationInFrames", 120),
            "scenes": [first_scene],
        }
        first_shot_path = workspace_dir / "build_props.first_shot.json"
        first_shot_path.write_text(json.dumps(first_shot_props, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[+] 首镜样板审核 (First Shot) 配置已生成: {first_shot_path} ({first_scene['id']})")

    # 生成 30 秒先导样片 (Pilot Checkpoint) 配置
    pilot_scenes = []
    pilot_frames = 0
    for s in assembled_scenes:
        dur = s.get("durationInFrames", 90)
        if pilot_scenes and (pilot_frames + dur > 960 or len(pilot_scenes) >= args.pilot_scenes):
            break
        pilot_scenes.append(s)
        pilot_frames += dur

    pilot_props = {
        **build_props,
        "totalFrames": pilot_frames,
        "scenes": pilot_scenes,
    }
    pilot_props_path = workspace_dir / "build_props.pilot.json"
    pilot_props_path.write_text(json.dumps(pilot_props, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.first_shot:
        print("\n🎬 [First Shot Approval] 正在执行首镜样板渲染与关键帧抽样审核...")
        from visual_qa import run_visual_qa
        qa_dir = Path("out/qa").resolve()
        run_visual_qa(
            props_path=first_shot_path,
            output_dir=qa_dir,
            mode="first-shot",
            render_video_out=Path("out/first_shot.mp4").resolve()
        )
        print("\n✅ 首镜样板已生成！请审核 out/first_shot.mp4 与 out/qa/first_shot_sheet.png 确认全片视觉基准。")
        return

    if args.render_pilot:
        print("\n🎬 正在快速渲染 30 秒先导片: out/pilot.mp4 ...")
        render_cmd = f"npx remotion render src/index.ts PilotVideo out/pilot.mp4 --props={pilot_props_path}"
        subprocess.run(render_cmd, shell=True, check=True)
        print("✅ 先导片导出成功: out/pilot.mp4！")

    if args.run_qa:
        print("\n🔍 正在执行全片 Contact Sheet 与连续帧视觉 QA 验收...")
        from visual_qa import run_visual_qa
        qa_dir = Path("out/qa").resolve()
        run_visual_qa(
            props_path=props_path,
            output_dir=qa_dir,
            mode="full"
        )

    print("\n✨ 构建准备完毕！建议先通过 First Shot Approval 或运行 scripts/visual_qa.py 完成视觉验收。")


if __name__ == "__main__":
    main()
