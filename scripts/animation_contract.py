import json
import math
import re
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ModuleNotFoundError:
    class _ValidationError:
        def __init__(self, message, path=()):
            self.message = message
            self.absolute_path = list(path)

    class Draft202012Validator:  # type: ignore[no-redef]
        def __init__(self, schema):
            self.schema = schema
            self.defs = schema.get("$defs", {})

        def _resolve(self, node):
            while "$ref" in node:
                ref = node["$ref"]
                if not ref.startswith("#/$defs/"):
                    raise ValueError(f"Unsupported $ref: {ref}")
                target = self.defs[ref.split("/")[-1]]
                siblings = {k: v for k, v in node.items() if k != "$ref"}
                node = {**target, **siblings}
            return node

        def _check_type(self, value, expected):
            if expected == "object":
                return isinstance(value, dict)
            if expected == "array":
                return isinstance(value, list)
            if expected == "string":
                return isinstance(value, str)
            if expected == "boolean":
                return isinstance(value, bool)
            if expected == "integer":
                return isinstance(value, int) and not isinstance(value, bool)
            if expected == "number":
                return isinstance(value, (int, float)) and not isinstance(value, bool)
            return True

        def iter_errors(self, instance, _node=None, _path=()):
            node = self._resolve(self.schema if _node is None else _node)
            if "anyOf" in node:
                if not any(not list(self.iter_errors(instance, sub, _path)) for sub in node["anyOf"]):
                    yield _ValidationError("is not valid under any of the given schemas", _path)
                return
            expected_type = node.get("type")
            if expected_type and not self._check_type(instance, expected_type):
                yield _ValidationError(f"{instance!r} is not of type {expected_type!r}", _path)
                return
            if "enum" in node and instance not in node["enum"]:
                yield _ValidationError(f"{instance!r} is not one of {node['enum']!r}", _path)
                return
            if isinstance(instance, str):
                if "minLength" in node and len(instance) < node["minLength"]:
                    yield _ValidationError(f"{instance!r} is too short", _path)
                if "maxLength" in node and len(instance) > node["maxLength"]:
                    yield _ValidationError(f"{instance!r} is too long", _path)
                if "pattern" in node and not re.search(node["pattern"], instance):
                    yield _ValidationError(f"{instance!r} does not match {node['pattern']!r}", _path)
            elif isinstance(instance, (int, float)) and not isinstance(instance, bool):
                if "minimum" in node and instance < node["minimum"]:
                    yield _ValidationError(f"{instance} is less than the minimum of {node['minimum']}", _path)
                if "maximum" in node and instance > node["maximum"]:
                    yield _ValidationError(f"{instance} is greater than the maximum of {node['maximum']}", _path)
                if "exclusiveMinimum" in node and instance <= node["exclusiveMinimum"]:
                    yield _ValidationError(f"{instance} is less than or equal to the minimum of {node['exclusiveMinimum']}", _path)
            elif isinstance(instance, list):
                if "minItems" in node and len(instance) < node["minItems"]:
                    yield _ValidationError(f"{instance!r} is too short", _path)
                if "maxItems" in node and len(instance) > node["maxItems"]:
                    yield _ValidationError(f"{instance!r} is too long", _path)
                if node.get("uniqueItems"):
                    seen = []
                    for item in instance:
                        if item in seen:
                            yield _ValidationError(f"{instance!r} has non-unique elements", _path)
                            break
                        seen.append(item)
                if "items" in node:
                    for idx, item in enumerate(instance):
                        yield from self.iter_errors(item, node["items"], (*_path, idx))
            elif isinstance(instance, dict):
                for req in node.get("required", []):
                    if req not in instance:
                        yield _ValidationError(f"{req!r} is a required property", _path)
                props = node.get("properties", {})
                addl = node.get("additionalProperties", True)
                for key, val in instance.items():
                    if key in props:
                        yield from self.iter_errors(val, props[key], (*_path, key))
                    elif addl is False:
                        yield _ValidationError(f"Additional properties are not allowed ({key!r} was unexpected)", _path)
                    elif isinstance(addl, dict):
                        yield from self.iter_errors(val, addl, (*_path, key))

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
    visual_mode = scene.get("visual_mode")
    supported_modes = renderer.get("visualModes", [])
    if supported_modes and visual_mode not in supported_modes:
        errors.append(f"Renderer {renderer['id']} does not support visual_mode {visual_mode}")
    forbidden_2d_cameras = set(
        (manifest.get("supported_visual_modes", {}).get("2d_editorial", {}) or {}).get(
            "forbidden_cameras",
            ["orbit_left", "orbit_right", "isometric_tilt", "top_down_overview"],
        )
    )
    world = scene["visual_world"]
    if visual_mode == "2d_editorial":
        art_style = (scene.get("art_direction") or {}).get("style")
        if art_style in ("mechanism_3d", "premium_3d_editorial", "spatial_25d"):
            errors.append(f"2d_editorial scene forbids 3D art_direction.style {art_style}")
    elif visual_mode == "hybrid":
        has_2d_layer = bool(scene.get("text_overlays")) or bool(world.get("object_labels"))
        if not has_2d_layer:
            errors.append("hybrid scene requires at least one 2D information layer (text_overlays or object_labels)")
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
        if visual_mode == "2d_editorial" and beat["camera"] in forbidden_2d_cameras:
            errors.append(f"{prefix}: 2d_editorial scene forbids 3D tilt camera {beat['camera']}")
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
            if visual_mode == "2d_editorial" and rule.get("zOffset") not in (None, 0):
                errors.append(f"{prefix}: 2d_editorial scene forbids non-zero zOffset in yielding")
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
