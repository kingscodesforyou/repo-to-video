#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v4.3: fast contract gates, opt-in silent Remotion renders and reviewed goldens.

Default report: out/evals/benchmark_report.json (never implies Visual QA approval).
Exit 0: requested machine checks passed; 1: failure; 2: golden missing/unreviewed.
Semantic review is always separate and pending, even when pixels match a golden.
"""

import argparse
import copy
import hashlib
import json
import math
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

RENDER_SETTINGS = {
    "fps": 30,
    "frames_per_beat": 40,
    "width": 1920,
    "height": 1080,
    "scale": 0.5,
    "concurrency": 2,
    "seed": 430,
    "codec": "h264",
    "crf": 18,
    "pixel_format": "yuv420p",
    "image_format": "png",
    "hardware_acceleration": "disable",
    "device_scale_factor": 1,
    "offthread_video_cache_bytes": 64 * 1024 * 1024,
    "media_cache_bytes": 128 * 1024 * 1024,
    "gl": "swangle",
    "bundle_cache": False,
    "audio": False,
    "composition_id": "TutorialVideo",
    "timing_policy": "synthetic-visual-only; beat end inclusive; no TTS/alignment claims",
    "sampling_policy": "beat start/mid/end and internal boundaries -1/0/+1; deduplicated",
}
DEFAULT_TOLERANCE = {
    "pixel_threshold": 8,
    "max_mean_absolute_error": 0.35,
    "max_changed_pixel_ratio": 0.001,
}


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def json_hash(value) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode("utf-8")).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_negative_regression_tests(manifest: dict) -> list:
    """运行 4 项核心负向回归测试，确保门禁不会漏放任何违规分镜"""
    from tts_generator import validate_and_locate_phrase_anchors
    from visual_qa import (run_schema_qa_layer, compute_scene_signature_hash,
                           generate_semantic_qa_artifacts)

    results = []

    # Test 1: 缺失或未注册的 renderer_id 必须被 Schema QA 拦截
    bad_scene_1 = {
        "id": "neg_01",
        "renderer_id": "non_existent_renderer_v99",
        "narration": "测试口播文案。",
        "visual_intent": "测试意图",
        "art_direction": {"accent_color": "#78A9FF"},
        "visual_world": {"primary_object": "3d_filter_machine", "secondary_objects": ["waste_container"]},
        "visual_choreography": [
            {"beat": "B1", "phrase_anchor": "测试口播文案", "action": "particles_flow", "target": "3d_filter_machine"}
        ],
    }
    r1 = run_schema_qa_layer(bad_scene_1, manifest)
    results.append({
        "test": "reject_unregistered_renderer_id",
        "passed": r1["status"] == "FAIL",
        "details": r1["issues"],
    })

    # Test 2: product_interface_v1 缺失 authentic_assets 必须被拦截
    bad_scene_2 = {
        "id": "neg_02",
        "renderer_id": "product_interface_v1",
        "narration": "展示真实代码视口。",
        "visual_intent": "测试代码展示",
        "art_direction": {"accent_color": "#78A9FF"},
        "visual_world": {
            "primary_object": "authentic_code_viewport",
            "secondary_objects": ["authentic_terminal_bench"],
        },
        "visual_choreography": [
            {"beat": "B1", "phrase_anchor": "展示真实代码视口", "action": "reveal_ui", "target": "authentic_code_viewport"}
        ],
    }
    r2 = run_schema_qa_layer(bad_scene_2, manifest)
    results.append({
        "test": "reject_missing_authentic_assets_in_product_interface",
        "passed": r2["status"] == "FAIL",
        "details": r2["issues"],
    })

    # Test 3: 动作顺序与口播顺序颠倒必须被 validate_and_locate_phrase_anchors 拦截
    caught_order_error = False
    try:
        validate_and_locate_phrase_anchors(
            "neg_03",
            "第一步数据进入，第二步完成提纯。",
            [
                {"beat": "B1", "phrase_anchor": "第二步完成提纯"},
                {"beat": "B2", "phrase_anchor": "第一步数据进入"},
            ],
        )
    except ValueError:
        caught_order_error = True
    results.append({
        "test": "reject_out_of_order_phrase_anchors",
        "passed": caught_order_error,
    })

    # Test 4: 修改分镜内容但保持相同 scene_id 时，Semantic QA 旧审批必须自动失效
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        scene_v1 = {
            "id": "scene_01",
            "renderer_id": "particle_filter_v1",
            "narration": "原始口播版本",
            "visual_intent": "原始意图",
            "visual_choreography": [{"beat": "B1", "phrase_anchor": "原始口播版本", "action": "particles_flow"}],
        }
        sig_v1 = compute_scene_signature_hash(scene_v1, "4.2.0", [])
        # 模拟旧版已通过审批的 checklist
        checklist_path = tmp_dir / "semantic_qa_checklist.json"
        checklist_path.write_text(
            json.dumps({
                "version": "4.2",
                "scenes": [
                    {
                        "scene_id": "scene_01",
                        "scene_signature_hash": sig_v1,
                        "agent_verified": True,
                        "answers": {
                            "blind_comprehension": {"pass": True},
                            "action_fidelity": {"pass": True},
                            "anti_card_check": {"pass": True},
                            "visual_restraint": {"pass": True},
                            "shot_continuity": {"pass": True},
                        },
                    }
                ],
            }),
            encoding="utf-8",
        )
        # 修改分镜文案与动作，但保持 scene_id="scene_01"
        scene_v2 = {
            **scene_v1,
            "narration": "修改后的口播版本",
        }
        sig_v2 = compute_scene_signature_hash(scene_v2, "4.2.0", [])
        sem_res = generate_semantic_qa_artifacts(
            [scene_v2], {"scene_01": sig_v2}, tmp_dir, tmp_dir / "contact_sheet.png"
        )
        results.append({
            "test": "invalidate_semantic_qa_on_scene_content_change",
            "passed": sem_res["status"] == "PENDING_AGENT_REVIEW" and sig_v1 != sig_v2,
            "old_hash": sig_v1,
            "new_hash": sig_v2,
        })

    return results


def build_eval_props(storyboard: dict) -> dict:
    """Assemble already-validated source without altering narration/world/payload.

    These are deliberate synthetic visual windows, NOT measured speech timings.
    Leave phrase/word timings empty rather than fabricate forced alignment.
    """
    scenes = []
    offset = 0
    step = RENDER_SETTINGS["frames_per_beat"]
    fps = RENDER_SETTINGS["fps"]
    for original in storyboard["scenes"]:
        scene = copy.deepcopy(original)
        beats = scene["visual_choreography"]
        if not beats:
            raise ValueError(f"{scene['id']}: no beats")
        duration = len(beats) * step
        timings = []
        for index, beat in enumerate(beats):
            start, end = index * step, (index + 1) * step - 1
            timings.append({
                "beat_index": index, "beat": beat["beat"],
                "action": beat["action"], "target": beat["target"],
                "phrase_anchor": beat["phrase_anchor"],
                "camera": beat.get("camera"), "shot_scale": beat.get("shot_scale"),
                "start_frame": start, "startFrame": start,
                "end_frame": end, "endFrame": end, "mid_frame": start + step // 2,
            })
        # Storyboard validation must happen BEFORE this runtime-only augmentation.
        scene.update({
            "type": "choreographed_v4", "durationInFrames": duration,
            "durationSec": duration / fps, "audioFrames": duration,
            "startFrame": offset, "start_frame": offset,
            "endFrame": offset + duration - 1, "end_frame": offset + duration - 1,
            "beat_timings": timings, "phrase_timings": [], "word_timings": [],
        })
        if scene.get("audioUrl"):
            raise ValueError("Visual benchmark must not contain an audio track")
        scenes.append(scene)
        offset += duration
    if not scenes:
        raise ValueError("Storyboard has no scenes")
    return {
        "schemaVersion": storyboard["schema_version"],
        "title": storyboard["video_title"], "repoName": storyboard["repo_name"],
        "repoUrl": storyboard.get("repo_url", ""), "repoType": storyboard["repo_type"],
        "heroSceneId": storyboard.get("hero_scene_id", scenes[0]["id"]),
        "chapters": copy.deepcopy(storyboard.get("chapters", [])),
        "globalArtDirection": copy.deepcopy(storyboard.get("global_art_direction", {})),
        "fps": fps, "totalFrames": offset, "scenes": scenes,
    }


def make_samples(props: dict) -> list:
    """All indices are global video frames; overlapping requests share one PNG."""
    by_frame = {}

    def add(frame, label):
        if 0 <= frame < props["totalFrames"]:
            by_frame.setdefault(frame, []).append(label)

    for si, scene in enumerate(props["scenes"]):
        for bi, beat in enumerate(scene["beat_timings"]):
            prefix = f"scene_{si + 1:02d}/beat_{bi + 1:02d}"
            offset = scene["startFrame"]
            for position, key in (("start", "start_frame"), ("mid", "mid_frame"), ("end", "end_frame")):
                add(offset + beat[key], f"{prefix}/{position}")
            boundary = offset + beat["start_frame"]
            if boundary > 0:  # No fictional -1 frame or frame beyond the video.
                for delta in (-1, 0, 1):
                    add(boundary + delta, f"{prefix}/boundary{delta:+d}")
    return [{"frame": frame, "file": f"frames/frame_{frame:06d}.png", "labels": labels}
            for frame, labels in sorted(by_frame.items())]


def frame_path(directory: Path, relative: str) -> Path:
    path = Path(relative)
    if path.is_absolute() or len(path.parts) != 2 or path.parts[0] != "frames" or path.suffix != ".png" or ".." in path.parts:
        raise ValueError(f"Invalid sampled frame path: {relative}")
    return directory / path


def check_frame_inventory(directory: Path, samples: list) -> list:
    expected = [s["file"] for s in samples]
    if not expected or len(set(expected)) != len(expected):
        return ["Empty or duplicate sample file list"]
    for name in expected:
        frame_path(directory, name)
    actual = {p.relative_to(directory).as_posix() for p in (directory / "frames").rglob("*.png")}
    return ([f"Missing frame: {name}" for name in sorted(set(expected) - actual)]
            + [f"Extra frame: {name}" for name in sorted(actual - set(expected))])


def validate_rendered_frames(directory: Path, manifest: dict) -> list:
    from PIL import Image

    issues = check_frame_inventory(directory, manifest["samples"])
    settings = manifest["contract"]["render_settings"]
    expected_size = (round(settings["width"] * settings["scale"]),
                     round(settings["height"] * settings["scale"]))
    if not issues:
        for sample in manifest["samples"]:
            with Image.open(frame_path(directory, sample["file"])) as image:
                if image.size != expected_size:
                    issues.append(f"Unexpected dimensions for {sample['file']}: {image.size} != {expected_size}")
                image.verify()
    return issues


def image_metrics(current: Path, golden: Path, tolerance: dict) -> dict:
    from PIL import Image, ImageChops, ImageStat

    with Image.open(current) as c, Image.open(golden) as g:
        if c.size != g.size:
            return {"status": "FAIL", "reason": "DIMENSION_MISMATCH",
                    "current_size": list(c.size), "golden_size": list(g.size)}
        diff = ImageChops.difference(c.convert("RGBA"), g.convert("RGBA"))
        mean_error = sum(ImageStat.Stat(diff).mean) / 4
        r, green, b, alpha = diff.split()
        histogram = ImageChops.lighter(ImageChops.lighter(r, green), ImageChops.lighter(b, alpha)).histogram()
        changed = sum(histogram[tolerance["pixel_threshold"] + 1:]) / (c.width * c.height)
        ok = (mean_error <= tolerance["max_mean_absolute_error"]
              and changed <= tolerance["max_changed_pixel_ratio"])
        return {"status": "PASS" if ok else "FAIL", "mean_absolute_error": mean_error,
                "changed_pixel_ratio": changed}


def compare_goldens(current_dir: Path, golden_dir: Path, current: dict, tolerance=None) -> dict:
    """Read-only comparison: absent/unapproved baselines NEVER become a PASS."""
    tolerance = dict(DEFAULT_TOLERANCE if tolerance is None else tolerance)
    result = {"status": "FAIL", "issues": [], "frames": [], "tolerance": tolerance}
    try:
        issues = validate_rendered_frames(current_dir, current)
        if issues:
            return {**result, "issues": issues}
        baseline_path = golden_dir / "manifest.json"
        if not baseline_path.is_file():
            return {**result, "status": "BASELINE_MISSING",
                    "issues": ["No golden manifest; explicit --update-goldens and human review required"]}
        golden = json.loads(baseline_path.read_text(encoding="utf-8"))
        if golden.get("format_version") != current["format_version"]:
            issues.append("MANIFEST_VERSION_CHANGED")
        if golden.get("case") != current["case"]:
            issues.append("CASE_CHANGED")
        if golden.get("contract") != current["contract"]:
            issues.append("RENDER_PARAMETERS_OR_ENVIRONMENT_CHANGED")
        if golden.get("samples") != current["samples"]:
            issues.append("SAMPLE_LIST_CHANGED (missing/extra/reordered frames or labels)")
        issues.extend(check_frame_inventory(golden_dir, golden.get("samples", [])))
        result["issues"] = issues
        if issues:
            return result
        for sample in current["samples"]:
            name = sample["file"]
            metrics = image_metrics(frame_path(current_dir, name), frame_path(golden_dir, name), tolerance)
            result["frames"].append({"file": name, **metrics})
        if any(f["status"] != "PASS" for f in result["frames"]):
            result["issues"].append("PIXEL_DIFFERENCE")
            return result
        approval = golden.get("approval", {})
        approved = (approval.get("status") == "APPROVED" and approval.get("reviewer")
                    and approval.get("reviewed_at"))
        result["pixel_comparison"] = "MATCH"
        result["status"] = "PASS" if approved else "BASELINE_PENDING_REVIEW"
        result["baseline_approval"] = approval
        return result
    except (OSError, ValueError, KeyError, TypeError) as exc:
        result["issues"].append(f"Unreadable/invalid visual artifacts: {exc}")
        return result


def update_goldens(current_dir: Path, golden_dir: Path, current: dict):
    """Explicit opt-in only. Every write revokes approval, even for identical PNGs."""
    issues = validate_rendered_frames(current_dir, current)
    if issues:
        raise ValueError("; ".join(issues))
    golden_dir.mkdir(parents=True, exist_ok=True)
    # Invalidate the previous approval BEFORE copying any new pixels.
    manifest = {**copy.deepcopy(current), "created_at": utc_now(),
                "approval": {"status": "PENDING_REVIEW", "reviewer": None, "reviewed_at": None},
                "review_scope": "Image regression baseline only; not semantic or audiovisual QA approval"}
    write_json(golden_dir / "manifest.json", manifest)
    frames_dir = golden_dir / "frames"
    frames_dir.mkdir(exist_ok=True)
    for old in frames_dir.glob("*.png"):
        old.unlink()
    for sample in current["samples"]:
        shutil.copyfile(frame_path(current_dir, sample["file"]), frame_path(golden_dir, sample["file"]))
    for name in ("contact_sheet.png", "props.json"):
        if (current_dir / name).is_file():
            shutil.copyfile(current_dir / name, golden_dir / name)


def make_contact_sheet(case_dir: Path, samples: list):
    from PIL import Image, ImageDraw

    cols, thumb_w, thumb_h, label_h = 3, 320, 180, 54
    sheet = Image.new("RGB", (cols * thumb_w, math.ceil(len(samples) / cols) * (thumb_h + label_h)), "#111827")
    draw = ImageDraw.Draw(sheet)
    for i, sample in enumerate(samples):
        x, y = (i % cols) * thumb_w, (i // cols) * (thumb_h + label_h)
        with Image.open(frame_path(case_dir, sample["file"])) as image:
            thumbnail = image.convert("RGB")
            thumbnail.thumbnail((thumb_w, thumb_h))
            sheet.paste(thumbnail, (x, y))
        label = f"frame {sample['frame']}\n" + "\n".join(sample["labels"])
        draw.multiline_text((x + 5, y + thumb_h + 2), label, fill="white", spacing=1)
    sheet.save(case_dir / "contact_sheet.png")


def run_command(command: list, log_path: Path) -> dict:
    try:
        completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True,
                                   encoding="utf-8", errors="replace", check=False)
        output = completed.stdout + completed.stderr
        status, returncode = ("PASS" if completed.returncode == 0 else "FAIL"), completed.returncode
    except OSError as exc:
        output, status, returncode = str(exc), "FAIL", None
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(output, encoding="utf-8")
    return {"status": status, "returncode": returncode, "command": command, "log": str(log_path)}


def evaluate_contract(path: Path, registry: dict) -> tuple:
    import contextlib
    import io
    from build_video import validate_storyboard_v4_2
    from visual_qa import run_schema_qa_layer

    captured = io.StringIO()
    try:
        with contextlib.redirect_stdout(captured):
            data = validate_storyboard_v4_2(path)
            scenes = data["scenes"]
            qa = [run_schema_qa_layer(scene, registry) for scene in scenes]
        ok = bool(scenes) and all(r["status"] == "PASS" for r in qa)
        return data, {"status": "PASS" if ok else "FAIL", "scenes": qa, "log": captured.getvalue()}
    except (Exception, SystemExit) as exc:
        return None, {"status": "FAIL", "error": str(exc), "log": captured.getvalue()}


def render_cases(jobs: list, reports: dict, output_dir: Path, args) -> dict:
    job_file = output_dir / "render_jobs.json"
    # The Node runner uses this exact manifest for all five cases and one bundle.
    write_json(job_file, {"version": "4.3", "settings": RENDER_SETTINGS, "cases": jobs,
                          "browser_executable": args.browser_executable})
    batch = run_command(["node", str(ROOT / "scripts" / "render_evals.mjs"),
                         "--jobs", str(job_file)], output_dir / "render.log")
    for job in jobs:
        report = reports[job["case"]]
        case_dir = Path(job["output_dir"])
        try:
            rendered = json.loads((case_dir / "render_result.json").read_text(encoding="utf-8"))
            if rendered.get("run_id") != job["run_id"]:
                raise ValueError("Stale render result from a previous run")
            report["render"] = rendered
            if rendered["status"] != "PASS":
                continue
            if not (case_dir / "video.mp4").is_file() or (case_dir / "video.mp4").stat().st_size == 0:
                raise ValueError("Missing/empty video.mp4")
            issues = check_frame_inventory(case_dir, job["samples"])
            if issues:
                raise ValueError("; ".join(issues))
            current = {
                "format_version": 1, "case": job["case"], "samples": job["samples"],
                "contract": {"props_sha256": job["props_sha256"], "render_settings": RENDER_SETTINGS,
                             "comparison_tolerance": DEFAULT_TOLERANCE,
                             "environment": rendered["environment"]},
                "provenance": rendered.get("provenance", {}),
            }
            issues = validate_rendered_frames(case_dir, current)
            if issues:
                raise ValueError("; ".join(issues))
            make_contact_sheet(case_dir, job["samples"])
            write_json(case_dir / "render_manifest.json", current)
            golden_dir = ROOT / "evals" / "golden_renders" / job["case"]
            comparison = compare_goldens(case_dir, golden_dir, current)
            if args.update_goldens:
                update_goldens(case_dir, golden_dir, current)
                comparison = {"status": "BASELINE_UPDATED_PENDING_REVIEW", "golden_dir": str(golden_dir),
                              "comparison_before_update": comparison}
            report["visual_comparison"] = comparison
            write_json(case_dir / "visual_comparison.json", comparison)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            report["render"] = {"status": "FAIL", "error": str(exc), "batch_log": batch["log"]}
    return batch


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", action="store_true", help="Render real silent videos and sampled PNGs")
    parser.add_argument("--case", action="append", default=[], help="Case stem, filename or numeric prefix; repeatable")
    parser.add_argument("--update-goldens", action="store_true", help="Write UNAPPROVED baseline candidates (requires --render)")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "out" / "evals")
    parser.add_argument("--browser-executable", help="Use an existing Chrome executable")
    parser.add_argument("--motion-tests", action="store_true", help="Also run templates npm test before rendering")
    args = parser.parse_args(argv)
    if (args.update_goldens or args.motion_tests) and not args.render:
        parser.error("--update-goldens and --motion-tests require --render")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / "benchmark_report.json"
    summary = {"version": "4.3", "mode": "render" if args.render else "contract",
               "scope": "Silent synthetic-timing engineering benchmark, not full audiovisual QA",
               "semantic_review": {"status": "PENDING_REVIEW", "approval_granted": False},
               "overall_status": "FAIL", "benchmarks": [], "negative_regressions": []}
    exit_code = 1
    try:
        eval_files = sorted((ROOT / "evals").glob("0*.json"))
        if args.case:
            matches = {selector: [p for p in eval_files if selector in (p.name, p.stem, p.stem.split("_")[0])]
                       for selector in args.case}
            if any(not cases for cases in matches.values()):
                raise ValueError(f"Unknown --case selector(s): {[s for s, cases in matches.items() if not cases]}")
            eval_files = sorted({p for paths in matches.values() for p in paths})
        if not eval_files:
            raise ValueError("No evals/0*.json cases found")
        summary["registry_check"] = run_command(
            [sys.executable, str(ROOT / "scripts" / "sync_registry.py"), "--check"],
            output_dir / "registry_check.log")
        if summary["registry_check"]["status"] != "PASS":
            raise ValueError("Registry/schema sync check failed; see registry_check.log")
        from build_video import load_registry_manifest
        registry = load_registry_manifest()
        jobs, reports = [], {}
        for path in eval_files:
            data, schema = evaluate_contract(path, registry)
            report = {"benchmark": path.name, "schema": schema, "render": {"status": "NOT_RUN"},
                      "visual_comparison": {"status": "NOT_RUN"},
                      "semantic_review": {"status": "PENDING_REVIEW", "approval_granted": False}}
            summary["benchmarks"].append(report)
            reports[path.stem] = report
            if data:
                report.update({"video_title": data.get("video_title"),
                               "renderer_ids": [s.get("renderer_id") for s in data["scenes"]],
                               "scenes_count": len(data["scenes"]),
                               "beats_count": sum(len(s.get("visual_choreography", [])) for s in data["scenes"])})
            if args.render and schema["status"] == "PASS":
                props = build_eval_props(data)
                case_dir = output_dir / path.stem
                props_path = case_dir / "props.json"
                write_json(props_path, props)
                jobs.append({"case": path.stem, "run_id": utc_now(), "storyboard": str(path),
                             "props_path": str(props_path), "props_sha256": json_hash(props),
                             "output_dir": str(case_dir), "samples": make_samples(props)})
            print(f"{path.name}: schema={schema['status']}")
        summary["negative_regressions"] = run_negative_regression_tests(registry)
        contracts_ok = (all(r["schema"]["status"] == "PASS" for r in reports.values())
                        and all(r["passed"] for r in summary["negative_regressions"]))
        if args.render and args.motion_tests:
            npm = shutil.which("npm.cmd" if sys.platform == "win32" else "npm") or "npm"
            summary["motion_tests"] = run_command([npm, "--prefix", str(ROOT / "templates"), "test"],
                                                   output_dir / "motion_tests.log")
            contracts_ok = contracts_ok and summary["motion_tests"]["status"] == "PASS"
        if args.render and contracts_ok:
            summary["render_batch"] = render_cases(jobs, reports, output_dir, args)
            renders_ok = (summary["render_batch"]["status"] == "PASS"
                          and all(r["render"]["status"] == "PASS" for r in reports.values()))
            comparisons = [r["visual_comparison"]["status"] for r in reports.values()]
            if renders_ok and not any(s in ("FAIL", "NOT_RUN") for s in comparisons):
                if all(s == "PASS" for s in comparisons):
                    summary["overall_status"] = "VISUAL_MATCH_SEMANTIC_REVIEW_PENDING"
                    exit_code = 0
                else:
                    summary["overall_status"] = "BASELINE_REVIEW_PENDING"
                    exit_code = 2
        elif not args.render and contracts_ok:
            summary["overall_status"] = "CONTRACT_PASS_VISUAL_NOT_RUN"
            exit_code = 0
    except (Exception, SystemExit) as exc:
        summary["error"] = str(exc)
    summary["exit_code"] = exit_code
    write_json(report_path, summary)
    print(f"{summary['overall_status']}: {report_path}")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
