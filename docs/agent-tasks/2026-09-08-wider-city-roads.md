# Wider avenues and streets

## Goal

Give player driving, passing cars and buses more usable road width after the user accepted and merged PR 73. Start from main `7ee3af6e35459ff938972eea9f41a5efb16f9878`.

## Scope and authority

The authoritative road centreline graph is `tools/city-compiler/city-road-graph-v1.js`. Increase major roads from 120 to 150 units, local roads from 72–84 to 96, and alley/service roads from 60–68 to 88. Preserve four lanes on avenues and two on streets; position street lanes inside the wider halves and let junction approach trims grow with the junction.

Update the road generation pipeline, compiler lane geometry, corresponding generated city/chunk/district packs and focused geometry tests. Reserve space for sidewalks by fitting affected building footprints and attached roofs/roof anchors in the generator. Keep all building identities, the world dimensions, districts and landmark identities. Move the hall's west approach 24 units east to preserve the compiler's minimum parallel-street block depth. Generated geometry must remain reproducible and must never be hand edited.

No traffic population increase, new AI authority, radio changes, browser execution or automatic merge. Publish a new draft PR on the existing review branch so the configured Pages deployment remains usable.

## Acceptance and validation

- Wider rendered and physical road surfaces agree with generated lane and junction geometry.
- No road/building or road/landmark-site overlaps, and clear pedestrian bands.
- Four avenue lanes and two street lanes fit full car/bus bodies.
- Generation is deterministic; roofs and attached traversal endpoints follow adjusted buildings.
- Existing native circulation, recovery, bus service and performance invariants pass without relaxing deadlock thresholds.
- Run focused compiler/geometry tests, city generation/validation, `npm run check:fast`, and review the affected plan. Execute native/static portions only under the user's explicit no-browser instruction; keep CI consistent with that request for this continuation.

## Design check

The first 160-unit avenue experiment removed some forward right-turn connectors where district seams lie only 60 units from a junction, and broke the native circular-route/circulation gates. The accepted width is 150 (+25%); 96-unit local streets gain 14–33%, and 88-unit service streets gain 29–47%. Street lane offsets rise from at most 16 to 22–24, so the extra width is used by actual driving trajectories. The four avenue lanes are 37.5 units each, giving a 22-unit-wide bus 15.5 units of total lateral room.

The Blackwater density observer moves from `(2265, 3280)` to `(2250, 3250)` on the new sidewalk; the old position became an obstruction inside the widened roadway. The native CPU profiler uses and reports that same new position. Density, collision and maximum-wait thresholds are unchanged. Earlier M16 timings are a different road layout/viewpoint and must not be presented as a matched performance comparison.

## Integration

The reservation fit adjusts 66 of the 93 buildings and retains all building IDs and 30 roofs. Some service-strip buildings become shallower. Foundry's candidate generator now filters templates by the available parcel and fits their maximum dimensions inside it, with compact industrial variants available for the shallow southern parcels. Its template dimensions and acceptance thresholds remain unchanged.

Boulevard pedestrian search bounds include the wider sidewalks. The Glasshouse route is anchored inside its actual district rather than beyond its southern boundary, keeping all 14 districts covered. Authored extra loops follow their referenced sidewalks. Dumpster generation reuses original source anchors so repeated runs do not reinterpret relocated furniture as new authoring input.

## Native traffic evidence

The 32-car, three-minute physical circulation test passes. The full population remains 600 civilian cars plus six buses, with 567 of 574 eligible directed lanes covered and a maximum district-share deviation of 0.0491.

All three native density viewpoints report zero contacts, overlaps, guarded visible spawns and old unresolved queues. Maximum observed stops are 22.4 seconds in Old Quarter, 49.95 seconds in Blackwater and 7.05 seconds in North Harbor. Some recent queues remain; the road expansion is not a claim that junction waits are eliminated. No browser performance or visual gameplay measurement is claimed.

## Final validation

- `npm run check:fast`: 911/911 native tests pass; static ownership check covers 41 browser specifications without executing them.
- `npm run city:topology`: valid city, zero errors/warnings, score 87.8/A; 660 directed lanes, 176 nodes and 2,424 transitions.
- Repeated full generation leaves all 99 city/chunk/pack files byte-identical. Generated city SHA-256: `939335ab73f48935c96971c1fe9e93354bc3cb2cfbb17d19f8e7a9201d579268`.
- `check:affected:plan -- --base=origin/main` selects native tests, city validation and 18 browser specifications. The first two are completed; browser execution is excluded under the user's instruction.
- Static compiler map reviewed. In-game driving feel remains for review on Pages.
