#!/usr/bin/env python3
"""Deterministic local render inputs and fail-closed QA evidence validation.

The public directory is hashed in full, not just the currently selected assets.
Paths in props use Remotion staticFile semantics (relative to public). Remote
media must first be downloaded and the reference rewritten to that local file.
This is an integrity contract, not a sandbox for arbitrary executable renderer JS.
"""

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

REPO_ROOT = Path(__file__).resolve().parent.parent
AUDIO_SUFFIXES = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".aiff"}
MEDIA_SUFFIXES = AUDIO_SUFFIXES | {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp",
    ".mp4", ".webm", ".mov", ".woff", ".woff2", ".ttf", ".otf", ".glb", ".gltf",
}
CODE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".scss", ".json"}
QA_LAYERS = ("schema_qa", "render_qa", "motion_qa", "semantic_qa")


def reject(detail, code="REJECTED_STALE_QA_REPORT"):
    raise ValueError(f"{code}: {detail}")


def canonical_json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def _unique_object(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            reject(f"Duplicate JSON key: {key}", "REJECTED_INVALID_JSON")
        obj[key] = value
    return obj


def read_json(path):
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8-sig"),
                           object_pairs_hook=_unique_object)
        canonical_json(value)  # Reject NaN / Infinity, including nested values.
        return value
    except (OSError, UnicodeError, ValueError) as exc:
        reject(f"Cannot read JSON {path}: {exc}", "REJECTED_INVALID_JSON")


def _digest(value):
    return hashlib.sha256(canonical_json(value)).hexdigest()


def file_sha256(path):
    try:
        with Path(path).open("rb") as stream:
            digest = hashlib.sha256()
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
            return digest.hexdigest()
    except OSError as exc:
        reject(f"Cannot hash {path}: {exc}", "REJECTED_MISSING_INPUT")


def _local_file(path, root):
    path, root = Path(path), Path(root).resolve()
    try:
        relative = path.relative_to(root)
        cursor = root
        for part in relative.parts:
            cursor = cursor / part
            if cursor.is_symlink():
                reject(f"Symlink input is not pinned: {cursor}", "REJECTED_ASSET_PATH")
        path.resolve().relative_to(root)
    except ValueError as exc:
        reject(f"Input escapes local root: {path}: {exc}", "REJECTED_ASSET_PATH")
    if not path.is_file():
        reject(f"Missing local file: {path}", "REJECTED_MISSING_INPUT")
    return path


def _tree(root):
    if not root.exists() and not root.is_symlink():
        return {}
    if root.is_symlink() or not root.is_dir():
        reject(f"Not a pinned directory: {root}", "REJECTED_ASSET_PATH")
    result = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            reject(f"Symlink input: {path}", "REJECTED_ASSET_PATH")
        if path.is_file():
            result[path.relative_to(root).as_posix()] = file_sha256(_local_file(path, root))
    return result


def _mirror(root_name, mirror_name, remotion_dir, optional=False):
    root = REPO_ROOT / root_name
    mirror = remotion_dir / "src" / "registry" / mirror_name
    if optional and not any(p.exists() or p.is_symlink() for p in (root, mirror)):
        return {"present": False}
    _local_file(root, REPO_ROOT)
    _local_file(mirror, remotion_dir)
    if root.read_bytes() != mirror.read_bytes():
        reject(f"Root and generated mirror differ: {root} != {mirror}",
               "REJECTED_REGISTRY_DRIFT" if not optional else "REJECTED_SCHEMA_DRIFT")
    read_json(root)
    return {"present": True, "root": file_sha256(root), "mirror": file_sha256(mirror)}


def load_root_registry():
    manifest = read_json(REPO_ROOT / "renderer-registry.json")
    if not isinstance(manifest, dict) or not isinstance(manifest.get("registry_version"), str):
        reject("Root registry lacks registry_version", "REJECTED_REGISTRY_DRIFT")
    return manifest


