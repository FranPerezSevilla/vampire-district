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

  fillStyle(...args) { this.calls.push({ name: "fillStyle", args }); return this; }
  fillRect(...args) { this.calls.push({ name: "fillRect", args }); return this; }
  fillPoints(...args) { this.calls.push({ name: "fillPoints", args }); return this; }
  fillCircle(...args) { this.calls.push({ name: "fillCircle", args }); return this; }
  strokeRect(...args) { this.calls.push({ name: "strokeRect", args }); return this; }
  strokeCircle(...args) { this.calls.push({ name: "strokeCircle", args }); return this; }

  lineStyle(width, color, alpha) {
    this.line = { width, color, alpha };
    this.calls.push({ name: "lineStyle", args: [width, color, alpha] });
    return this;
  }

  lineBetween(...args) {
    this.calls.push({ name: "lineBetween", args, line: { ...this.line } });
    return this;
  }
}

function corrugatedPlan() {
  const plan = createBuildingPresentationPlan({
    id: "warehouse-corrugation-contract",
    sign: "WARE",
    x: 100,
    y: 200,
    w: 260,
    h: 180,
    color: 0x292b38,
    trim: 0x625e70,
    presentation: {
      profile: "warehouse",
      layoutId: "rectangle",
      detailLevel: "minimal",
      seed: 1603
    }
  });
  const ribs = plan.modules
    .filter(module => module.kind === MODULE_KINDS.ROOF_TEXTURE_LINE)
    .slice(0, 8);
  assert.equal(ribs.length, 8, "fixture should expose two complete four-rib rhythm groups");
  return { ...plan, modules: ribs };
}

function textureLines(graphics, plan) {
  return graphics.calls.filter(call => (
    call.name === "lineBetween"
      && [plan.palette.roofShadow, plan.palette.roofTextureHighlight].includes(call.line?.color)
  ));
}

test("warehouse corrugation renders as low-contrast three-rib groups with a quiet fourth lane", () => {
  const plan = corrugatedPlan();
  const authoredModules = structuredClone(plan.modules);
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  assert.deepEqual(plan.modules, authoredModules, "renderer must not mutate planned corrugation geometry");

  const lines = textureLines(graphics, plan);
  const shadowLines = lines.filter(call => call.line.color === plan.palette.roofShadow);
  const highlightLines = lines.filter(call => call.line.color === plan.palette.roofTextureHighlight);

  assert.equal(shadowLines.length, 6, "every fourth planned rib should become a quiet grouping lane");
  assert.equal(highlightLines.length, 6);
  assert.ok(shadowLines.every(call => Number(call.line.alpha) <= 0.13));
  assert.ok(highlightLines.every(call => Number(call.line.alpha) <= 0.09));
  assert.ok(shadowLines.some(call => Number(call.line.alpha) === 0.13));
  assert.ok(shadowLines.some(call => Number(call.line.alpha) === 0.075));

  const visibleHighlightX = highlightLines.map(call => Number(call.args[0]));
  const expectedVisibleX = [0, 1, 2, 4, 5, 6].map(index => Number(plan.modules[index].x1));
  assert.deepEqual(visibleHighlightX, expectedVisibleX);
  assert.equal(visibleHighlightX.includes(Number(plan.modules[3].x1)), false);
  assert.equal(visibleHighlightX.includes(Number(plan.modules[7].x1)), false);
});

test("warehouse corrugation material rendering is deterministic", () => {
  const plan = corrugatedPlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();

  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);

  assert.deepEqual(first.calls, second.calls);
});
