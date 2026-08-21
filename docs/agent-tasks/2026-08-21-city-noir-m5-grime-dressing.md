# M5 — Low-frequency grime and urban surface dressing

Branch: `agent/city-noir-atmosphere`  
Initiative: `city-noir-atmosphere`  
Depends on: merged PR #69 street-surface authority, M4 wet-road response.

## Goal

Remove the remaining sterile large-surface feeling with sparse contextual dirt and service-corner dressing **without reopening or duplicating PR #69 street-surface geometry**.

M5 is presentation-only. It does not create walkability, collision, interaction, street furniture, road topology, building topology, gameplay evidence objects or light sources.

## M5.1 responsibility audit — complete

The audit was performed against the merged PR #69 implementation and current `main` street authorities before any M5 runtime geometry was added.

### Existing authorities that M5 must not duplicate

PR #69 / `CitySurfacePresentationPolicy` / `StreetSurfaceDetailGeometry` already own:

- street/open-ground grid language;
- deterministic open-ground panels;
- generic open-ground scuff marks;
- road/asphalt base values and road-edge treatment;
- asphalt repair patches and patch seams;
- asphalt cracks;
- gutter bands;
- gutter grime/stain runs;
- drains and drain-bar presentation;
- major/local road paint and worn centre markings;
- sidewalk material, joints, trims and canonical curbs;
- authoritative road-edge pavement bands;
- junction pavement/caps/completion;
- zebra/crosswalk geometry, stop lines and tactile paving;
- manhole/street-surface details already emitted by that presentation pass.

M4 separately owns light-coupled wet-road receiving response. M5 must not disguise another wet-reflection system as generic damp stains.

`StreetFurnitureSystem` owns gameplay dumpsters and their body-containment behaviour. M5 may later read their stable nearby position as contextual presentation input, but must never create a second dumpster, move one, change collision, or mutate its gameplay state.

### Explicitly rejected M5 families

Do not add any world-wide or road-wide family for:

- generic tyre/scuff fields;
- generic damp/gutter stains;
- asphalt patches, repairs or cracks;
- drains/manholes;
- curb dirt bands that simply restate the #69 gutter language;
- repeated road paint wear;
- generic procedural litter on a uniform world grid;
- reflective puddles coupled to lights (M4 authority);
- gameplay street furniture.

These would either duplicate an existing authority or create the repeated procedural texture the atmosphere program is trying to avoid.

## Allowed M5 presentation space

M5 may add **contextual, low-frequency, non-interactive** dressing that is driven by existing semantic anchors rather than a global texture grid:

- service/frontage grime immediately outside selected building service/frontage edges;
- compact oil/dirt residue only when constrained to a service/mechanical context, never distributed across the road network;
- later small litter clusters around selected service corners or existing dumpsters, read-only and capped;
- small dirty accumulation around industrial/commercial/mechanical frontage language where it does not overlap roads/crosswalks.

Narrative posters, readable graffiti and signage are deferred to M7 environmental storytelling so M5 remains material/dirt focused.

## M5.2 — first implementation slice: `service-frontage-grime`

Implement **one family only** before expanding M5.

### Source authority

Reuse existing building presentation semantics and frontage definitions. Do not infer a second building outline or invent service doors as gameplay objects.

Candidate semantic preference:

- industrial / warehouse;
- commercial/service-like buildings;
- selected medical/service frontage only where the existing presentation profile exposes a suitable edge;
- neutral buildings only at a much lower deterministic rate if needed after visual review.

### Placement contract

For each selected building:

1. derive a stable source ID from the existing building ID and presentation profile;
2. use the existing frontage/service edge as the placement axis;
3. project a compact patch just outside the building footprint;
4. reject any receiving centre that lands on road or crosswalk authority;
5. prefer non-road ground / pedestrian-side frontage where compatible;
6. keep the whole composition near the source building rather than filling a district cell;
7. render only inside the bounded urban render window plus a small fixed margin.

### Visual contract

- irregular broken shapes, not clean circles or rectangles;
- very low contrast against the receiving material;
- 1–3 fragments per selected building, not dozens;
- no bright/saturated colour;
- no repeated checker/grid cadence;
- no visual resemblance to M4 light reflections;
- no more than one selected grime composition per building;
- most buildings remain untouched.

### Determinism and cost

- deterministic hash from stable building/source IDs only;
- no unseeded `Math.random()`;
- hard density cap;
- minimum spacing between selected compositions;
- static composition generated/drawn with the static city presentation pass, not a whole-world per-frame scan;
- unknown/missing presentation semantics fail soft by producing no descriptor.

## M5.2 focused tests

Add focused tests before accepting the runtime slice:

- descriptor generation is deterministic;
- input buildings/presentation definitions are not mutated;
- only intended building/profile families are selected;
- descriptor source IDs remain stable;
- receiving points do not land on road/crosswalk authority;
- render-window culling removes distant descriptors;
- density and per-building fragment caps hold;
- no generated topology/gameplay data changes;
- family name remains `service-frontage-grime` and cannot be confused with #69 repair/gutter/scuff geometry.

## M5.2 gameplay-scale evidence

Capture at normal gameplay zoom:

- one industrial/service frontage with visible but restrained grime;
- one mixed street showing most buildings remain clean/dark enough to preserve hierarchy;
- one ordinary/dark control location without service-grime spam.

Acceptance:

- the city feels less sterile at the selected service location;
- dirt remains subordinate to lighting, navigation and actors;
- no repeated procedural grid becomes visible;
- #69 details remain visually distinct and authoritative;
- no false pickup/interactable/collision cue appears.

## M5.3 — later service-corner composition

Only after M5.2 passes visual review, consider a second sparse family using existing service semantics and existing gameplay dumpster positions read-only:

- tiny paper/litter group;
- compact grime accumulation around a service corner;
- optional mechanical residue where an existing building semantic justifies it.

Do not add readable posters/graffiti/signage here; that belongs to M7.

## Exit gate

M5 closes only when:

- large representative surfaces no longer feel uniformly sterile;
- no M5 family duplicates #69 or M4;
- clutter remains contextual and low-frequency;
- presentation descriptors are deterministic and culled;
- decorative dressing remains non-interactive/non-collidable;
- focused tests and gameplay-scale evidence pass.

## Stop rules

Continue autonomously through bounded visual corrections. Stop only for a genuine authority conflict, unrelated persistent CI blocker, a subjective art-direction fork that cannot be resolved from `CITY_NOIR_ATMOSPHERE.md`, or the initiative-wide M9 user gate.
