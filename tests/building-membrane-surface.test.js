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

function membranePlan() {
  const plan = createBuildingPresentationPlan({
    id: "membrane-surface-works",
    sign: "WORKS",
    x: 120,
    y: 180,
    w: 280,
    h: 200,
    color: 0x2d2a28,
    trim: 0x685f56,
    presentation: {
      profile: "industrial",
      layoutId: "rectangle",
      detailLevel: "minimal",
      seed: 2207
    }
  });
  const seams = plan.modules.filter(module => (
    module.kind === MODULE_KINDS.ROOF_TEXTURE_LINE
      && module.variant === ROOF_SURFACE_KINDS.MEMBRANE
  ));
  assert.ok(seams.length >= 2, "industrial roof should provide broadly spaced membrane seams");
  return { ...plan, modules: seams };
}

function lineSignature(values) {
  return values.map(value => Number(value).toFixed(4)).join(":");
}

test("membrane seams keep broad planned spacing while gaining restrained deterministic tonal variation", () => {
  const plan = membranePlan();
  const authoredModules = structuredClone(plan.modules);
  const graphics = new GraphicsRecorder();

  const plannedY = plan.modules
    .map(module => Number(module.y1))
    .sort((a, b) => a - b);
  for (let index = 1; index < plannedY.length; index += 1) {
    assert.ok(plannedY[index] - plannedY[index - 1] >= 20, "membrane seams should remain broadly spaced");
  }

  renderBuildingPresentation(graphics, plan);

  const seamCalls = graphics.calls.filter(call => (
    call.name === "lineBetween" && call.line?.color === plan.palette.roofTexture
  ));
  const highlightCalls = graphics.calls.filter(call => (
    call.name === "lineBetween" && call.line?.color === plan.palette.roofTextureHighlight
  ));

  assert.equal(seamCalls.length, plan.modules.length);
  assert.equal(highlightCalls.length, plan.modules.length);

  assert.deepEqual(
    seamCalls.map(call => lineSignature(call.args)),
    plan.modules.map(module => lineSignature([module.x1, module.y1, module.x2, module.y2])),
    "primary membrane seams must stay on planner-owned coordinates"
  );

  const seamAlphas = seamCalls.map(call => Number(call.line.alpha));
  assert.ok(seamAlphas.every(alpha => alpha <= 0.13));
  assert.ok(new Set(seamAlphas).size > 1, "seams should vary tone deterministically instead of using one diagram-line alpha");
  assert.equal(seamAlphas.includes(0.22), false, "legacy uniform membrane alpha should be absent");
  assert.ok(highlightCalls.every(call => Number(call.line.alpha) <= 0.038));

  assert.deepEqual(plan.modules, authoredModules);
});

test("membrane material rendering is deterministic for the same planned seams", () => {
  const plan = membranePlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();

  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);

  assert.deepEqual(first.calls, second.calls);
});
