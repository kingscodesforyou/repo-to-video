#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
visual_qa.py (v4.3) - 四层可执行视觉审核系统与强交付门禁 (Schema QA + Render QA + Motion QA + Hash-Bound Semantic QA)
1. Schema QA: 校验唯一数据源 renderer-registry.json 绑定、动作支持度、元素预算 (<= 4)、结构化让位规则与真实代码资产
2. Render QA: 严格检查每一帧静帧与样板视频渲染返回状态及 PNG 文件完整性，任何缺帧直接判为失败
3. Motion QA: 抽样每一个动作节拍 (Beat) 的起/中/止关键帧 + 所有节拍交界处的连续帧，检测动作冻结与跳变
4. Semantic QA: 生成绑定 scene_signature_hash（分镜内容 + 渲染器版本 + 关键帧图像指纹）的五项必答审美核验表；
   一旦分镜或画面发生任何改动，旧审核记录自动失效；overall_status != 'APPROVED' 时命令以非零状态码退出 (SystemExit(1))。
"""

import os
import sys
import json
import math
import shutil
import hashlib
import re
import struct
import zlib
import argparse
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional

sys.path.insert(0, str(Path(__file__).parent.resolve()))

from build_fingerprint import (
    canonical_json, compute_build_fingerprint, file_sha256, load_root_registry,
    read_json, reject, validate_qa_frame_cache,
)

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
    """Validate PNG chunks/CRCs and compressed pixels, without requiring Pillow."""
    try:
        data = Path(png_path).read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n":
            return False
        pos, chunks, pixels = 8, [], bytearray()
        while pos + 12 <= len(data):
            size = struct.unpack(">I", data[pos:pos + 4])[0]
            kind = data[pos + 4:pos + 8]
            end = pos + 8 + size
            if end + 4 > len(data):
                return False
            payload = data[pos + 8:end]
            if zlib.crc32(kind + payload) & 0xffffffff != struct.unpack(">I", data[end:end + 4])[0]:
                return False
            chunks.append(kind)
            if kind == b"IHDR":
                if len(chunks) != 1 or size != 13:
                    return False
                width, height = struct.unpack(">II", payload[:8])
                if width == 0 or height == 0:
                    return False
            elif kind == b"IDAT":
                pixels.extend(payload)
            elif kind == b"IEND":
                return (size == 0 and end + 4 == len(data) and chunks[0] == b"IHDR"
                        and b"IDAT" in chunks and bool(zlib.decompress(pixels)))
            pos = end + 4
        return False
    except (OSError, ValueError, struct.error, zlib.error):
        return False


def compute_scene_signature_hash(
    scene: Dict[str, Any],
    registry_version: str,
    sampled_pngs: List[Path],
    build_fingerprint: Optional[Dict[str, Any]] = None,
) -> str:
    """Bind FULL scene, build and ordered key/continuous frame names + bytes.

    The original three-argument API remains available for run_evals. Production
    evidence always supplies the complete fingerprint and the full frame plan.
    Missing / invalid images never silently disappear from a signature.
    """
    images = []
    for png in sampled_pngs:
        png = Path(png)
        if not verify_png_file(png):
            reject(f"Cannot sign invalid PNG: {png}", "REJECTED_RENDER_FAILURE")
        images.append({"name": png.name, "sha256": file_sha256(png)})
    return hashlib.sha256(canonical_json({
        "signature_version": 2,
        "registry_version": registry_version,
        "scene": scene,
        "build_fingerprint": build_fingerprint,
        "frames": images,
    })).hexdigest()


def plan_qa_scenes(props: Dict[str, Any], mode: str):
    """Select scenes while retaining their real offsets in TutorialVideo."""
    if mode not in ("full", "hero-shot", "first-shot"):
        reject(f"Unsupported QA mode: {mode}", "REJECTED_INVALID_PROPS")
    scenes = props.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        reject("Props require nonempty scenes", "REJECTED_INVALID_PROPS")
    result, seen, offset = [], set(), 0
    for scene in scenes:
        sid = scene.get("id") if isinstance(scene, dict) else None
        if not isinstance(sid, str) or not re.fullmatch(r"[\w-]+", sid) or sid in seen:
            reject(f"Unsafe or duplicate scene ID: {sid}", "REJECTED_INVALID_PROPS")
        seen.add(sid)
        duration = scene.get("durationInFrames", 120)
        if type(duration) is not int or duration < 1:
            reject(f"Invalid duration: {sid}", "REJECTED_INVALID_PROPS")
        result.append((scene, offset))
        offset += duration
    if mode != "full":
        hero = props.get("heroSceneId")
        return [next((pair for pair in result if pair[0]["id"] == hero), result[0])]
    return result


def scene_frame_plan(scene: Dict[str, Any], start_frame: int):
    """One deterministic manifest shared by rendering, cache and final gate."""
    duration = scene.get("durationInFrames", 120)
    sid = scene["id"]
    beats = scene.get("beat_timings") or []
    points = []

    def add(kind, tag, local_frame, beat_index):
        frame = start_frame + max(0, min(duration - 1, int(local_frame)))
        safe_tag = re.sub(r"[^\w-]", "_", tag)
        points.append({"kind": kind, "tag": tag, "frame": frame,
                       "beat_index": beat_index,
                       "filename": f"{sid}_{len(points):03d}_{safe_tag}_f{frame}.png"})

    for index, beat in enumerate(beats):
        b_idx = beat.get("beat_index", index)
        if type(b_idx) is not int or b_idx < 0:
            reject(f"Invalid beat_index: {sid}", "REJECTED_INVALID_PROPS")
        name = beat.get("beat", f"B{b_idx + 1}")
        begin = beat.get("start_frame", beat.get("startFrame", 0))
        end = beat.get("end_frame", beat.get("endFrame", duration))
        begin = 0 if begin is None else begin
        end = duration if end is None else end
        middle = beat.get("mid_frame", (int(begin) + int(end)) // 2)
        # Keep samples inside the beat, including very short holds.
        last = max(int(begin), int(end) - 1)
        for label, frame in (("Start", min(last, int(begin) + 3)),
                             ("Mid", middle), ("End", max(int(begin), last - 2))):
            add("key", f"B{b_idx+1}_{name}_{label}", frame, b_idx)
    if not beats:
        for label, fraction in (("Start", .15), ("Mid", .50), ("End", .85)):
            add("key", f"Scene_{label}", int(duration * fraction), 0)
    for index, beat in enumerate(beats[:-1]):
        end = beat.get("end_frame", beat.get("endFrame", duration // 2))
        for delta in (-3, 0, 3):
            add("continuous", f"B{index+1}->B{index+2}({delta:+d}f)", int(end) + delta, index)
    return points


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
        # Missing decoder, corrupt PNG or comparison errors are not motion PASS.
        return -1.0


def build_contact_sheet_image(
    items: List[Dict[str, Any]],
    out_sheet_path: Path,
    columns: int = 3,
    title: str = "repo-to-video v4.3 Visual QA Contact Sheet"
) -> bool:
    """将抽样关键帧拼接为带场景 ID、节拍名称、动作与帧号标注的 Contact Sheet 审片大图"""
    valid_items = [it for it in items if verify_png_file(Path(it["image_path"]))]
    if not valid_items or len(valid_items) != len(items):
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

    try:
        result = subprocess.run(
            [ffmpeg, "-y", *inputs, "-filter_complex", filter_complex, "-map", "[out]", str(out_sheet_path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        return result.returncode == 0 and verify_png_file(out_sheet_path)
    except OSError:
        return False


def run_2d_qa_layer(scene: Dict[str, Any], manifest: Dict[str, Any]) -> Dict[str, Any]:
    """
    v4.4 新增 2D QA：
    检查：
    1. visual_mode 合法性与渲染器支持度（任何违反 visual_mode 的镜头直接拒绝）
    2. 2D 镜头是否意外倾斜（禁止 orbit_left / orbit_right / isometric_tilt / top_down_overview 及 3D style）
    3. 文字是否水平 & 是否出现不必要的透视（禁止 2D 镜头在 yielding 中使用非零 zOffset）
    4. 图表和流程图是否清晰（校验 2D 流程图节点、代码行、对比项结构完备）
    5. 是否超出安全区（校验元素预算 <= 4、次要物体 <= 3、屏幕批注 <= 2 且单条长度合理）
    """
    from build_video import build_renderers_lookup

    issues: List[str] = []
    sid = scene.get("id", "unknown")
    visual_mode = scene.get("visual_mode")
    art = scene.get("art_direction") or {}
    world = scene.get("visual_world") or {}
    choreo = scene.get("visual_choreography") or []
    overlays = scene.get("text_overlays") or []

    if visual_mode not in ("2d_editorial", "3d_spatial", "hybrid"):
        issues.append(
            f"[{sid}] 2D/Mode QA: 缺失或非法的 visual_mode='{visual_mode}'（必须为 2d_editorial / 3d_spatial / hybrid）。"
        )
        return {"layer": "2D QA", "status": "FAIL", "issues": issues}

    renderers_map = build_renderers_lookup(manifest)
    rid = (scene.get("renderer_id") or "").strip()
    r_spec = renderers_map.get(rid)
    if r_spec:
        supported_modes = r_spec.get("visualModes", [])
        if supported_modes and visual_mode not in supported_modes:
            issues.append(
                f"[{sid}] 2D/Mode QA: 渲染器 '{r_spec['id']}' 不支持 visual_mode='{visual_mode}'（支持模式: {supported_modes}）。"
            )

    forbidden_2d_cams = set(
        (manifest.get("supported_visual_modes", {}).get("2d_editorial", {}) or {}).get(
            "forbidden_cameras",
            ["orbit_left", "orbit_right", "isometric_tilt", "top_down_overview"],
        )
    )

    if visual_mode == "2d_editorial":
        if art.get("style") in ("mechanism_3d", "premium_3d_editorial", "spatial_25d"):
            issues.append(
                f"[{sid}] 2D QA: 2d_editorial 镜头严禁使用 3D 艺术风格 '{art.get('style')}'（防止意外三维倾斜）。"
            )
        for b_idx, b in enumerate(choreo):
            cam = b.get("camera")
            if cam in forbidden_2d_cams:
                issues.append(
                    f"[{sid}] 2D QA: Beat #{b_idx + 1} 在 2d_editorial 模式下使用了禁止的 3D 倾斜相机 '{cam}'。"
                )
            for rule in b.get("yielding") or []:
                if isinstance(rule, dict) and rule.get("zOffset") not in (None, 0):
                    issues.append(
                        f"[{sid}] 2D QA: Beat #{b_idx + 1} 在 2d_editorial 模式下使用了非零 zOffset={rule.get('zOffset')}（导致透视缩放变形）。"
                    )
            act = b.get("action")
            payload = b.get("payload") or {}
            if act == "flowchart" and len(payload.get("nodes") or []) < 2:
                issues.append(f"[{sid}] 2D QA: Beat #{b_idx + 1} 流程图 (flowchart) 节点数不足 2 个，图表不清晰。")
            if act == "code_explanation" and not (payload.get("lines") or []):
                issues.append(f"[{sid}] 2D QA: Beat #{b_idx + 1} 代码讲解 (code_explanation) 未指定高亮行 lines。")
    elif visual_mode == "hybrid":
        has_2d_info = bool(overlays) or bool(world.get("object_labels"))
        if not has_2d_info:
            issues.append(
                f"[{sid}] Hybrid QA: hybrid 模式镜头必须包含正视 2D 信息层 (text_overlays 或 object_labels)。"
            )

    # 安全区与信息过载边界检查
    for ov_idx, ov in enumerate(overlays):
        txt = str((ov or {}).get("text") or "")
        if len(txt) > 28:
            issues.append(
                f"[{sid}] 2D Safe-Area QA: text_overlays[{ov_idx}] 文字过长 ({len(txt)} 字 > 28)，易超出安全区。"
            )

    return {
        "layer": "2D QA",
        "status": "PASS" if not issues else "FAIL",
        "issues": issues,
    }


def run_teaching_semantic_qa(scene: Dict[str, Any]) -> Dict[str, Any]:
    """
    v4.4 新增教学语义 QA (Teaching Semantic QA)：
    检查：
    1. 画面是否真的在解释口播内容 (visual_explanation)
    2. 观众看完是否能理解原理 (learning_objective & expected_understanding)
    3. 是否把过程表现出来，而不是只摆文字 (动作多样性与非纯静态卡片检查)
    4. 类比/视觉动作是否与真实机制对应 (phrase_anchor 与 narration 绑定)
    5. 信息密度是否过高 (元素预算 <= 4，次要物体 <= 3，批注 <= 2)
    """
    issues: List[str] = []
    sid = scene.get("id", "unknown")
    learning_obj = str(scene.get("learning_objective") or "").strip()
    visual_exp = str(scene.get("visual_explanation") or "").strip()
    expected_und = str(scene.get("expected_understanding") or "").strip()
    choreo = scene.get("visual_choreography") or []
    world = scene.get("visual_world") or {}
    overlays = scene.get("text_overlays") or []

    if len(learning_obj) < 4:
        issues.append(f"[{sid}] Teaching Semantic QA: 缺少有效的 learning_objective（本镜头教学目标）。")
    if len(visual_exp) < 4:
        issues.append(f"[{sid}] Teaching Semantic QA: 缺少有效的 visual_explanation（画面如何帮助理解）。")
    if len(expected_und) < 4:
        issues.append(f"[{sid}] Teaching Semantic QA: 缺少有效的 expected_understanding（观众看完应明白什么）。")

    if len(choreo) > 1 and all((b.get("action") == "hold") for b in choreo):
        issues.append(
            f"[{sid}] Teaching Semantic QA: 多节拍镜头全部为静态 hold，未把原理过程动态表现出来。"
        )

    sec_objs = world.get("secondary_objects") or []
    if len(sec_objs) > 3 or len(overlays) > 2:
        issues.append(
            f"[{sid}] Teaching Semantic QA: 画面信息密度过高 (secondary_objects={len(sec_objs)}, text_overlays={len(overlays)})。"
        )

    return {
        "layer": "Teaching Semantic QA",
        "status": "PASS" if not issues else "FAIL",
        "issues": issues,
    }


def run_schema_qa_layer(scene: Dict[str, Any], manifest: Dict[str, Any]) -> Dict[str, Any]:
    """第 1 层：Schema QA（含 v4.4 2D QA、Teaching Semantic QA、注册组件、动作支持度、元素预算 <= 4、真实代码资产与让位规则）"""
    from build_video import build_renderers_lookup
    from animation_contract import validate_animation_scene

    issues = []
    sid = scene.get("id", "unknown")
    art = scene.get("art_direction") or {}
    world = scene.get("visual_world") or {}
    choreo = scene.get("visual_choreography") or []
    overlays = scene.get("text_overlays") or []

    contract_errs = validate_animation_scene(scene, manifest)
    for cerr in contract_errs:
        issues.append(f"[{sid}] Contract QA: {cerr}")

    two_d_res = run_2d_qa_layer(scene, manifest)
    issues.extend(two_d_res["issues"])

    teaching_res = run_teaching_semantic_qa(scene)
    issues.extend(teaching_res["issues"])

    renderers_map = build_renderers_lookup(manifest)
    rid = (scene.get("renderer_id") or "").strip()
    if not rid or rid not in renderers_map:
        issues.append(f"[{sid}] Schema QA: renderer_id='{rid}' 未在 renderer-registry.json 中注册。")
    else:
        r_spec = renderers_map[rid]
        for b in choreo:
            act = b.get("action")
            if act not in r_spec["supportedActions"]:
                issues.append(f"[{sid}] Schema QA: 动作 '{act}' 不被组件 '{r_spec['id']}' 支持。")
        if r_spec["id"] == "product_interface_v1":
            auth = world.get("authentic_assets")
            if not isinstance(auth, dict) or (
                not (auth.get("code_snippet") or "").strip()
                and not (auth.get("terminal_commands") or [])
            ):
                issues.append(
                    f"[{sid}] Schema QA: product_interface_v1 缺少真实的 visual_world.authentic_assets，禁止回退到伪造示例。"
                )

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
        "two_d_qa": two_d_res["status"],
        "teaching_semantic_qa": teaching_res["status"],
        "issues": issues,
    }


def generate_semantic_qa_artifacts(
    scenes: List[Dict[str, Any]],
    scene_signatures: Dict[str, str],
    output_dir: Path,
    contact_sheet_path: Path,
    build_fingerprint: Optional[Dict[str, Any]] = None,
    scope: str = "full",
) -> Dict[str, Any]:
    """
    第 4 层：Hash-Bound Semantic QA（绑定签名哈希的语义与审美独立审片清单生成与核验）
    只有当 scene_id 存在且 scene_signature_hash 完全一致时，才复用已通过的 agent_verified 结论；
    一旦分镜内容或渲染帧发生任何变化，立即使旧审批失效并强制要求重新审片！
    """
    checklist_path = output_dir / "semantic_qa_checklist.json"
    review_md_path = output_dir / "semantic_qa_review.md"

    existing_verdicts = {}
    if checklist_path.exists():
        try:
            old_data = read_json(checklist_path)
            old_scenes = old_data.get("scenes", [])
            ids = [item["scene_id"] for item in old_scenes]
            compatible = (build_fingerprint is None or (
                canonical_json(old_data.get("build_fingerprint")) == canonical_json(build_fingerprint)
                and old_data.get("scope") == scope))
            if compatible and len(ids) == len(set(ids)):
                for item in old_scenes:
                    if item.get("agent_verified") is True:
                        existing_verdicts[item["scene_id"]] = item
        except Exception:
            pass

    semantic_scenes = []
    unverified_count = 0
    failed_semantic_issues = []

    md_lines = [
        "# Visual QA 第 4 层：Semantic QA 真实画面审美审片单 (v4.3)",
        "",
        f"- **全片 Contact Sheet 路径**: `{contact_sheet_path}`",
        "- **哈希绑定机制**: 每个镜头的审批结论均与 `scene_signature_hash`（完整分镜 + 构建指纹 + 关键帧及连续帧 SHA-256）强绑定；修改分镜后旧审批自动失效。",
        "- **审核要求**: Visual QA Agent 必须使用 `read_file` 直接查看上述 Contact Sheet 图片及各镜头的 `continuous_<scene_id>.png` 连续帧图片，逐镜回答以下 5 个问题，并将 `semantic_qa_checklist.json` 中的 `agent_verified` 设为 `true`。",
        "",
    ]

    for s in scenes:
        sid = s.get("id", "unknown")
        sig_hash = scene_signatures.get(sid, "")
        prev = existing_verdicts.get(sid)

        if prev and prev.get("scene_signature_hash") == sig_hash:
            semantic_scenes.append(prev)
            answers = prev.get("answers")
            if not isinstance(answers, dict):
                answers = {}
            if set(answers) != {q["id"] for q in MANDATORY_SEMANTIC_QUESTIONS}:
                failed_semantic_issues.append(f"[{sid}] Semantic QA: 缺失或额外的五问答案。")
            for q in MANDATORY_SEMANTIC_QUESTIONS:
                ans = answers.get(q["id"], {})
                if not isinstance(ans, dict):
                    ans = {}
                if ans.get("pass") is not True:
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
                "scene_signature_hash": sig_hash,
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

        md_lines.append(f"## 镜头 `{sid}` ({s.get('title', '')}) — Hash: `{sig_hash}`")
        md_lines.append(f"- **渲染组件 (`renderer_id`)**: `{s.get('renderer_id')}`")
        md_lines.append(f"- **口播文案**: {s.get('narration')}")
        md_lines.append(f"- **视觉意图**: {s.get('visual_intent')}")
        md_lines.append(f"- **连续帧条带**: `{output_dir / f'continuous_{sid}.png'}`")
        md_lines.append("- **必答审美核验项**:")
        for q in MANDATORY_SEMANTIC_QUESTIONS:
            md_lines.append(f"  - [ ] {q['question']}")
        md_lines.append("")

    checklist_payload = {
        "version": "4.3",
        "scope": scope,
        "build_fingerprint": build_fingerprint,
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
    render_frames: bool = True,
    remotion_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Run four-layer QA against a pinned build; sample scope is never final QA.

    --no-render-frames only reuses a complete, hash-verified report from this
    output directory. A pending checklist is allowed, unknown-origin frames aren't.
    """
    props_path, output_dir = Path(props_path).resolve(), Path(output_dir).resolve()
    remotion_dir = Path(remotion_dir or resolve_remotion_workdir()).resolve()
    before = compute_build_fingerprint(props_path, remotion_dir)
    props = read_json(props_path)
    planned_scenes = plan_qa_scenes(props, mode)
    scenes = [pair[0] for pair in planned_scenes]
    manifest = load_root_registry()
    registry_version = manifest["registry_version"]
    scope = "full" if mode == "full" else "sample"
    report_path = output_dir / "visual_qa_report.json"
    if not render_frames:
        cached = validate_qa_frame_cache(report_path, props_path, remotion_dir, mode, before)
        if cached["qa_output_dir"] != str(output_dir):
            reject("Cache belongs to another QA directory", "REJECTED_STALE_QA_CACHE")

    output_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = output_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    render_failures, all_issues, contact_items, scene_reports = [], [], [], []
    scene_signatures, artifact_hashes = {}, {}

    if scope == "sample" and render_video_out is not None and render_frames:
        render_video_out = Path(render_video_out).resolve()
        render_video_out.parent.mkdir(parents=True, exist_ok=True)
        cmd = f'npx remotion render src/index.ts TutorialVideo "{render_video_out}" --props="{props_path}"'
        res = subprocess.run(cmd, cwd=str(remotion_dir), shell=True)
        if res.returncode != 0 or not render_video_out.is_file():
            render_failures.append(f"Render QA: 样板视频渲染失败: {render_video_out}")

    for scene, start in planned_scenes:
        sid = scene["id"]
        schema = run_schema_qa_layer(scene, manifest)
        scene_issues = list(schema["issues"])
        frames, key_items, continuous_items, beat_frames = [], [], [], {}
        for point in scene_frame_plan(scene, start):
            png = frames_dir / point["filename"]
            ok = True
            if render_frames:
                # Never allow a successful return code to recycle an old output.
                if png.exists():
                    png.unlink()
                ok = render_still_frame(remotion_dir, "TutorialVideo", props_path, point["frame"], png)
            if not ok or not verify_png_file(png):
                issue = f"[{sid}] Render QA: 缺失或无效 PNG ({point['tag']}, f={point['frame']})"
                render_failures.append(issue)
                scene_issues.append(issue)
            saved = {key: point[key] for key in ("kind", "tag", "frame", "beat_index")}
            saved.update(image_path=str(png), sha256=file_sha256(png) if verify_png_file(png) else None)
            frames.append(saved)
            item = {"scene_id": sid, "tag": point["tag"], "frame": point["frame"], "image_path": str(png)}
            if point["kind"] == "key":
                key_items.append(item)
                beat_frames.setdefault(point["beat_index"], []).append(png)
            else:
                continuous_items.append(item)
        contact_items.extend(key_items)
        strip = output_dir / f"continuous_{sid}.png"
        if render_frames:
            if strip.exists():
                strip.unlink()
            strip_ok = build_contact_sheet_image(continuous_items or key_items, strip, columns=3,
                                                  title=f"Continuous Audit: {sid}")
        else:
            strip_ok = verify_png_file(strip)
        if not strip_ok or not verify_png_file(strip):
            issue = f"[{sid}] Render QA: 连续帧条带合成失败: {strip}"
            render_failures.append(issue)
            scene_issues.append(issue)
        else:
            artifact_hashes[strip.name] = file_sha256(strip)

        motion_diffs = []
        choreography = scene.get("visual_choreography") or []
        for beat_index, paths in beat_frames.items():
            diff = compute_image_diff_score(paths[0], paths[-1])
            action = choreography[beat_index].get("action") if beat_index < len(choreography) else None
            intentional_hold = action == "hold"
            motion_diffs.append({"beat_index": beat_index, "diff_pct": diff,
                                 "intentional_hold": intentional_hold})
            if not isinstance(diff, (float, int)) or not math.isfinite(diff) or diff < 0:
                scene_issues.append(f"[{sid}] Motion QA: Beat #{beat_index + 1} PNG 比较失败")
            elif diff < 0.25 and not intentional_hold:
                scene_issues.append(f"[{sid}] Motion QA: Beat #{beat_index + 1} Frozen Beat ({diff}%)")

        try:
            signature = compute_scene_signature_hash(scene, registry_version,
                [Path(frame["image_path"]) for frame in frames], before)
        except ValueError as exc:
            signature = ""
            render_failures.append(str(exc))
            scene_issues.append(str(exc))
        scene_signatures[sid] = signature
        all_issues.extend(scene_issues)
        scene_reports.append({
            "scene_id": sid, "scene_signature_hash": signature,
            "renderer_id": scene.get("renderer_id", ""), "title": scene.get("title", ""),
            "visual_intent": scene.get("visual_intent", ""), "beats_count": len(choreography),
            "schema_qa": schema["status"], "frames": frames, "motion_diffs": motion_diffs,
            "issues": scene_issues, "status": "PASS" if not scene_issues else "FAIL",
        })

    sheet_path = output_dir / ("contact_sheet.png" if scope == "full" else "first_shot_sheet.png")
    if render_frames:
        if sheet_path.exists():
            sheet_path.unlink()
        sheet_ok = build_contact_sheet_image(contact_items, sheet_path, columns=3,
                                             title=f"repo-to-video v4.3 {scope} QA")
    else:
        sheet_ok = verify_png_file(sheet_path)
    if not sheet_ok or not verify_png_file(sheet_path):
        render_failures.append(f"Render QA: Contact Sheet 合成失败: {sheet_path}")
    else:
        artifact_hashes[sheet_path.name] = file_sha256(sheet_path)
        if scope == "sample" and render_frames:
            shutil.copy2(sheet_path, output_dir / "hero_shot_sheet.png")
    all_issues.extend(issue for issue in render_failures if issue not in all_issues)

    # Recheck after ALL rendering / frame reads, before binding human approvals.
    after = compute_build_fingerprint(props_path, remotion_dir)
    if canonical_json(after) != canonical_json(before):
        reject("Build changed while rendering QA frames", "REJECTED_BUILD_CHANGED_DURING_QA")
    # Also catch changes to earlier frames while later scenes were rendering.
    for row in scene_reports:
        for frame in row["frames"]:
            if frame["sha256"] is not None and file_sha256(frame["image_path"]) != frame["sha256"]:
                reject("Frame changed during QA", "REJECTED_STALE_QA_CACHE")
    if not render_frames:
        validate_qa_frame_cache(report_path, props_path, remotion_dir, mode, before)

    semantic = generate_semantic_qa_artifacts(scenes, scene_signatures, output_dir, sheet_path,
                                              build_fingerprint=before, scope=scope)
    all_issues.extend(semantic["issues"])
    if render_failures:
        status = "REJECTED_RENDER_FAILURE"
    elif all_issues:
        status = "REJECTED_QA_ISSUES"
    elif semantic["status"] != "PASS":
        status = "PENDING_SEMANTIC_QA_REVIEW"
    else:
        status = "APPROVED"
    report = {
        "version": "4.3", "mode": mode, "scope": scope,
        "build_fingerprint": before, "qa_output_dir": str(output_dir),
        "repo_name": props.get("repoName", ""), "hero_scene_id": props.get("heroSceneId", ""),
        "contact_sheet": str(sheet_path), "artifact_hashes": artifact_hashes,
        "overall_status": status,
        "layers": {
            "schema_qa": "PASS" if all(s["schema_qa"] == "PASS" for s in scene_reports) else "FAIL",
            "render_qa": "PASS" if not render_failures else "FAIL",
            "motion_qa": "PASS" if not any("Motion QA" in issue for issue in all_issues) else "FAIL",
            "semantic_qa": semantic["status"],
        },
        "semantic_qa_checklist": semantic["checklist_path"],
        "semantic_qa_review_md": semantic["review_markdown_path"],
        "issues_count": len(all_issues), "issues": all_issues, "scenes": scene_reports,
    }
    if canonical_json(compute_build_fingerprint(props_path, remotion_dir)) != canonical_json(before):
        reject("Build changed before QA report publication", "REJECTED_BUILD_CHANGED_DURING_QA")
    serialized = json.dumps(report, ensure_ascii=False, indent=2)
    report_path.write_text(serialized, encoding="utf-8")
    (props_path.parent / "visual_qa_report.json").write_text(serialized, encoding="utf-8")
    print(f"Visual QA v4.3 ({scope}/{mode}): {status}; report: {report_path}")
    return report


