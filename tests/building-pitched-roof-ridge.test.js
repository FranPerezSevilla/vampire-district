import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULE_KINDS,
  createBuildingPresentationPlan,
  renderBuildingPresentation
} from "../phaser/src/rendering/BuildingPresentation.js";

class GraphicsRecorder {
  constructor() {
    this.calls = [];
    this.line = { width: null, color: null, alpha: null };
  }

  lineStyle(width, color, alpha) {
    this.line = { width, color, alpha };
    this.calls.push({ name: "lineStyle", args: [width, color, alpha] });
    return this;
  }

  lineBetween(...args) {
    this.calls.push({ name: "lineBetween", args, line: { ...this.line } });
    return this;
  }

  strokeRect(...args) {
    this.calls.push({ name: "strokeRect", args, line: { ...this.line } });
    return this;
  }
}

function churchRidgePlan() {
  const plan = createBuildingPresentationPlan({
    id: "pitched-ridge-church",
    sign: "CHURCH",
    x: 120,
    y: 160,
    w: 260,
    h: 260,
    color: 0x2b292c,
    trim: 0x706966,
    presentation: {
      archetype: "church",
      profile: "church",
      layoutId: "cross",
      detailLevel: "minimal",
      seed: 4417
    }
  });
  const ridges = plan.modules.filter(module => module.kind === MODULE_KINDS.ROOF_RIDGE);
  assert.equal(ridges.length, 2, "church roof should retain its planner-owned longitudinal and transverse ridges");
  return { ...plan, modules: ridges };
}

function isHorizontal(module) {
  return Math.abs(Number(module.x2) - Number(module.x1))
    >= Math.abs(Number(module.y2) - Number(module.y1));
}

function signature(values) {
  return values.map(value => Number(value).toFixed(4)).join(":");
}

test("pitched roof ridges read as asymmetric roof-plane shading while preserving planner coordinates", () => {
  const plan = churchRidgePlan();
  const authoredModules = structuredClone(plan.modules);
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const capCalls = graphics.calls.filter(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.roofTextureHighlight
      && Number(call.line?.alpha) === 0.085
  ));
  const lightCalls = graphics.calls.filter(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.roofTextureHighlight
      && Number(call.line?.alpha) === 0.032
  ));
  const shadeCalls = graphics.calls.filter(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.roofShadow
      && Number(call.line?.alpha) === 0.11
  ));

  assert.equal(capCalls.length, plan.modules.length);
  assert.equal(lightCalls.length, plan.modules.length);
  assert.equal(shadeCalls.length, plan.modules.length);
  assert.deepEqual(
    capCalls.map(call => signature(call.args)).sort(),
    plan.modules.map(module => signature([module.x1, module.y1, module.x2, module.y2])).sort(),
    "fine ridge caps must stay on the exact planner-owned coordinates"
  );

  for (const module of plan.modules) {
    const horizontal = isHorizontal(module);
    const shade = horizontal
      ? [module.x1, module.y1 + 1.5, module.x2, module.y2 + 1.5]
      : [module.x1 + 1.5, module.y1, module.x2 + 1.5, module.y2];
    const light = horizontal
      ? [module.x1, module.y1 - 1, module.x2, module.y2 - 1]
      : [module.x1 - 1, module.y1, module.x2 - 1, module.y2];

    assert.ok(shadeCalls.some(call => signature(call.args) === signature(shade)));
    assert.ok(lightCalls.some(call => signature(call.args) === signature(light)));
  }

  assert.equal(
    graphics.calls.some(call => call.name === "lineBetween" && Number(call.line?.alpha) === 0.4),
    false,
    "legacy heavy ridge shadow should be absent"
  );
  assert.equal(
    graphics.calls.some(call => call.name === "lineBetween" && Number(call.line?.alpha) === 0.5),
    false,
    "legacy bright ridge diagram line should be absent"
  );
  assert.deepEqual(plan.modules, authoredModules);
});

test("pitched roof ridge shading is deterministic for the same planned church ridges", () => {
  const plan = churchRidgePlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();

  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);

  assert.deepEqual(first.calls, second.calls);
});
