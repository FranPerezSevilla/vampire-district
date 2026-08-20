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
    this.fill = { color: null, alpha: null };
    this.line = { width: null, color: null, alpha: null };
  }

  fillStyle(color, alpha) {
    this.fill = { color, alpha };
    this.calls.push({ name: "fillStyle", args: [color, alpha] });
    return this;
  }

  fillPoints(points, closePath) {
    this.calls.push({
      name: "fillPoints",
      args: [points.map(point => ({ ...point })), closePath],
      fill: { ...this.fill }
    });
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

function materialPlan() {
  const plan = createBuildingPresentationPlan({
    id: "low-frequency-warehouse",
    sign: "WARE",
    x: 90,
    y: 140,
    w: 300,
    h: 190,
    color: 0x30343a,
    trim: 0x69727a,
    presentation: {
      profile: "warehouse",
      layoutId: "rectangle",
      detailLevel: "minimal",
      seed: 7321
    }
  });

  const roof = plan.modules.find(module => module.kind === MODULE_KINDS.ROOF_MASS);
  assert.ok(roof, "warehouse profile should expose a roof mass");
  return { ...plan, modules: [roof] };
}

function insideBounds(point, bounds) {
  const epsilon = 0.001;
  return point.x >= bounds.x - epsilon
    && point.y >= bounds.y - epsilon
    && point.x <= bounds.x + bounds.w + epsilon
    && point.y <= bounds.y + bounds.h + epsilon;
}

test("non-night roof mass receives exactly one broad neutral low-frequency variation zone", () => {
  const plan = materialPlan();
  const roof = plan.modules[0];
  const authoredModule = structuredClone(roof);
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const variations = graphics.calls.filter(call => (
    call.name === "fillPoints"
      && (
        Number(call.fill?.alpha) === 0.018
          || Number(call.fill?.alpha) === 0.022
      )
  ));

  assert.equal(variations.length, 1, "low-frequency material language should add one broad zone, not texture noise");
  const variation = variations[0];
  assert.ok(
    variation.fill.color === plan.palette.roofShade
      || variation.fill.color === plan.palette.roofTextureHighlight,
    "variation should remain neutral roof material rather than family accent color"
  );
  assert.notEqual(variation.fill.color, plan.palette.accent);

  const points = variation.args[0];
  assert.ok(points.length >= 3);
  assert.ok(points.every(point => insideBounds(point, roof.bounds)));
  assert.notDeepEqual(points, roof.points, "variation must remain a partial broad zone rather than a whole-roof tint");
  assert.deepEqual(roof, authoredModule, "low-frequency treatment must not mutate planner-owned roof geometry");
});

test("low-frequency roof material variation is deterministic", () => {
  const plan = materialPlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();

  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);

  assert.deepEqual(first.calls, second.calls);
});
