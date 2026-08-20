import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULE_KINDS,
  createBuildingPresentationPlan,
  renderBuildingPresentation
} from "../phaser/src/rendering/BuildingPresentation.js";

function createGraphicsRecorder() {
  const target = {
    calls: [],
    fill: { color: null, alpha: null },
    line: { width: null, color: null, alpha: null }
  };
  let proxy;
  proxy = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      return (...args) => {
        if (property === "fillStyle") object.fill = { color: args[0], alpha: args[1] };
        if (property === "lineStyle") object.line = { width: args[0], color: args[1], alpha: args[2] };
        object.calls.push({
          name: property,
          args: structuredClone(args),
          fill: { ...object.fill },
          line: { ...object.line }
        });
        return proxy;
      };
    }
  });
  return proxy;
}

function policePlan() {
  const plan = createBuildingPresentationPlan({
    id: "civic-centre-review",
    sign: "POLICE",
    x: 120,
    y: 150,
    w: 360,
    h: 220,
    color: 0x27364f,
    trim: 0x61779c,
    presentation: {
      archetype: "police",
      profile: "police",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 6127
    }
  });
  assert.equal(plan.profileId, "police");
  assert.ok(plan.modules.some(module => module.kind === MODULE_KINDS.HVAC));
  assert.ok(plan.modules.some(module => module.kind === MODULE_KINDS.ANTENNA));
  return plan;
}

function center(bounds) {
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

function containsPoint(rect, point) {
  const epsilon = 0.001;
  return point.x >= rect.x - epsilon
    && point.y >= rect.y - epsilon
    && point.x <= rect.x + rect.w + epsilon
    && point.y <= rect.y + rect.h + epsilon;
}

test("police roof groups HVAC and antenna inside one ordered communications court", () => {
  const plan = policePlan();
  const authoredModules = structuredClone(plan.modules);
  const roof = plan.modules.find(module => module.kind === MODULE_KINDS.ROOF_MASS);
  const hvac = plan.modules.find(module => module.kind === MODULE_KINDS.HVAC);
  const antenna = plan.modules.find(module => module.kind === MODULE_KINDS.ANTENNA);
  const graphics = createGraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const courtCall = graphics.calls.find(call => (
    call.name === "fillRect"
      && call.fill?.color === plan.palette.roofShade
      && Number(call.fill?.alpha) === 0.13
  ));
  assert.ok(courtCall, "police roof should receive one broad civic communications court");
  const [x, y, w, h] = courtCall.args;
  const court = { x, y, w, h };
  assert.ok(w >= 116 && h >= 58, "communications court should read as an ordered area, not another icon");
  assert.ok(containsPoint(roof.bounds, { x, y }));
  assert.ok(containsPoint(roof.bounds, { x: x + w, y: y + h }));
  assert.ok(containsPoint(court, center(hvac.bounds)), "court should group the planned HVAC unit");
  assert.ok(containsPoint(court, center(antenna.bounds)), "court should group the planned antenna");

  const materialCap = graphics.calls.find(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.roofTextureHighlight
      && Number(call.line?.alpha) === 0.15
  ));
  assert.ok(materialCap, "communications court should have one restrained civic material cap");
  assert.deepEqual(plan.modules, authoredModules, "police final treatment must not mutate planner-owned modules");
});

test("police communications court is deterministic and does not leak into non-police roofs", () => {
  const plan = policePlan();
  const first = createGraphicsRecorder();
  const second = createGraphicsRecorder();
  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);
  assert.deepEqual(first.calls, second.calls);

  const generic = createBuildingPresentationPlan({
    id: "neutral-control-building",
    x: 40,
    y: 50,
    w: 360,
    h: 220,
    presentation: {
      profile: "default",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 6127
    }
  });
  const control = createGraphicsRecorder();
  renderBuildingPresentation(control, generic);
  assert.equal(
    control.calls.some(call => (
      call.name === "fillRect"
        && call.fill?.color === generic.palette.roofShade
        && Number(call.fill?.alpha) === 0.13
    )),
    false,
    "police communications court must remain family-specific"
  );
});
