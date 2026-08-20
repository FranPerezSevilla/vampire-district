# City street visual pass

## Goal

Make the playable street layer read like the approved neon-noir POC: darker asphalt, clearly paved sidewalks, rounded-feeling junction corners, zebra crossings and richer open paved space, while preserving the existing city topology and gameplay geometry.

## In scope

- System or authority: Phaser street presentation over the generated city topology.
- Expected files or area: `phaser/src/policies/`, `phaser/src/main.js`, shared presentation colours, focused tests.
- Required behaviour: render the already-generated roads, sidewalks and crosswalks with a more legible layered treatment; add deterministic paving detail to open ground; keep rendering bounded to the existing urban render window.

## Out of scope

- No new road graph, parcel layout or generated-city authority.
- No changes to collisions, traffic lanes, vehicle routing, pedestrian routing, police behaviour or mission logic.
- No hand edits to `phaser/src/data/generated/city-topology-v2.js`.
- No large raster tileset dependency in this pass; the base street language remains procedural so it scales with generated geometry.

## Acceptance criteria

- [x] Behaviour can be demonstrated or asserted.
- [x] Existing authority remains unique.
- [ ] Regression coverage exists for the changed behaviour.
- [x] Relevant documentation is updated only if its contract changed.
- [ ] Existing street scenario boots with the new presentation and unchanged navigation/collision data.

## Validation

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Focused test: deterministic city-surface presentation geometry (grid, zebra stripes and rounded-corner cutouts). Browser visual smoke remains covered by the existing render-quality/playtest boot scenarios selected by the affected-test plan.

## Delivery

- Draft PR: `City street visual pass`.
- Summary will call out that the generated topology already contained sidewalks/crosswalks; this pass changes presentation rather than creating a second city model.
- Report local/CI validation separately.
