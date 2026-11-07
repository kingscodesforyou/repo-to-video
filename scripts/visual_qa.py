#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
visual_qa.py (v4.1) - 四层可执行视觉审核系统 (Schema QA + Render QA + Motion QA + Semantic QA)
1. Schema QA: 校验 Renderer Registry 绑定、动作支持度、元素预算 (<= 4) 与 phrase_anchor
2. Render QA: 严格检查每一帧静帧与样板视频渲染返回状态及 PNG 文件完整性，任何缺帧直接判为失败
3. Motion QA: 抽样每一个动作节拍 (Beat) 的起/中/止关键帧 + 所有节拍交界处的连续帧，检测动作冻结与跳变
4. Semantic QA: 生成供 Visual QA Agent 审阅真实画面的五项必答语义审核表，未通过五项审美核验禁止交付
"""

import os
import sys
import json
import math
import argparse
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional

sys.path.insert(0, str(Path(__file__).parent.resolve()))

MANDATORY_SEMANTIC_QUESTIONS = [
    {
        "id": "blind_comprehension",
        "question": "1. 不看字幕，仅凭物体形态与空间动作能否理解这段动画表达的技术机制？",
    },
    {
        "id": "action_fidelity",
        "question": "2. 画面主体是否真正执行了文案描述的物理动作（如过滤分流、多面体结晶、多层拆解），而非简单方块平移？",
    },
    {
        "id": "anti_card_check",
        "question": "3. 是否彻底杜绝了用静态文字卡片、方框列表加箭头代替动画？",
    },
    {
        "id": "visual_restraint",
        "question": "4. 画面是否保持克制（单一主强调色、无廉价极光/光球、无底部冗余 description 说明卡片）？",
    },
    {
        "id": "shot_continuity",
        "question": "5. 动作节拍之间与相邻镜头之间的相机运动、空间透视是否自然连贯无跳切？",
    },
]


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


def verify_png_file(png_path: Path) -> bool:
    """验证渲染出的 PNG 文件真实存在、字节数正常且具有合法的 PNG 签名头"""
    if not png_path.exists():
        return False
    try:
        size = png_path.stat().st_size
        if size < 512:
            return False
        with open(png_path, "rb") as f:
            sig = f.read(8)
        return sig == b"\x89PNG\r\n\x1a\n"
    except Exception:
        return False


def render_still_frame(
    remotion_dir: Path,
    composition_id: str,
    props_path: Path,
    frame: int,
    out_png: Path
) -> bool:
    """调用 npx remotion still 渲染单帧 PNG，并严格验证输出文件完整性"""
    out_png.parent.mkdir(parents=True, exist_ok=True)
    cmd = (
        f'npx remotion still src/index.ts {composition_id} "{out_png}" '
        f'--props="{props_path}" --frame={max(0, int(frame))}'
    )
    res = subprocess.run(cmd, cwd=str(remotion_dir), shell=True)
    return res.returncode == 0 and verify_png_file(out_png)


def compute_image_diff_score(img_a: Path, img_b: Path) -> float:
    """计算两张关键帧之间的视觉变化率 (0.0 ~ 100.0)"""
    if not verify_png_file(img_a) or not verify_png_file(img_b):
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
        b1 = img_a.read_bytes()
        b2 = img_b.read_bytes()
        return 0.0 if b1 == b2 else 5.0


def build_contact_sheet_image(
    items: List[Dict[str, Any]],
    out_sheet_path: Path,
    columns: int = 3,
    title: str = "repo-to-video v4.1 Visual QA Contact Sheet"
) -> bool:
    """将抽样关键帧拼接为带场景 ID、节拍名称、动作与帧号标注的 Contact Sheet 审片大图"""
    valid_items = [it for it in items if verify_png_file(Path(it["image_path"]))]
    if not valid_items:
        return False

    out_sheet_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        from PIL import Image, ImageDraw
        thumb_w, thumb_h = 640, 360
        pad = 24
        header_h = 68
        label_h = 48
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
            draw.text((x + 12, y + thumb_h + 14), caption, fill=(203, 213, 225))

        sheet.save(out_sheet_path)
        print(f"[+] Contact Sheet 已生成: {out_sheet_path} ({len(valid_items)} 帧)")
        return verify_png_file(out_sheet_path)
    except Exception:
        pass

    try:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ffmpeg = "ffmpeg"

    cols = max(1, min(columns, len(valid_items)))
    inputs = []
    for it in valid_items:
        inputs.extend(["-i", str(it["image_path"])])
    n = len(valid_items)
    filter_in = "".join([f"[{i}:v]scale=640:360[v{i}];" for i in range(n)])
    concat_in = "".join([f"[v{i}]" for i in range(n)])
    layouts = [f"{(idx % cols) * 640}_{(idx // cols) * 360}" for idx in range(n)]
    filter_complex = f"{filter_in}{concat_in}xstack=inputs={n}:layout={'|'.join(layouts)}[out]"

    subprocess.run(
        [ffmpeg, "-y", *inputs, "-filter_complex", filter_complex, "-map", "[out]", str(out_sheet_path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return verify_png_file(out_sheet_path)


def run_schema_qa_layer(scene: Dict[str, Any], manifest: Dict[str, Any]) -> Dict[str, Any]:
    """第 1 层：Schema QA（校验注册组件、动作支持度、元素预算 <= 4 与让位规则）"""
    issues = []
    sid = scene.get("id", "unknown")
    art = scene.get("art_direction") or {}
    world = scene.get("visual_world") or {}
    choreo = scene.get("visual_choreography") or []
    overlays = scene.get("text_overlays") or []

    renderers_map = {r["id"]: r for r in manifest.get("renderers", [])}
    rid = scene.get("renderer_id")
    if not rid or rid not in renderers_map:
        issues.append(f"[{sid}] Schema QA: renderer_id='{rid}' 未在 Renderer Registry 中注册。")
    else:
        r_spec = renderers_map[rid]
        for b in choreo:
            act = b.get("action")
            if act not in r_spec["supportedActions"]:
                issues.append(f"[{sid}] Schema QA: 动作 '{act}' 不被组件 '{rid}' 支持。")

    sec_objs = world.get("secondary_objects") or []
    if len(sec_objs) > 3:
        issues.append(
            f"[{sid}] Schema QA: secondary_objects 数量 ({len(sec_objs)}) > 3，超出统一元素预算 (1 主物体 + 3 次要物体 <= 4)。"
        )

    if len(overlays) > 2:
        issues.append(f"[{sid}] Schema QA: text_overlays 数量 ({len(overlays)}) > 2。")

    if not art.get("accent_color"):
        issues.append(f"[{sid}] Schema QA: 未指定唯一主强调色 accent_color。")

    for b_idx, b in enumerate(choreo):
        if not b.get("phrase_anchor"):
            issues.append(f"[{sid}] Schema QA: Beat #{b_idx + 1} 缺少必填的 phrase_anchor。")
        if len(choreo) > 1 and not b.get("yielding"):
            issues.append(f"[{sid}] Schema QA: Beat #{b_idx + 1} 缺少必填的 yielding 镜头让位规则。")

    return {
        "layer": "Schema QA",
        "status": "PASS" if not issues else "FAIL",
        "issues": issues,
    }


def generate_semantic_qa_artifacts(
    scenes: List[Dict[str, Any]],
    output_dir: Path,
    contact_sheet_path: Path
) -> Dict[str, Any]:
    """
    第 4 层：Semantic QA（语义与审美独立审片清单生成与核验）
    生成 out/qa/semantic_qa_checklist.json 与 out/qa/semantic_qa_review.md，
    强制要求 Visual QA Agent 对照实际渲染出的 Contact Sheet 与连续帧逐项回答 5 个核心问题。
    """
    checklist_path = output_dir / "semantic_qa_checklist.json"
    review_md_path = output_dir / "semantic_qa_review.md"

    existing_verdicts = {}
    if checklist_path.exists():
        try:
            old_data = json.loads(checklist_path.read_text(encoding="utf-8"))
            for item in old_data.get("scenes", []):
                if item.get("agent_verified"):
                    existing_verdicts[item["scene_id"]] = item
        except Exception:
            pass

    semantic_scenes = []
    unverified_count = 0
    failed_semantic_issues = []

    md_lines = [
        "# Visual QA 第 4 层：Semantic QA 真实画面审美审片单 (v4.1)",
        "",
        f"- **全片 Contact Sheet 路径**: `{contact_sheet_path}`",
        "- **审核要求**: Visual QA Agent 必须使用 `read_file` 直接查看上述 Contact Sheet 图片及各镜头的 `continuous_<scene_id>.png` 连续帧图片，逐镜回答以下 5 个问题，并将 `semantic_qa_checklist.json` 中的 `agent_verified` 设为 `true`。",
        "",
    ]

    for s in scenes:
        sid = s.get("id", "unknown")
        prev = existing_verdicts.get(sid)
        if prev:
            semantic_scenes.append(prev)
            for q in MANDATORY_SEMANTIC_QUESTIONS:
                ans = prev.get("answers", {}).get(q["id"], {})
                if not ans.get("pass", False):
                    failed_semantic_issues.append(
                        f"[{sid}] Semantic QA 未通过 ({q['id']}): {ans.get('comment', '不合格')}"
                    )
        else:
            unverified_count += 1
            beats_summary = [
                f"Beat {i+1} [{b.get('beat')}]: anchor='{b.get('phrase_anchor')}' -> action={b.get('action')} on {b.get('target')} (camera={b.get('camera')})"
                for i, b in enumerate(s.get("visual_choreography") or [])
            ]
            entry = {
                "scene_id": sid,
                "renderer_id": s.get("renderer_id", ""),
                "narration": s.get("narration", ""),
                "visual_intent": s.get("visual_intent", ""),
                "expected_beats": beats_summary,
                "continuous_strip_image": str(output_dir / f"continuous_{sid}.png"),
                "agent_verified": False,
                "answers": {
                    q["id"]: {
                        "question": q["question"],
                        "pass": None,
                        "comment": "PENDING_VISUAL_QA_AGENT_INSPECTION",
                    }
                    for q in MANDATORY_SEMANTIC_QUESTIONS
                },
            }
            semantic_scenes.append(entry)

        md_lines.append(f"## 镜头 `{sid}` ({s.get('title', '')})")
        md_lines.append(f"- **渲染组件 (`renderer_id`)**: `{s.get('renderer_id')}`")
        md_lines.append(f"- **口播文案**: {s.get('narration')}")
        md_lines.append(f"- **视觉意图**: {s.get('visual_intent')}")
        md_lines.append(f"- **连续帧条带**: `{output_dir / f'continuous_{sid}.png'}`")
        md_lines.append("- **必答审美核验项**:")
        for q in MANDATORY_SEMANTIC_QUESTIONS:
            md_lines.append(f"  - [ ] {q['question']}")
        md_lines.append("")

    checklist_payload = {
        "version": "4.1",
        "contact_sheet": str(contact_sheet_path),
        "all_verified": unverified_count == 0 and len(failed_semantic_issues) == 0,
        "unverified_scenes_count": unverified_count,
        "scenes": semantic_scenes,
    }
    checklist_path.write_text(
        json.dumps(checklist_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    review_md_path.write_text("\n".join(md_lines), encoding="utf-8")

    status = "PASS"
    if failed_semantic_issues:
        status = "FAIL"
    elif unverified_count > 0:
        status = "PENDING_AGENT_REVIEW"

    return {
        "layer": "Semantic QA",
        "status": status,
        "checklist_path": str(checklist_path),
        "review_markdown_path": str(review_md_path),
        "unverified_scenes_count": unverified_count,
        "issues": failed_semantic_issues,
    }


def run_visual_qa(
    props_path: Path,
    output_dir: Path,
    mode: str = "full",
    render_video_out: Optional[Path] = None,
    render_frames: bool = True
) -> Dict[str, Any]:
    """
    执行 v4.1 四层视觉 QA：
    - Layer 1: Schema QA
    - Layer 2: Render QA (严格验证每一次静帧渲染返回码与 PNG 签名，任何失败直接阻断)
    - Layer 3: Motion QA (采样每个动作节拍的起/中/止帧 + 每个节拍交界处的连续帧)
    - Layer 4: Semantic QA (生成五问审片单，核验真实画面是否准确表达口播文案)
    """
    from build_video import load_registry_manifest

    props_path = props_path.resolve()
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = output_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    manifest = load_registry_manifest()
    props = json.loads(props_path.read_text(encoding="utf-8"))
    scenes = props.get("scenes", [])
    if not scenes:
        raise ValueError(f"No scenes in {props_path}")

    if mode in ("hero-shot", "first-shot"):
        hero_id = props.get("heroSceneId")
        if hero_id:
            matched = [s for s in scenes if s.get("id") == hero_id]
            scenes = matched if matched else scenes[:1]
        else:
            scenes = scenes[:1]

    remotion_dir = resolve_remotion_workdir()
    render_failures: List[str] = []

    if mode in ("hero-shot", "first-shot") and render_video_out is not None and render_frames:
        render_video_out.parent.mkdir(parents=True, exist_ok=True)
        print(f"🎬 正在渲染样板审核视频: {render_video_out} ...")
        cmd = f'npx remotion render src/index.ts TutorialVideo "{render_video_out}" --props="{props_path}"'
        res = subprocess.run(cmd, cwd=str(remotion_dir), shell=True)
        if res.returncode != 0 or not render_video_out.exists():
            render_failures.append(f"样板视频渲染失败: {render_video_out}")

    contact_items: List[Dict[str, Any]] = []
    scene_reports: List[Dict[str, Any]] = []
    all_issues: List[str] = []

    acc_frame = 0
    for idx, scene in enumerate(scenes):
        sid = scene.get("id", f"scene_{idx + 1}")
        dur = int(scene.get("durationInFrames", 120))
        start_f = acc_frame
        end_f = acc_frame + dur

        # Layer 1: Schema QA
        schema_qa = run_schema_qa_layer(scene, manifest)
        scene_issues = list(schema_qa["issues"])

        # Layer 2 & 3: 采样每个动作节拍 (Beat) 的 Start / Mid / End 关键帧
        beat_timings = scene.get("beat_timings") or []
        sample_points = []
        if beat_timings:
            for b in beat_timings:
                b_idx = b.get("beat_index", 0)
                b_name = b.get("beat", f"B{b_idx + 1}")
                b_start = start_f + max(2, int(b.get("start_frame", 0)) + 3)
                b_mid = start_f + int(b.get("mid_frame", dur // 2))
                b_end = start_f + min(dur - 3, max(4, int(b.get("end_frame", dur)) - 3))
                sample_points.append((f"B{b_idx+1}_{b_name}_Start", b_start, b_idx))
                sample_points.append((f"B{b_idx+1}_{b_name}_Mid", b_mid, b_idx))
                sample_points.append((f"B{b_idx+1}_{b_name}_End", b_end, b_idx))
        else:
            sample_points = [
                ("Scene_Start", start_f + max(4, int(dur * 0.15)), 0),
                ("Scene_Mid", start_f + int(dur * 0.50), 0),
                ("Scene_End", start_f + min(dur - 6, int(dur * 0.85)), 0),
            ]

        beat_frames_map: Dict[int, List[Path]] = {}
        for tag, abs_frame, b_idx in sample_points:
            safe_tag = tag.replace(":", "_").replace(" ", "_")
            png_path = frames_dir / f"{sid}_{safe_tag}_f{abs_frame}.png"
            if render_frames:
                print(f"   [📸] 抽样节拍关键帧: {sid} [{tag}] @ frame {abs_frame}")
                ok = render_still_frame(remotion_dir, "TutorialVideo", props_path, abs_frame, png_path)
                if not ok:
                    err_msg = f"[{sid}] Render QA 失败: 关键帧 {tag} (frame={abs_frame}) 渲染失败或 PNG 无效！"
                    render_failures.append(err_msg)
                    scene_issues.append(err_msg)
            beat_frames_map.setdefault(b_idx, []).append(png_path)
            contact_items.append({
                "scene_id": sid,
                "tag": tag,
                "frame": abs_frame,
                "image_path": str(png_path),
            })

        # 对每一个动作节拍交界处 (Beat Boundary) 抽样连续过渡帧 (-3f, 0f, +3f)
        continuous_items: List[Dict[str, Any]] = []
        if len(beat_timings) >= 2 and render_frames:
            for b_i in range(len(beat_timings) - 1):
                boundary_frame = start_f + int(beat_timings[b_i].get("end_frame", dur // 2))
                for delta in (-3, 0, 3):
                    cf = max(start_f + 2, min(end_f - 2, boundary_frame + delta))
                    c_png = frames_dir / f"{sid}_b{b_i+1}_to_b{b_i+2}_f{cf}.png"
                    ok = render_still_frame(remotion_dir, "TutorialVideo", props_path, cf, c_png)
                    if not ok:
                        err_msg = f"[{sid}] Render QA 失败: 节拍过渡连续帧 (frame={cf}) 渲染失败！"
                        render_failures.append(err_msg)
                        scene_issues.append(err_msg)
                    continuous_items.append({
                        "scene_id": sid,
                        "tag": f"B{b_i+1}->B{b_i+2}({delta:+d}f)",
                        "frame": cf,
                        "image_path": str(c_png),
                    })
            if continuous_items:
                strip_path = output_dir / f"continuous_{sid}.png"
                build_contact_sheet_image(
                    continuous_items,
                    strip_path,
                    columns=3,
                    title=f"Beat Transition Continuous Audit: {sid}",
                )

        # Layer 3: Motion QA (按每个节拍检查是否存在 Frozen Beat)
        motion_diffs = []
        for b_idx, p_list in beat_frames_map.items():
            if len(p_list) >= 2:
                d_score = compute_image_diff_score(p_list[0], p_list[-1])
                if d_score >= 0:
                    motion_diffs.append({"beat_index": b_idx, "diff_pct": d_score})
                    if d_score < 0.25:
                        scene_issues.append(
                            f"[{sid}] Motion QA 失败: Beat #{b_idx + 1} 画面静止 (Frozen Beat: 首尾帧差异仅 {d_score}%)！"
                        )

        all_issues.extend(scene_issues)
        scene_reports.append({
            "scene_id": sid,
            "renderer_id": scene.get("renderer_id", ""),
            "title": scene.get("title", ""),
            "visual_intent": scene.get("visual_intent", ""),
            "beats_count": len(scene.get("visual_choreography") or []),
            "schema_qa": schema_qa["status"],
            "motion_diffs": motion_diffs,
            "issues": scene_issues,
            "status": "PASS" if not scene_issues else "FAIL",
        })

        acc_frame = end_f

    sheet_name = "hero_shot_sheet.png" if mode in ("hero-shot", "first-shot") else "contact_sheet.png"
    sheet_path = output_dir / sheet_name
    sheet_ok = build_contact_sheet_image(
        contact_items,
        sheet_path,
        columns=3,
        title=f"repo-to-video v4.1 {'Hero Shot Approval' if mode in ('hero-shot', 'first-shot') else 'Full Beat Contact Sheet'} ({props.get('repoName', '')})",
    )
    if render_frames and not sheet_ok:
        render_failures.append(f"Contact Sheet 合成失败: {sheet_path}")
        all_issues.append(f"Render QA 失败: Contact Sheet 未成功生成 ({sheet_path})")

    # Layer 4: Semantic QA
    semantic_qa = generate_semantic_qa_artifacts(scenes, output_dir, sheet_path)
    all_issues.extend(semantic_qa["issues"])

    if render_failures:
        overall_status = "REJECTED_RENDER_FAILURE"
    elif all_issues:
        overall_status = "REJECTED_QA_ISSUES"
    elif semantic_qa["status"] == "PENDING_AGENT_REVIEW":
        overall_status = "PENDING_SEMANTIC_QA_REVIEW"
    else:
        overall_status = "APPROVED"

    report = {
        "version": "4.1",
        "mode": mode,
        "repo_name": props.get("repoName", ""),
        "hero_scene_id": props.get("heroSceneId", ""),
        "contact_sheet": str(sheet_path),
        "overall_status": overall_status,
        "layers": {
            "schema_qa": "PASS" if all(s["schema_qa"] == "PASS" for s in scene_reports) else "FAIL",
            "render_qa": "PASS" if not render_failures else "FAIL",
            "motion_qa": "PASS" if not any("Motion QA" in i for i in all_issues) else "FAIL",
            "semantic_qa": semantic_qa["status"],
        },
        "semantic_qa_checklist": semantic_qa["checklist_path"],
        "semantic_qa_review_md": semantic_qa["review_markdown_path"],
        "issues_count": len(all_issues),
        "issues": all_issues,
        "scenes": scene_reports,
    }

    report_path = output_dir / "visual_qa_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    ws_report = props_path.parent / "visual_qa_report.json"
    ws_report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n[✓] Visual QA v4.1 ({mode}) 执行完毕! 综合状态: {overall_status}")
    print(f"    - 四层状态: {json.dumps(report['layers'], ensure_ascii=False)}")
    print(f"    - 审片报告: {report_path}")
    print(f"    - Semantic QA 审片单: {semantic_qa['review_markdown_path']}")
    if all_issues:
        print("    - 阻断问题清单:")
        for iss in all_issues:
            print(f"      ✗ {iss}")

    return report


def main():
    parser = argparse.ArgumentParser(description="repo-to-video v4.1 4-Layer Visual QA runner")
    parser.add_argument("--props", required=True, help="Path to build_props.json or build_props.hero_shot.json")
    parser.add_argument("--output-dir", default="out/qa", help="Output directory for Contact Sheet & QA report")
    parser.add_argument("--mode", choices=["hero-shot", "first-shot", "full"], default="full", help="QA mode")
    parser.add_argument(
        "--no-render-frames",
        action="store_true",
        help="Skip Remotion still rendering (run Schema QA & Semantic QA generation on existing frames)",
    )
    args = parser.parse_args()

    run_visual_qa(
        props_path=Path(args.props),
        output_dir=Path(args.output_dir),
        mode=args.mode,
        render_frames=not args.no_render_frames,
    )


if __name__ == "__main__":
    main()
