# Building presentation system

ViceBlood buildings keep their authored `x`, `y`, `w`, and `h` as the only collision and navigation footprint. The presentation layer turns that rectangle into a deterministic modular roof composition without changing roads, entrances, rooftop routes, interiors, missions, or AI geometry.

The active art-polish north star, milestone roadmap and agent continuity contract live in [`BUILDING_VISUAL_POLISH.md`](BUILDING_VISUAL_POLISH.md). This document remains the runtime architecture and authored-data contract.

The current visual north star is the approved in-context overpaint:

1. **one solid overhead mass;**
2. **a readable parapet and south/east shadow;**
3. **one large identity prop and, at most, one supporting prop;**
4. **no permanent debug labels.**

The logical modular grid is planning data. It must not be visible in the finished render.

## Design contract

- **Pure overhead:** orthographic top-down only. No front facade and no isometric tilt.
- **Mass before detail:** the eye should read the building silhouette before rooftop machinery.
- **Footprint-safe planning:** every planned module stays inside the authored rectangle.
- **Visual shadow freedom:** renderer-only shadows may extend outside the footprint because they do not affect collision.
- **No invisible collision:** irregular raised masses sit above a complete low roof covering the full collision rectangle.
- **Deterministic:** stable authored identity fixes profile, layout, annex, props, and placement.
- **Sparse detail:** `standard` permits at most two standalone rooftop props.
- **Data-driven:** profiles, archetypes, masks, props, surfaces, and palettes live outside `GameScene`.
- **Presentation-only:** this system does not own topology, gameplay, entrances, navigation, or interiors.
- **Labels are opt-in:** buildings, vehicles, and dumpsters do not carry permanent world-space names by default.

## Architecture

`phaser/src/rendering/BuildingPresentation.js` is the stable public facade. Scene code should import only from it.

### Semantic catalog

`phaser/src/rendering/buildings/BuildingPresentationCatalog.js`

- module kinds and render layers;
- reusable layout masks;
- landmark archetypes;
- detail limits;
- semantic classification;
- palette resolution.

### Visual profiles

`phaser/src/rendering/buildings/BuildingVisualProfileCatalog.js`

Visual profiles describe *how a generic building should read*, independently of its collision geometry.

Current profiles:

- `default`
- `residential`
- `commercial`
- `warehouse`
- `industrial`
- `police`
- `club`
- `church`

Profile inference uses conservative whole-word tokens. For example:

- `WARE`, `WAREHOUSE`, `DEPOT`, and `STORAGE` resolve to `warehouse`;
- `WORKS`, `FACTORY`, `FOUNDRY`, and `GARAGE` resolve to `industrial`;
- `FLATS`, `APARTMENTS`, and `TENEMENT` resolve to `residential`.

`SOFTWARE` does **not** become a warehouse merely because it contains `ware`.

A profile controls:

- roof surface;
- weighted layout candidates;
- frontage default;
- signature prop;
- supporting prop pool;
- roof tint;
- service strip;
- optional service light;
- optional raised annex;
- shadow depth;
- default label visibility.

### Silhouette geometry

`phaser/src/rendering/buildings/BuildingSilhouetteGeometry.js`

- safely insets the authored footprint;
- emits logical occupied cells;
- converts connected mask cells into one closed orthogonal contour;
- removes collinear vertices;
- emits only external parapet edges;
- has no Phaser dependency.

### Planner

`phaser/src/rendering/buildings/BuildingPresentationPlanner.js`

The planner combines archetype and profile data into a serializable presentation plan:

- full-footprint low roof;
- one fused raised roof mass;
- profile-specific surface lines;
- external parapets;
- optional raised service annex;
- optional frontage;
- optional service strip and warm service light;
- one or two large standalone props;
- landmark identity accents.

The planner also returns:

- selected archetype and visual profile;
- roof surface kind;
- exact collision and visual footprints;
- silhouette and logical grid metadata;
- label policy;
- shadow/wall effect values;
- module counts;
- safe fallback warnings.

### Renderer

