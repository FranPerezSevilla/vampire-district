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

function nightRoofPlan() {
  const plan = createBuildingPresentationPlan({
    id: "night-roof-club",
    sign: "NEON",
    x: 120,
    y: 150,
    w: 280,
    h: 210,
    color: 0x2b2232,
    trim: 0x6f526f,
    presentation: {
      archetype: "club",
      profile: "club",
      layoutId: "l-shape",
      detailLevel: "minimal",
      seed: 4519
    }
  });

  const roof = plan.modules.find(module => (
    module.kind === MODULE_KINDS.ROOF_MASS
      && module.surfaceKind === ROOF_SURFACE_KINDS.NIGHT
  ));
  assert.ok(roof, "club profile should expose a NIGHT roof mass");
  return { ...plan, modules: [roof] };
}

function insideBounds(point, bounds) {
  const epsilon = 0.001;
  return point.x >= bounds.x - epsilon
    && point.y >= bounds.y - epsilon
    && point.x <= bounds.x + bounds.w + epsilon
    && point.y <= bounds.y + bounds.h + epsilon;
}

test("night roof mass gains broad neutral tonal zones without changing authored roof geometry", () => {
  const plan = nightRoofPlan();
  const roof = plan.modules[0];
  const authoredModule = structuredClone(roof);
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const lift = graphics.calls.find(call => (
    call.name === "fillPoints"
      && call.fill?.color === plan.palette.roofTextureHighlight
      && Number(call.fill?.alpha) === 0.025
  ));
  const shade = graphics.calls.find(call => (
    call.name === "fillPoints"
      && call.fill?.color === plan.palette.roofShade
      && Number(call.fill?.alpha) === 0.055
  ));

  assert.ok(lift, "night roof should receive one restrained north-side tonal lift");
  assert.ok(shade, "night roof should receive one restrained south-side shade wash");

  const liftPoints = lift.args[0];
  const shadePoints = shade.args[0];
  assert.ok(liftPoints.length >= 3);
  assert.ok(shadePoints.length >= 3);
  assert.ok(liftPoints.every(point => insideBounds(point, roof.bounds)));
  assert.ok(shadePoints.every(point => insideBounds(point, roof.bounds)));

  const liftBottom = Math.max(...liftPoints.map(point => point.y));
  const shadeTop = Math.min(...shadePoints.map(point => point.y));
  assert.ok(liftBottom <= roof.bounds.y + roof.bounds.h * 0.62 + 0.001);
  assert.ok(shadeTop >= roof.bounds.y + roof.bounds.h * 0.38 - 0.001);
  assert.notDeepEqual(liftPoints, roof.points, "tonal lift should be a broad zone, not a whole-roof tint pass");
  assert.notDeepEqual(shadePoints, roof.points, "shade should be a broad zone, not a whole-roof tint pass");

  assert.notEqual(lift.fill.color, plan.palette.accent, "night modulation must not turn the whole roof into club accent color");
  assert.notEqual(shade.fill.color, plan.palette.accent, "night modulation must remain neutral material shading");
  assert.deepEqual(roof, authoredModule, "night material treatment must not mutate the planner-owned roof module");
});

test("night roof tonal modulation is deterministic for the same planned mass", () => {
  const plan = nightRoofPlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();

  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);

  assert.deepEqual(first.calls, second.calls);
});