def _asset_reference(value, public_dir):
    if not isinstance(value, str) or not value.strip():
        return  # Empty / omitted audio is a valid silent track.
    value = value.strip()
    parsed = urlsplit(value)
    if parsed.scheme == "data":
        return  # Immutable inline bytes are already covered by props / source.
    if parsed.scheme or parsed.netloc or value.startswith(("//", "\\")):
        reject(f"Media must be pinned to a local public file: {value}", "REJECTED_REMOTE_ASSET")
    decoded = unquote(parsed.path)
    # Reject drive letters / NTFS alternate streams and encoded URL-root escapes.
    if ":" in decoded or decoded.startswith("//") or "\\" in decoded or "\x00" in decoded or ".." in Path(decoded).parts:
        reject(f"Unsafe media reference: {value}", "REJECTED_ASSET_PATH")
    # A leading slash denotes the public URL root, never the filesystem root.
    path = public_dir / decoded.lstrip("/")
    return _local_file(path, public_dir)


def _validate_props_references(value, public_dir, context="", audio_refs=None, audio_context=False):
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = re.sub(r"[^a-z]", "", key.lower())
            if normalized in {"code", "codesnippet", "terminalcommands", "narration", "repourl", "repopath"}:
                continue  # Displayed code/provenance is not a fetched media reference.
            media_key = (
                normalized in {"src", "href", "url", "path", "file", "poster"}
                or normalized.endswith(("url", "src", "path", "file"))
                or normalized in {"audio", "image", "video", "font", "asset", "assets", "images",
                                  "screenshot", "screenshots", "backgroundimage", "thumbnail"}
            )
            child_context = normalized if media_key else context
            _validate_props_references(child, public_dir, child_context, audio_refs,
                                       audio_context or "audio" in normalized)
    elif isinstance(value, list):
        for child in value:
            _validate_props_references(child, public_dir, context, audio_refs, audio_context)
    elif isinstance(value, str):
        # Also recognize extension-bearing media references in custom payload keys.
        suffix = Path(urlsplit(value).path).suffix.lower() if "\n" not in value else ""
        if context or (suffix in MEDIA_SUFFIXES and not any(c.isspace() for c in value)):
            path = _asset_reference(value, public_dir)
            if audio_context and audio_refs is not None:
                if path is not None:
                    audio_refs[path.relative_to(public_dir).as_posix()] = file_sha256(path)
                elif value.startswith("data:"):
                    audio_refs["inline:" + _digest(value)] = _digest(value)


def _validate_stylesheet_references(path, text, local_root, public_dir):
    for match in re.finditer(r"\burl\(\s*['\"]?([^)'\"]+)['\"]?\s*\)", text):
        ref = match.group(1).strip()
        if ref.startswith(("#", "data:")) or "${" in ref:
            continue
        if urlsplit(ref).scheme or ref.startswith("/"):
            _asset_reference(ref, public_dir)
        else:
            target = path.parent / unquote(urlsplit(ref).path)
            _local_file(target, local_root)


def _validate_public_references(public_dir):
    for path in sorted(public_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".css", ".svg"}:
            continue
        text = path.read_text(encoding="utf-8-sig")
        _validate_stylesheet_references(path, text, public_dir, public_dir)
        if path.suffix.lower() == ".svg":
            for match in re.finditer(r"(?:\bhref|\bsrc)\s*=\s*(['\"])(.*?)\1", text):
                ref = match.group(2)
                if ref.startswith(("#", "data:")):
                    continue
                if urlsplit(ref).scheme or ref.startswith("/"):
                    _asset_reference(ref, public_dir)
                else:
                    _local_file(path.parent / unquote(urlsplit(ref).path), public_dir)


