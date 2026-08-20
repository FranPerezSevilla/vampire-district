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
  fillStyle(color, alpha) { this.fill = { color, alpha }; this.calls.push({ name: "fillStyle", args: [color, alpha] }); return this; }
  fillPoints(points, closePath) { this.calls.push({ name: "fillPoints", args: [points.map(point => ({ ...point })), closePath], fill: { ...this.fill } }); return this; }
  fillRect(...args) { this.calls.push({ name: "fillRect", args, fill: { ...this.fill } }); return this; }
  fillCircle(...args) { this.calls.push({ name: "fillCircle", args, fill: { ...this.fill } }); return this; }
  lineStyle(width, color, alpha) { this.line = { width, color, alpha }; this.calls.push({ name: "lineStyle", args: [width, color, alpha] }); return this; }
  lineBetween(...args) { this.calls.push({ name: "lineBetween", args, line: { ...this.line } }); return this; }
  strokeRect(...args) { this.calls.push({ name: "strokeRect", args, line: { ...this.line } }); return this; }
  strokeCircle(...args) { this.calls.push({ name: "strokeCircle", args, line: { ...this.line } }); return this; }
}

function clubPlan() {
  return createBuildingPresentationPlan({
    id: "final-nightlife-club",
    sign: "CLUB",
    x: 120,
    y: 150,
    w: 240,
    h: 120,
    color: 0x2b2232,
    trim: 0x6f526f,
    presentation: {
      archetype: "club",
      profile: "club",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 22101
    }
  });
}

function inside(point, bounds) {
  const epsilon = 0.001;
  return point.x >= bounds.x - epsilon
    && point.y >= bounds.y - epsilon
    && point.x <= bounds.x + bounds.w + epsilon
    && point.y <= bounds.y + bounds.h + epsilon;
}

test("nightlife roof balances its hero prop with one dark asymmetric service deck", () => {
  const plan = clubPlan();
  const roof = plan.modules.find(module => module.kind === MODULE_KINDS.ROOF_MASS);
  const hero = plan.modules.find(module => module.kind === MODULE_KINDS.SKYLIGHT);
  assert.ok(roof?.bounds);
  assert.ok(hero?.bounds);
  const authored = structuredClone(plan.modules);
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const deck = graphics.calls.find(call => (
    call.name === "fillPoints"
      && call.fill?.color === plan.palette.serviceDark
      && Number(call.fill?.alpha) === 0.28
  ));
  assert.ok(deck, "club should gain one dark service-deck material zone");
  assert.ok(deck.args[0].every(point => inside(point, roof.bounds)));

  const deckCenterX = deck.args[0].reduce((sum, point) => sum + point.x, 0) / deck.args[0].length;
  const heroCenterX = hero.bounds.x + hero.bounds.w / 2;
  const roofCenterX = roof.bounds.x + roof.bounds.w / 2;
  assert.ok(
    (heroCenterX <= roofCenterX && deckCenterX > roofCenterX)
      || (heroCenterX > roofCenterX && deckCenterX < roofCenterX),
    "service deck should counterbalance the hero rooflight rather than stack beside it"
  );

  const accent = graphics.calls.find(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.accentSoft
      && Number(call.line?.alpha) === 0.22
  ));
  assert.ok(accent, "nightlife deck should receive exactly one restrained local accent cue");
  assert.deepEqual(plan.modules, authored);
});

test("final nightlife composition is deterministic", () => {
  const plan = clubPlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();
  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);
  assert.deepEqual(first.calls, second.calls);
});
