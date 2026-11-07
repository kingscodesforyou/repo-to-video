#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
visual_qa.py (v4) - 首镜样板审核 (First Shot Approval) 与全片 Contact Sheet + 连续帧视觉 QA 工具
借鉴 video-talkcraft 的首镜确认、静帧抽样、连续动作帧检测与独立审片机制。
"""

import os
import sys
import json
import math
import shutil
import argparse
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional


def resolve_remotion_workdir() -> Path:
    """定位包含 src/index.ts 与 package.json 的 Remotion 工作目录"""
    cwd = Path.cwd().resolve()
    if (cwd / "src" / "index.ts").exists():
        return cwd
    script_root = Path(__file__).parent.parent.resolve()
    templates_dir = script_root / "templates"
    if (templates_dir / "src" / "index.ts").exists():
        return templates_dir
    return cwd


def render_still_frame(
    remotion_dir: Path,
    composition_id: str,
    props_path: Path,
    frame: int,
    out_png: Path
) -> bool:
    """调用 npx remotion still 渲染单帧 PNG"""
    out_png.parent.mkdir(parents=True, exist_ok=True)
    cmd = (
        f'npx remotion still src/index.ts {composition_id} "{out_png}" '
        f'--props="{props_path}" --frame={max(0, int(frame))}'
    )
    res = subprocess.run(cmd, cwd=str(remotion_dir), shell=True)
    return res.returncode == 0 and out_png.exists()


def compute_image_diff_score(img_a: Path, img_b: Path) -> float:
    """
    计算两张关键帧之间的视觉变化率 (0.0 ~ 100.0)：
    用于检测镜头是否冻结 (Frozen Shot: diff < 0.3) 或发生异常闪烁跳变。
    """
    if not img_a.exists() or not img_b.exists():
        return -1.0
    try:
        from PIL import Image, ImageChops, ImageStat
        with Image.open(img_a) as im1, Image.open(img_b) as im2:
            s1 = im1.convert("RGB").resize((320, 180))
            s2 = im2.convert("RGB").resize((320, 180))
            diff = ImageChops.difference(s1, s2)
            stat = ImageStat.Stat(diff)
            mean_diff = sum(stat.mean) / 3.0
            return round((mean_diff / 255.0) * 100.0, 2)
    except Exception:
        # 若未安装 Pillow，通过文件字节指纹粗略判断完全相同帧
        b1 = img_a.read_bytes()
        b2 = img_b.read_bytes()
        return 0.0 if b1 == b2 else 5.0


def build_contact_sheet_image(
    items: List[Dict[str, Any]],
    out_sheet_path: Path,
    columns: int = 3,
    title: str = "repo-to-video v4 Visual QA Contact Sheet"
):
    """
    将抽样关键帧拼接为带场景 ID、节拍名称与帧号标注的 Contact Sheet 审片大图。
    优先使用 Pillow 绘制高可读性审片标注，若无 Pillow 则自动降级使用 ffmpeg tile 滤镜。
    """
    valid_items = [it for it in items if Path(it["image_path"]).exists()]
    if not valid_items:
        return

    out_sheet_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        from PIL import Image, ImageDraw
        thumb_w, thumb_h = 640, 360
        pad = 24
        header_h = 68
        label_h = 44
        cols = max(1, min(columns, len(valid_items)))
        rows = int(math.ceil(len(valid_items) / float(cols)))

        canvas_w = pad + cols * (thumb_w + pad)
        canvas_h = header_h + pad + rows * (thumb_h + label_h + pad)

        sheet = Image.new("RGB", (canvas_w, canvas_h), (11, 13, 18))
        draw = ImageDraw.Draw(sheet)
        draw.text((pad, 22), title, fill=(243, 244, 246))

        for idx, item in enumerate(valid_items):
            r = idx // cols
            c = idx % cols
            x = pad + c * (thumb_w + pad)
            y = header_h + pad + r * (thumb_h + label_h + pad)

            with Image.open(item["image_path"]) as im:
                thumb = im.convert("RGB").resize((thumb_w, thumb_h))
                sheet.paste(thumb, (x, y))

            draw.rectangle(
                [x, y + thumb_h, x + thumb_w, y + thumb_h + label_h],
                fill=(20, 24, 34),
                outline=(45, 55, 72),
            )
            caption = f"{item['scene_id']} | {item['tag']} (f={item['frame']})"
            draw.text((x + 12, y + thumb_h + 13), caption, fill=(203, 213, 225))

        sheet.save(out_sheet_path)
        print(f"[+] Contact Sheet 已生成: {out_sheet_path} ({len(valid_items)} 帧)")
        return
    except Exception:
        pass

    # Fallback: 使用 ffmpeg tile 滤镜拼接
    try:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ffmpeg = "ffmpeg"

    cols = max(1, min(columns, len(valid_items)))
    rows = int(math.ceil(len(valid_items) / float(cols)))
    inputs = []
    for it in valid_items:
        inputs.extend(["-i", str(it["image_path"])])
    n = len(valid_items)
    filter_in = "".join([f"[{i}:v]scale=640:360[v{i}];" for i in range(n)])
    concat_in = "".join([f"[v{i}]" for i in range(n)])
    filter_complex = f"{filter_in}{concat_in}xstack=inputs={n}:layout="
    layouts = []
    for idx in range(n):
        r = idx // cols
        c = idx % cols
        layouts.append(f"{c * 640}_{r * 360}")
    filter_complex += "|".join(layouts) + "[out]"

    subprocess.run(
        [ffmpeg, "-y", *inputs, "-filter_complex", filter_complex, "-map", "[out]", str(out_sheet_path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if out_sheet_path.exists():
        print(f"[+] Contact Sheet (ffmpeg) 已生成: {out_sheet_path}")


def audit_scene_structure(scene: Dict[str, Any]) -> List[str]:
    """静态检查单镜头的审美规范、元素预算与镜头让位配置"""
    issues = []
    sid = scene.get("id", "unknown")
    art = scene.get("art_direction") or {}
    world = scene.get("visual_world") or {}
    choreo = scene.get("visual_choreography") or []
    overlays = scene.get("text_overlays") or []

    if not choreo:
        issues.append(f"[{sid}] 缺少 visual_choreography 动作节拍定义。")
    else:
        yielding_count = sum(1 for b in choreo if b.get("yielding"))
        if len(choreo) > 1 and yielding_count == 0:
            issues.append(f"[{sid}] 多节拍镜头未声明任何 'yielding' (镜头让位规则)，存在主次元素争抢焦点风险。")

    sec_objs = world.get("secondary_objects") or []
    if len(sec_objs) > 4:
        issues.append(f"[{sid}] secondary_objects 数量 ({len(sec_objs)}) 超过 4 个，违反元素预算限制。")

    if len(overlays) > 3:
        issues.append(f"[{sid}] text_overlays 数量 ({len(overlays)}) 超过 3 条，存在 PPT 化风险。")

    if not art.get("accent_color"):
        issues.append(f"[{sid}] 未指定唯一主强调色 accent_color。")

    return issues


def run_visual_qa(
    props_path: Path,
    output_dir: Path,
    mode: str = "full",
    render_video_out: Optional[Path] = None,
    render_frames: bool = True
) -> Dict[str, Any]:
    """
    执行视觉 QA：
    - mode="first-shot": 首镜样板审核，渲染第 1 镜短视频 + 各节拍关键帧审片单
    - mode="full": 全片每个镜头的 Start/Mid/End 关键帧 Contact Sheet + 关键过渡连续帧抽样
    """
    props_path = props_path.resolve()
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = output_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    props = json.loads(props_path.read_text(encoding="utf-8"))
    scenes = props.get("scenes", [])
    if not scenes:
        raise ValueError(f"No scenes in {props_path}")

    if mode == "first-shot":
        scenes = scenes[:1]

    remotion_dir = resolve_remotion_workdir()

    # 若为 first-shot 模式且请求渲染样板视频
    if mode == "first-shot" and render_video_out is not None:
        render_video_out.parent.mkdir(parents=True, exist_ok=True)
        print(f"🎬 正在渲染首镜样板视频: {render_video_out} ...")
        cmd = f'npx remotion render src/index.ts TutorialVideo "{render_video_out}" --props="{props_path}"'
        subprocess.run(cmd, cwd=str(remotion_dir), shell=True, check=False)

    contact_items: List[Dict[str, Any]] = []
    scene_reports: List[Dict[str, Any]] = []
    all_issues: List[str] = []

    acc_frame = 0
    for idx, scene in enumerate(scenes):
        sid = scene.get("id", f"scene_{idx + 1}")
        dur = int(scene.get("durationInFrames", 90))
        start_f = acc_frame
        end_f = acc_frame + dur

        # 抽样 Start (15%), Mid (50%), End (85%) 关键帧
        f_start = start_f + max(4, int(dur * 0.15))
        f_mid = start_f + int(dur * 0.50)
        f_end = start_f + min(dur - 6, int(dur * 0.85))

        sample_points = [
            ("Start", f_start),
            ("Mid", f_mid),
            ("End", f_end),
        ]

        # 若为首镜样板模式，额外抽样每个动作节拍 (beat) 的中心帧
        beat_timings = scene.get("beat_timings") or []
        if mode == "first-shot" and beat_timings:
            sample_points = []
            for b in beat_timings:
                b_mid = start_f + int(b.get("mid_frame", dur // 2))
                sample_points.append((f"Beat:{b.get('beat', 'action')}", b_mid))

        rendered_paths: List[Path] = []
        for tag, abs_frame in sample_points:
            safe_tag = tag.replace(":", "_").replace(" ", "_")
            png_path = frames_dir / f"{sid}_{safe_tag}_f{abs_frame}.png"
            if render_frames:
                print(f"   [📸] 抽样关键帧: {sid} [{tag}] @ frame {abs_frame}")
                render_still_frame(remotion_dir, "TutorialVideo", props_path, abs_frame, png_path)
            rendered_paths.append(png_path)
            contact_items.append({
                "scene_id": sid,
                "tag": tag,
                "frame": abs_frame,
                "image_path": str(png_path),
            })

        # 对包含多个节拍的关键镜头额外抽样节拍交界处的连续帧 (防止跳变与穿帮)
        continuous_items: List[Dict[str, Any]] = []
        if len(beat_timings) >= 2 and render_frames:
            transition_frame = start_f + int(beat_timings[0].get("end_frame", dur // 2))
            for delta in (-4, 0, 4):
                cf = max(start_f + 2, min(end_f - 2, transition_frame + delta))
                c_png = frames_dir / f"{sid}_cont_f{cf}.png"
                render_still_frame(remotion_dir, "TutorialVideo", props_path, cf, c_png)
                continuous_items.append({
                    "scene_id": sid,
                    "tag": f"Transition({delta:+d}f)",
                    "frame": cf,
                    "image_path": str(c_png),
                })
            if continuous_items:
                strip_path = output_dir / f"continuous_{sid}.png"
                build_contact_sheet_image(
                    continuous_items,
                    strip_path,
                    columns=3,
                    title=f"Continuous Transition Audit: {sid}"
                )

        # 计算 Start -> Mid -> End 运动变化率，检查是否存在 Frozen Shot
        motion_diffs = []
        for i in range(len(rendered_paths) - 1):
            d_score = compute_image_diff_score(rendered_paths[i], rendered_paths[i + 1])
            if d_score >= 0:
                motion_diffs.append(d_score)

        structural_issues = audit_scene_structure(scene)
        if motion_diffs and max(motion_diffs) < 0.25:
            structural_issues.append(
                f"[{sid}] 检测到画面疑似静止 (Frozen Shot: 最大帧间差异仅 {max(motion_diffs)}%)，请检查动效是否真正执行！"
            )

        all_issues.extend(structural_issues)
        scene_reports.append({
            "scene_id": sid,
            "title": scene.get("title", ""),
            "visual_intent": scene.get("visual_intent", ""),
            "style": (scene.get("art_direction") or {}).get("style", ""),
            "accent_color": (scene.get("art_direction") or {}).get("accent_color", ""),
            "beats_count": len(scene.get("visual_choreography") or []),
            "motion_diff_scores": motion_diffs,
            "issues": structural_issues,
            "status": "PASS" if not structural_issues else "WARN",
        })

        acc_frame = end_f

    sheet_name = "first_shot_sheet.png" if mode == "first-shot" else "contact_sheet.png"
    sheet_path = output_dir / sheet_name
    build_contact_sheet_image(
        contact_items,
        sheet_path,
        columns=3,
        title=f"repo-to-video v4 {'First Shot Approval' if mode == 'first-shot' else 'Full Contact Sheet'} ({props.get('repoName', '')})"
    )

    report = {
        "mode": mode,
        "repo_name": props.get("repoName", ""),
        "schema_version": props.get("schemaVersion", "4.0"),
        "contact_sheet": str(sheet_path),
        "total_scenes_checked": len(scene_reports),
        "overall_status": "APPROVED" if not all_issues else "NEEDS_REVIEW",
        "issues_count": len(all_issues),
        "issues": all_issues,
        "scenes": scene_reports,
    }

    report_path = output_dir / "visual_qa_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # 同步保存一份到 workspace 目录便于主流程读取
    ws_report = props_path.parent / "visual_qa_report.json"
    ws_report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n[✓] Visual QA ({mode}) 完成! 状态: {report['overall_status']}")
    print(f"    - 审片报告: {report_path}")
    print(f"    - Contact Sheet: {sheet_path}")
    if all_issues:
        print("    - 发现待关注问题:")
        for iss in all_issues:
            print(f"      ! {iss}")

    return report


def main():
    parser = argparse.ArgumentParser(description="repo-to-video v4 Visual QA & Contact Sheet generator")
    parser.add_argument("--props", required=True, help="Path to build_props.json or build_props.first_shot.json")
    parser.add_argument("--output-dir", default="out/qa", help="Output directory for Contact Sheet & QA report")
    parser.add_argument("--mode", choices=["first-shot", "full"], default="full", help="QA mode")
    parser.add_argument("--no-render-frames", action="store_true", help="Skip Remotion still rendering (structural & existing frame check only)")
    args = parser.parse_args()

    run_visual_qa(
        props_path=Path(args.props),
        output_dir=Path(args.output_dir),
        mode=args.mode,
        render_frames=not args.no_render_frames,
    )


if __name__ == "__main__":
    main()
