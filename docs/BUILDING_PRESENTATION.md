# Building presentation system

ViceBlood buildings keep their authored `x`, `y`, `w`, and `h` as the sole collision and navigation footprint. The presentation layer turns that rectangle into a deterministic modular composition without changing roads, entrances, rooftop routes, interiors, missions, or AI geometry.

The visual target is the approved concept sheet: **one clean overhead silhouette first, one or two large roof details second, and a restrained identity accent last**. The internal grid must never be visible in the finished render.

## Design contract

- **Pure overhead:** orthographic top-down only. Volume comes from parapet values and a restrained south/east shadow, never from a front-facing or isometric facade.
- **Silhouette first:** occupancy masks are planning data. Adjacent occupied cells are fused into one concave orthogonal roof polygon before rendering.
- **Footprint-safe:** every planned module remains inside the authored rectangle. A full-footprint low service roof remains beneath irregular raised masses, so collision never becomes invisible.
- **Restrained detail:** the default `standard` profile produces at most three large rooftop props and normally only one or two.
- **Deterministic:** a stable seed derived from authored building identity fixes layout, prop selection, and prop placement across redraws and sessions.
- **Data-driven:** layouts, archetypes, palettes, signature props, frontages, and module kinds live in the catalog rather than in scene conditionals.
- **Presentation-only:** the system does not own topology, collision, navigation, rooftop traversal, interiors, or gameplay semantics.

## Architecture

`phaser/src/rendering/BuildingPresentation.js` is the stable public facade. Scene and gameplay code should import only from it.

### Catalog

`phaser/src/rendering/buildings/BuildingPresentationCatalog.js`

- reusable module kinds;
- layout recipes expressed as occupancy masks;
- semantic archetypes and conservative classification rules;
- signature props, optional prop pools, detail profiles, accents, and palette resolution.

### Silhouette geometry

`phaser/src/rendering/buildings/BuildingSilhouetteGeometry.js`

- normalizes and safely insets authored footprints;
- converts occupied cells into directed external boundary segments;
- chains those segments into one closed orthogonal contour;
- removes collinear intermediate vertices;
- emits only external parapet edges, with no internal grid seams;
- remains pure JavaScript with no Phaser dependency.

### Planner

`phaser/src/rendering/buildings/BuildingPresentationPlanner.js`

- chooses a fitting layout deterministically;
- emits a full-footprint low service roof plus one fused raised roof mass;
- places a small number of large props inside occupied logical cells;
- reserves space around frontages and existing props;
- creates landmark identity modules from shared primitives;
- reports safe layout fallback warnings;
- returns plain serializable plan data.

### Renderer

`phaser/src/rendering/buildings/BuildingPresentationRenderer.js`

- renders one polygon for the raised roof rather than one rectangle per cell;
- draws directional parapets and contained roof shadows;
- uses one small renderer per module kind;
- keeps police, club, church, and generic identity compositional rather than monolithic;
- caches immutable plans in a `WeakMap` keyed by authored building object and planning options;
- ignores unknown future module kinds rather than crashing the city renderer.

## Reusable layouts

- `rectangle`
- `l-shape`
- `t-shape`
- `stepped`
- `cross`
- `irregular`

Masks are normalized to the authored footprint. The mask controls the raised mass only; the low service roof still covers the complete collision footprint.

## Current archetypes

- `generic`: neutral rectangle/L/T/stepped silhouettes, one hero prop, and no loud accent;
- `police`: ordered rectangular mass, civic canopy, antenna, large HVAC, and two short blue cues;
- `club`: irregular mass, dominant skylight, dark canopy, and one continuous magenta roof-edge accent;
- `church`: cross or T silhouette, central ridges, a small gold cross marker, and almost no mechanical clutter.

Classification intentionally avoids broad terms such as `NEON`. Explicit metadata always wins over inference.

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
    propKinds: ["skylight", "hvac"]
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
- `propKinds`: optional allow-list of registered rooftop prop kinds; structural kinds are rejected;
- `seed`: optional deterministic seed override.

Invalid values fall back to archetype defaults. A requested layout that cannot fit the authored dimensions falls back to `rectangle` and records a warning in the plan.

## Extending the system

### Add a layout

1. Add one connected occupancy mask to `LAYOUT_RECIPES`.
2. Set minimum dimensions appropriate for readable gameplay-scale cells.
3. Add the layout to an archetype's candidates or select it explicitly.
4. Cover contour vertex count, occupied cells, and exposed parapets in tests.

No renderer change is required: the geometry layer automatically produces the fused polygon.

### Add an archetype

1. Add layout candidates, frontage, signature props, prop pool, accent, and label color to `BUILDING_ARCHETYPES`.
2. Prefer explicit `presentation.archetype` metadata; add a narrow classification rule only when inference is unambiguous.
3. Reuse existing modules wherever possible.
4. Add archetype-specific identity planning only when composition cannot be expressed through catalog data alone.

### Add a module kind

1. Add the constant to `MODULE_KINDS`.
2. Have the planner emit a stable `id`, `layer`, and contained `bounds` or polygon points.
3. Add one renderer entry to `MODULE_RENDERERS`.
4. Add containment and renderer-dispatch coverage.

## Validation invariants

Focused tests verify:

- semantic classification and explicit overrides;
- deterministic plans;
- exact collision and visual footprint preservation;
- containment of every generated module;
- exactly one fused roof mass per building;
- absence of visible roof-cell modules and internal parapet seams;
- safe layout fallback;
- restrained prop counts and readable signature prop sizes;
- police, club, and church identity contracts;
- rejection of structural kinds in rooftop prop allow-lists;
- renderability and containment for tiny authored footprints;
- deterministic runtime caching;
- polygon rendering without Phaser globals in unit tests.

Visual acceptance must happen at normal gameplay zoom in the Netlify preview. A successful building should read in this order: **silhouette → landmark identity → roof detail**. If the eye reads a procedural grid first, the implementation has failed even when its data model is correct.
