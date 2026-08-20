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

function pitchedRoofPlan() {
  const plan = createBuildingPresentationPlan({
    id: "final-pitched-church",
    sign: "CHURCH",
    x: 120,
    y: 150,
    w: 300,
    h: 300,
    color: 0x2b292c,
    trim: 0x706966,
    presentation: {
      archetype: "church",
      profile: "church",
      layoutId: "cross",
      detailLevel: "minimal",
      seed: 21101
    }
  });
  const roof = plan.modules.find(module => (
    module.kind === MODULE_KINDS.ROOF_MASS
      && module.surfaceKind === ROOF_SURFACE_KINDS.PITCHED
  ));
  assert.ok(roof);
  return { ...plan, modules: [roof] };
}

function inside(point, bounds) {
  const epsilon = 0.001;
  return point.x >= bounds.x - epsilon
    && point.y >= bounds.y - epsilon
    && point.x <= bounds.x + bounds.w + epsilon
    && point.y <= bounds.y + bounds.h + epsilon;
}

test("pitched church mass gains broad directional planes without mutating its silhouette", () => {
  const plan = pitchedRoofPlan();
  const roof = plan.modules[0];
  const authored = structuredClone(roof);
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const expected = [
    [plan.palette.roofTextureHighlight, 0.04],
    [plan.palette.roofShade, 0.06],
    [plan.palette.roofTextureHighlight, 0.018],
    [plan.palette.roofShade, 0.03]
  ];
  for (const [color, alpha] of expected) {
    const call = graphics.calls.find(item => (
      item.name === "fillPoints"
        && item.fill?.color === color
        && Number(item.fill?.alpha) === alpha
    ));
    assert.ok(call, `missing pitched plane color=${color} alpha=${alpha}`);
    assert.ok(call.args[0].length >= 3);
    assert.ok(call.args[0].every(point => inside(point, roof.bounds)));
    assert.notDeepEqual(call.args[0], roof.points, "final plane treatment must remain a clipped zone");
  }

  assert.deepEqual(roof, authored);
});

test("final pitched roof planes are deterministic", () => {
  const plan = pitchedRoofPlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();
  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);
  assert.deepEqual(first.calls, second.calls);
});
