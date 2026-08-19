import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULE_KINDS,
  createBuildingPresentationPlan,
  renderBuildingPresentation
} from "../phaser/src/rendering/BuildingPresentation.js";

function building(overrides = {}) {
  return {
    id: "shadow-test-building",
    sign: "WORKS",
    x: 100,
    y: 200,
    w: 260,
    h: 180,
    color: 0x292b38,
    trim: 0x625e70,
    ...overrides
  };
}

class GraphicsRecorder {
  constructor() {
    this.calls = [];
    this.style = { color: null, alpha: null };
    this.line = { width: null, color: null, alpha: null };
  }

  fillStyle(color, alpha) {
    this.style = { color, alpha };
    this.calls.push({ name: "fillStyle", args: [color, alpha] });
    return this;
  }

  fillRect(...args) {
    this.calls.push({ name: "fillRect", args, style: { ...this.style } });
    return this;
  }

  fillPoints(...args) {
    this.calls.push({ name: "fillPoints", args, style: { ...this.style } });
    return this;
  }

  lineStyle(...args) {
    this.line = { width: args[0], color: args[1], alpha: args[2] };
    this.calls.push({ name: "lineStyle", args });
    return this;
  }

  strokeRect(...args) {
    this.calls.push({ name: "strokeRect", args, line: { ...this.line } });
    return this;
  }

  fillCircle(...args) {
    this.calls.push({ name: "fillCircle", args, style: { ...this.style } });
    return this;
  }

  strokeCircle(...args) {
    this.calls.push({ name: "strokeCircle", args, line: { ...this.line } });
    return this;
  }

  lineBetween(...args) {
    this.calls.push({ name: "lineBetween", args, line: { ...this.line } });
    return this;
  }
}

test("building cast shadows use several soft external layers", () => {
  const plan = createBuildingPresentationPlan(building());
  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, plan);

  const footprint = plan.visualFootprint;
  const externalShadowRects = graphics.calls.filter(call => {
    if (call.name !== "fillRect") return false;
    if (call.style?.color !== plan.palette.worldShadow) return false;
    const [x, y, w, h] = call.args.map(Number);
    return x < footprint.x
      || y < footprint.y
      || x + w > footprint.x + footprint.w
      || y + h > footprint.y + footprint.h;
  });

  assert.ok(externalShadowRects.length >= 3);
  assert.ok(new Set(externalShadowRects.map(call => call.style.alpha)).size >= 3);
});

test("raised roof masses use layered polygon contact shadows", () => {
  const plan = createBuildingPresentationPlan(building());
  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, plan);

  const roofShadowPolygons = graphics.calls.filter(call => (
    call.name === "fillPoints"
      && call.style?.color === plan.palette.roofShadow
  ));
  assert.ok(roofShadowPolygons.length >= 3);
});

test("neutral parapets avoid the old six-pixel bright frame recipe", () => {
  const plan = createBuildingPresentationPlan(building({
    sign: "FLATS",
    presentation: { profile: "residential", layoutId: "rectangle" }
  }));
  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, plan);

  const lineStyles = graphics.calls
    .filter(call => call.name === "lineStyle")
    .map(call => call.args);

  assert.ok(lineStyles.some(([width]) => Number(width) <= 2));
  assert.ok(lineStyles.some(([width]) => Number(width) === 1));
  assert.equal(
    lineStyles.some(([width, color, alpha]) => (
      Number(width) === 6
        && Number(color) === plan.palette.parapetDark
        && Number(alpha) >= 0.9
    )),
    false
  );
});

test("the authored collider footprint keeps a low slab but no visible full-frame outline", () => {
  const sourcePlan = createBuildingPresentationPlan(building({
    sign: "FLATS",
    presentation: { profile: "residential", layoutId: "rectangle" }
  }));
  const foundation = sourcePlan.modules.find(module => module.kind === MODULE_KINDS.FOUNDATION);
  assert.ok(foundation);
  assert.deepEqual(foundation.bounds, sourcePlan.collisionFootprint);

  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, {
    ...sourcePlan,
    modules: [foundation]
  });

  const foundationFills = graphics.calls.filter(call => (
    call.name === "fillRect"
      && call.style?.color === sourcePlan.palette.foundation
  ));
  assert.ok(foundationFills.length >= 1);
  assert.ok(foundationFills.every(call => Number(call.style.alpha) <= 0.62));
  assert.equal(graphics.calls.some(call => call.name === "strokeRect"), false);
  assert.equal(graphics.calls.some(call => call.name === "lineBetween"), false);
});

test("rectangular roof props receive several local contact-shadow passes", () => {
  const sourcePlan = createBuildingPresentationPlan(building({
    sign: "WARE",
    presentation: { profile: "warehouse" }
  }));
  const skylight = sourcePlan.modules.find(module => module.kind === MODULE_KINDS.SKYLIGHT);
  assert.ok(skylight);

  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, {
    ...sourcePlan,
    modules: [skylight]
  });

  const contactShadows = graphics.calls.filter(call => (
    call.name === "fillRect"
      && call.style?.color === sourcePlan.palette.roofShadow
  ));
  assert.ok(contactShadows.length >= 3);
  assert.ok(new Set(contactShadows.map(call => call.style.alpha)).size >= 3);
});
