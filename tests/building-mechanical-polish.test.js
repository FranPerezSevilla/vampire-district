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

function industrialBuilding() {
  return {
    id: "mechanical-polish-works",
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
      seed: 903
    }
  };
}

test("industrial HVAC keeps authored bounds while gaining casing faces and fan housings", () => {
  const plan = createBuildingPresentationPlan(industrialBuilding());
  const hvac = plan.modules.find(module => module.kind === MODULE_KINDS.HVAC);
  assert.ok(hvac, "industrial profile should emit an HVAC unit");
  const authoredBounds = { ...hvac.bounds };

  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, { ...plan, modules: [hvac] });

  assert.deepEqual(hvac.bounds, authoredBounds);

  const rectFills = graphics.calls.filter(call => call.name === "fillRect");
  assert.ok(rectFills.some(call => call.style?.color === plan.palette.prop));
  assert.ok(rectFills.some(call => call.style?.color === plan.palette.propDark));
  assert.ok(rectFills.some(call => call.style?.color === plan.palette.serviceDark));

  const contactShadows = rectFills.filter(call => call.style?.color === plan.palette.roofShadow);
  assert.ok(contactShadows.length >= 3, "HVAC should retain layered contact shadow");
  assert.ok(new Set(contactShadows.map(call => call.style.alpha)).size >= 3);

  const fanHousings = graphics.calls.filter(call => (
    call.name === "fillCircle" && call.style?.color === plan.palette.propDark
  ));
  const fanWells = graphics.calls.filter(call => (
    call.name === "fillCircle" && call.style?.color === plan.palette.serviceDark
  ));
  assert.ok(fanHousings.length >= 1);
  assert.equal(fanWells.length, fanHousings.length);
  assert.ok(graphics.calls.filter(call => call.name === "strokeCircle").length >= fanHousings.length * 2);
});

test("wide HVAC units use multiple physical fan housings without planner-specific geometry", () => {
  const plan = createBuildingPresentationPlan(industrialBuilding());
  const source = plan.modules.find(module => module.kind === MODULE_KINDS.HVAC);
  assert.ok(source);

  const wideHvac = {
    ...source,
    bounds: { x: 120, y: 220, w: 72, h: 30 }
  };
  const before = { ...wideHvac.bounds };
  const graphics = new GraphicsRecorder();
  renderBuildingPresentation(graphics, { ...plan, modules: [wideHvac] });

  assert.deepEqual(wideHvac.bounds, before);
  const fanHousings = graphics.calls.filter(call => (
    call.name === "fillCircle" && call.style?.color === plan.palette.propDark
  ));
  assert.equal(fanHousings.length, 2);
});
