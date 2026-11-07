import assert from "node:assert/strict";
import test from "node:test";
import manifest from "../src/registry/registry_manifest.json";
import {
  IMPLEMENTATIONS,
  createMotionRegistry,
  createSceneMotionResolver,
  evaluateMotion,
  initialMotionState,
  type MotionBinding,
  type Vec3,
} from "../src/registry/MotionPrimitives";

const registry = createMotionRegistry(manifest.motion_primitives as any);
const declarations = manifest.motion_primitives as Record<string, any>;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const binding = (extra: Partial<MotionBinding> = {}): MotionBinding => ({ objectId: "obj", durationSeconds: 1, ...extra });

test("registry parity: every declared action has exactly one implementation", () => {
  assert.deepEqual(Object.keys(IMPLEMENTATIONS).sort(), Object.keys(declarations).sort());
  assert.equal(registry.size, Object.keys(declarations).length);
});

test("createMotionRegistry rejects an array declaration", () => {
  assert.throws(() => createMotionRegistry([] as any), /action-keyed/);
});

test("createMotionRegistry rejects a declared action without an implementation", () => {
  const d = structuredClone(declarations);
  d.fake_action = { category: "test", required_payload: [], optional_payload: [], payload_schema: { type: "object", additionalProperties: false } };
  assert.throws(() => createMotionRegistry(d), /mismatch/);
});

test("createMotionRegistry rejects an implementation without a declaration", () => {
  const d = structuredClone(declarations);
  delete d.particles_flow;
  assert.throws(() => createMotionRegistry(d), /mismatch/);
});

test("createMotionRegistry rejects an incomplete declaration", () => {
  const d = structuredClone(declarations);
  delete d.hold.optional_payload;
  assert.throws(() => createMotionRegistry(d), /Invalid motion declaration/);
});

test("evaluateMotion throws on an unknown action instead of synthesizing a fallback", () => {
  assert.throws(() => evaluateMotion("teleport", 0.5), /Unknown motion action/);
});

test("evaluateMotion rejects non-finite progress", () => {
  for (const p of [NaN, Infinity, -Infinity]) assert.throws(() => evaluateMotion("merge", p), /finite/);
});

for (const [direction, expected] of Object.entries({ right: [180, 0, 0], left: [-180, 0, 0], up: [0, -180, 0], down: [0, 180, 0] })) {
  test(`particles_flow moves ${direction} with the correct sign`, () => {
    const s = evaluateMotion("particles_flow", 1, { direction, flow_speed: 1 }, undefined, binding());
    assert.deepEqual(s.position, expected);
  });
}

test("particles_flow distance scales with flow_speed", () => {
  const slow = evaluateMotion("particles_flow", 1, { direction: "right", flow_speed: 1 }, undefined, binding());
  const fast = evaluateMotion("particles_flow", 1, { direction: "right", flow_speed: 2 }, undefined, binding());
  assert.equal(slow.position[0], 180);
  assert.equal(fast.position[0], 360);
});

test("particles_flow rejects an invalid direction", () => {
  assert.throws(() => evaluateMotion("particles_flow", 1, { direction: "diagonal" }, undefined, binding()), /Invalid motion direction/);
});

test("separate increases separation monotonically to the commanded distance", () => {
  const s0 = initialMotionState(binding());
  const mid = evaluateMotion("separate", 0.5, { separation_distance: 100 }, s0, binding());
  const end = evaluateMotion("separate", 1, { separation_distance: 100 }, s0, binding());
  assert.ok(mid.separation > s0.separation);
  assert.ok(end.separation > mid.separation);
  assert.equal(end.separation, 100);
});

test("merge decreases distance to the merge point and collapses separation", () => {
  const b = binding({ mergePoint: [0, 0, 0] });
  const start = { ...initialMotionState(b), position: [100, 0, 0] as Vec3, separation: 50 };
  const mid = evaluateMotion("merge", 0.5, {}, start, b);
  const end = evaluateMotion("merge", 1, {}, start, b);
  assert.ok(dist(mid.position, [0, 0, 0]) < dist(start.position, [0, 0, 0]));
  assert.deepEqual(end.position, [0, 0, 0]);
  assert.equal(end.separation, 0);
});

test("explode_layers reaches per-layer signed endpoints", () => {
  const count = 3, distance = 100;
  for (let index = 0; index < count; index++) {
    const b = binding({ objectId: `layer${index}`, role: "layer", index, count, origin: [0, 0, 0] });
    const end = evaluateMotion("explode_layers", 1, { explode_distance: distance }, undefined, b);
    assert.equal(end.position[1], (index - (count - 1) / 2) * distance);
  }
});

test("assemble returns to the assembled position and zeroes separation/rotation", () => {
  const b = binding({ assembled: [10, 20, 30] });
  const start = { ...initialMotionState(b), position: [100, 200, 300] as Vec3, separation: 80, rotateZ: 45 };
  const end = evaluateMotion("assemble", 1, {}, start, b);
  assert.deepEqual(end.position, [10, 20, 30]);
  assert.equal(end.separation, 0);
  assert.equal(end.rotateZ, 0);
});