def main():
    parser = argparse.ArgumentParser(description="repo-to-video v4.3 4-Layer Visual QA runner")
    parser.add_argument("--props", required=True, help="Path to build_props.json or build_props.first_shot.json")
    parser.add_argument("--output-dir", default="out/qa", help="Output directory for Contact Sheet & QA report")
    parser.add_argument("--remotion-dir", help="Actual Remotion project used by both QA and final rendering")
    parser.add_argument("--mode", choices=["hero-shot", "first-shot", "full"], default="full", help="QA mode")
    parser.add_argument(
        "--no-render-frames",
        action="store_true",
        help="Reuse only frames verified against an existing identical-build QA report and per-file hashes",
    )
    parser.add_argument(
        "--allow-pending-semantic",
        action="store_true",
        help="Allow exit code 0 when status is PENDING_SEMANTIC_QA_REVIEW (used only when generating initial checklist for Visual QA Agent)",
    )
    args = parser.parse_args()

    report = run_visual_qa(
        props_path=Path(args.props),
        output_dir=Path(args.output_dir),
        mode=args.mode,
        render_frames=not args.no_render_frames,
        remotion_dir=Path(args.remotion_dir) if args.remotion_dir else None,
    )

    status = report.get("overall_status")
    if status == "APPROVED":
        return
    if args.allow_pending_semantic and status == "PENDING_SEMANTIC_QA_REVIEW":
        return
    raise SystemExit(1)


if __name__ == "__main__":
    main()
