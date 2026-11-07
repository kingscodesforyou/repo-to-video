import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GENERATED_FILES = {
    "renderer-registry.json": "registry_manifest.json",
    "animation-contract.schema.json": "animation_contract.schema.json",
}


def resolve_payload_properties(payload_schema, schema):
    """Effective property names for an action payload, following $ref / anyOf."""
    names = set()
    reference = payload_schema.get("$ref")
    if reference:
        names |= resolve_payload_properties(schema["$defs"][reference.removeprefix("#/$defs/")], schema)
    names |= set(payload_schema.get("properties", {}).keys())
    for branch in payload_schema.get("anyOf", []) + payload_schema.get("allOf", []) + payload_schema.get("oneOf", []):
        names |= resolve_payload_properties(branch, schema)
    return names


def validate_registry(manifest, schema):
    primitives = manifest.get("motion_primitives")
    if not isinstance(primitives, dict) or not primitives:
        raise ValueError("motion_primitives must be an action-keyed object")
    seen = set()
    for renderer in manifest["renderers"]:
        for key in [renderer["id"], *renderer.get("aliases", []), renderer["component"]]:
            if key in seen:
                raise ValueError(f"Duplicate renderer key: {key}")
            seen.add(key)
        for action in renderer["supportedActions"]:
            if action not in primitives:
                raise ValueError(f"Unregistered action: {action}")
        for obj in renderer["supportedObjects"]:
            if obj not in manifest["object_renderers"]:
                raise ValueError(f"Unregistered object: {obj}")
    for action, spec in primitives.items():
        payload_schema = spec["payload_schema"]
        required = payload_schema.get("required", [])
        if spec["required_payload"] != required:
            raise ValueError(f"Required payload metadata disagrees with schema: {action}")
        reference = payload_schema.get("$ref")
        if reference and reference.removeprefix("#/$defs/") not in schema["$defs"]:
            raise ValueError(f"Unknown payload schema: {action}")
        properties = resolve_payload_properties(payload_schema, schema)
        if not set(required) <= properties:
            raise ValueError(f"Required payload field absent from schema properties: {action}")
        expected_optional = sorted(properties - set(required))
        if spec.get("optional_payload") != expected_optional:
            raise ValueError(f"Optional payload metadata disagrees with schema: {action}")


def sync_registry(project_dir=None, check=False):
    project_dir = Path(project_dir or ROOT / "templates").resolve()
    manifest = json.loads((ROOT / "renderer-registry.json").read_text(encoding="utf-8"))
    schema = json.loads((ROOT / "animation-contract.schema.json").read_text(encoding="utf-8"))
    validate_registry(manifest, schema)
    target_dir = project_dir / "src" / "registry"
    if not target_dir.is_dir():
        raise ValueError(f"Missing renderer registry directory: {target_dir}")
    for source_name, generated_name in GENERATED_FILES.items():
        source = ROOT / source_name
        target = target_dir / generated_name
        if check:
            if not target.is_file() or target.read_bytes() != source.read_bytes():
                raise ValueError(f"REGISTRY_DRIFT: {target}; run scripts/sync_registry.py before building")
        elif not target.exists() or target.read_bytes() != source.read_bytes():
            target.write_bytes(source.read_bytes())
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate or verify renderer contract mirrors")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--project-dir", type=Path)
    args = parser.parse_args()
    sync_registry(args.project_dir, args.check)
    print("Registry and animation contract mirrors verified" if args.check else "Registry and animation contract mirrors generated")
