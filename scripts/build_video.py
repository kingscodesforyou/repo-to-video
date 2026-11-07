#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_video.py - 统筹运行流水线：分析仓库 -> 生成分镜 -> 语音合成 -> 组装 Remotion 配置
"""

import os
import sys
import json
import argparse
import subprocess
from pathlib import Path

# 确保脚本所在目录加入导入路径
sys.path.insert(0, str(Path(__file__).parent.resolve()))

def generate_default_storyboard(profile: dict, output_path: Path):
    """基于 repo profile 自动生成符合黄金法则的分镜结构"""
    repo_name = profile.get("name", "Project")
    repo_type = profile.get("type", "RUNNABLE")
    title = profile.get("readme_title", repo_name)
    summary = profile.get("summary", "一个实用的开源项目")
    features = profile.get("features", [])
    skills = profile.get("skills", [])

    scenes = []

    if repo_type == "SKILL":
        # 模式 B: Skill 项目
        scenes.append({
            "id": "scene_1_hook",
            "title": f"普通 AI 编程 vs 挂载 {repo_name}",
            "type": "compare",
            "narration": f"你是不是也遇到过让 AI 帮你写代码时，它天马行空胡乱改动，甚至漏掉关键测试？今天给你推荐一套 GitHub 爆火的 Agent 技能库：{repo_name}，彻底重构 AI 的开发纪律！",
            "data": {
                "before_title": "原生大模型",
                "before_text": "❌ 拿到任务直接写代码\n❌ 幻觉凭空编造函数\n❌ 没有任何单测验证\n❌ 改坏现有代码后交差",
                "after_title": f"挂载 {repo_name}",
                "after_text": "✅ 先写需求规范与设计方案\n✅ 遵循测试驱动开发(TDD)红绿循环\n✅ 4步系统化根因排查\n✅ 完成前运行真机验证测试"
            }
        })
        
        # 挑选 3-4 个核心技能
        top_skills = skills[:4]
        skill_details = "\n".join([f"- {s['name']}: {s['description'][:40]}..." for s in top_skills])
        scenes.append({
            "id": "scene_2_skills_overview",
            "title": f"{repo_name} 包含的核心 Superpowers",
            "type": "code_focus",
            "narration": f"整个仓库精挑细选了十五个顶级开发技能，涵盖测试驱动开发、系统化调试排障、以及多 Agent 并行分工。每一个技能都经过严密设计，采用渐进式上下文加载，绝不浪费你的 Token。",
            "data": {
                "code": skill_details or "Skills loaded successfully.",
                "language": "markdown"
            }
        })

        scenes.append({
            "id": "scene_3_anatomy",
            "title": "深入 SKILL 规范核心架构",
            "type": "code_focus",
            "narration": "我们来看它的实现机理。每一个 Skill 文件都包含严谨的 YAML 头部，清晰定义了触发时机与行为约束。AI 只有在满足条件时才会动态调入对应指令，既轻量又高效。",
            "data": {
                "code": "---\nname: systematic-debugging\ndescription: Use when encountering any bug or test failure before proposing fixes\n---\n\n## 4-Phase Root Cause Process\n1. Observe and reproduce the failure\n2. Trace root cause with evidence\n3. Implement defense-in-depth fix\n4. Verify tests pass\n",
                "language": "yaml"
            }
        })

        scenes.append({
            "id": "scene_4_install",
            "title": "一键克隆与部署至你的 IDE",
            "type": "terminal",
            "narration": "安装极其简单，只需要将整个仓库克隆到你的项目目录或者全局配置中，支持 Antigravity、Claude Code、Cursor 等各大主流智能体生态。",
            "data": {
                "commands": [
                    f"git clone https://github.com/obra/superpowers.git .agents/superpowers",
                    "agy --version",
                    "# Skills loaded automatically!"
                ]
            }
        })

        scenes.append({
            "id": "scene_5_outro",
            "title": f"立即体验 {repo_name}",
            "type": "title_card",
            "narration": "本期视频所有的演示与配置都在简介区开源。如果你也想让你的 AI 编程助手拥有超能力，赶紧去 GitHub 体验并给作者点个 Star 吧！",
            "data": {
                "headline": repo_name,
                "subheadline": "让你的 AI 拥有世界级工程师的开发纪律",
                "tag": "GitHub Trending | 开源神库推荐"
            }
        })

    else:
        # 模式 A: 可运行项目
        scenes.append({
            "id": "scene_1_hook",
            "title": f"开源神器：{repo_name}",
            "type": "title_card",
            "narration": f"今天要带大家盘点的是在 GitHub 上备受瞩目的开源项目：{title}。它解决了我们在实际开发中极其棘手的问题。",
            "data": {
                "headline": title,
                "subheadline": summary[:80],
                "tag": "GitHub 开源推荐"
            }
        })

        scenes.append({
            "id": "scene_2_architecture",
            "title": "项目特性与技术架构",
            "type": "code_focus",
            "narration": f"整个项目具有出色的架构设计。核心亮点包括：{', '.join(features[:3]) if features else '高并发、轻量化与模块化设计'}。",
            "data": {
                "code": json.dumps(features[:5], ensure_ascii=False, indent=2) if features else summary,
                "language": "json"
            }
        })

        scenes.append({
            "id": "scene_3_quickstart",
            "title": "保姆级环境安装与启动",
            "type": "terminal",
            "narration": "接下来进入保姆级实操环节。第一步克隆代码，第二步安装依赖并配置环境变量，最后一行命令启动服务。",
            "data": {
                "commands": [
                    f"git clone {profile.get('repo_path')} {repo_name}",
                    f"cd {repo_name}",
                    "npm install",
                    "npm run dev"
                ]
            }
        })

        scenes.append({
            "id": "scene_4_outro",
            "title": f"总结与开源体验",
            "type": "title_card",
            "narration": "以上就是本期教程的全部内容。如果觉得有帮助，别忘了点赞关注，代码与配置链接见视频下方评论区！",
            "data": {
                "headline": repo_name,
                "subheadline": "保姆级部署教程已完成",
                "tag": "记得点赞关注收藏"
            }
        })

    storyboard = {
        "repo_name": repo_name,
        "repo_type": repo_type,
        "scenes": scenes
    }
    output_path.write_text(json.dumps(storyboard, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[+] Default storyboard generated at: {output_path}")
    return storyboard

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


def audit_storyboard_facts(profile: dict, storyboard_path: Path):
    """
    强制文案数字审查门禁：
    核验分镜剧本中的 GitHub Star 数等关键指标是否与 GitHub API 实时数据一致，
    发现过时数字（如旧博文中的 48,000 星）时自动修正并打印审查报告。
    """
    gh = profile.get("github_stats") or {}
    stars = gh.get("stars")
    stars_fmt = gh.get("stars_formatted")
    if not stars or not storyboard_path.exists():
        return

    raw_text = storyboard_path.read_text(encoding="utf-8")
    updated_text = raw_text
    cn_stars = number_to_chinese_thousands(stars)

    # 检测常见的过时 Star 表述（如 48,000 / 48000 / 四万八千）
    stale_patterns = [
        (r"48,000\+?\s*Star", f"{stars_fmt} Star"),
        (r"48000\+?\s*Star", f"{stars_fmt} Star"),
        (r"四万八千多?颗?星", f"{cn_stars}颗星"),
        (r"四万八千星", f"{cn_stars}颗星"),
    ]
    fixes = 0
    for pat, repl in stale_patterns:
        import re
        if re.search(pat, updated_text, flags=re.I):
            updated_text = re.sub(pat, repl, updated_text, flags=re.I)
            fixes += 1

    if fixes > 0:
        storyboard_path.write_text(updated_text, encoding="utf-8")
        print(f"[!] 文案审查门禁拦截并修正了 {fixes} 处过时 Star 数字 -> 已更新为实时数据: {stars_fmt} ({cn_stars}颗星)")
    else:
        print(f"[✓] 文案数字审查通过: 当前实时 Star 数为 {stars:,} ({stars_fmt})")


def main():
    parser = argparse.ArgumentParser(description="End-to-end tutorial video build runner")
    parser.add_argument("--repo", required=True, help="Target repository directory or URL")
    parser.add_argument("--workspace", default="workspace", help="Workspace folder for assets")
    parser.add_argument("--tts-url", default="http://192.168.8.106:8712/tts", help="Index-TTS URL")
    parser.add_argument("--voice", default="yali.wav", help="Index-TTS voice timbre (default: yali.wav)")
    parser.add_argument("--emo-alpha", type=float, default=1.0, help="Emotion alpha factor")
    parser.add_argument("--speed", type=float, default=0.9, help="Speech speed factor (default: 0.9, i.e., 1/10 slower)")
    parser.add_argument("--fps", type=int, default=30, help="Target FPS")
    parser.add_argument("--pilot", action="store_true", help="Build only the pilot cut (~30s preview) instead of full video")
    parser.add_argument("--pilot-scenes", type=int, default=3, help="Max scenes to include in pilot preview (default: 3)")
    parser.add_argument("--render-pilot", action="store_true", help="Render out/pilot.mp4 automatically after assembling props")
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

    # 2. 生成与审查分镜
    print("\n=== [2/4] 生成与审查分镜剧本 ===")
    storyboard_path = workspace_dir / "storyboard.json"
    if not storyboard_path.exists():
        generate_default_storyboard(profile, storyboard_path)
    else:
        print(f"[i] 使用已存在的分镜剧本: {storyboard_path}")
    audit_storyboard_facts(profile, storyboard_path)

    # 3. 语音合成与时间对齐
    print(f"\n=== [3/4] 局域网 Index-TTS 配音与时序对齐 (语速: {args.speed}x) ===")
    from tts_generator import process_storyboard
    max_scenes = args.pilot_scenes if args.pilot else None
    durations = process_storyboard(
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

    # 自动将音频同步到 Remotion 的 public/audio 目录以供 staticFile 读取
    import shutil
    public_audio_dir = Path("public/audio").resolve()
    public_audio_dir.mkdir(parents=True, exist_ok=True)
    for wav_file in audio_dir.glob("*.wav"):
        shutil.copy2(wav_file, public_audio_dir / wav_file.name)

    # 整合各个 scene 的音频文件路径与帧时序
    assembled_scenes = []
    source_scenes = storyboard_data["scenes"][:len(durations_data["scenes"])]
    for s, dur in zip(source_scenes, durations_data["scenes"]):
        assembled_scenes.append({
            **s,
            "durationInFrames": dur["frame_count"],
            "audioFrames": int(round(dur["duration_sec"] * args.fps)),
            "durationSec": dur["duration_sec"],
            "startFrame": dur["start_frame"],
            "audioUrl": f"audio/{dur['audio_file']}"
        })

    build_props = {
        "title": storyboard_data.get("video_title") or profile.get("readme_title", profile["name"]),
        "repoName": storyboard_data.get("repo_name") or profile["name"],
        "repoType": storyboard_data.get("repo_type") or profile["type"],
        "chapters": storyboard_data.get("chapters", []),
        "fps": args.fps,
        "totalFrames": durations_data["total_frames"],
        "scenes": assembled_scenes
    }

    props_path = workspace_dir / "build_props.json"
    props_path.write_text(json.dumps(build_props, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[+] Remotion 配置文件构建完成: {props_path}")
    print(f"[+] 视频总帧数: {durations_data['total_frames']} 帧 ({durations_data['total_seconds']} 秒)")

    # 5. 生成 30 秒先导样片 (Pilot Checkpoint) 配置
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
        "scenes": pilot_scenes
    }
    pilot_props_path = workspace_dir / "build_props.pilot.json"
    pilot_props_path.write_text(json.dumps(pilot_props, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[+] 30秒先导片 (Pilot) 配置已生成: {pilot_props_path} ({len(pilot_scenes)} 场景, {round(pilot_frames/args.fps, 1)}秒)")

    if args.render_pilot:
        print("\n🎬 正在快速渲染 30 秒先导片: out/pilot.mp4 ...")
        render_cmd = f"npx remotion render src/index.ts PilotVideo out/pilot.mp4 --props={pilot_props_path}"
        subprocess.run(render_cmd, shell=True, check=True)
        print("✅ 先导片导出成功: out/pilot.mp4！请审核音色与节奏。")

    print("\n✨ 全流程准备完毕！你可以运行 Remotion 进行实时预览或导出视频！")

if __name__ == "__main__":
    main()
