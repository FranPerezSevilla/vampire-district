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

function ventPlan() {
  return createBuildingPresentationPlan({
    id: "vent-refinement-test",
    sign: "FLATS",
    x: 100,
    y: 200,
    w: 220,
    h: 150,
    color: 0x292b38,
    trim: 0x625e70,
    presentation: {
      profile: "residential",
      detailLevel: "rich",
      propKinds: [MODULE_KINDS.VENT],
      seed: 733
    }
  });
}

test("physical vent gains a recessed exhaust throat and metal collar without mutating bounds", () => {
  const plan = ventPlan();
  const vent = plan.modules.find(module => module.kind === MODULE_KINDS.VENT);
  assert.ok(vent);
  const authoredBounds = { ...vent.bounds };

  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, { ...plan, modules: [vent] });

  assert.deepEqual(vent.bounds, authoredBounds);

  const collar = graphics.calls.filter(call => (
    call.name === "fillCircle"
      && call.style?.color === plan.palette.propDark
      && Number(call.style?.alpha) === 0.9
  ));
  const throat = graphics.calls.filter(call => (
    call.name === "fillCircle"
      && call.style?.color === plan.palette.serviceDark
      && Number(call.style?.alpha) === 0.96
  ));
  const occlusion = graphics.calls.filter(call => (
    call.name === "fillCircle"
      && call.style?.color === plan.palette.roofShadow
      && Number(call.style?.alpha) === 0.32
  ));

  assert.equal(collar.length, 1);
  assert.equal(throat.length, 1);
  assert.equal(occlusion.length, 1);

  const rim = graphics.calls.filter(call => (
    call.name === "strokeCircle"
      && call.line?.color === plan.palette.serviceMid
      && Number(call.line?.alpha) === 0.68
  ));
  assert.equal(rim.length, 1);

  const directionalRimHighlight = graphics.calls.filter(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.parapetLight
      && Number(call.line?.alpha) === 0.36
  ));
  assert.equal(directionalRimHighlight.length, 1);
});

test("vent refinement is deterministic for the same planned module", () => {
  const plan = ventPlan();
  const vent = plan.modules.find(module => module.kind === MODULE_KINDS.VENT);
  assert.ok(vent);

  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();
  renderBuildingPresentation(first, { ...plan, modules: [vent] });
  renderBuildingPresentation(second, { ...plan, modules: [vent] });

  const detailCalls = recorder => recorder.calls.filter(call => (
    (call.name === "fillCircle" && [0.9, 0.96, 0.32].includes(Number(call.style?.alpha)))
      || (call.name === "strokeCircle" && Number(call.line?.alpha) === 0.68)
      || (call.name === "lineBetween" && Number(call.line?.alpha) === 0.36)
  ));

  assert.deepEqual(detailCalls(first), detailCalls(second));
});
