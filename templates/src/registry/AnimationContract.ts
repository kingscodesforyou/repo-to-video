import Ajv2020 from "ajv/dist/2020";
import schema from "./animation_contract.schema.json";
import manifest from "./registry_manifest.json";

const ajv = new Ajv2020({ allErrors: true, strict: false, strictNumbers: true });
const sceneValidator = ajv.compile<Record<string, any>>(schema);
const primitives = manifest.motion_primitives as Record<string, { payload_schema: Record<string, unknown> }>;
const payloadValidators = new Map(
  Object.entries(primitives).map(([action, spec]) => [
    action,
    ajv.compile<Record<string, any>>({ $schema: schema.$schema, $defs: schema.$defs, ...spec.payload_schema }),
  ])
);
const renderers = new Map(manifest.renderers.flatMap((renderer) =>
  [renderer.id, renderer.component, ...renderer.aliases].map((key) => [key, renderer] as const)
));

const objectId = (value: any): string => typeof value === "string" ? value : value.id || value.type;

export function validateAnimationScene(scene: any): string[] {
  if (!sceneValidator(scene)) return [ajv.errorsText(sceneValidator.errors)];
  const errors: string[] = [];
  const renderer = renderers.get(scene.renderer_id);
  if (!renderer) return [`Unregistered renderer: ${scene.renderer_id}`];
  const visualMode = scene.visual_mode;
  const supportedModes: string[] = (renderer as any).visualModes || [];
  if (supportedModes.length > 0 && !supportedModes.includes(visualMode)) {
    errors.push(`Renderer ${renderer.id} does not support visual_mode ${visualMode}`);
  }
  const forbidden2DCameras = new Set<string>(
    ((manifest as any).supported_visual_modes?.["2d_editorial"]?.forbidden_cameras as string[]) || [
      "orbit_left",
      "orbit_right",
      "isometric_tilt",
      "top_down_overview",
    ]
  );
  const world = scene.visual_world;
  if (visualMode === "2d_editorial") {
    const artStyle = scene.art_direction?.style;
    if (["mechanism_3d", "premium_3d_editorial", "spatial_25d"].includes(artStyle)) {
      errors.push(`2d_editorial scene forbids 3D art_direction.style ${artStyle}`);
    }
  } else if (visualMode === "hybrid") {
    const has2DLayer =
      (Array.isArray(scene.text_overlays) && scene.text_overlays.length > 0) ||
      Boolean(world.object_labels && Object.keys(world.object_labels).length > 0);
    if (!has2DLayer) {
      errors.push("hybrid scene requires at least one 2D information layer (text_overlays or object_labels)");
    }
  }
  const objects: string[] = [objectId(world.primary_object), ...world.secondary_objects.map(objectId)];
  if (new Set(objects).size !== objects.length) errors.push("Scene object IDs must be unique");
  for (const object of objects) {
    if (!(object in manifest.object_renderers) || !renderer.supportedObjects.includes(object)) {
      errors.push(`Unsupported scene object: ${object}`);
    }
  }
  if (!renderer.supportedEnvironments.includes(world.environment)) errors.push("Unsupported environment");
  for (const id of Object.keys(world.object_labels || {})) {
    if (!objects.includes(id)) errors.push(`Label references absent object: ${id}`);
  }
  scene.visual_choreography.forEach((beat: any, index: number) => {
    const prefix = `visual_choreography[${index}]`;
    if (!objects.includes(beat.target)) errors.push(`${prefix}: target is not a scene object`);
    if (!renderer.supportedCameras.includes(beat.camera)) errors.push(`${prefix}: unsupported camera`);
    if (visualMode === "2d_editorial" && forbidden2DCameras.has(beat.camera)) {
      errors.push(`${prefix}: 2d_editorial scene forbids 3D tilt camera ${beat.camera}`);
    }
    if (beat.camera_config?.lookAt !== undefined && !objects.includes(beat.camera_config.lookAt)) {
      errors.push(`${prefix}: lookAt is not a scene object`);
    }
    if (scene.visual_choreography.length > 1 && !beat.yielding?.length) errors.push(`${prefix}: structured yielding rules required`);
    const targets = new Set<string>();
    for (const rule of beat.yielding || []) {
      if (![...objects, "background_grid", "*", "non_focal"].includes(rule.target)) errors.push(`${prefix}: unknown yielding target`);
      if (targets.has(rule.target)) errors.push(`${prefix}: duplicate yielding target`);
      targets.add(rule.target);
      if (visualMode === "2d_editorial" && rule.zOffset !== undefined && rule.zOffset !== 0) {
        errors.push(`${prefix}: 2d_editorial scene forbids non-zero zOffset in yielding`);
      }
    }
    const validatePayload = payloadValidators.get(beat.action);
    if (!validatePayload || !renderer.supportedActions.includes(beat.action)) {
      errors.push(`${prefix}: unsupported action ${beat.action}`);
      return;
    }
    const payload = beat.payload || {};
    const validPayload = validatePayload(payload);
    if (!validPayload) errors.push(`${prefix}.payload: ${ajv.errorsText(validatePayload.errors)}`);
    if (Object.keys(payload).some((key) => !renderer.payloadSchema.includes(key))) errors.push(`${prefix}: renderer does not consume payload fields`);
    if (!validPayload) return;
    const assets = world.authentic_assets || {};
    if (payload.command_index !== undefined && payload.command_index >= (assets.terminal_commands || []).length) errors.push(`${prefix}: command_index is out of range`);
    if (payload.focus_layer !== undefined && payload.focus_layer >= world.secondary_objects.length) errors.push(`${prefix}: focus_layer is out of range`);
    const lineCount = assets.code_snippet ? assets.code_snippet.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").length : 0;
    if (payload.lines?.some((line: number) => line > lineCount)) errors.push(`${prefix}: highlighted line is out of range`);
  });
  return errors;
}

export function assertAnimationScene(scene: unknown): void {
  const errors = validateAnimationScene(scene);
  if (errors.length) throw new Error(`ANIMATION_CONTRACT_REJECTED: ${errors.join("; ")}`);
}
