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

function largeGenericPlan() {
  const plan = createBuildingPresentationPlan({
    id: "neutral-block-review",
    x: 120,
    y: 160,
    w: 380,
    h: 220,
    color: 0x252c34,
    trim: 0x59636b,
    presentation: {
      profile: "default",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 8817
    }
  });
  assert.equal(plan.profileId, "default");
  assert.equal(plan.layoutId, "rectangle");
  assert.equal(
    plan.modules.filter(module => [
      MODULE_KINDS.SKYLIGHT,
      MODULE_KINDS.HVAC,
      MODULE_KINDS.VENT,
      MODULE_KINDS.HATCH,
      MODULE_KINDS.ANTENNA,
      MODULE_KINDS.SATELLITE_DISH
    ].includes(module.kind)).length,
    2,
    "large standard generic roof should retain its hero/support prop budget"
  );
  return plan;
}

function insideBounds(point, bounds) {
  const epsilon = 0.001;
  return point.x >= bounds.x - epsilon
    && point.y >= bounds.y - epsilon
    && point.x <= bounds.x + bounds.w + epsilon
    && point.y <= bounds.y + bounds.h + epsilon;
}

function pointBounds(points) {
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    w: Math.max(...xs) - x,
    h: Math.max(...ys) - y
  };
}

test("large generic roof groups existing props with one neutral service court", () => {
  const plan = largeGenericPlan();
  const authoredModules = structuredClone(plan.modules);
  const roof = plan.modules.find(module => module.kind === MODULE_KINDS.ROOF_MASS);
  const graphics = createGraphicsRecorder();

  renderBuildingPresentation(graphics, plan);

  const court = graphics.calls.find(call => (
    call.name === "fillPoints"
      && call.fill?.color === plan.palette.roofShade
      && Number(call.fill?.alpha) === 0.085
  ));
  assert.ok(court, "large default roof should receive one low-frequency neutral service court");
  const points = court.args[0];
  assert.ok(points.length >= 3);
  assert.ok(points.every(point => insideBounds(point, roof.bounds)));
  const bounds = pointBounds(points);
  assert.ok(bounds.w >= 64, "service court should be broad enough to group rooftop hardware");
  assert.ok(bounds.h >= 30, "service court should read as an area, not another diagram line");
  assert.notDeepEqual(points, roof.points, "service court must remain a local composition zone");

  const structuralJoint = graphics.calls.find(call => (
    call.name === "lineBetween"
      && call.line?.color === plan.palette.roofTextureHighlight
      && Number(call.line?.alpha) === 0.12
  ));
  assert.ok(structuralJoint, "rectangular generic service court should have one restrained structural joint");
  assert.notEqual(court.fill.color, plan.palette.accent, "generic service hierarchy must stay family-neutral");
  assert.deepEqual(plan.modules, authoredModules, "final generic treatment must not mutate planner modules");
});

test("generic service court is deterministic and omitted on roofs below the final-review size threshold", () => {
  const plan = largeGenericPlan();
  const first = createGraphicsRecorder();
  const second = createGraphicsRecorder();
  renderBuildingPresentation(first, plan);
  renderBuildingPresentation(second, plan);
  assert.deepEqual(first.calls, second.calls);

  const smallPlan = createBuildingPresentationPlan({
    id: "small-neutral-block",
    x: 20,
    y: 30,
    w: 108,
    h: 66,
    presentation: {
      profile: "default",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed: 8817
    }
  });
  const smallGraphics = createGraphicsRecorder();
  renderBuildingPresentation(smallGraphics, smallPlan);
  assert.equal(
    smallGraphics.calls.some(call => call.name === "fillPoints" && Number(call.fill?.alpha) === 0.085),
    false,
    "small generic roofs should stay sparse rather than gaining a service court"
  );
});