def _validate_source_references(src_dir, public_dir):
    for path in sorted(src_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in CODE_SUFFIXES - {".json"}:
            continue
        text = path.read_text(encoding="utf-8-sig")
        # Includes constants and template literals later passed to Audio/Img/fetch,
        # not merely direct JSX attributes. Computed JS remains trusted source.
        for match in re.finditer(r"['\"`]((?:https?:|//|blob:|file:)[^'\"`\s]*)", text):
            _asset_reference(match.group(1), public_dir)
        for match in re.finditer(r"staticFile\(\s*(['\"`])(.*?)\1\s*\)", text):
            if "${" not in match.group(2):
                _asset_reference(match.group(2), public_dir)
        for match in re.finditer(r"\bsrc\s*[:=]\s*\{?\s*(['\"])(.*?)\1", text):
            _asset_reference(match.group(2), public_dir)
        _validate_stylesheet_references(path, text, src_dir, public_dir)
        # Resolve literal relative imports too: imports may not escape src into an
        # untracked workspace or silently rely on a missing file.
        for match in re.finditer(r"(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)(['\"])(\.[^'\"]+)\1", text):
            ref = match.group(2)
            target = path.parent / ref
            candidates = [target] + [Path(str(target) + ext) for ext in CODE_SUFFIXES]
            candidates += [target / ("index" + ext) for ext in CODE_SUFFIXES]
            found = next((p for p in candidates if p.is_file()), None)
            if found is None:
                reject(f"Missing relative import {ref} in {path}", "REJECTED_MISSING_INPUT")
            _local_file(found, src_dir)


def compute_build_fingerprint(props_path, remotion_dir):
    """Return classified SHA-256 inputs for this actual Remotion project.

    A missing lockfile is explicitly hashed as absent (small fixture/projects can
    be unlocked); adding or deleting it invalidates prior evidence. No node_modules
    or unrelated fixed template tree is used. Invalid local inputs raise ValueError.
    """
    remotion_dir = Path(remotion_dir).resolve()
    props = read_json(props_path)
    if not isinstance(props, dict):
        reject("Props must be an object", "REJECTED_INVALID_PROPS")
    _local_file(remotion_dir / "src" / "index.ts", remotion_dir)
    _local_file(remotion_dir / "package.json", remotion_dir)
    registry = _mirror("renderer-registry.json", "registry_manifest.json", remotion_dir)
    schema = _mirror("animation-contract.schema.json", "animation_contract.schema.json", remotion_dir, True)
    load_root_registry()
    source = _tree(remotion_dir / "src")
    public = _tree(remotion_dir / "public")
    referenced_audio = {}
    _validate_props_references(props, remotion_dir / "public", audio_refs=referenced_audio)
    _validate_source_references(remotion_dir / "src", remotion_dir / "public")
    _validate_public_references(remotion_dir / "public")

    config = {}
    patterns = ("package*.json", "*lock*", "remotion.config.*", "tsconfig*.json", "jsconfig*.json",
                "*webpack*", "*vite.config.*", "*babel*", ".babelrc*", ".npmrc", ".yarnrc*",
                "postcss.config.*", "tailwind.config.*", ".swcrc", "*.config.*")
    for pattern in patterns:
        for path in sorted(remotion_dir.glob(pattern)):
            if path.is_file() or path.is_symlink():
                config[path.name] = file_sha256(_local_file(path, remotion_dir))
    for required in ("package.json", "package-lock.json", "remotion.config.ts", "tsconfig.json"):
        config.setdefault(required, None)
    # Local tsconfig inheritance affects compilation and must be pinned too.
    pending = [p for p in config if p.startswith(("tsconfig", "jsconfig")) and config[p]]
    while pending:
        name = pending.pop()
        data = read_json(remotion_dir / name)
        inherited = data.get("extends", [])
        for ref in ([inherited] if isinstance(inherited, str) else inherited):
            if not ref.startswith("."):
                continue  # Package-provided config is pinned by package / lockfile.
            target = (remotion_dir / name).parent / ref
            if not target.suffix:
                target = target.with_suffix(".json")
            target = _local_file(target, remotion_dir).resolve()
            key = target.relative_to(remotion_dir).as_posix()
            if key not in config:
                config[key] = file_sha256(target)
                pending.append(key)

    audio = {"reference/" + name: sha for name, sha in referenced_audio.items()}
    assets = {}
    for prefix, tree in (("public", public), ("src", source)):
        for name, sha in tree.items():
            if (Path(name).suffix.lower() in AUDIO_SUFFIXES or name.startswith("audio/")
                    or (prefix == "public" and name in referenced_audio)):
                audio[f"{prefix}/{name}"] = sha
            elif prefix == "public" or Path(name).suffix.lower() not in CODE_SUFFIXES:
                assets[f"{prefix}/{name}"] = sha
    fingerprint = {
        "fingerprint_version": 1,
        "storyboard_hash": _digest(props),  # FULL props: independent timings, fps, duration, inline code.
        "registry_hash": _digest(registry),
        "schema_hash": _digest(schema),
        "renderer_source_hash": _digest(source),
        "assets_hash": _digest(assets),
        "audio_hash": _digest(audio),
        "config_hash": _digest(config),
        "composition_hash": _digest({"props": props, "source": source, "config": config,
                                     "composition_id": "TutorialVideo"}),
    }
    fingerprint["build_hash"] = _digest(fingerprint)
    return fingerprint


def _same_fingerprint(report, fingerprint):
    if canonical_json(report.get("build_fingerprint")) != canonical_json(fingerprint):
        reject("Missing or changed build_fingerprint; rerender QA frames")


def _indexed_scenes(rows, expected, label, id_key="scene_id"):
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        reject(f"Invalid {label} scenes")
    ids = [row.get(id_key) for row in rows]
    if any(not isinstance(sid, str) or not sid for sid in ids):
        reject(f"Invalid {label} scene ID")
    if len(ids) != len(set(ids)) or set(ids) != set(expected):
        reject(f"Missing, extra or duplicate {label} scene IDs")
    return {row[id_key]: row for row in rows}


def _evidence_file(root, reference, expected_name):
    if not isinstance(reference, str):
        reject(f"Missing artifact reference: {expected_name}")
    path = Path(reference)
    if not path.is_absolute():
        path = root / path
    expected = root / expected_name
    if path != expected:
        reject(f"Artifact path differs from expected plan: {reference}")
    return _local_file(path, root)


def _validate_frame_evidence(report, props, mode, fingerprint):
    # Lazy import preserves the legacy three-argument scene-signature API without
    # a module import cycle, and shares the exact sampling plan with the producer.
    from visual_qa import (plan_qa_scenes, scene_frame_plan, verify_png_file,
                           compute_scene_signature_hash)

    _same_fingerprint(report, fingerprint)
    scope = "full" if mode == "full" else "sample"
    if report.get("mode") != mode or report.get("scope") != scope:
        reject("QA mode / scope mismatch")
    if report.get("layers", {}).get("render_qa") != "PASS":
        reject("Cached Render QA did not pass")
    root_value = report.get("qa_output_dir")
    if not isinstance(root_value, str) or not Path(root_value).is_absolute():
        reject("Missing absolute qa_output_dir")
    root = Path(root_value)
    if root.is_symlink() or root.resolve() != root:
        reject("QA artifact root is not pinned")
    selected = plan_qa_scenes(props, mode)
    rows = _indexed_scenes(report.get("scenes"), [s[0]["id"] for s in selected], "report")
    registry_version = load_root_registry()["registry_version"]
    expected_artifacts = {"contact_sheet.png" if mode == "full" else "first_shot_sheet.png"}
    for scene, start in selected:
        sid = scene["id"]
        row = rows[sid]
        frames = row.get("frames")
        plan = scene_frame_plan(scene, start)
        if not isinstance(frames, list) or len(frames) != len(plan):
            reject(f"Incomplete frame manifest: {sid}")
        paths = []
        for saved, planned in zip(frames, plan):
            if not isinstance(saved, dict):
                reject(f"Invalid frame manifest: {sid}")
            for key in ("kind", "tag", "frame", "beat_index"):
                if canonical_json(saved.get(key)) != canonical_json(planned[key]):
                    reject(f"Frame plan mismatch: {sid}/{key}")
            png = _evidence_file(root, saved.get("image_path"), "frames/" + planned["filename"])
            if not verify_png_file(png) or saved.get("sha256") != file_sha256(png):
                reject(f"Missing, invalid or changed PNG: {png}")
            paths.append(png)
        expected_sig = compute_scene_signature_hash(scene, registry_version, paths, fingerprint)
        if row.get("scene_signature_hash") != expected_sig:
            reject(f"Scene signature mismatch: {sid}")
        expected_artifacts.add(f"continuous_{sid}.png")
    artifacts = report.get("artifact_hashes")
    if not isinstance(artifacts, dict) or set(artifacts) != expected_artifacts:
        reject("Incomplete contact-sheet / continuous-strip manifest")
    for name, sha in artifacts.items():
        png = _evidence_file(root, name, name)
        if not verify_png_file(png) or sha != file_sha256(png):
            reject(f"Changed QA artifact: {png}")
    sheet_name = "contact_sheet.png" if mode == "full" else "first_shot_sheet.png"
    _evidence_file(root, report.get("contact_sheet"), sheet_name)
    return rows, root


def validate_qa_frame_cache(report_path, props_path, remotion_dir, mode="full", fingerprint=None):
    """Validate reusable image evidence, allowing a pending human checklist.

    This deliberately does NOT approve semantic QA. It only proves that every
    expected image is still bound to the current build and exact sampling plan.
    """
    try:
        current = fingerprint if fingerprint is not None else compute_build_fingerprint(props_path, remotion_dir)
        report = read_json(report_path)
        _validate_frame_evidence(report, read_json(props_path), mode, current)
        return report
    except (ValueError, TypeError, KeyError, AttributeError, OSError) as exc:
        reject(str(exc), "REJECTED_STALE_QA_CACHE")


def validate_final_qa_report(report_path, props_path, remotion_dir):
    """Require full, current, complete four-layer approval; return current fingerprint.

    There is intentionally no legacy report or status-only fallback.
    """
    try:
        current = compute_build_fingerprint(props_path, remotion_dir)
        report = read_json(report_path)
        rows, root = _validate_frame_evidence(report, read_json(props_path), "full", current)
        if report.get("overall_status") != "APPROVED":
            reject("Final report is not APPROVED")
        if any(report.get("layers", {}).get(layer) != "PASS" for layer in QA_LAYERS):
            reject("All four layers must explicitly PASS")
        if report.get("issues") != [] or report.get("issues_count") != 0:
            reject("Report has unresolved or missing issue results")
        checklist_path = _evidence_file(root, report.get("semantic_qa_checklist"), "semantic_qa_checklist.json")
        checklist = read_json(checklist_path)
        _same_fingerprint(checklist, current)
        if checklist.get("scope") != "full" or checklist.get("all_verified") is not True:
            reject("Checklist is not fully verified for full scope")
        _evidence_file(root, checklist.get("contact_sheet"), "contact_sheet.png")
        approvals = _indexed_scenes(checklist.get("scenes"), rows.keys(), "checklist")
        from visual_qa import MANDATORY_SEMANTIC_QUESTIONS
        question_ids = {q["id"] for q in MANDATORY_SEMANTIC_QUESTIONS}
        for sid, row in rows.items():
            if row.get("status") != "PASS" or row.get("schema_qa") != "PASS" or row.get("issues") != []:
                reject(f"Scene did not PASS: {sid}")
            approval = approvals[sid]
            if approval.get("agent_verified") is not True:
                reject(f"Missing real boolean approval: {sid}")
            if approval.get("scene_signature_hash") != row["scene_signature_hash"]:
                reject(f"Checklist signature mismatch: {sid}")
            _evidence_file(root, approval.get("continuous_strip_image"), f"continuous_{sid}.png")
            answers = approval.get("answers")
            if not isinstance(answers, dict) or set(answers) != question_ids:
                reject(f"Missing or extra mandatory questions: {sid}")
            if any(not isinstance(answer, dict) or answer.get("pass") is not True for answer in answers.values()):
                reject(f"All five answers must be boolean True: {sid}")
        if compute_build_fingerprint(props_path, remotion_dir) != current:
            reject("Build changed during final QA validation")
        return current
    except (ValueError, TypeError, KeyError, AttributeError, OSError) as exc:
        reject(str(exc))
