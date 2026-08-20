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

function hatchPlan() {
  return createBuildingPresentationPlan({
    id: "hatch-hardware-test",
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
      propKinds: [MODULE_KINDS.HATCH],
      seed: 721
    }
  });
}

test("physical hatch adds paired hinges and a raised handle without mutating authored bounds", () => {
  const plan = hatchPlan();
  const hatch = plan.modules.find(module => module.kind === MODULE_KINDS.HATCH);
  assert.ok(hatch);
  const authoredBounds = { ...hatch.bounds };

  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, { ...plan, modules: [hatch] });

  assert.deepEqual(hatch.bounds, authoredBounds);

  const hingeFills = graphics.calls.filter(call => (
    call.name === "fillRect"
      && call.style?.color === plan.palette.serviceMid
      && Number(call.style?.alpha) === 0.82
  ));
  assert.equal(hingeFills.length, 2);

  const handleLines = graphics.calls.filter(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.parapetLight
      && Number(call.line?.alpha) === 0.68
  ));
  assert.equal(handleLines.length, 3);

  for (const call of hingeFills) {
    const [x, y, w, h] = call.args.map(Number);
    assert.ok(x >= authoredBounds.x && y >= authoredBounds.y);
    assert.ok(x + w <= authoredBounds.x + authoredBounds.w);
    assert.ok(y + h <= authoredBounds.y + authoredBounds.h);
  }
});

test("hatch hardware overlay is deterministic for the same planned module", () => {
  const plan = hatchPlan();
  const hatch = plan.modules.find(module => module.kind === MODULE_KINDS.HATCH);
  assert.ok(hatch);

  const first = new GraphicsRecorder();
  const second = new GraphicsRecorder();
  renderBuildingPresentation(first, { ...plan, modules: [hatch] });
  renderBuildingPresentation(second, { ...plan, modules: [hatch] });

  const hardwareCalls = recorder => recorder.calls.filter(call => (
    (call.name === "fillRect" && call.style?.alpha === 0.82)
      || (call.name === "lineBetween" && call.line?.alpha === 0.68)
  ));

  assert.deepEqual(hardwareCalls(first), hardwareCalls(second));
});
