import assert from "node:assert/strict";
import test from "node:test";

import {
  FRONTAGE_KINDS,
  MODULE_KINDS,
  buildingPresentationSeed,
  classifyBuildingPresentation,
  clearBuildingPresentationCache,
  createBuildingPresentationPlan,
  drawBuildingPresentation,
  getBuildingLayoutRecipe,
  moduleFitsBuildingFootprint,
  renderBuildingPresentation,
  resolveBuildingPresentationDefinition
} from "../phaser/src/rendering/BuildingPresentation.js";

function building(overrides = {}) {
  return {
    id: "generic-test-block",
    sign: "FLATS",
    districtId: "old-quarter",
    x: 100,
    y: 200,
    w: 240,
    h: 160,
    color: 0x272938,
    trim: 0x625e70,
    ...overrides
  };
}

function moduleLineKey(module) {
  return [module.x1, module.y1, module.x2, module.y2]
    .map(value => Number(value).toFixed(4))
    .join(":");
}

class GraphicsRecorder {
  constructor() {
    this.calls = [];
  }

  record(name, args) {
    this.calls.push({ name, args: [...args] });
    return this;
  }

  fillStyle(...args) { return this.record("fillStyle", args); }
  fillRect(...args) { return this.record("fillRect", args); }
  lineStyle(...args) { return this.record("lineStyle", args); }
  strokeRect(...args) { return this.record("strokeRect", args); }
  fillCircle(...args) { return this.record("fillCircle", args); }
  strokeCircle(...args) { return this.record("strokeCircle", args); }
  lineBetween(...args) { return this.record("lineBetween", args); }
}

test("semantic classification is conservative and supports explicit overrides", () => {
  assert.equal(classifyBuildingPresentation(building({ id: "police", sign: "POLICE" })), "police");
  assert.equal(classifyBuildingPresentation(building({ id: "club", sign: "CLUB" })), "club");
  assert.equal(classifyBuildingPresentation(building({ id: "cathedral", sign: "CATHEDRAL" })), "church");
  assert.equal(classifyBuildingPresentation(building({ id: "neon-row", sign: "NEON" })), "generic");
  assert.equal(
    classifyBuildingPresentation(building({ presentation: { archetype: "nightclub" } })),
    "club"
  );
});

test("the planner is deterministic for the same authored building", () => {
  const source = building({ id: "deterministic-block" });
  assert.equal(buildingPresentationSeed(source), buildingPresentationSeed({ ...source }));
  assert.deepEqual(
    createBuildingPresentationPlan(source),
    createBuildingPresentationPlan({ ...source })
  );
});

test("collision and visual footprints remain exactly equal to authored geometry", () => {
  const source = building({ x: 37, y: 51, w: 183, h: 127 });
  const plan = createBuildingPresentationPlan(source);
  const expected = { x: 37, y: 51, w: 183, h: 127 };
  assert.deepEqual(plan.collisionFootprint, expected);
  assert.deepEqual(plan.visualFootprint, expected);

  const foundations = plan.modules.filter(module => module.kind === MODULE_KINDS.FOUNDATION);
  assert.equal(foundations.length, 1);
  assert.deepEqual(foundations[0].bounds, expected);
});

test("every generated module stays inside the authored footprint", () => {
  const variants = [
    building({ id: "generic-large" }),
    building({ id: "police", sign: "POLICE" }),
    building({ id: "club", sign: "CLUB" }),
    building({ id: "church", sign: "CHURCH", w: 210, h: 220 })
  ];

  for (const source of variants) {
    const plan = createBuildingPresentationPlan(source);
    for (const module of plan.modules) {
      assert.equal(
        moduleFitsBuildingFootprint(module, plan.collisionFootprint),
        true,
        `${source.id}: ${module.kind} ${module.id}`
      );
    }
  }
});

test("layout recipes produce modular geometry without duplicate internal parapets", () => {
  const source = building({
    id: "authored-l-block",
    presentation: { layoutId: "l-shape" }
  });
  const plan = createBuildingPresentationPlan(source);
  assert.equal(plan.layoutId, "l-shape");
  assert.equal(plan.roofGrid.occupiedCells.length, 5);

  const edges = plan.modules.filter(module => module.kind === MODULE_KINDS.PARAPET_EDGE);
  assert.equal(edges.length, 10);
  assert.equal(new Set(edges.map(moduleLineKey)).size, edges.length);
});

test("unsupported layout size falls back safely and reports why", () => {
  const source = building({
    id: "tiny-church",
    w: 70,
    h: 60,
    presentation: { layoutId: "cross" }
  });
  const plan = createBuildingPresentationPlan(source);
  assert.equal(plan.layoutId, "rectangle");
  assert.equal(plan.warnings.length, 1);
  assert.match(plan.warnings[0], /does not fit/i);
});

