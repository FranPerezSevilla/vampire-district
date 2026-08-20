import assert from "node:assert/strict";
import test from "node:test";

import {
  FRONTAGE_KINDS,
  MODULE_KINDS,
  ROOF_SURFACE_KINDS,
  buildingPresentationSeed,
  classifyBuildingPresentation,
  classifyBuildingVisualProfile,
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
  fillPoints(...args) { return this.record("fillPoints", args); }
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

test("generic visual profiles use narrow whole-word classification", () => {
  assert.equal(classifyBuildingVisualProfile(building({ sign: "WARE" })), "warehouse");
  assert.equal(classifyBuildingVisualProfile(building({ sign: "WORKS" })), "industrial");
  assert.equal(classifyBuildingVisualProfile(building({ sign: "FLATS" })), "residential");
  assert.equal(classifyBuildingVisualProfile(building({ sign: "SOFTWARE" })), "default");
  assert.equal(
    classifyBuildingVisualProfile(building({ presentation: { profile: "factory" } })),
    "industrial"
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

test("every planned module stays inside the authored footprint", () => {
  const variants = [
    building({ id: "generic-large" }),
    building({ id: "warehouse", sign: "WARE" }),
    building({ id: "works", sign: "WORKS" }),
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

test("each building renders one fused roof mass instead of visible roof cells", () => {
  const plan = createBuildingPresentationPlan(building({
    id: "authored-l-block",
    presentation: { layoutId: "l-shape" }
  }));
  const masses = plan.modules.filter(module => module.kind === MODULE_KINDS.ROOF_MASS);
  assert.equal(masses.length, 1);
  assert.equal(masses[0].points.length, 6);
  assert.equal(plan.silhouette.points.length, 6);
  assert.equal(plan.modules.some(module => module.kind === "roof-cell"), false);
});

test("layout recipes produce clean external parapets without internal seams", () => {
  const source = building({
    id: "authored-l-block",
    presentation: { layoutId: "l-shape" }
  });
  const plan = createBuildingPresentationPlan(source);
  assert.equal(plan.layoutId, "l-shape");
  assert.equal(plan.roofGrid.occupiedCells.length, 5);

  const edges = plan.modules.filter(module => module.kind === MODULE_KINDS.PARAPET_EDGE);
  assert.equal(edges.length, 6);
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

test("standard detail stays restrained and uses large signature props", () => {
  const generic = createBuildingPresentationPlan(building({ id: "generic-detail" }));
  assert.ok(rooftopProps(generic).length <= 2);

  const club = createBuildingPresentationPlan(building({ id: "club", sign: "CLUB" }));
  const skylight = club.modules.find(module => module.kind === MODULE_KINDS.SKYLIGHT);
  assert.ok(skylight);
  assert.ok(skylight.bounds.w >= 20);
  assert.ok(skylight.bounds.h >= 12);
});

test("WARE uses the approved cool corrugated warehouse grammar", () => {
  const plan = createBuildingPresentationPlan(building({
    id: "riverside-ware",
    sign: "WARE"
  }));
  assert.equal(plan.archetype, "generic");
  assert.equal(plan.profileId, "warehouse");
  assert.equal(plan.surfaceKind, ROOF_SURFACE_KINDS.CORRUGATED);
  assert.equal(plan.layoutId, "rectangle");
  assert.equal(plan.frontage, null);
  assert.ok(plan.modules.some(module => module.kind === MODULE_KINDS.SKYLIGHT));
  assert.ok(plan.modules.some(module => module.kind === MODULE_KINDS.SERVICE_STRIP));
  assert.ok(
    plan.modules.filter(module => module.kind === MODULE_KINDS.ROOF_TEXTURE_LINE).length >= 4
  );
});

test("WORKS uses one unified industrial mass with a raised service annex", () => {
  const plan = createBuildingPresentationPlan(building({
    id: "old-works",
    sign: "WORKS"
  }));
  assert.equal(plan.archetype, "generic");
  assert.equal(plan.profileId, "industrial");
  assert.equal(plan.surfaceKind, ROOF_SURFACE_KINDS.MEMBRANE);
  assert.equal(plan.layoutId, "rectangle");
  assert.ok(plan.modules.some(module => module.kind === MODULE_KINDS.ROOF_ANNEX));
  assert.ok(plan.modules.some(module => module.kind === MODULE_KINDS.HVAC));
  assert.ok(plan.modules.some(module => module.kind === MODULE_KINDS.SERVICE_STRIP));
  assert.ok(plan.modules.some(module => module.kind === MODULE_KINDS.SERVICE_LIGHT));
});

test("landmark archetypes assemble from shared modules but retain identity", () => {
  const police = createBuildingPresentationPlan(building({ id: "police", sign: "POLICE" }));
  assert.equal(police.archetype, "police");
  assert.equal(police.profileId, "police");
  assert.equal(police.frontage.kind, FRONTAGE_KINDS.POLICE);
  assert.ok(police.modules.some(module => module.kind === MODULE_KINDS.ANTENNA));
  assert.ok(police.modules.some(module => module.kind === MODULE_KINDS.ACCENT_STRIP));

  const club = createBuildingPresentationPlan(building({ id: "club", sign: "CLUB" }));
  assert.equal(club.archetype, "club");
  assert.equal(club.profileId, "club");
  assert.equal(club.layoutId, "irregular");
  assert.equal(club.frontage.kind, FRONTAGE_KINDS.CLUB);
  assert.ok(club.modules.some(module => module.kind === MODULE_KINDS.SKYLIGHT));
  assert.equal(
    club.modules.filter(module => module.kind === MODULE_KINDS.ACCENT_STRIP).length,
    1
  );

  const church = createBuildingPresentationPlan(building({
    id: "cathedral",
    sign: "CATHEDRAL",
    w: 260,
    h: 260
  }));
  assert.equal(church.archetype, "church");
  assert.equal(church.profileId, "church");
  assert.equal(church.layoutId, "cross");
  assert.equal(church.frontage.kind, FRONTAGE_KINDS.CHURCH);
  assert.ok(church.modules.some(module => module.kind === MODULE_KINDS.ROOF_RIDGE));
  assert.ok(church.modules.some(module => module.kind === MODULE_KINDS.CROSS_MARKER));
});

test("authored presentation overrides are resolved through one extension point", () => {
  const source = building({
    presentation: {
      archetype: "club",
      profile: "warehouse",
      surfaceKind: "corrugated",
      layoutId: "l-shape",
      frontage: "club",
      frontageEdge: "east",
      frontageOffset: 0.5,
      detailLevel: "minimal",
      showLabel: true,
      propKinds: [MODULE_KINDS.FRONTAGE, MODULE_KINDS.VENT]
    }
  });
  const definition = resolveBuildingPresentationDefinition(source);
  assert.equal(definition.archetypeId, "club");
  assert.equal(definition.profileId, "warehouse");
  assert.equal(definition.surfaceKind, "corrugated");
  assert.equal(definition.layoutId, "l-shape");
  assert.equal(definition.frontageEdge, "east");
  assert.equal(definition.frontageOffset, 0.5);
  assert.equal(definition.detailLevel, "minimal");
  assert.equal(definition.showLabel, true);

  const plan = createBuildingPresentationPlan(source);
  assert.equal(plan.profileId, "warehouse");
  assert.equal(plan.surfaceKind, ROOF_SURFACE_KINDS.CORRUGATED);
  assert.equal(plan.layoutId, "l-shape");
  assert.equal(plan.frontage.edge, "east");
  assert.equal(plan.showLabel, true);
  assert.equal(
    plan.modules.filter(module => module.kind === MODULE_KINDS.FRONTAGE).length,
    1
  );
  assert.ok(rooftopProps(plan).every(module => module.kind === MODULE_KINDS.VENT));
});

test("world labels are opt-in rather than permanent debug overlays", () => {
  assert.equal(createBuildingPresentationPlan(building({ sign: "WARE" })).showLabel, false);
  assert.equal(
    createBuildingPresentationPlan(building({
      sign: "WARE",
      presentation: { showLabel: true }
    })).showLabel,
    true
  );
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

test("tiny authored footprints still produce contained, renderable modules", () => {
  const source = building({
    id: "tiny-explicit-club",
    x: 3,
    y: 7,
    w: 8,
    h: 8,
    presentation: { archetype: "club", frontageEdge: "east" }
  });
  const plan = createBuildingPresentationPlan(source);
  for (const module of plan.modules) {
    assert.equal(moduleFitsBuildingFootprint(module, plan.collisionFootprint), true, module.id);
  }
  assert.doesNotThrow(() => renderBuildingPresentation(new GraphicsRecorder(), plan));
});

test("runtime drawing caches deterministic plans per authored building and option set", () => {
  const source = building({ id: "cached-building" });
  const first = drawBuildingPresentation(
    new GraphicsRecorder(),
    source,
    { detailLevel: "minimal" }
  );
  const second = drawBuildingPresentation(
    new GraphicsRecorder(),
    source,
    { detailLevel: "minimal" }
  );
  assert.equal(first, second);

  clearBuildingPresentationCache(source);
  const third = drawBuildingPresentation(
    new GraphicsRecorder(),
    source,
    { detailLevel: "minimal" }
  );
  assert.notEqual(first, third);
  assert.deepEqual(first, third);
});

test("renderer paints the overpaint grammar without Phaser globals", () => {
  const graphics = new GraphicsRecorder();
  const plan = createBuildingPresentationPlan(building({
    id: "old-works",
    sign: "WORKS"
  }));
  assert.doesNotThrow(() => renderBuildingPresentation(graphics, plan));
  assert.ok(graphics.calls.some(call => call.name === "fillPoints"));
  assert.ok(graphics.calls.some(call => call.name === "fillRect"));
  assert.ok(graphics.calls.some(call => call.name === "fillCircle"));
  assert.ok(graphics.calls.some(call => call.name === "lineBetween"));
  assert.ok(graphics.calls.some(call => call.name === "strokeRect"));

  const footprint = plan.visualFootprint;
  const externalShadow = graphics.calls
    .filter(call => call.name === "fillRect")
    .some(call => {
      const [x, y, w, h] = call.args.map(Number);
      return x < footprint.x
        || y < footprint.y
        || x + w > footprint.x + footprint.w
        || y + h > footprint.y + footprint.h;
    });
  assert.equal(externalShadow, true);
});
