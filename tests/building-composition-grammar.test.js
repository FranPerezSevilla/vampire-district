import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULE_KINDS,
  createBuildingPresentationPlan
} from "../phaser/src/rendering/BuildingPresentation.js";

function industrialPlan(seed = 9143) {
  return createBuildingPresentationPlan({
    id: "composition-works",
    sign: "WORKS",
    x: 100,
    y: 140,
    w: 340,
    h: 240,
    color: 0x393231,
    trim: 0x70645e,
    presentation: {
      profile: "industrial",
      layoutId: "rectangle",
      detailLevel: "standard",
      seed
    }
  });
}

function rooftopProps(plan) {
  return plan.modules.filter(module => [
    MODULE_KINDS.SKYLIGHT,
    MODULE_KINDS.HVAC,
    MODULE_KINDS.VENT,
    MODULE_KINDS.HATCH,
    MODULE_KINDS.ANTENNA,
    MODULE_KINDS.SATELLITE_DISH
  ].includes(module.kind));
}

test("large industrial composition reads main mass then secondary annex then hero prop then support", () => {
  const plan = industrialPlan();
  const roof = plan.modules.find(module => module.kind === MODULE_KINDS.ROOF_MASS);
  const annex = plan.modules.find(module => module.kind === MODULE_KINDS.ROOF_ANNEX);
  const props = rooftopProps(plan);

  assert.ok(roof, "composition requires one main roof mass");
  assert.ok(annex, "industrial family requires its secondary service volume");
  assert.equal(props.length, 2, "large standard-detail roof should remain sparse with hero plus one support prop");
  assert.equal(props[0].kind, MODULE_KINDS.HVAC, "profile signature must occupy the hero prop slot");
  assert.match(props[0].id, /:prop:0:hvac$/);
  assert.match(props[1].id, /:prop:1:/, "second rooftop object should be the support slot");

  const roofIndex = plan.modules.indexOf(roof);
  const annexIndex = plan.modules.indexOf(annex);
  const heroIndex = plan.modules.indexOf(props[0]);
  const supportIndex = plan.modules.indexOf(props[1]);
  assert.ok(roofIndex < annexIndex, "main mass must establish the silhouette before the secondary volume");
  assert.ok(annexIndex < heroIndex, "secondary volume must precede rooftop prop composition");
  assert.ok(heroIndex < supportIndex, "signature hero prop must precede support detail");
});

test("composition grammar is deterministic for the same authored building and seed", () => {
  assert.deepEqual(industrialPlan(), industrialPlan());
});