test("landmark archetypes assemble from shared modules but retain identity", () => {
  const police = createBuildingPresentationPlan(building({ id: "police", sign: "POLICE" }));
  assert.equal(police.archetype, "police");
  assert.equal(police.frontage.kind, FRONTAGE_KINDS.POLICE);
  assert.ok(police.modules.some(module => module.kind === MODULE_KINDS.ANTENNA));
  assert.ok(police.modules.some(module => module.kind === MODULE_KINDS.ACCENT_STRIP));

  const club = createBuildingPresentationPlan(building({ id: "club", sign: "CLUB" }));
  assert.equal(club.archetype, "club");
  assert.equal(club.layoutId, "irregular");
  assert.equal(club.frontage.kind, FRONTAGE_KINDS.CLUB);
  assert.ok(club.modules.some(module => module.kind === MODULE_KINDS.SKYLIGHT));
  assert.ok(club.modules.some(module => module.kind === MODULE_KINDS.ACCENT_STRIP));

  const church = createBuildingPresentationPlan(building({
    id: "cathedral",
    sign: "CATHEDRAL",
    w: 260,
    h: 260
  }));
  assert.equal(church.archetype, "church");
  assert.equal(church.layoutId, "cross");
  assert.equal(church.frontage.kind, FRONTAGE_KINDS.CHURCH);
  assert.ok(church.modules.some(module => module.kind === MODULE_KINDS.ROOF_RIDGE));
  assert.ok(church.modules.some(module => module.kind === MODULE_KINDS.CROSS_MARKER));
});

test("authored presentation overrides are resolved through one extension point", () => {
  const source = building({
    presentation: {
      archetype: "club",
      layoutId: "l-shape",
      frontage: "club",
      frontageEdge: "east",
      frontageOffset: 0.5,
      detailLevel: "minimal",
      propKinds: [MODULE_KINDS.FRONTAGE, MODULE_KINDS.VENT]
    }
  });
  const definition = resolveBuildingPresentationDefinition(source);
  assert.equal(definition.archetypeId, "club");
  assert.equal(definition.layoutId, "l-shape");
  assert.equal(definition.frontageEdge, "east");
  assert.equal(definition.frontageOffset, 0.5);
  assert.equal(definition.detailLevel, "minimal");

  const plan = createBuildingPresentationPlan(source);
  assert.equal(plan.layoutId, "l-shape");
  assert.equal(plan.frontage.edge, "east");
  assert.equal(plan.modules.filter(module => module.kind === MODULE_KINDS.FRONTAGE).length, 1);
  const optionalProps = plan.modules.filter(module => [
    MODULE_KINDS.SKYLIGHT,
    MODULE_KINDS.HVAC,
    MODULE_KINDS.VENT,
    MODULE_KINDS.HATCH,
    MODULE_KINDS.SATELLITE_DISH
  ].includes(module.kind));
  assert.ok(optionalProps.every(module => module.kind === MODULE_KINDS.VENT));
});

test("all catalog recipes have internally consistent masks", () => {
  for (const id of ["rectangle", "l-shape", "t-shape", "stepped", "cross", "irregular"]) {
    const recipe = getBuildingLayoutRecipe(id);
    assert.ok(recipe);
    assert.equal(recipe.mask.length, recipe.rows);
    assert.ok(recipe.mask.every(row => row.length === recipe.columns));
    assert.ok(recipe.mask.some(row => row.includes("1")));
  }
});

test("runtime drawing caches deterministic plans per authored building and option set", () => {
  const source = building({ id: "cached-building" });
  const first = drawBuildingPresentation(new GraphicsRecorder(), source, { detailLevel: "minimal" });
  const second = drawBuildingPresentation(new GraphicsRecorder(), source, { detailLevel: "minimal" });
  assert.equal(first, second);

  clearBuildingPresentationCache(source);
  const third = drawBuildingPresentation(new GraphicsRecorder(), source, { detailLevel: "minimal" });
  assert.notEqual(first, third);
  assert.deepEqual(first, third);
});

test("renderer dispatches the modular plan without requiring Phaser globals", () => {
  const graphics = new GraphicsRecorder();
  const plan = createBuildingPresentationPlan(building({ id: "club", sign: "CLUB" }));
  assert.doesNotThrow(() => renderBuildingPresentation(graphics, plan));
  assert.ok(graphics.calls.some(call => call.name === "fillRect"));
  assert.ok(graphics.calls.some(call => call.name === "lineBetween"));
  assert.ok(graphics.calls.some(call => call.name === "strokeRect"));
});
