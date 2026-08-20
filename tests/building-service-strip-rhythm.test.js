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
  fillRect(...args) {
    this.calls.push({ name: "fillRect", args, fill: { ...this.fill } });
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
}

function servicePlan() {
  const plan = createBuildingPresentationPlan({
    id: "service-rhythm-warehouse",
    sign: "WAREHOUSE",
    x: 100,
    y: 140,
    w: 340,
    h: 230,
    color: 0x30363b,
    trim: 0x687078,
    presentation: {
      profile: "warehouse",
      layoutId: "rectangle",
      detailLevel: "minimal",
      seed: 8431
    }
  });
  const strip = plan.modules.find(module => module.kind === MODULE_KINDS.SERVICE_STRIP);
  assert.ok(strip);
  assert.ok(Number(strip.slots) >= 4, "wide warehouse fixture should expose enough slots to judge rhythm");
  return { ...plan, modules: [strip] };
}

function inside(rect, bounds) {
  const epsilon = 0.001;
  return rect.x >= bounds.x - epsilon
    && rect.y >= bounds.y - epsilon
    && rect.x + rect.w <= bounds.x + bounds.w + epsilon
    && rect.y + rect.h <= bounds.y + bounds.h + epsilon;
}

test("service strip uses deterministic irregular spacing instead of equal repeated slots", () => {
  const plan = servicePlan();
  const strip = plan.modules[0];
  const authored = structuredClone(strip);
  const graphics = new GraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const slots = graphics.calls
    .filter(call => (
      call.name === "fillRect"
        && call.fill?.color === plan.palette.serviceWindow
        && Number(call.fill?.alpha) === 0.88
    ))
    .map(call => ({
      x: Number(call.args[0]),
      y: Number(call.args[1]),
      w: Number(call.args[2]),
      h: Number(call.args[3])
    }));

  assert.equal(slots.length, Number(strip.slots));
  assert.ok(slots.every(slot => inside(slot, strip.bounds)));
  for (let index = 1; index < slots.length; index += 1) {
    assert.ok(slots[index].x > slots[index - 1].x + slots[index - 1].w, "service slots must remain ordered and separated");
  }

  const centerGaps = [];
  for (let index = 1; index < slots.length; index += 1) {
    const previous = slots[index - 1].x + slots[index - 1].w / 2;
    const current = slots[index].x + slots[index].w / 2;
    centerGaps.push(Number((current - previous).toFixed(2)));
  }
  assert.ok(new Set(centerGaps).size > 1, "service rhythm should not be an equal-spaced UI row");
  assert.ok(new Set(slots.map(slot => Number(slot.w.toFixed(2)))).size > 1, "slot widths should vary slightly within a controlled family");
  assert.deepEqual(strip, authored, "renderer rhythm must not mutate planner-owned service bounds or slot count");
});

test("service-slot rhythm is deterministic", () => {
  const plan = servicePlan();
  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();
  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);
  assert.deepEqual(first.calls, second.calls);
});
