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

  lineStyle(...args) {
    this.line = { width: args[0], color: args[1], alpha: args[2] };
    this.calls.push({ name: "lineStyle", args });
    return this;
  }

  lineBetween(...args) {
    this.calls.push({ name: "lineBetween", args, line: { ...this.line } });
    return this;
  }
}

function markerPlan() {
  const plan = createBuildingPresentationPlan({
    id: "architectural-marker-church",
    sign: "CHURCH",
    x: 100,
    y: 200,
    w: 260,
    h: 260,
    color: 0x292b38,
    trim: 0x625e70,
    presentation: {
      archetype: "church",
      profile: "church",
      layoutId: "cross",
      detailLevel: "minimal",
      seed: 1187
    }
  });
  const marker = plan.modules.find(module => module.kind === MODULE_KINDS.CROSS_MARKER);
  assert.ok(marker, "church plan should contain the authored identity marker");
  return {
    ...plan,
    modules: [marker]
  };
}

function rectFromCall(call) {
  const [x, y, w, h] = call.args.map(Number);
  return { x, y, w, h };
}

function rectWithin(inner, outer) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.w <= outer.x + outer.w
    && inner.y + inner.h <= outer.y + outer.h;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

test("church marker is rendered as two joined raised roof fins instead of a flat accent stamp", () => {
  const plan = markerPlan();
  const marker = plan.modules[0];
  const authoredBounds = { ...marker.bounds };
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  assert.deepEqual(marker.bounds, authoredBounds);

  const fills = graphics.calls.filter(call => call.name === "fillRect");
  const legacyAccentStamps = fills.filter(call => (
    call.style?.color === plan.palette.accent
      && Number(call.style?.alpha) === 0.95
  ));
  assert.equal(
    legacyAccentStamps.length,
    0,
    "legacy flat cross rectangles should not survive the architectural route"
  );

  const topFaces = fills.filter(call => (
    call.style?.color === plan.palette.parapetMid
      && Number(call.style?.alpha) === 0.96
  ));
  assert.equal(topFaces.length, 2, "marker should use one raised stem and one raised arm");

  const topRects = topFaces.map(rectFromCall);
  assert.ok(topRects.some(rect => rect.h > rect.w), "one top face should read as the nave-aligned stem");
  assert.ok(topRects.some(rect => rect.w > rect.h), "one top face should read as the cross arm");
  assert.ok(rectsOverlap(topRects[0], topRects[1]), "stem and arm should join into one architectural marker");

  const structuralFaces = fills.filter(call => (
    (call.style?.color === plan.palette.parapetMid && Number(call.style?.alpha) === 0.96)
      || (call.style?.color === plan.palette.wall && Number(call.style?.alpha) === 0.82)
      || (call.style?.color === plan.palette.parapetDark && Number(call.style?.alpha) === 0.86)
  ));
  assert.equal(structuralFaces.length, 6, "two raised segments should each have top, south and east faces");
  for (const call of structuralFaces) {
    assert.equal(rectWithin(rectFromCall(call), authoredBounds), true);
  }

  const warmHighlights = graphics.calls.filter(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.accent
      && Number(call.line?.alpha) === 0.3
  ));
  assert.equal(warmHighlights.length, 4, "warm identity should stay local to restrained structural highlights");
});

test("architectural church marker rendering is deterministic for the same planned module", () => {
  const plan = markerPlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();

  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);

  assert.deepEqual(first.calls, second.calls);
});
