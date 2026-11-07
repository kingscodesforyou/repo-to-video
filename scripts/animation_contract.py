import json
import math
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = json.loads((ROOT / "animation-contract.schema.json").read_text(encoding="utf-8"))
SCENE_VALIDATOR = Draft202012Validator(SCHEMA)


def object_id(value):
    return value if isinstance(value, str) else value.get("id") or value.get("type", "")


def scoped_schema(schema):
    return {"$schema": SCHEMA["$schema"], "$defs": SCHEMA["$defs"], **schema}


def finite_errors(value, path="scene"):
    if isinstance(value, float) and not math.isfinite(value):
        return [f"{path}: non-finite number"]
    if isinstance(value, dict):
        return [error for key, item in value.items() for error in finite_errors(item, f"{path}.{key}")]
    if isinstance(value, list):
        return [error for index, item in enumerate(value) for error in finite_errors(item, f"{path}[{index}]")]
    return []


def validate_animation_scene(scene, manifest):
    errors = finite_errors(scene)
    errors.extend(f"{'.'.join(map(str, error.absolute_path))}: {error.message}" for error in SCENE_VALIDATOR.iter_errors(scene))
    if errors:
        return errors
    renderers = {key: renderer for renderer in manifest["renderers"] for key in [renderer["id"], renderer["component"], *renderer.get("aliases", [])]}
    renderer = renderers.get(scene["renderer_id"])
    if not renderer:
        return [f"Unregistered renderer: {scene['renderer_id']}"]
    world = scene["visual_world"]
    objects = [object_id(world["primary_object"]), *map(object_id, world["secondary_objects"])]
    if len(set(objects)) != len(objects):
        errors.append("Scene object IDs must be unique")
    for obj in objects:
        if obj not in manifest["object_renderers"] or obj not in renderer["supportedObjects"]:
            errors.append(f"Unsupported scene object: {obj}")
    if world["environment"] not in renderer["supportedEnvironments"]:
        errors.append(f"Unsupported environment: {world['environment']}")
    for label_id in world.get("object_labels", {}):
        if label_id not in objects:
            errors.append(f"Label references absent object: {label_id}")
    for index, beat in enumerate(scene["visual_choreography"]):
        prefix = f"visual_choreography[{index}]"
        action = beat["action"]
        if beat["target"] not in objects:
            errors.append(f"{prefix}: target is not a scene object")
        if beat["camera"] not in renderer["supportedCameras"]:
            errors.append(f"{prefix}: unsupported camera")
        look_at = beat.get("camera_config", {}).get("lookAt")
        if look_at is not None and look_at not in objects:
            errors.append(f"{prefix}: lookAt is not a scene object")
        if len(scene["visual_choreography"]) > 1 and not beat.get("yielding"):
            errors.append(f"{prefix}: structured yielding rules required")
        targets = []
        for rule in beat.get("yielding", []):
            target = rule["target"]
            if target not in [*objects, "background_grid", "*", "non_focal"]:
                errors.append(f"{prefix}: unknown yielding target {target}")
            if target in targets:
                errors.append(f"{prefix}: duplicate yielding target {target}")
            targets.append(target)
        spec = manifest["motion_primitives"].get(action)
        if not spec or action not in renderer["supportedActions"]:
            errors.append(f"{prefix}: unsupported action {action}")
            continue
        payload = beat.get("payload", {})
        validator = Draft202012Validator(scoped_schema(spec["payload_schema"]))
        payload_errors = list(validator.iter_errors(payload))
        errors.extend(f"{prefix}.payload: {error.message}" for error in payload_errors)
        unsupported = set(payload) - set(renderer.get("payloadSchema", []))
        if unsupported:
            errors.append(f"{prefix}: renderer does not consume payload fields {sorted(unsupported)}")
        if payload_errors:
            continue
        assets = world.get("authentic_assets", {})
        if "command_index" in payload and payload["command_index"] >= len(assets.get("terminal_commands", [])):
            errors.append(f"{prefix}: command_index is out of range")
        if "focus_layer" in payload and payload["focus_layer"] >= len(world["secondary_objects"]):
            errors.append(f"{prefix}: focus_layer is out of range")
        if "lines" in payload and any(line > len(assets.get("code_snippet", "").splitlines()) for line in payload["lines"]):
            errors.append(f"{prefix}: highlighted line is out of range")
    return errors
