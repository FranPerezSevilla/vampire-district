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

function policePlan() {
  return createBuildingPresentationPlan({
    id: "antenna-support-police",
    sign: "POLICE",
    x: 100,
    y: 200,
    w: 260,
    h: 180,
    color: 0x292b38,
    trim: 0x625e70,
    presentation: {
      archetype: "police",
      profile: "police",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 947
    }
  });
}

test("police antenna is anchored to a physical base with mast and braces inside authored bounds", () => {
  const plan = policePlan();
  const antenna = plan.modules.find(module => module.kind === MODULE_KINDS.ANTENNA);
  assert.ok(antenna, "police grammar should emit its signature antenna");
  const authoredBounds = { ...antenna.bounds };

  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, { ...plan, modules: [antenna] });

  assert.deepEqual(antenna.bounds, authoredBounds);

  const physicalBaseTops = graphics.calls.filter(call => (
    call.name === "fillRect"
      && call.style?.color === plan.palette.propDark
      && Number(call.style?.alpha) === 1
  ));
  assert.ok(physicalBaseTops.length >= 1);

  const mast = graphics.calls.filter(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.parapetLight
      && Number(call.line?.alpha) === 0.78
  ));
  const braces = graphics.calls.filter(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.serviceMid
      && Number(call.line?.alpha) === 0.42
  ));
  const crossarm = graphics.calls.filter(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.prop
      && Number(call.line?.alpha) === 0.54
  ));
  const mastCap = graphics.calls.filter(call => (
    call.name === "fillCircle"
      && call.style?.color === plan.palette.serviceMid
      && Number(call.style?.alpha) === 0.88
  ));

  assert.equal(mast.length, 1);
  assert.equal(braces.length, 2);
  assert.equal(crossarm.length, 1);
  assert.equal(mastCap.length, 1);

  for (const call of [...mast, ...braces, ...crossarm]) {
    const [x1, y1, x2, y2] = call.args.map(Number);
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      assert.ok(x >= authoredBounds.x && x <= authoredBounds.x + authoredBounds.w);
      assert.ok(y >= authoredBounds.y && y <= authoredBounds.y + authoredBounds.h);
    }
  }
});

test("antenna support overlay is deterministic for the same planned module", () => {
  const plan = policePlan();
  const antenna = plan.modules.find(module => module.kind === MODULE_KINDS.ANTENNA);
  assert.ok(antenna);

  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();
  renderBuildingPresentation(first, { ...plan, modules: [antenna] });
  renderBuildingPresentation(second, { ...plan, modules: [antenna] });

  const supportCalls = recorder => recorder.calls.filter(call => (
    (call.name === "lineBetween" && [0.78, 0.42, 0.54].includes(Number(call.line?.alpha)))
      || (call.name === "fillCircle" && Number(call.style?.alpha) === 0.88)
  ));

  assert.deepEqual(supportCalls(first), supportCalls(second));
});
