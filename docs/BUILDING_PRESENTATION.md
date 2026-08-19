# Building presentation system

ViceBlood buildings keep their authored `x`, `y`, `w`, and `h` as the sole collision and navigation footprint. The presentation layer turns that rectangle into a deterministic set of reusable top-down modules without changing roads, entrances, rooftop routes, or AI geometry.

## Design contract

- **Pure overhead:** modules are drawn in orthographic top-down view. Volume comes from parapet values and restrained south/east shading, never from a front-facing facade.
- **Footprint-safe:** every generated module is contained inside the authored building rectangle. A full-footprint foundation remains visible beneath irregular raised roof masses, so there is no invisible collision.
- **Deterministic:** a stable seed derived from authored building identity selects generic layouts and rooftop details. A building does not change appearance between redraws or sessions.
- **Data-driven:** semantic archetypes, layout masks, detail budgets, frontages, and module kinds live in the catalog. Game scenes call one stable facade.
- **Presentation-only:** this system does not own city topology, collision, entrances, roof traversal, interiors, or mission semantics.
- **Restrained by default:** the city renderer requests the `standard` detail profile explicitly; the profile is intentionally sparse and can be tuned centrally without touching scene code.

## Architecture

`phaser/src/rendering/BuildingPresentation.js` is the public facade. Gameplay and scenes should import only from it.

- `buildings/BuildingPresentationCatalog.js`
  - module kind constants;
  - layout recipes expressed as occupancy masks;
  - semantic archetypes and conservative classification rules;
  - frontages, detail levels, validated rooftop prop kinds, accents, and palette resolution.
- `buildings/BuildingPresentationPlanner.js`
  - pure deterministic planning with no Phaser dependency;
  - converts an authored footprint into roof cells, exposed parapet edges, frontage, rooftop props, and identity modules;
  - preserves exact collision and visual footprint contracts;
  - clamps frontages and identity markers for unusually small authored footprints.
- `buildings/BuildingPresentationRenderer.js`
  - Phaser Graphics dispatch only;
  - one small renderer per module kind;
  - caches deterministic plans in a `WeakMap` keyed by the immutable authored building object and planning options;
  - unknown future module kinds are ignored rather than crashing the city renderer.

The planner output is a plain object containing the selected archetype and layout, exact footprints, palette, roof grid, module list, module counts, and any safe fallback warnings.

## Current reusable layouts

- `rectangle`
- `l-shape`
- `t-shape`
- `stepped`
- `cross`
- `irregular`

Masks are normalized to the building footprint. This lets the same recipe work for differently sized buildings while retaining the original collision rectangle.

## Current archetypes

- `generic`: neutral frontage and restrained deterministic rooftop variety;
- `police`: ordered rectangular mass, civic frontage, antenna, and blue accents;
- `club`: irregular raised roof, skylight, club frontage, and magenta edge lighting;
- `church`: cross-shaped raised roof, ridges, church frontage, and a small gold cross marker.

Classification intentionally avoids broad words such as `NEON`; ordinary generated blocks should not become landmarks accidentally. Explicit metadata always wins.

## Authored override contract

A building may optionally provide a `presentation` object:

```js
{
  id: "east-side-club",
  x: 1200,
  y: 900,
  w: 240,
  h: 170,
  presentation: {
    archetype: "club",
    layoutId: "l-shape",
    frontage: "club",
    frontageEdge: "east",
    frontageOffset: 0.35,
    detailLevel: "minimal",
    propKinds: ["vent", "hvac"]
  }
}
```

Supported fields:

- `archetype`: registered archetype or alias;
- `layoutId`: registered layout recipe;
- `frontage`: `none`, `generic`, `police`, `club`, or `church`;
- `frontageEdge`: `north`, `east`, `south`, or `west`;
- `frontageOffset`: normalized offset from `-1` to `1` along that edge;
- `detailLevel`: `minimal`, `standard`, or `rich`;
- `propKinds`: optional allow-list of registered rooftop prop kinds; structural kinds such as `frontage` or `roof-cell` are rejected;
- `seed`: optional deterministic seed override.

Invalid values fall back to the archetype defaults. A layout that cannot fit the authored dimensions falls back to `rectangle` and records a warning in the plan.

## Extending the system

### Add a layout

1. Add one occupancy-mask entry to `LAYOUT_RECIPES`.
2. Add its ID to an archetype's `layoutCandidates` or use it through explicit metadata.
3. Add or update planner tests for occupied cells and exposed edges.

The generic roof-cell and parapet renderers need no changes.

### Add an archetype

1. Add an entry to `BUILDING_ARCHETYPES` with layout, frontage, prop pool, accent, and label color.
2. Add a narrow classification rule or rely on explicit `presentation.archetype` metadata.
3. Reuse existing module kinds when possible.
4. Add identity planner logic only when the archetype needs a genuinely unique arrangement.

### Add a module kind

1. Add the constant to `MODULE_KINDS`.
2. Have the planner emit a module with stable `id`, `layer`, and contained `bounds`.
3. Add one renderer to `MODULE_RENDERERS`.
4. Add containment and renderer-dispatch coverage.

## Validation invariants

The focused unit suite verifies:

- semantic classification and explicit overrides;
- deterministic plans;
- exact collision/visual footprint preservation;
- containment of every generated module;
- modular mask assembly and absence of duplicate internal parapets;
- safe layout fallback;
- police, club, and church identity contracts;
- rejection of structural kinds in authored rooftop prop lists;
- renderability and containment for tiny authored footprints;
- renderer operation without Phaser globals.

When iterating visually, validate the Netlify preview at normal gameplay zoom. Module detail should remain chunky enough to support character readability; this is not a miniature architectural renderer.
