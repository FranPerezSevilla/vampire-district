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

function clubFrontagePlan() {
  const plan = createBuildingPresentationPlan({
    id: "club-family-vestibule",
    sign: "NEON CLUB",
    x: 100,
    y: 150,
    w: 290,
    h: 220,
    color: 0x2e2433,
    trim: 0x725c7a,
    presentation: {
      archetype: "club",
      profile: "club",
      layoutId: "irregular",
      detailLevel: "minimal",
      seed: 6113
    }
  });
  const frontage = plan.modules.find(module => (
    module.kind === MODULE_KINDS.FRONTAGE
      && module.variant === FRONTAGE_KINDS.CLUB
  ));
  assert.ok(frontage, "club should expose its planned frontage module");
  return { ...plan, modules: [frontage] };
}

function inside(rect, bounds) {
  const epsilon = 0.001;
  return rect.x >= bounds.x - epsilon
    && rect.y >= bounds.y - epsilon
    && rect.x + rect.w <= bounds.x + bounds.w + epsilon
    && rect.y + rect.h <= bounds.y + bounds.h + epsilon;
}

test("club frontage uses a dark physical vestibule with one local neon edge", () => {
  const plan = clubFrontagePlan();
  const frontage = plan.modules[0];
  const authored = structuredClone(frontage);
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const rects = graphics.calls
    .filter(call => call.name === "fillRect")
    .map(call => ({
      x: Number(call.args[0]),
      y: Number(call.args[1]),
      w: Number(call.args[2]),
      h: Number(call.args[3]),
      fill: call.fill
    }));

  assert.ok(rects.some(rect => (
    rect.fill.color === plan.palette.serviceDark && Number(rect.fill.alpha) === 0.98
  )), "club vestibule should use a dark physical top instead of a flat purple panel");

  const accent = rects.find(rect => (
    rect.fill.color === plan.palette.accent && Number(rect.fill.alpha) === 0.7
  ));
  assert.ok(accent, "club identity should retain one local neon edge");
  assert.ok(inside(accent, frontage.bounds));
  assert.ok(
    accent.w * accent.h < frontage.bounds.w * frontage.bounds.h * 0.3,
    "neon must remain subordinate to the physical vestibule"
  );

  const threshold = rects.find(rect => (
    rect.fill.color === plan.palette.propDark && Number(rect.fill.alpha) === 0.96
  ));
  assert.ok(threshold, "nightlife frontage should contain one recessed entrance cue");
  assert.ok(inside(threshold, frontage.bounds));

  assert.equal(
    graphics.calls.some(call => (
      call.name === "lineBetween"
        && call.line?.color === plan.palette.label
        && Number(call.line?.alpha) >= 0.8
    )),
    false,
    "legacy cocktail-shaped label linework must not survive the M4 family route"
  );

  const structural = rects.filter(rect => !(
    rect.fill.color === plan.palette.roofShadow && Number(rect.fill.alpha) === 0.42
  ));
  assert.ok(structural.every(rect => inside(rect, frontage.bounds)));
  assert.deepEqual(frontage, authored);
});

test("club family frontage rendering is deterministic", () => {
  const plan = clubFrontagePlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();
  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);
  assert.deepEqual(first.calls, second.calls);
});
