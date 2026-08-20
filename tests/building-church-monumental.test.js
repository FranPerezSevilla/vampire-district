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

function churchFrontagePlan() {
  const plan = createBuildingPresentationPlan({
    id: "church-monumental-porch",
    sign: "CHURCH",
    x: 110,
    y: 150,
    w: 300,
    h: 230,
    color: 0x3c3739,
    trim: 0x756c67,
    presentation: {
      archetype: "church",
      profile: "church",
      layoutId: "cross",
      detailLevel: "minimal",
      seed: 5911
    }
  });
  const frontage = plan.modules.find(module => (
    module.kind === MODULE_KINDS.FRONTAGE
      && module.variant === FRONTAGE_KINDS.CHURCH
  ));
  assert.ok(frontage, "church should expose its planned frontage module");
  return { ...plan, modules: [frontage] };
}

function inside(rect, bounds) {
  const epsilon = 0.001;
  return rect.x >= bounds.x - epsilon
    && rect.y >= bounds.y - epsilon
    && rect.x + rect.w <= bounds.x + bounds.w + epsilon
    && rect.y + rect.h <= bounds.y + bounds.h + epsilon;
}

test("church frontage reads as a raised stone porch rather than a stamped cross", () => {
  const plan = churchFrontagePlan();
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
    rect.fill.color === plan.palette.annexRoof && Number(rect.fill.alpha) === 0.98
  )), "church porch should have a physical stone top");
  assert.ok(rects.some(rect => (
    rect.fill.color === plan.palette.wall && Number(rect.fill.alpha) === 0.9
  )), "church porch should expose a south wall face");
  assert.ok(rects.some(rect => (
    rect.fill.color === plan.palette.parapetDark && Number(rect.fill.alpha) === 0.88
  )), "church porch should expose an east/contact face");

  const threshold = rects.find(rect => (
    rect.fill.color === plan.palette.serviceDark && Number(rect.fill.alpha) === 0.9
  ));
  assert.ok(threshold, "church porch should include one recessed public threshold");
  assert.ok(inside(threshold, frontage.bounds));

  assert.equal(
    graphics.calls.some(call => call.name === "fillCircle" || call.name === "strokeCircle"),
    false,
    "church porch should not rely on circular iconography"
  );

  const warmLines = graphics.calls.filter(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.accent
      && Number(call.line?.alpha) === 0.24
  ));
  assert.equal(warmLines.length, 1, "religious warmth should remain one restrained threshold edge");

  const structural = rects.filter(rect => !(
    rect.fill.color === plan.palette.roofShadow && Number(rect.fill.alpha) === 0.44
  ));
  assert.ok(structural.every(rect => inside(rect, frontage.bounds)));
  assert.deepEqual(frontage, authored, "monumental porch must preserve planner-owned frontage bounds");
});

test("church family frontage rendering is deterministic", () => {
  const plan = churchFrontagePlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();
  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);
  assert.deepEqual(first.calls, second.calls);
});
