import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULE_KINDS,
  ROOF_SURFACE_KINDS,
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

function civicPlan() {
  const plan = createBuildingPresentationPlan({
    id: "civic-surface-police",
    sign: "POLICE",
    x: 100,
    y: 160,
    w: 280,
    h: 200,
    color: 0x292d38,
    trim: 0x697181,
    presentation: {
      archetype: "police",
      profile: "police",
      layoutId: "rectangle",
      detailLevel: "minimal",
      seed: 3119
    }
  });
  const joints = plan.modules.filter(module => (
    module.kind === MODULE_KINDS.ROOF_TEXTURE_LINE
      && module.variant === ROOF_SURFACE_KINDS.CIVIC
  ));
  assert.ok(joints.length >= 2, "civic roof should expose both primary and cross-axis ordering joints");
  return { ...plan, modules: joints };
}

function isHorizontal(module) {
  return Math.abs(Number(module.x2) - Number(module.x1))
    >= Math.abs(Number(module.y2) - Number(module.y1));
}

function signature(values) {
  return values.map(value => Number(value).toFixed(4)).join(":");
}

test("civic surface uses one primary joint hierarchy instead of identical decorative linework", () => {
  const plan = civicPlan();
  const authoredModules = structuredClone(plan.modules);
  const horizontal = plan.modules.find(isHorizontal);
  const vertical = plan.modules.find(module => !isHorizontal(module));
  assert.ok(horizontal, "civic surface should retain the planner-owned horizontal ordering joint");
  assert.ok(vertical, "civic surface should retain the planner-owned cross-axis joint");

  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, plan);

  const structural = graphics.calls.filter(call => (
    call.name === "lineBetween" && call.line?.color === plan.palette.roofTexture
  ));
  const highlights = graphics.calls.filter(call => (
    call.name === "lineBetween" && call.line?.color === plan.palette.roofTextureHighlight
  ));

  assert.equal(structural.length, plan.modules.length, "each planned civic joint should be painted once structurally");
  assert.deepEqual(
    structural.map(call => signature(call.args)).sort(),
    plan.modules.map(module => signature([module.x1, module.y1, module.x2, module.y2])).sort(),
    "structural civic lines must remain on planner-owned coordinates"
  );

  const horizontalCall = structural.find(call => signature(call.args) === signature([
    horizontal.x1, horizontal.y1, horizontal.x2, horizontal.y2
  ]));
  const verticalCall = structural.find(call => signature(call.args) === signature([
    vertical.x1, vertical.y1, vertical.x2, vertical.y2
  ]));
  assert.ok(horizontalCall);
  assert.ok(verticalCall);
  assert.equal(Number(horizontalCall.line.alpha), 0.115);
  assert.equal(Number(verticalCall.line.alpha), 0.06);
  assert.ok(
    Number(horizontalCall.line.alpha) > Number(verticalCall.line.alpha),
    "primary civic joint should dominate the secondary cross-axis joint"
  );

  assert.equal(highlights.length, 1, "only the primary joint should receive a restrained material highlight");
  assert.equal(Number(highlights[0].line.alpha), 0.028);
  assert.deepEqual(
    highlights[0].args,
    [horizontal.x1, horizontal.y1 - 1, horizontal.x2, horizontal.y2 - 1]
  );
  assert.equal(
    graphics.calls.some(call => call.name === "lineBetween" && Number(call.line?.alpha) === 0.2),
    false,
    "legacy uniform civic highlight alpha should be absent"
  );

  assert.deepEqual(plan.modules, authoredModules);
});

test("civic material hierarchy is deterministic for the same planned joints", () => {
  const plan = civicPlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();

  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);

  assert.deepEqual(first.calls, second.calls);
});
