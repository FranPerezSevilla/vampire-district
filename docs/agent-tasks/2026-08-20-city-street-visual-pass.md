# City street visual pass

## Goal

Make the playable street layer read like the approved neon-noir POC: darker asphalt, clearly paved sidewalks, rounded-feeling junction corners, zebra crossings and richer open paved space, while preserving the existing city topology and gameplay geometry.

## In scope

- System or authority: Phaser street presentation over the generated city topology.
- Expected files or area: `phaser/src/policies/`, `phaser/src/rendering/`, `phaser/src/main.js`, shared presentation colours, focused tests.
- Required behaviour: render the already-generated roads, sidewalks and crosswalks with a more legible layered treatment; add deterministic paving detail to open ground; keep rendering bounded to the existing urban render window.

## Authoritative pavement invariant

Street pavement is derived from compiler-owned road geometry, never from nearby building facades.

### Straight road segments

Every compiler-trimmed `roadSegment`, including alley/service segments, owns one fixed 22-unit sidewalk band on each side. Buildings and incomplete authored sidewalk fragments cannot split or delete these bands.

### Junction authority

Rectangular junction authority is treated as a geometric perimeter rather than guessed from `junctionKind` alone:

1. expand the junction boundary outward by 22 units;
2. identify every compiler-trimmed `roadSegment` connected to any graph node owned by that junction piece;
3. classify each approach from the physical boundary it meets (north/east/south/west), not from the aggregate junction centre;
4. subtract the carriageway span of each approach from that perimeter;
5. render the remaining perimeter as pavement.

This rule works for simple crossroads, T/corner/end nodes, straight authorities and compound `road-junction-cluster` pieces with multiple graph nodes. Road mouths remain open for carriageway/crosswalk rendering. Buildings never participate in deciding whether junction pavement exists.

Width-transition polygons retain the compiler's offset-sidewalk grammar and the same building-independent presentation rule.

## Rendering order

1. street base / open-ground detail
2. roads and asphalt detail
3. buildings
4. authoritative segment and junction pavement
5. normal sidewalk network / canonical curb
6. crosswalks and manholes

The completion layer is presentation-only at runtime: collision, traffic, pedestrian routing, AI and population keep consuming the authored topology.

## Out of scope

- No new road graph, parcel layout or generated-city authority.
- No changes to collisions, traffic lanes, vehicle routing, pedestrian routing, police behaviour or mission logic.
- No hand edits to `phaser/src/data/generated/city-topology-v2.js`.
- Never infer a sidewalk by filling from a road to a nearby facade.
- Never automatically pave yards, plazas, parking/setback areas or building forecourts.
- No large raster tileset dependency in this pass; the base street language remains procedural so it scales with generated geometry.

## Acceptance criteria

- [x] Behaviour can be demonstrated or asserted.
- [x] Existing authority remains unique.
- [x] Regression coverage exists for the changed behaviour.
- [x] Relevant documentation is updated only if its contract changed.
- [ ] Existing street scenario boots with the new presentation and unchanged navigation/collision data (CI browser checks pending).

## Validation

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Focused coverage verifies:
- authored gaps and building overlap cannot remove segment-owned pavement;
- alleys/service roads receive the same two-band contract;
- four-way intersections leave only pavement around real road mouths;
- T junctions pave the closed side while leaving active road mouths open;
- straight authorities bridge sidewalk sides without covering carriageway;
- building footprints cannot delete junction pavement;
- compound junction clusters subtract each local approach from the correct physical side;
- production city contains both authoritative segment bands and junction-owned pavement;
- authoritative pavement renders after buildings while gameplay-facing `chunkItems` is restored immediately afterwards.

Browser visual smoke remains covered by the existing render-quality/playtest boot scenarios selected by the affected-test plan.

## Delivery

- Draft PR: `City street visual pass`.
- Summary calls out that the generated topology already contained sidewalks/crosswalks; this pass completes presentation without creating a second gameplay city model.
- Report local/CI validation separately.
