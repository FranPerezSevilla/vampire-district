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

## M5.2 — `service-frontage-grime` — complete

The first M5 runtime family is implemented in `phaser/src/policies/CityGrimePresentationPolicy.js` and installed as a static presentation-only layer.

### Source authority

The family reuses existing building presentation semantics and frontage definitions. It does not infer a second building outline or create service doors as gameplay objects.

Selection remains biased toward service-like contexts:

- industrial / warehouse;
- commercial/service-like buildings;
- other profiles only through the deliberately bounded fallback rules protected by tests.

### Placement contract delivered

For each selected building the implementation:

1. derives a stable source ID from the existing building ID/profile;
2. uses existing frontage semantics as the placement anchor;
3. projects compact irregular dirt fragments close to the building;
4. rejects road and crosswalk receiving points;
5. remains outside gameplay/topology state;
6. culls against the active urban render window;
7. emits at most a small hard-capped fragment count per selected source.

### Visual contract delivered

- irregular broken polygon fragments rather than clean circles/rectangles;
- restrained neutral dirt colour/value;
- maximum two fragments in the accepted production slice;
- no bright/saturated colour;
- no repeated world-grid cadence;
- no visual coupling to M4 reflection sources;
- most buildings remain untouched;
- accepted production fragments remain compact and bounded, with alpha protected in focused tests.

The first visual iteration was too subtle at gameplay scale. The accepted correction increased fragment scale/alpha only inside the already-bounded service-frontage family, then added explicit tests preventing future drift beyond the restrained range.

### Determinism and cost

- deterministic stable-ID hashing;
- no unseeded `Math.random()`;
- hard descriptor and per-building fragment caps;
- static redraw only, not a whole-world per-frame scan;
- render-window culling;
- missing/unsupported semantics fail soft.

## M5.2 focused tests — complete

`tests/city-service-frontage-grime-presentation.test.js` protects:

- deterministic descriptor generation;
- input/source non-mutation;
- allowed profile/source semantics;
- stable source IDs;
- road/crosswalk rejection;
- render-window culling;
- descriptor/fragment caps;
- compact fragment dimensions;
- accepted restrained alpha range;
- production-city receiver safety;
- family identity `service-frontage-grime`.

## M5.2 gameplay-scale evidence — complete

Browser review: `tests/browser/city-grime-review.spec.js`.

Validated implementation head: `485ad7074f1ddfcbb1ab8e8f70d33125cd4a0aa4`.

- `Tests` run `32488128735`: **success**.
- `City atmosphere review` run `32488128814`: **success**.
- artifact `9448812773`: `city-atmosphere-review`.
- captures:
  - `service-frontage-grime.png`;
  - `mixed-grime-context.png`;
  - `grime-dark-control.png`.

Acceptance result:

- selected industrial/service frontage reads less sterile;
- dirt remains subordinate to lights, navigation, actors and building mass;
- no repeated procedural grid is visible;
- #69 street-surface detail remains distinct and authoritative;
- no pickup/interactable/collision cue was introduced;
- the control area remains sparse.

M5.2 is technically and visually accepted.

## M5.3 — service-corner composition — planned / awaiting user checkpoint

Do **not** begin M5.3 automatically under the default execution cadence. M5.2 is now documented and the agent must report this checkpoint and wait for the user’s next indication.

If the user authorizes the next bounded task, consider exactly one sparse service-corner composition using existing semantics and existing gameplay dumpster positions read-only:

- tiny paper/litter group; or
- compact grime accumulation around a service corner; or
- optional mechanical residue where an existing building semantic justifies it.

Choose one family first, not all three. Do not add readable posters/graffiti/signage here; that belongs to M7.

## Exit gate

M5 closes only when:

- large representative surfaces no longer feel uniformly sterile;
- no M5 family duplicates #69 or M4;
- clutter remains contextual and low-frequency;
- presentation descriptors are deterministic and culled;
- decorative dressing remains non-interactive/non-collidable;
- focused tests and gameplay-scale evidence pass.

## Execution cadence / stop rule

The initiative-wide default is **task → validate → document → report → wait for user direction**.

After a bounded M5 task is complete, update this task document, machine state, progress log and PR summary as needed, report the checkpoint, and stop before starting the next bounded task.

Only an explicit user batch instruction (for example, “hazlo todo de golpe” or “continúa hasta que necesites mi intervención”) removes the wait step for the scope granted. Batch mode never removes the documentation requirement between tasks.