test("transform changes morph and shape to the target state", () => {
  const s0 = initialMotionState(binding());
  const crystal = evaluateMotion("transform", 1, { target_state: "crystal", morph_duration: 1 }, s0, binding());
  assert.equal(crystal.morph, 1);
  assert.equal(crystal.shape, "crystal");
  const fragments = evaluateMotion("transform", 1, { target_state: "fragments", morph_duration: 1 }, { ...s0, morph: 1, shape: "crystal" }, binding());
  assert.equal(fragments.morph, 0);
  assert.equal(fragments.shape, "fragments");
});

test("hold is intentionally static and preserves the previous kinematic state", () => {
  const prev = { ...initialMotionState(binding()), position: [5, 6, 7] as Vec3, scale: 1.5, morph: 0.8, separation: 40, action: "merge", progress: 1 };
  const held = evaluateMotion("hold", 0.9, {}, prev, binding());
  assert.deepEqual(held.position, [5, 6, 7]);
  assert.equal(held.scale, 1.5);
  assert.equal(held.morph, 0.8);
  assert.equal(held.separation, 40);
  assert.equal(held.action, "hold");
});

test("a subsequent route beat starts from the previous endpoint, never resets the packet", () => {
  const b = binding({ routeFrom: [0, 0, 0], routeTo: [100, 0, 0] });
  const first = evaluateMotion("route_stream", 1, {}, undefined, b);
  assert.deepEqual(first.position, [100, 0, 0]);
  assert.equal(first.route, 1);
  const second = evaluateMotion("route_stream", 0.5, {}, first, { ...b, routeTo: [200, 0, 0] });
  assert.deepEqual(second.position, [150, 0, 0]);
});

test("cubic_out easing is monotonic and still reaches the exact endpoint", () => {
  const linear = evaluateMotion("particles_flow", 0.5, { direction: "right", flow_speed: 1, easing: "linear" }, undefined, binding());
  const cubic = evaluateMotion("particles_flow", 0.5, { direction: "right", flow_speed: 1, easing: "cubic_out" }, undefined, binding());
  const end = evaluateMotion("particles_flow", 1, { direction: "right", flow_speed: 1, easing: "cubic_out" }, undefined, binding());
  assert.equal(linear.position[0], 90);
  assert.ok(cubic.position[0] > linear.position[0]);
  assert.equal(end.position[0], 180);
});

test("scene resolver matches targets exactly, never by substring", () => {
  const scene = { beats: [{ action: "particles_flow", target: "filter", payload: { direction: "right", flow_speed: 1 } }], beatWindows: [{ start: 0, end: 30 }], activeBeatIdx: 0, beatProgress: 1, fps: 30 };
  const resolver = createSceneMotionResolver(scene as any, registry);
  assert.equal(resolver({ objectId: "filter" }).position[0], 180);
  assert.equal(resolver({ objectId: "filter_machine" }).position[0], 0);
});

test("scene resolver accumulates state across beats using beat-local progress", () => {
  const scene = {
    beats: [
      { action: "particles_flow", target: "o", payload: { direction: "right", flow_speed: 1 } },
      { action: "particles_flow", target: "o", payload: { direction: "right", flow_speed: 1 } },
    ],
    beatWindows: [{ start: 0, end: 30 }, { start: 30, end: 60 }],
    activeBeatIdx: 1, beatProgress: 0.5, fps: 30,
  };
  const resolver = createSceneMotionResolver(scene as any, registry);
  assert.equal(resolver({ objectId: "o" }).position[0], 270);
});

test("scene resolver validates every beat action even when no object matches", () => {
  const scene = { beats: [{ action: "teleport", target: "o" }], beatWindows: [{ start: 0, end: 30 }], activeBeatIdx: 0, beatProgress: 1, fps: 30 };
  assert.throws(() => createSceneMotionResolver(scene as any, registry), /Unknown motion action/);
});

test("v4.4 2D editorial primitives always keep zero 3D rotation and zero Z translation", () => {
  const actions2D: Array<[string, Record<string, unknown>]> = [
    ["typography", { headline: "幂等性概念定义" }],
    ["infographic", { headline: "吞吐量对比", metrics: [{ label: "QPS", value: "100k" }] }],
    ["flowchart", { nodes: [{ id: "a", label: "Req" }, { id: "b", label: "Cache" }] }],
    ["timeline", { events: [{ time: "T0", title: "Init" }] }],
    ["comparison", { left_column: { title: "Before", points: ["A"] }, right_column: { title: "After", points: ["B"] } }],
    ["code_explanation", { code_lines: [{ line_number: 1, code: "return True", annotation: "放行" }] }],
    ["step_by_step", { steps: [{ title: "Step 1", detail: "Check token" }] }],
    ["cause_effect", { cause_effect_pairs: [{ cause: "Timeout", effect: "Retry" }] }],
  ];
  for (const [action, payload] of actions2D) {
    for (const p of [0, 0.5, 1]) {
      const state = evaluateMotion(action, p, payload, undefined, binding());
      assert.equal(state.position[2], 0, `${action} at p=${p} must keep Z=0`);
      assert.equal(state.rotateZ, 0, `${action} at p=${p} must keep rotateZ=0`);
    }
  }
});