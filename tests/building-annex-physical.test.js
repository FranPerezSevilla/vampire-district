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

  fillCircle(...args) {
    this.calls.push({ name: "fillCircle", args, style: { ...this.style } });
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

function annexPlan() {
  const plan = createBuildingPresentationPlan({
    id: "annex-physical-contract",
    sign: "WORKS",
    x: 100,
    y: 200,
    w: 260,
    h: 180,
    color: 0x292b38,
    trim: 0x625e70,
    presentation: {
      profile: "industrial",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 977
    }
  });
  return {
    ...plan,
    modules: [{
      kind: MODULE_KINDS.ROOF_ANNEX,
      layer: 26,
      bounds: { x: 156, y: 242, w: 64, h: 42 },
      variant: "raised"
    }]
  };
}

test("raised annex uses physical top and wall faces without mutating authored bounds", () => {
  const plan = annexPlan();
  const annex = plan.modules[0];
  const authoredBounds = { ...annex.bounds };
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  assert.deepEqual(annex.bounds, authoredBounds);

  const rectFills = graphics.calls.filter(call => call.name === "fillRect");
  const physicalFaces = rectFills.filter(call => [
    plan.palette.annexRoof,
    plan.palette.wall,
    plan.palette.serviceDark
  ].includes(call.style?.color));

  assert.ok(physicalFaces.some(call => call.style?.color === plan.palette.annexRoof));
  assert.ok(physicalFaces.some(call => call.style?.color === plan.palette.wall));
  assert.ok(physicalFaces.some(call => call.style?.color === plan.palette.serviceDark));
  assert.ok(rectFills.some(call => call.style?.color === plan.palette.roofShadow));

  for (const call of physicalFaces) {
    const [x, y, w, h] = call.args.map(Number);
    assert.ok(x >= authoredBounds.x);
    assert.ok(y >= authoredBounds.y);
    assert.ok(x + w <= authoredBounds.x + authoredBounds.w);
    assert.ok(y + h <= authoredBounds.y + authoredBounds.h);
  }

  assert.equal(
    graphics.calls.filter(call => call.name === "fillCircle").length,
    0,
    "legacy icon-like annex circle should not survive the physical-volume route"
  );
  assert.equal(
    graphics.calls.filter(call => call.name === "strokeRect").length,
    0,
    "raised annex should no longer use the legacy stamped rectangle outline"
  );
});

test("raised annex physical rendering is deterministic for the same planned module", () => {
  const plan = annexPlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();

  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);

  assert.deepEqual(first.calls, second.calls);
});
