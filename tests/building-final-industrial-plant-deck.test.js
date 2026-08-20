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

function industrialPlan() {
  const plan = createBuildingPresentationPlan({
    id: "foundry-review-block",
    sign: "FOUNDRY WORKS",
    x: 120,
    y: 150,
    w: 360,
    h: 220,
    color: 0x423329,
    trim: 0x67584e,
    presentation: {
      profile: "industrial",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 9917
    }
  });
  assert.equal(plan.profileId, "industrial");
  assert.ok(plan.modules.some(module => module.kind === MODULE_KINDS.ROOF_ANNEX));
  assert.ok(plan.modules.some(module => module.kind === MODULE_KINDS.HVAC));
  return plan;
}

function rectContainsPoint(rect, point) {
  const epsilon = 0.001;
  return point.x >= rect.x - epsilon
    && point.y >= rect.y - epsilon
    && point.x <= rect.x + rect.w + epsilon
    && point.y <= rect.y + rect.h + epsilon;
}

function center(bounds) {
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

test("industrial roof groups planned annex and HVAC inside one restrained mechanical plant deck", () => {
  const plan = industrialPlan();
  const authoredModules = structuredClone(plan.modules);
  const roof = plan.modules.find(module => module.kind === MODULE_KINDS.ROOF_MASS);
  const annex = plan.modules.find(module => module.kind === MODULE_KINDS.ROOF_ANNEX);
  const hvac = plan.modules.find(module => module.kind === MODULE_KINDS.HVAC);
  const graphics = createGraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const deckCall = graphics.calls.find(call => (
    call.name === "fillRect"
      && call.fill?.color === plan.palette.serviceDark
      && Number(call.fill?.alpha) === 0.12
  ));
  assert.ok(deckCall, "industrial roof should receive one low-frequency mechanical plant deck");
  const [x, y, w, h] = deckCall.args;
  const deck = { x, y, w, h };
  assert.ok(w >= 70 && h >= 42, "plant deck should read as one broad service zone");
  assert.ok(rectContainsPoint(roof.bounds, { x, y }));
  assert.ok(rectContainsPoint(roof.bounds, { x: x + w, y: y + h }));
  assert.ok(rectContainsPoint(deck, center(annex.bounds)), "plant deck should group the raised service annex");
  assert.ok(rectContainsPoint(deck, center(hvac.bounds)), "plant deck should group the primary HVAC unit");

  const upperEdge = graphics.calls.find(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.roofTextureHighlight
      && Number(call.line?.alpha) === 0.14
  ));
  assert.ok(upperEdge, "plant deck should get one restrained material edge, not a decorative grid");
  assert.deepEqual(plan.modules, authoredModules, "industrial final treatment must not mutate planner-owned modules");
});

test("industrial mechanical plant deck is deterministic and does not leak into non-industrial roofs", () => {
  const plan = industrialPlan();
  const first = createGraphicsRecorder();
  const second = createGraphicsRecorder();
  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);
  assert.deepEqual(first.calls, second.calls);

  const generic = createBuildingPresentationPlan({
    id: "neutral-control-block",
    x: 40,
    y: 50,
    w: 360,
    h: 220,
    presentation: {
      profile: "default",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 9917
    }
  });
  const control = createGraphicsRecorder();
  renderBuildingPresentation(control, generic);
  assert.equal(
    control.calls.some(call => (
      call.name === "fillRect"
        && call.fill?.color === generic.palette.serviceDark
        && Number(call.fill?.alpha) === 0.12
    )),
    false,
    "industrial plant deck must remain family-specific"
  );
});
