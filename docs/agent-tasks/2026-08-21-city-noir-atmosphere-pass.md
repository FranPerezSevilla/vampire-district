# City noir atmosphere pass

## Goal

Make the playable ViceBlood city communicate the committed noir north-star mood — dark, wet, decaying, dangerous and inhabited — while preserving the current city topology, simulation systems and production-friendly pure-overhead art language.

This is an umbrella presentation initiative executed through the bounded milestones in `docs/roadmaps/CITY_NOIR_ATMOSPHERE_ROADMAP.md`. Each agent iteration must select only one explicit roadmap task.

## In scope

- System/authority: presentation layers that compose existing city, building, district, vehicle and character data without taking gameplay ownership.
- Expected areas after authority inspection: existing city-surface presentation, `GameScene` render composition, focused rendering helpers/policies, presentation-only dynamic effects and focused tests.
- Required behaviour:
  - darkness becomes the dominant scene value;
  - roads/sidewalks/player/threats remain readable;
  - practical lights form sparse islands rather than blanket illumination;
  - wet asphalt responds locally to lights with cheap irregular reflections;
  - sterile surfaces gain restrained low-frequency grime/detail not already owned by PR #69;
  - vehicles/characters/props gain coherent grounding where missing;
  - signage/steam/contextual details create sparse environmental stories;
  - district semantics may influence presentation only;
  - static composition is deterministic and streamed/culled.

## Mandatory references

- `docs/CITY_NOIR_ATMOSPHERE.md`
- `docs/agents/CITY_NOIR_ATMOSPHERE_AGENT.md`
- `docs/roadmaps/CITY_NOIR_ATMOSPHERE_ROADMAP.md`
- `docs/progress/city-noir-atmosphere-status.json`
- `docs/progress/CITY_NOIR_ATMOSPHERE_PROGRESS.md`
- `docs/assets/city-noir-atmosphere/north-star-menu-city.webp`
- `docs/assets/city-noir-atmosphere/baseline-city-2026-08-21.webp`
- PR #69 before any overlapping street-surface work.

## Out of scope

- No new road graph, parcel layout, building footprints or generated-city authority.
- No hand edits to generated topology.
- No gameplay stealth/visibility system disguised as lighting.
- No traffic, pedestrian, police, Heat, mission or AI behaviour changes.
- No second building or character renderer.
- No photorealistic asset rewrite.
- No isometric/perspective camera language.
- No full-screen general-purpose reflection system.
- No decorative prop becoming collision/interactivity by accident.
- No duplication of PR #69 asphalt, paving, curb, crosswalk, gutter, drain, crack, repair or worn-paint work.

## Execution order

1. Resolve the current roadmap/status pointer.
2. Verify #69 dependency state if relevant.
3. Inspect only the existing authority for the selected bounded task.
4. State intended files/non-goals.
5. Implement one bounded task.
6. Add focused deterministic tests where applicable.
7. Run the repository validation ladder.
8. Capture visual evidence when the milestone exit requires it.
9. Append progress and update machine state.
10. Stop at the next explicit roadmap boundary.

## Acceptance criteria

- [ ] Existing city/gameplay authorities remain unique.
- [ ] The selected roadmap task improves one or more named atmosphere rubric categories.
- [ ] Result remains pure top-down and readable at gameplay zoom.
- [ ] Static presentation is deterministic.
- [ ] Dynamic presentation is visibly culled/bounded.
- [ ] No overlapping work from PR #69 is duplicated.
- [ ] Focused regression coverage exists for deterministic geometry/policy changes.
- [ ] Relevant progress/status documentation is updated.
- [ ] Final initiative average reaches at least 1.6/2 on the canonical rubric with no zero in value hierarchy, gameplay clarity or determinism/performance.

## Validation

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Use `npm run test:rc` only when justified by repository policy or final cross-cutting integration.

## Visual review rule

Intermediate implementation may proceed autonomously. Once M9 passes automated/rubric gates, set state to `final-validation-pending`, stop visual changes and request one final user validation. Do not merge without explicit user instruction.

## Exact first implementation action

M1.1: inspect PR #69. It was open/draft at initiative bootstrap. If it has merged, synchronize this branch to the post-merge main tree and audit the new visual baseline. If it is still open, do not duplicate its street-surface scope.
