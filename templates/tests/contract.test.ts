import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { validateAnimationScene } from "../src/registry/AnimationContract";

const evals = join(__dirname, "../../evals");
const base = JSON.parse(readFileSync(join(evals, "01_ai_info_filter.json"), "utf8")).scenes[0];
const cases = JSON.parse(readFileSync(join(evals, "contract-cases.json"), "utf8"));
for (const fixture of cases) {
  test(`shared contract: ${fixture.name}`, () => {
    const scene = structuredClone(base);
    let parent = scene;
    for (const key of fixture.path.slice(0, -1)) parent = parent[key];
    const key = fixture.path.at(-1);
    if (fixture.delete) delete parent[key];
    else parent[key] = fixture.value;
    const errors = validateAnimationScene(scene);
    assert.equal(errors.length === 0, fixture.valid, errors.join("; "));
  });
}
for (const name of readdirSync(evals).filter((name) => /^0.*\.json$/.test(name))) {
  test(`valid benchmark: ${name}`, () => {
    for (const scene of JSON.parse(readFileSync(join(evals, name), "utf8")).scenes) {
      assert.deepEqual(validateAnimationScene(scene), []);
    }
  });
}
for (const value of [NaN, Infinity, -Infinity]) {
  test(`reject non-finite opacity: ${value}`, () => {
    const scene = structuredClone(base);
    scene.visual_choreography[0].yielding[0].opacity = value;
    assert.ok(validateAnimationScene(scene).length);
  });
}
test("hold is explicit and valid", () => {
  const scene = structuredClone(base);
  Object.assign(scene.visual_choreography[0], { action: "hold", payload: {} });
  assert.deepEqual(validateAnimationScene(scene), []);
});
