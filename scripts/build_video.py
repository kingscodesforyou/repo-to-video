#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_video.py (v4.1) - 可执行的视觉编排系统构建流水线：
1. 分析目标仓库并拉取实时 GitHub 数据
2. 严格执行 v4.1 字段级白名单、Renderer Registry 能力校验、元素预算 (<= 4) 与 phrase_anchor 顺序校验
3. 验证 Motion Designer 组件绑定（严禁未知动作/物体静默退化到默认模板）
4. 调用短语级分段 TTS 配音与声学强制对齐 (phrase_timings / word_timings / beat_timings)
5. 支持代表性样板镜头审核 (hero_scene_id / --hero-shot) 与四层 Visual QA (--run-qa)
"""

import os
import re
import sys
import json
import shutil
import argparse
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Set

# 确保脚本所在目录加入导入路径
sys.path.insert(0, str(Path(__file__).parent.resolve()))

ALLOWED_TOP_KEYS: Set[str] = {
    "schema_version",
    "repo_name",
    "repo_url",
    "repo_type",
    "video_title",
    "hero_scene_id",
    "chapters",
    "global_art_direction",
    "motion_designer_verified",
    "scenes",
}

ALLOWED_SCENE_KEYS: Set[str] = {
    "id",
    "renderer_id",
    "chapter",
    "title",
    "continuity_group",
    "narration",
    "narration_phrases",
    "visual_intent",
    "art_direction",
    "visual_world",
    "visual_choreography",
    "text_overlays",
    "motion_notes",
}

ALLOWED_ART_KEYS: Set[str] = {
    "style",
    "theme",
    "lighting",
    "material",
    "accent_color",
    "element_budget",
}

ALLOWED_WORLD_KEYS: Set[str] = {
    "environment",
    "stage_continuity",
    "primary_object",
    "secondary_objects",
    "object_labels",
    "authentic_assets",
}

ALLOWED_BEAT_KEYS: Set[str] = {
    "beat",
    "phrase_anchor",
    "action",
    "target",
    "description",
    "camera",
    "shot_scale",
    "yielding",
    "payload",
}

FORBIDDEN_LEGACY_KEYS: Set[str] = {
    "type",
    "data",
    "stack_items",
    "cards",
    "pain_points",
    "magic_points",
    "raw_inputs",
    "distilled_outputs",
    "before_text",
    "after_text",
    "teacher_note",
}


def load_registry_manifest() -> Dict[str, Any]:
    """加载 templates/src/registry/registry_manifest.json 共享能力注册表"""
    manifest_path = (
        Path(__file__).parent.parent / "templates" / "src" / "registry" / "registry_manifest.json"
    ).resolve()
    if not manifest_path.exists():
        raise FileNotFoundError(f"Renderer Registry manifest not found: {manifest_path}")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def normalize_obj_id(obj: Any) -> str:
    if isinstance(obj, str):
        return obj.strip()
    if isinstance(obj, dict):
        return str(obj.get("id") or obj.get("type") or "").strip()
    return ""


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


def validate_storyboard_v4_1(storyboard_path: Path) -> Dict[str, Any]:
    """
    v4.1 强执行校验门禁：
    1. 字段级白名单检查：彻底禁止新旧结构混用（即使存在 visual_choreography，出现 data/cards/type 等旧字段也直接报错）
    2. 统一元素预算口径：1 个 primary_object + 最多 3 个 secondary_objects = 最多 4 个主要视觉元素 (element_budget <= 4)
       （注：particle_system 内的粒子实例作为 collective_group 计为 1 个整体视觉元素）
    3. Renderer Registry 能力验证：检查每个镜头的 renderer_id、environment、primary_object、action、camera 和 payload 是否在注册表中真实支持
    4. 严格 phrase_anchor 校验：每个动作必须匹配口播原文、严禁重复锚定、顺序必须单调递增
    5. Hero Scene 样板指定校验：检查 hero_scene_id 是否有效
    """
    if not storyboard_path.exists():
        print("\n" + "=" * 78)
        print("[✗] 致命错误: 未找到正式分镜文件 workspace/storyboard.json！")
        print("    repo-to-video v4.1 严禁自动降级生成简化版默认分镜。")
        print("    请严格按五阶段流程依次执行：")
        print("      1. Scriptwriter (agents/scriptwriter.md) -> workspace/script_draft.json")
        print("      2. Visual Director (agents/visual_director.md) -> workspace/storyboard.json")
        print("      3. Motion Designer (agents/motion_designer.md) -> 绑定与扩展 Renderer Registry")
        print("=" * 78 + "\n")
        sys.exit(1)

    try:
        data = json.loads(storyboard_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[✗] 分镜 JSON 解析失败 ({storyboard_path}): {e}")
        sys.exit(1)

    manifest = load_registry_manifest()
    supported_envs = set(manifest.get("supported_environments", {}).keys())
    supported_cameras = set(manifest.get("supported_cameras", []))
    renderers_map = {r["id"]: r for r in manifest.get("renderers", [])}
    budget_policy = manifest.get("element_budget_policy", {})
    max_total_elements = budget_policy.get("max_total_major_elements", 4)
    max_sec_objs = budget_policy.get("max_secondary_objects", 3)
    max_overlays = budget_policy.get("max_text_overlays", 2)

    errors: List[str] = []
    warnings: List[str] = []

    # 顶层白名单检查
    unknown_top = set(data.keys()) - ALLOWED_TOP_KEYS
    if unknown_top:
        errors.append(f"Storyboard 顶层包含未授权字段: {sorted(unknown_top)}（请使用严格 v4.1 Schema）。")

    scenes = data.get("scenes")
    if not isinstance(scenes, list) or len(scenes) == 0:
        print("[✗] 分镜校验失败: 'scenes' 必须是非空数组。")
        sys.exit(1)

    scene_ids = [s.get("id") for s in scenes if isinstance(s, dict) and s.get("id")]
    hero_scene_id = data.get("hero_scene_id")
    if hero_scene_id and hero_scene_id not in scene_ids:
        errors.append(f"顶层指定的 hero_scene_id='{hero_scene_id}' 不在 scenes 列表 {scene_ids} 中。")
    elif not hero_scene_id:
        warnings.append(
            "未显式指定顶层 'hero_scene_id'，系统将自动选取动作最丰富的核心机制镜头作为样板审核对象。"
        )

    from tts_generator import validate_and_locate_phrase_anchors

    for idx, scene in enumerate(scenes):
        sid = scene.get("id") or f"scene_{idx + 1}"
        prefix = f"Scene[{idx + 1}:{sid}]"

        # 1. 字段级白名单检查（杜绝旧版卡片结构混入）
        scene_keys = set(scene.keys())
        forbidden_found = scene_keys.intersection(FORBIDDEN_LEGACY_KEYS)
        if forbidden_found:
            errors.append(
                f"{prefix} 检测到被禁止的旧版卡片/模板字段 {sorted(forbidden_found)}！"
                f"v4.1 采用严格字段级白名单，严禁新旧结构混用。"
            )
        unknown_scene_keys = scene_keys - ALLOWED_SCENE_KEYS - FORBIDDEN_LEGACY_KEYS
        if unknown_scene_keys:
            errors.append(f"{prefix} 包含未知字段 {sorted(unknown_scene_keys)}。")

        narration = (scene.get("narration") or "").strip()
        if not narration:
            errors.append(f"{prefix} 缺少口播文案 'narration'。")

        visual_intent = (scene.get("visual_intent") or "").strip()
        if not visual_intent:
            errors.append(f"{prefix} 缺少 'visual_intent'。")

        # 2. art_direction 与统一元素预算 (<= 4) 校验
        art = scene.get("art_direction")
        if not isinstance(art, dict):
            errors.append(f"{prefix} 缺少 'art_direction' 对象。")
        else:
            unknown_art = set(art.keys()) - ALLOWED_ART_KEYS
            if unknown_art:
                errors.append(f"{prefix}.art_direction 包含未知字段 {sorted(unknown_art)}。")
            for req_key in ("style", "lighting", "material", "accent_color"):
                if not art.get(req_key):
                    errors.append(f"{prefix}.art_direction 缺少必填字段 '{req_key}'。")
            accent = str(art.get("accent_color", ""))
            if accent and not re.match(r"^#[0-9A-Fa-f]{6}$", accent):
                errors.append(f"{prefix}.art_direction.accent_color ('{accent}') 必须是 6 位 HEX 颜色。")
            budget = art.get("element_budget", max_total_elements)
            if isinstance(budget, (int, float)) and budget > max_total_elements:
                errors.append(
                    f"{prefix}.art_direction.element_budget={budget} 超出统一元素预算上限 (<= {max_total_elements}，即 1 主物体 + 最多 3 次要物体)。"
                )

        # 3. visual_world 与 environment 校验
        world = scene.get("visual_world")
        primary_id = ""
        if not isinstance(world, dict):
            errors.append(f"{prefix} 缺少 'visual_world' 对象。")
        else:
            unknown_world = set(world.keys()) - ALLOWED_WORLD_KEYS
            if unknown_world:
                errors.append(f"{prefix}.visual_world 包含未知字段 {sorted(unknown_world)}。")
            env = world.get("environment")
            if not env:
                errors.append(f"{prefix}.visual_world 缺少 'environment'。")
            elif env not in supported_envs:
                errors.append(
                    f"{prefix}.visual_world.environment='{env}' 未在 registry_manifest.json 中注册！支持列表: {sorted(supported_envs)}"
                )

            primary_id = normalize_obj_id(world.get("primary_object"))
            if not primary_id:
                errors.append(f"{prefix}.visual_world 缺少有效的 'primary_object'。")

            sec_objs = world.get("secondary_objects")
            if not isinstance(sec_objs, list) or len(sec_objs) == 0:
                errors.append(f"{prefix}.visual_world.secondary_objects 必须是非空列表。")
            elif len(sec_objs) > max_sec_objs:
                errors.append(
                    f"{prefix}.visual_world.secondary_objects 数量 ({len(sec_objs)}) 超过上限 ({max_sec_objs})！"
                    f"加上 1 个主物体后总主要元素不得超过 {max_total_elements} 个（粒子群作为单一集合体计为 1 个元素）。"
                )

        # 4. Renderer Registry 匹配与 visual_choreography 能力验证
        choreo = scene.get("visual_choreography")
        if not isinstance(choreo, list) or len(choreo) == 0:
            errors.append(f"{prefix} 缺少 'visual_choreography' 动作节拍序列。")
        else:
            # 匹配 Renderer
            explicit_rid = scene.get("renderer_id")
            matched_renderer = None
            if explicit_rid:
                if explicit_rid not in renderers_map:
                    errors.append(
                        f"{prefix} 指定的 renderer_id='{explicit_rid}' 未在 Renderer Registry 中注册！可用组件: {sorted(renderers_map.keys())}"
                    )
                else:
                    matched_renderer = renderers_map[explicit_rid]
            else:
                # 根据 primary_object 与 actions 查找能力匹配的 Renderer
                best_r = None
                best_score = 0
                for r in renderers_map.values():
                    score = 0
                    if primary_id in r["supportedObjects"]:
                        score += 5
                    for b in choreo:
                        if isinstance(b, dict) and b.get("action") in r["supportedActions"]:
                            score += 3
                    if score > best_score:
                        best_score = score
                        best_r = r
                matched_renderer = best_r
                if not matched_renderer:
                    errors.append(
                        f"{prefix} 的 primary_object='{primary_id}' 与动作未匹配到任何已注册的 SceneRenderer！"
                        f"请由 Motion Designer 在 templates/src/registry/ 中开发并注册新组件。"
                    )
                else:
                    scene["renderer_id"] = matched_renderer["id"]

            # 逐个节拍校验字段白名单、action 支持度、camera 支持度、yielding 与 payload
            for b_idx, beat in enumerate(choreo):
                b_prefix = f"{prefix}.visual_choreography[{b_idx}]"
                if not isinstance(beat, dict):
                    errors.append(f"{b_prefix} 必须是对象。")
                    continue
                unknown_beat = set(beat.keys()) - ALLOWED_BEAT_KEYS
                if unknown_beat:
                    errors.append(f"{b_prefix} 包含未知字段 {sorted(unknown_beat)}。")

                for req_b in ("beat", "phrase_anchor", "action", "target", "description", "camera"):
                    if not beat.get(req_b):
                        errors.append(f"{b_prefix} 缺少必填字段 '{req_b}'。")

                act = beat.get("action")
                if matched_renderer and act and act not in matched_renderer["supportedActions"]:
                    errors.append(
                        f"{b_prefix}.action='{act}' 不被渲染组件 '{matched_renderer['id']}' 支持！"
                        f"该组件支持的动作为: {matched_renderer['supportedActions']}。"
                        f"请由 Motion Designer 扩展组件能力或切换匹配的 renderer_id。"
                    )

                cam = beat.get("camera")
                if cam and cam not in supported_cameras:
                    errors.append(
                        f"{b_prefix}.camera='{cam}' 不在受支持的相机运镜列表 {sorted(supported_cameras)} 中。"
                    )

                if len(choreo) > 1 and not beat.get("yielding"):
                    errors.append(
                        f"{b_prefix} 缺少必填的 'yielding'（镜头让位指令）！多节拍镜头必须明确声明非焦点元素如何让位。"
                    )

                payload = beat.get("payload")
                if payload is not None:
                    if not isinstance(payload, dict):
                        errors.append(f"{b_prefix}.payload 必须是对象。")
                    elif matched_renderer:
                        allowed_payload_keys = set(matched_renderer.get("payloadSchema", []))
                        invalid_p_keys = set(payload.keys()) - allowed_payload_keys
                        if invalid_p_keys:
                            errors.append(
                                f"{b_prefix}.payload 包含组件 '{matched_renderer['id']}' 未消费的参数 {sorted(invalid_p_keys)}！"
                                f"支持的参数为: {sorted(allowed_payload_keys)}"
                            )

            # 5. 校验 phrase_anchor 与口播文本的严格匹配与单调顺序
            if narration:
                try:
                    validate_and_locate_phrase_anchors(sid, narration, choreo)
                except ValueError as ve:
                    errors.append(str(ve))

        # 6. text_overlays 校验
        overlays = scene.get("text_overlays")
        if overlays is not None:
            if not isinstance(overlays, list):
                errors.append(f"{prefix}.text_overlays 必须是数组。")
            elif len(overlays) > max_overlays:
                errors.append(
                    f"{prefix}.text_overlays 数量 ({len(overlays)}) 超过上限 ({max_overlays})，严禁在画面堆砌说明文字。"
                )

    if warnings:
        print("\n[!] 视觉编排规范提示 (Warnings):")
        for w in warnings:
            print(f"    - {w}")

    if errors:
        print("\n" + "=" * 78)
        print(f"[✗] v4.1 可执行视觉编排校验未通过，共发现 {len(errors)} 处阻断问题：")
        for err in errors:
            print(f"    ✗ {err}")
        print("\n请由 Visual Director 与 Motion Designer 协同修复 workspace/storyboard.json 后重试。")
        print("=" * 78 + "\n")
        sys.exit(1)

    # 若写回了自动解析的 renderer_id，保存更新
    storyboard_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[✓] v4.1 可执行视觉编排与 Renderer Registry 校验通过! 共 {len(scenes)} 个镜头。")
    return data


def select_hero_scene(scenes: List[Dict[str, Any]], explicit_hero_id: str = None) -> Dict[str, Any]:
    """
    选取最具代表性的核心机制样板镜头 (Hero Scene)：
    优先使用 Visual Director 显式指定的 hero_scene_id；
    若未指定，自动选择非纯排版类、动作节拍最丰富的核心机制镜头（而非机械选择第 1 幕开场标题）。
    """
    if explicit_hero_id:
        for s in scenes:
            if s.get("id") == explicit_hero_id:
                return s

    best_scene = scenes[0]
    best_score = -1
    for s in scenes:
        rid = s.get("renderer_id", "")
        beats_count = len(s.get("visual_choreography") or [])
        score = beats_count * 10
        if rid in ("PhysicalSimulation", "MechanicalStructure", "DataFlow"):
            score += 25
        elif rid == "KineticTypography":
            score -= 30
        if score > best_score:
            best_score = score
            best_scene = s
    return best_scene


def audit_storyboard_facts(profile: dict, storyboard_path: Path):
    """核验分镜剧本中的 GitHub Star 数等关键指标是否与 GitHub API 实时数据一致"""
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
        print(f"[!] 文案审查门禁修正了 {fixes} 处过时 Star 数字 -> {stars_fmt}")
    else:
        print(f"[✓] 文案数字审查通过: 当前实时 Star 数为 {stars:,} ({stars_fmt})")


def main():
    parser = argparse.ArgumentParser(description="repo-to-video v4.1 Executable Visual Choreography runner")
    parser.add_argument("--repo", required=True, help="Target repository directory or URL")
    parser.add_argument("--workspace", default="workspace", help="Workspace folder for assets")
    parser.add_argument("--tts-url", default="http://192.168.8.106:8712/tts", help="Index-TTS URL")
    parser.add_argument("--voice", default="yali.wav", help="Index-TTS voice timbre (default: yali.wav)")
    parser.add_argument("--emo-alpha", type=float, default=1.0, help="Emotion alpha factor")
    parser.add_argument("--speed", type=float, default=0.9, help="Speech speed factor (default: 0.9)")
    parser.add_argument("--fps", type=int, default=30, help="Target FPS")
    parser.add_argument(
        "--hero-shot",
        "--first-shot",
        dest="hero_shot",
        action="store_true",
        help="Hero Shot Approval mode: build & render the designated hero_scene_id benchmark shot first",
    )
    parser.add_argument("--pilot", action="store_true", help="Build only the pilot cut (~30s preview)")
    parser.add_argument("--pilot-scenes", type=int, default=3, help="Max scenes to include in pilot preview")
    parser.add_argument("--render-pilot", action="store_true", help="Render out/pilot.mp4 automatically")
    parser.add_argument("--run-qa", action="store_true", help="Run 4-layer visual_qa.py after build")
    args = parser.parse_args()

    workspace_dir = Path(args.workspace).resolve()
    workspace_dir.mkdir(parents=True, exist_ok=True)
    audio_dir = workspace_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    # 1. 扫描仓库
    print("\n=== [1/5] 分析目标仓库与实时 GitHub 数据核查 ===")
    from analyze_repo import analyze_repository
    profile = analyze_repository(args.repo)
    profile_path = workspace_dir / "repo_profile.json"
    profile_path.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[+] 项目类型判定: {profile['type']}")

    # 2. 严格执行 v4.1 字段级白名单与 Renderer Registry 能力校验
    print("\n=== [2/5] 执行 v4.1 分镜白名单、Renderer Registry 与动作锚点校验 ===")
    storyboard_path = workspace_dir / "storyboard.json"
    storyboard_data = validate_storyboard_v4_1(storyboard_path)
    audit_storyboard_facts(profile, storyboard_path)

    # 确定代表性样板镜头 (Hero Scene)
    hero_scene_obj = select_hero_scene(
        storyboard_data["scenes"], storyboard_data.get("hero_scene_id")
    )
    hero_scene_id = hero_scene_obj["id"]
    print(
        f"[+] 选定代表性样板审核镜头 (Hero Shot): '{hero_scene_id}' (Renderer: {hero_scene_obj.get('renderer_id')})"
    )

    # 3. 语音合成与双层时间锚点对齐
    print(f"\n=== [3/5] 短语级分段配音与声学强制对齐 (语速: {args.speed}x) ===")
    from tts_generator import process_storyboard
    target_sid = hero_scene_id if args.hero_shot else None
    max_scenes = args.pilot_scenes if (args.pilot and not args.hero_shot) else None

    process_storyboard(
        storyboard_path=str(storyboard_path),
        output_dir=str(audio_dir),
        tts_url=args.tts_url,
        voice=args.voice,
        emo_alpha=args.emo_alpha,
        speed=args.speed,
        fps=args.fps,
        allow_fallback=True,
        max_scenes=max_scenes,
        target_scene_id=target_sid,
    )

    # 4. 组装 Remotion 配置与 Motion Plan
    print("\n=== [4/5] 组装可执行视觉编排配置 (build_props.json & motion_plan.json) ===")
    storyboard_data = json.loads(storyboard_path.read_text(encoding="utf-8"))
    durations_data = json.loads((audio_dir / "durations.json").read_text(encoding="utf-8"))
    dur_by_id = {d["scene_id"]: d for d in durations_data["scenes"]}

    for target_pub in [
        Path("public/audio").resolve(),
        (Path(__file__).parent.parent / "templates" / "public" / "audio").resolve(),
    ]:
        target_pub.mkdir(parents=True, exist_ok=True)
        for wav_file in audio_dir.glob("*.wav"):
            shutil.copy2(wav_file, target_pub / wav_file.name)

    assembled_scenes = []
    motion_plan_entries = []
    for s in storyboard_data["scenes"]:
        sid = s["id"]
        if sid not in dur_by_id:
            continue
        dur = dur_by_id[sid]
        assembled_scenes.append({
            **s,
            "type": "choreographed_v4",
            "durationInFrames": dur["frame_count"],
            "audioFrames": int(round(dur["duration_sec"] * args.fps)),
            "durationSec": dur["duration_sec"],
            "startFrame": dur["start_frame"],
            "audioUrl": f"audio/{dur['audio_file']}",
            "phrase_timings": dur.get("phrase_timings", []),
            "word_timings": dur.get("word_timings", []),
            "beat_timings": dur.get("beat_timings", []),
        })
        motion_plan_entries.append({
            "scene_id": sid,
            "renderer_id": s.get("renderer_id"),
            "environment": (s.get("visual_world") or {}).get("environment"),
            "primary_object": normalize_obj_id((s.get("visual_world") or {}).get("primary_object")),
            "beats": dur.get("beat_timings", []),
            "timing_warnings": dur.get("timing_warnings", []),
        })

    motion_plan_path = workspace_dir / "motion_plan.json"
    motion_plan_path.write_text(
        json.dumps(
            {
                "version": "4.1",
                "hero_scene_id": hero_scene_id,
                "scenes": motion_plan_entries,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[+] Motion Designer 执行计划已生成: {motion_plan_path}")

    global_art_direction = storyboard_data.get("global_art_direction") or {
        "aesthetic": "Premium Editorial Tech Explainer",
        "default_theme": "dark_cinematic",
        "lighting_preset": "soft_studio",
        "camera_philosophy": "continuous_narrative_flow",
        "max_element_budget": 4,
    }

    build_props = {
        "schemaVersion": "4.1",
        "title": storyboard_data.get("video_title") or profile.get("readme_title", profile["name"]),
        "repoName": storyboard_data.get("repo_name") or profile["name"],
        "repoUrl": storyboard_data.get("repo_url") or profile.get("repo_path", ""),
        "repoType": storyboard_data.get("repo_type") or profile["type"],
        "heroSceneId": hero_scene_id,
        "chapters": storyboard_data.get("chapters", []),
        "globalArtDirection": global_art_direction,
        "fps": args.fps,
        "totalFrames": durations_data["total_frames"],
        "scenes": assembled_scenes,
    }

    props_path = workspace_dir / "build_props.json"
    props_path.write_text(json.dumps(build_props, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[+] Remotion 配置文件构建完成: {props_path}")

    # 生成代表性样板镜头配置 (Hero Shot Approval)
    hero_assembled = next(
        (s for s in assembled_scenes if s["id"] == hero_scene_id),
        assembled_scenes[0] if assembled_scenes else None,
    )
    if hero_assembled:
        hero_shot_props = {
            **build_props,
            "totalFrames": hero_assembled.get("durationInFrames", 150),
            "scenes": [hero_assembled],
        }
        hero_shot_path = workspace_dir / "build_props.hero_shot.json"
        first_shot_path = workspace_dir / "build_props.first_shot.json"
        hero_json = json.dumps(hero_shot_props, ensure_ascii=False, indent=2)
        hero_shot_path.write_text(hero_json, encoding="utf-8")
        first_shot_path.write_text(hero_json, encoding="utf-8")
        print(f"[+] Hero Shot 样板审核配置已生成: {hero_shot_path} (镜头: {hero_assembled['id']})")

    if args.hero_shot:
        print(f"\n=== [5/5] [Hero Shot Approval] 渲染代表性样板镜头 ({hero_scene_id}) 并执行四层 QA ===")
        from visual_qa import run_visual_qa
        qa_dir = Path("out/qa").resolve()
        run_visual_qa(
            props_path=workspace_dir / "build_props.hero_shot.json",
            output_dir=qa_dir,
            mode="hero-shot",
            render_video_out=Path("out/hero_shot.mp4").resolve(),
        )
        print("\n✅ 代表性样板镜头已生成！请检查 out/hero_shot.mp4 与 out/qa/hero_shot_sheet.png。")
        return

    if args.run_qa:
        print("\n=== [5/5] 正在执行全片四层视觉 QA (Schema + Render + Motion + Semantic QA) ===")
        from visual_qa import run_visual_qa
        qa_dir = Path("out/qa").resolve()
        run_visual_qa(
            props_path=props_path,
            output_dir=qa_dir,
            mode="full",
        )

    print("\n✨ v4.1 全流程构建准备完毕！")


if __name__ == "__main__":
    main()
