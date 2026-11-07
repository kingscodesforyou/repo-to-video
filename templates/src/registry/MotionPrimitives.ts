// Motion declarations belong to registry_manifest.json; this file contains only executable semantics.
export type Vec3 = [number, number, number];
export type MotionPayload = Record<string, any>;
export interface MotionPrimitiveKinematics {
  action: string;
  progress: number;
  position: Vec3;
  scale: number;
  rotateZ: number;
  opacity: number;
  separation: number;
  morph: number;
  shape: string;
  reveal: number;
  route: number;
  connection: number;
  scan: number;
  weight: number;
  typing: number;
  output: number;
  highlight: number;
  lines: number[];
  commandIndex: number;
  anchor: number;
  lineage: number;
  metric: number;
  cursor: [number, number];
  splitRatio: number;
  payload: MotionPayload;
}
export interface MotionBinding {
  objectId: string;
  // Explicit ownership, not fuzzy target matching. A layer can belong to a stack.
  targets?: Array<string | { id: string; actions: string[] }>;
  role?: "particle" | "layer" | "channel" | "node" | "text" | "screen" | "core";
  index?: number;
  count?: number;
  origin?: Vec3;
  assembled?: Vec3;
  mergePoint?: Vec3;
  routeFrom?: Vec3;
  routeTo?: Vec3;
  durationSeconds?: number;
}
export interface MotionDeclaration {
  category: string;
  required_payload: string[];
  optional_payload: string[];
  payload_schema: { type: string; properties: Record<string, unknown>; required?: string[]; additionalProperties: boolean };
}
export interface MotionPrimitive {
  id: string;
  tier: "MotionPrimitive";
  category: string;
  requiredPayload: string[];
  optionalPayload: string[];
  evaluate: (progress: number, payload?: MotionPayload, previous?: MotionPrimitiveKinematics, binding?: MotionBinding) => MotionPrimitiveKinematics;
}
type Implementation = (p: number, payload: MotionPayload, previous: MotionPrimitiveKinematics, binding: MotionBinding) => MotionPrimitiveKinematics;
export const clamp01 = (p: number) => Math.max(0, Math.min(1, p));
const number = (v: unknown, fallback: number) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const vector = (a: Vec3, b: Vec3, p: number): Vec3 => a.map((v, i) => lerp(v, b[i], p)) as Vec3;
export function initialMotionState(binding: MotionBinding = { objectId: "" }): MotionPrimitiveKinematics {
  return { action: "hold", progress: 0, position: [...(binding.origin || [0, 0, 0])], scale: 1, rotateZ: 0, opacity: 1,
    separation: 0, morph: 0, shape: "fragments", reveal: 1, route: 0, connection: 0, scan: 0, weight: 0,
    typing: 0, output: 0, highlight: 0, lines: [], commandIndex: -1, anchor: 0, lineage: 0, metric: 0,
    cursor: [0, 0], splitRatio: 0.5, payload: {} };
}
const separation: Implementation = (p, payload, s, b) => {
  const axis = payload.separation_axis || "y";
  const a = axis === "x" ? 0 : axis === "z" ? 2 : 1;
  const distance = number(payload.separation_distance, number(payload.explode_distance, 100));
  const sign = b.role === "layer" ? (b.index || 0) - ((b.count || 3) - 1) / 2 : (b.index || 0) % 2 ? 1 : -1;
  const position = [...s.position] as Vec3;
  position[a] += sign * distance * p;
  if (payload.split_angle !== undefined && b.role === "particle") position[0] += Math.cos(number(payload.split_angle, 45) * Math.PI / 180) * distance * p;
  return { ...s, position, separation: s.separation + distance * p };
};
const assembly: Implementation = (p, _payload, s, b) => ({ ...s,
  position: vector(s.position, b.assembled || b.origin || [0, 0, 0], p),
  separation: s.separation * (1 - p), rotateZ: s.rotateZ * (1 - p), morph: lerp(s.morph, 1, p) });
const merge: Implementation = (p, _payload, s, b) => ({ ...s,
  position: vector(s.position, b.mergePoint || [0, 0, 0], p), separation: s.separation * (1 - p), morph: lerp(s.morph, 1, p) });
const transform: Implementation = (p, payload, s, b) => {
  const duration = number(payload.morph_duration, b.durationSeconds || 1);
  const t = clamp01(p * (b.durationSeconds || 1) / Math.max(0.001, duration));
  return { ...s, morph: lerp(s.morph, payload.target_state === "fragments" ? 0 : 1, t),
    shape: t === 0 ? s.shape : String(payload.target_state || "crystal") };
};
const route: Implementation = (p, payload, s, b) => {
  const t = clamp01(p * number(payload.pulse_speed, 1));
  // Start at the actual previous endpoint. Subsequent beats never reset a packet.
  const start = s.route === 0 ? (b.routeFrom || s.position) : s.position;
  return { ...s, position: vector(start, b.routeTo || b.mergePoint || [420, 0, 0], t), route: lerp(s.route, 1, t), connection: lerp(s.connection, 1, t) };
};
const reveal: Implementation = (p, _payload, s) => ({ ...s, reveal: s.action === "hold" && s.progress === 0 ? p : lerp(s.reveal, 1, p) });
const collapse: Implementation = (p, payload, s) => ({ ...s, scale: lerp(s.scale, 0.65, p),
  rotateZ: s.rotateZ + number(payload.strain_level, 1) * 18 * p,
  position: [s.position[0], s.position[1] + number(payload.strain_level, 1) * 90 * p, s.position[2]] });