`phaser/src/rendering/buildings/BuildingPresentationRenderer.js`

- renders one fused polygon, never one visible rectangle per logical cell;
- draws an external south/east cast shadow;
- draws a complete low roof rather than an interior-looking floor;
- gives north/west parapets a restrained highlight;
- gives south/east edges wall depth;
- renders profile surfaces and service modules;
- dispatches one renderer per module kind;
- caches immutable plans in a `WeakMap`;
- ignores unknown future module kinds instead of crashing the city.

## Roof surfaces

- `smooth`: almost no internal linework;
- `membrane`: two or three broad, subtle roof seams;
- `corrugated`: repeated restrained ribs, used by warehouses;
- `civic`: sparse ordered seams;
- `night`: clean dark mass for club architecture;
- `pitched`: identity comes from ridges rather than flat-roof texture.

## Approved profile grammar

### Warehouse

The warehouse is the direct translation of the cool-blue overpaint:

- rectangular unified mass;
- cool blue-gray tint;
- fine corrugated ribs;
- one large central skylight;
- dark service strip on the south edge;
- strong but clean shadow;
- no generic entrance canopy.

### Industrial / works

The industrial building follows the warm-brown overpaint:

- rectangular unified main mass;
- subtle membrane seams;
- one large HVAC unit;
- raised service-room annex in the north-east area;
- dark loading/service strip;
- one restrained warm service light;
- no exposed-room or floorplan reading.

### Police

- ordered civic rectangle;
- civic canopy;
- antenna and HVAC composition;
- two short blue accents;
- no dependence on a large text label.

### Club

- irregular fused mass;
- dominant skylight;
- dark canopy;
- one continuous magenta edge accent.

### Church

- cross or T silhouette;
- central ridges;
- small warm cross marker;
- minimal mechanical clutter.

## Authored overrides

A building can optionally provide `presentation` metadata:

```js
{
  id: "east-side-works",
  x: 1200,
  y: 900,
  w: 240,
  h: 170,
  presentation: {
    profile: "industrial",
    surfaceKind: "membrane",
    layoutId: "rectangle",
    frontage: "none",
    detailLevel: "minimal",
    showLabel: false,
    propKinds: ["hvac"]
  }
}
```

Supported fields:

- `archetype`
- `profile` or `profileId`
- `surfaceKind` or `roofSurface`
- `layoutId`
- `frontage`
- `frontageEdge`
- `frontageOffset`
- `detailLevel`
- `showLabel`
- `propKinds`
- `seed`

Explicit metadata wins over inference. Structural module kinds are rejected from `propKinds`.

## Extending the system

### Add a visual profile

1. Add one entry to `BUILDING_VISUAL_PROFILES`.
2. Define narrow whole-word classification tokens only when inference is safe.
3. Reuse existing surface, annex, service, and prop modules.
4. Add focused tests for profile selection and its signature composition.

### Add a layout

1. Add one connected occupancy mask to `LAYOUT_RECIPES`.
2. Set readable minimum dimensions.
3. Add it to a profile or archetype candidate list.
4. Test contour vertices, occupied cells, and external parapets.

No renderer change is required for a new connected orthogonal mask.

### Add a module kind

1. Add the constant and layer.
2. Emit stable `id`, geometry, and bounds from the planner.
3. Add one renderer entry.
4. Test footprint containment and renderer dispatch.

## Validation invariants

Focused tests verify:

- archetype and whole-word profile classification;
- deterministic plans;
- exact footprint preservation;
- containment of every planned module;
- one fused roof mass;
- no visible roof cells or internal parapets;
- safe layout fallback;
- a maximum of two standard rooftop props;
- warehouse corrugation, skylight, and service edge;
- industrial annex, HVAC, service strip, and warm light;
- landmark identity contracts;
- authored override behavior;
- opt-in labels;
- tiny-footprint safety;
- runtime caching;
- external visual shadows;
- Phaser-free planner and renderer tests.

Visual acceptance still happens at normal gameplay zoom in the Netlify preview. The intended reading order is:

**silhouette → profile identity → roof detail.**
