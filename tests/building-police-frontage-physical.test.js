import assert from "node:assert/strict";
import test from "node:test";

import {
  FRONTAGE_KINDS,
  MODULE_KINDS,
  createBuildingPresentationPlan,
  renderBuildingPresentation
} from "../phaser/src/rendering/BuildingPresentation.js";

class GraphicsRecorder {
  constructor() {
    this.calls = [];
    this.fill = { color: null, alpha: null };
    this.line = { width: null, color: null, alpha: null };
  }

  fillStyle(color, alpha) {
    this.fill = { color, alpha };
    this.calls.push({ name: "fillStyle", args: [color, alpha] });
    return this;
  }

  fillRect(...args) {
    this.calls.push({ name: "fillRect", args, fill: { ...this.fill } });
    return this;
  }

  fillCircle(...args) {
    this.calls.push({ name: "fillCircle", args, fill: { ...this.fill } });
    return this;
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

  strokeCircle(...args) {
    this.calls.push({ name: "strokeCircle", args, line: { ...this.line } });
    return this;
  }
}

function policeFrontagePlan() {
  const plan = createBuildingPresentationPlan({
    id: "police-frontage-physical",
    sign: "POLICE",
    x: 100,
    y: 140,
    w: 300,
    h: 210,
    color: 0x29303c,
    trim: 0x66707d,
    presentation: {
      archetype: "police",
      profile: "police",
      layoutId: "rectangle",
      detailLevel: "minimal",
      seed: 4471
    }
  });
  const frontage = plan.modules.find(module => (
    module.kind === MODULE_KINDS.FRONTAGE
      && module.variant === FRONTAGE_KINDS.POLICE
  ));
  assert.ok(frontage, "police presentation should expose its authored frontage module");
  return { ...plan, modules: [frontage] };
}

function rectInside(rect, bounds) {
  const epsilon = 0.001;
  return rect.x >= bounds.x - epsilon
    && rect.y >= bounds.y - epsilon
    && rect.x + rect.w <= bounds.x + bounds.w + epsilon
    && rect.y + rect.h <= bounds.y + bounds.h + epsilon;
}

test("police frontage becomes a physical entry canopy without the old stamped badge", () => {
  const plan = policeFrontagePlan();
  const frontage = plan.modules[0];
  const authored = structuredClone(frontage);
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const rectangles = graphics.calls
    .filter(call => call.name === "fillRect")
    .map(call => ({
      x: Number(call.args[0]),
      y: Number(call.args[1]),
      w: Number(call.args[2]),
      h: Number(call.args[3]),
      fill: call.fill
    }));

  assert.ok(
    rectangles.some(rect => rect.fill.color === plan.palette.canopy && Number(rect.fill.alpha) === 0.98),
    "frontage should have a physical canopy top"
  );
  assert.ok(
    rectangles.some(rect => rect.fill.color === plan.palette.wall && Number(rect.fill.alpha) === 0.84),
    "frontage should expose a south wall face"
  );
  assert.ok(
    rectangles.some(rect => rect.fill.color === plan.palette.serviceDark && Number(rect.fill.alpha) === 0.88),
    "frontage should expose an east/contact face"
  );

  const accent = rectangles.find(rect => (
    rect.fill.color === plan.palette.accent && Number(rect.fill.alpha) === 0.68
  ));
  assert.ok(accent, "police blue should remain as one local entry-edge band");
  assert.ok(rectInside(accent, frontage.bounds));
  assert.ok(
    accent.w * accent.h < frontage.bounds.w * frontage.bounds.h * 0.35,
    "police identity must stay local instead of recoloring the whole frontage"
  );

  const recess = rectangles.find(rect => (
    rect.fill.color === plan.palette.serviceDark && Number(rect.fill.alpha) === 0.9
  ));
  assert.ok(recess, "physical frontage should contain one recessed public entry cue");
  assert.ok(rectInside(recess, frontage.bounds));

  assert.equal(
    graphics.calls.some(call => call.name === "fillCircle" || call.name === "strokeCircle"),
    false,
    "legacy circular badge/plus treatment must not survive the physical police frontage route"
  );

  const structuralRects = rectangles.filter(rect => !(
    rect.fill.color === plan.palette.roofShadow && Number(rect.fill.alpha) === 0.4
  ));
  assert.ok(structuralRects.every(rect => rectInside(rect, frontage.bounds)));
  assert.deepEqual(frontage, authored, "physical police frontage must not mutate planner-owned bounds");
});

test("physical police frontage rendering is deterministic", () => {
  const plan = policeFrontagePlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();

  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);

  assert.deepEqual(first.calls, second.calls);
});