// Deliberately exhaustive: never synthesize a generic fallback for an unknown action.
export const IMPLEMENTATIONS: Readonly<Record<string, Implementation>> = Object.freeze({
  hold: (_p, _payload, s) => s,
  particles_flow: (p, payload, s, b) => {
    const direction: Record<string, Vec3> = { right: [1, 0, 0], left: [-1, 0, 0], up: [0, -1, 0], down: [0, 1, 0] };
    const d = direction[payload.direction || "right"];
    if (!d) throw new Error(`Invalid motion direction: ${payload.direction}`);
    const distance = 180 * number(payload.flow_speed, 1) * (b.durationSeconds || 1) * p;
    return { ...s, position: s.position.map((v, i) => v + d[i] * distance) as Vec3 };
  },
  separate: separation,
  split: separation,
  collide: (p, payload, s, b) => {
    const impact = merge(Math.min(1, p * 2), payload, s, b);
    const rebound = Math.max(0, p * 2 - 1) * 0.2;
    return { ...impact, position: vector(impact.position, s.position, rebound), scale: 1 - 0.2 * Math.sin(Math.PI * p) };
  },
  merge,
  transform,
  crystallize: transform,
  explode_layers: separation,
  disassemble: separation,
  assemble: assembly,
  interlock: assembly,
  rotate_rotor: (p, payload, s, b) => ({ ...s, rotateZ: s.rotateZ + 360 * number(payload.rotor_rpm, 30) / 60 * (b.durationSeconds || 1) * p }),
  scan_layer: (p, payload, s) => ({ ...s, scan: lerp(s.scan, number(payload.scan_progress, 1), p) }),
  connect_bus: (p, _payload, s) => ({ ...s, connection: lerp(s.connection, 1, p) }),
  emit_probes: route,
  route_stream: route,
  route_parallel: route,
  dispatch_tool: route,
  send_request: route,
  stream_response: (p, payload, s, b) => ({ ...route(p, payload, s, b), morph: lerp(s.morph, 1, p), output: lerp(s.output, 1, p) }),
  weigh_signals: (p, payload, s, b) => ({ ...s, weight: lerp(s.weight, number(payload.weights?.[(b.index || 0) % (payload.weights?.length || 1)], 100), p) }),
  converge_result: (p, payload, s, b) => ({ ...merge(p, payload, s, b), weight: lerp(s.weight, number(payload.confidence_target, 98.6), p) }),
  append_state: (p, payload, s, b) => ({ ...reveal(p, payload, s, b), position: vector(s.position, b.assembled || s.position, p) }),
  anchor_timestamp: (p, _payload, s) => ({ ...s, anchor: lerp(s.anchor, 1, p) }),
  trace_lineage: (p, _payload, s) => ({ ...s, lineage: lerp(s.lineage, 1, p) }),
  overload_collapse: collapse,
  precision_extract: (p, payload, s, b) => ({ ...merge(p, payload, s, b), reveal: lerp(s.reveal, 1, p), highlight: lerp(s.highlight, 1, p) }),
  reveal_ui: reveal,
  highlight_code: (p, payload, s) => ({ ...s, highlight: lerp(s.highlight, 1, p), lines: payload.lines || s.lines }),
  type_command: (p, payload, s) => ({ ...s, commandIndex: number(payload.command_index, -1),
    typing: number(payload.command_index, -1) === s.commandIndex ? lerp(s.typing, 1, p) : p }),
  execute_output: (p, _payload, s) => ({ ...s, output: lerp(s.output, 1, p) }),
  navigate: (p, payload, s) => ({ ...s, position: [lerp(s.position[0], -number(payload.zoom_region?.x, 0), p), lerp(s.position[1], -number(payload.zoom_region?.y, 60), p), s.position[2]], scale: lerp(s.scale, number(payload.zoom_region?.scale, 1.12), p) }),
  interact: (p, payload, s) => ({ ...s, cursor: [lerp(s.cursor[0], number(payload.cursor_pos?.x, payload.cursor_pos?.[0] || 100), p), lerp(s.cursor[1], number(payload.cursor_pos?.y, payload.cursor_pos?.[1] || 60), p)], highlight: lerp(s.highlight, 1, p) }),
  compare_split: (p, payload, s) => ({ ...s, splitRatio: lerp(s.splitRatio, number(payload.split_ratio, 0.65), p) }),
  kinetic_reveal: reveal,
  editorial_focus: (p, _payload, s) => ({ ...s, scale: lerp(s.scale, 1.08, p), highlight: lerp(s.highlight, 1, p) }),
  metric_counter: (p, payload, s) => ({ ...s, metric: lerp(s.metric, number(Number.parseFloat(String(payload.metric_value)), 0), p) }),
  chapter_transition: (p, _payload, s) => ({ ...s, opacity: s.opacity * (1 - p), position: [s.position[0], s.position[1] - 80 * p, s.position[2]] }),
});
export function evaluateMotion(action: string, progress: number, payload: MotionPayload = {}, previous?: MotionPrimitiveKinematics, binding: MotionBinding = { objectId: "" }): MotionPrimitiveKinematics {
  if (!Object.prototype.hasOwnProperty.call(IMPLEMENTATIONS, action)) throw new Error(`Unknown motion action: ${action}`);
  if (!Number.isFinite(progress)) throw new Error("Motion progress must be finite");
  const s = previous || initialMotionState(binding);
  if (action === "hold") return { ...s, action: "hold" };
  const t = clamp01(progress);
  const p = payload.easing === "cubic_out" ? 1 - (1 - t) ** 3 : t;
  return { ...IMPLEMENTATIONS[action](p, payload, s, binding), action, progress: t, payload: { ...s.payload, ...payload } };
}
export function createMotionRegistry(declarations: Record<string, MotionDeclaration>): Map<string, MotionPrimitive> {
  if (!declarations || Array.isArray(declarations)) throw new Error("motion_primitives must be an action-keyed declaration object");
  const declared = Object.keys(declarations);
  const missing = declared.filter(id => !Object.prototype.hasOwnProperty.call(IMPLEMENTATIONS, id));
  const undeclared = Object.keys(IMPLEMENTATIONS).filter(id => !Object.prototype.hasOwnProperty.call(declarations, id));
  if (missing.length || undeclared.length) throw new Error(`Motion registry mismatch; missing implementations: ${missing.join(", ")}; undeclared implementations: ${undeclared.join(", ")}`);
  return new Map(declared.map(id => {
    const spec = declarations[id];
    if (!spec.category || !spec.payload_schema || !Array.isArray(spec.required_payload) || !Array.isArray(spec.optional_payload)) throw new Error(`Invalid motion declaration: ${id}`);
    return [id, { id, tier: "MotionPrimitive", category: spec.category, requiredPayload: spec.required_payload, optionalPayload: spec.optional_payload,
      evaluate: (p, payload, previous, binding) => evaluateMotion(id, p, payload, previous, binding) }];
  }));
}
export interface MotionBeat { action: string; target: string; payload?: MotionPayload }
export interface MotionScene {
  beats: MotionBeat[];
  beatWindows: Array<{ start: number; end: number }>;
  activeBeatIdx: number;
  beatProgress: number;
  fps: number;
}
export type MotionStateResolver = (binding: MotionBinding) => MotionPrimitiveKinematics;
export function createSceneMotionResolver(scene: MotionScene, registry: Map<string, MotionPrimitive>): MotionStateResolver {
  // Validate every action, even if no visible object happens to match its target.
  for (const beat of scene.beats) if (!registry.has(beat.action)) throw new Error(`Unknown motion action: ${beat.action}`);
  return binding => {
    let state = initialMotionState(binding);
    for (let i = 0; i <= scene.activeBeatIdx && i < scene.beats.length; i++) {
      const beat = scene.beats[i];
      const matched = beat.target === binding.objectId || binding.targets?.some(target => typeof target === "string" ? beat.target === target : beat.target === target.id && target.actions.includes(beat.action));
      if (!matched) continue;
      const window = scene.beatWindows[i];
      const durationSeconds = window ? Math.max(1, window.end - window.start) / scene.fps : 1;
      state = registry.get(beat.action)!.evaluate(i < scene.activeBeatIdx ? 1 : scene.beatProgress, beat.payload, state, { ...binding, durationSeconds });
    }
    return state;
  };
}
// Shared by real DOM consumers and tests; the attributes report the same state used for rendering.
export function motionAttributes(objectId: string, state: MotionPrimitiveKinematics) {
  return { "data-motion-object": objectId, "data-motion-action": state.action,
    "data-motion-position": state.position.join(","), "data-motion-progress": state.progress,
    "data-motion-shape": state.shape, "data-motion-morph": state.morph, "data-motion-separation": state.separation,
    "data-motion-route": state.route, "data-motion-reveal": state.reveal };
}
export function motionStyle(s: MotionPrimitiveKinematics) {
  return { transform: `translate3d(${s.position[0]}px, ${s.position[1]}px, ${s.position[2]}px) rotateZ(${s.rotateZ}deg) scale(${s.scale})`, opacity: s.opacity * s.reveal };
}
export function commandCharacters(command: string, index: number, count: number, s: MotionPrimitiveKinematics) {
  if (s.commandIndex >= 0) return index < s.commandIndex ? command.length : index > s.commandIndex ? 0 : Math.floor(command.length * s.typing);
  return Math.floor(command.length * clamp01(s.typing * count - index));
}
export function outputOpacity(index: number, count: number, s: MotionPrimitiveKinematics) { return clamp01(s.output * count - index); }
