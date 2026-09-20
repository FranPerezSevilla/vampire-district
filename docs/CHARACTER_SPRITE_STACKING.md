# Animated character sprite stacking

## Goal

Give the protagonist, human NPCs and foot police articulated sprite-stack volume, with readable running, firing, melee and existing rooftop-jump animations in ViceBlood's muted gothic-punk palette.

## Current finish and gestures — 2026-09-19

The material/gesture pass supersedes the first-iteration atlas and slice counts recorded below. See [art direction, source assets and generation prompts](STACK_ART_DIRECTION.md).

- People now use 67–69 reusable quads, still one Image per actor. A painted face is applied once on a sloped surface, with matte clothing and quieter seams. The shared packed atlas is 512 × 1024 with mipmaps (about 2.67 MiB RGBA including mip levels).
- Idle smoking, hand-to-ear police gestures, cosmetic running stumbles, and different firearm/vehicle falls sample the existing scene clock. Nonfatal reactions recover; fatal reactions remain down. Dead human NPCs retain the articulated view while the original corpse/drag/hide rules remain authoritative. Rats and missing-atlas/Canvas corpses keep their previous path.
- The same material system now serves street lamps, a hospital bench, cathedral piers/pews/altar/candles, fences and all 28 dumpsters. Colliders, entrances and interaction identities remain unchanged.
- 45 focused character, gesture, prop, projection, vehicle and firearm checks passed. Production action checks passed for real player fists/pipe/pistol, police baton/firearm, rooftop transitions, pause, offscreen culling, destruction and fallback. Fatal player/NPC and broken-dumpster checks passed; no page errors in these runs.
- Build: 293 modules, one gameplay JS request. City validator: 0 errors, 0 warnings, score 87.8. The broad native run still has the branch's 44 previously observed failures; one additional fixture failure from the new fence map was corrected and its focused checks pass. The entire broad suite was not rerun after that fixture fix.

Current review: [cathedral](screenshots/stack-gothic-cathedral.png), [hospital](screenshots/stack-gothic-hospital.png), [police](screenshots/stack-gothic-police.png), [gestures](screenshots/stack-gothic-gestures.png), [animated review](screenshots/stack-gothic-preview.mp4). The enlarged gallery demonstrates shared rig capabilities, including poses the current NPC AI does not request.

## Sprite finish iteration

- Owner: the existing `CharacterStackRig` and its single `CharacterSpriteStack` renderer.
- Scope: redraw the shared SVG sections, refine body/head profiles and joint transitions, add direction-aware face/clothing surface details in the same batch. Update the atlas preload only if its layout changes. Keep a native-size and enlarged before/after review.
- Acceptance: less rectangular anatomy and visible layer stepping; clear muted clothing/face/hair details at street zoom and oblique headings; existing animation timing and identity retained; bounded reusable slices, one atlas and one render object per actor; measure drawing plus pose cost against the previous stack.
- Non-goals: no changes to combat, AI, input, vehicle art, city geometry, population or camera controls. No per-actor render textures, realtime lights or filters.

### Added user scope

After the character finish, add bounded cigarette/idle and stumble/recovery presentation, then extend the same shared-atlas approach to street lamps, benches, fences, dumpsters and cathedral furnishings. Presentation samples existing actors/events; visual gestures never create a second AI/combat/input authority. Props retain existing collider positions, entrances and interaction identities. Inspect their current owners before replacing any drawing path; preserve baked assets that are not separately addressable. Verify visibility/camera projection and aggregate rendering cost.

### Art-direction correction requested during review

The user rejected the clean toy-like appearance of the first prop atlas and rounded people. Replace prop surface art with a generated, project-local shared raster atlas: soot-dark stone, aged walnut and black iron, restrained warm emissive accents. Rebuild cathedral piers as clustered masonry and pews with solid backs, without changing their footprints. Refine the existing editable character/vehicle art toward matte, angular silhouettes and remove exaggerated edge highlights. Keep geometry, culling, collision, events and animation ownership intact. Inspect the result in the actual cathedral and street rather than relying on a concept render.

## In scope

- Authority: `ModularCharacterView` remains the character presentation owner; `GameScene.updateCharacterPresentation` / `NpcSystem.updateCharacterPresentation` drive it once. CombatSystem, PlayerDamageSystem, PoliceFirearmSystem and TransitionSystem remain action authorities.
- Files: shared authored character SVG atlas; `CharacterSpriteStack`, character pose/action sampling; the existing character view and scene preload/presentation; NPC action adapter; a read-only jump presentation record in TransitionSystem. Existing combat presentation suppresses its ground-level muzzle flash when the stack supplies one. Extend the existing vehicle draw-order pass to live stacked street characters rather than creating another sorter. Focused tests and browser review.
- One batched image per stacked character, shared atlas, bounded slice count, conservative offscreen culling. Retain the existing Canvas/missing-atlas fallback and deterministic civilian variation.
- Ground contact/collision sizes stay unchanged. Upper body aims independently of running feet. All human NPC types use the rig; rats retain their current path. The later gesture pass above extends the rig to human corpses.

## Out of scope

No new combat rules, jump input, NPC jumping AI, damage windows, navigation, population, save format, car controls or extra update loop. Character projection is independent of car and landmark sliders. No per-character texture generation or filters.

## Acceptance criteria

- [x] Player and human NPCs/police share the atlas and articulated stacking.
- [x] Walk/run, strafing fire, alternating punches, pipe/baton swings and rooftop takeoff/air/landing visibly differ and follow authoritative action timing.
- [x] Palette, cap/hair/skin variants remain identifiable; no disembodied hands or rotating projection.
- [x] Pauses freeze animation; hidden/offscreen NPCs avoid animation/drawing work; destruction and fallback work.
- [x] Focused regression tests, production build, in-game action checks and visual animation review completed, with performance evidence scoped to what was measured.

## Validation

Affected-test plan and invocation; native character/combat/transition/rendering checks; production preview with player, civilian and police rigs at multiple headings and action phases. Inspect the native-size street view as well as enlarged animation frames. Record suite limitations and drawing cost without promising an overall FPS target.

### Results of the first iteration — 2026-09-19

- Production boots with the protagonist and all 235 defined living human NPCs using the same atlas. The SVG is rasterized once to 768 × 1152 (about 3.4 MiB RGBA), with tight frame crops. Each character has one renderable Image and 40–42 reusable slice records; no per-character textures or render targets.
- Actual player attacks were sampled through windup, impact and recovery for fists, pipe and pistol. Gun flashes originate on the elevated weapon; legacy ground flashes are suppressed only for stacked actors. Existing projectile/damage origins and collisions are unchanged.
- The existing rooftop-transition authority drove takeoff, bent legs in flight and the brief landing crouch, then cleared its presentation record. This adds animation to existing jumps; it does not add a free jump button or NPC jumping AI.
- A police officer's actual melee and firearm authorities drove the baton and pistol poses. Real Escape pause froze all sampled player slice positions. An offscreen police rig neither updated its pose nor rendered. View destruction and a missing-atlas legacy fallback both passed in the browser, with no page errors.
- All street characters share the existing Y-sort pass with vehicles; corpses, non-street layers and player traversal retain their original depth bands.
- 22 focused character, actor-ordering and police-firearm checks pass. Full native suite: **1273 tests, 1229 passed, 44 failed**. All 44 failing names match the prior branch baseline; the previously failing vehicle-density test now passes. The general suite is not green.
- Affected plan reviewed and invoked against origin/main. Its Windows npm subprocess again stops before running checks. Native checks were executed directly; city validation passes with 0 errors/warnings (A, 87.8), and browser-suite coverage passes. Targeted production-browser action/visual checks passed; the entire selected 32-spec legacy browser set was not executed.
- Production package: 290 modules, one gameplay JS request; no new gameplay loop, input reader or combat authority.

Visual review: [native street view](screenshots/character-stack-street.png), [pose sheet](screenshots/character-stack-poses.png), [animated preview](screenshots/character-stack-preview.mp4). The preview demonstrates shared rig capabilities, including civilian/police poses that their current AI does not request.

### Controlled performance comparison

64 visible, animated characters, mixed protagonist/civilian/police styles, identical positions, poses and headings. Isolated scene with city simulation paused. Headless Chromium / ANGLE D3D11, Intel HD 530, 2160 × 1440 framebuffer. Five-second samples after warmup, legacy → stack → stack → legacy. The fallback uses the previous nested-shape rendering path with the same pose inputs.

| Path | Total character objects, including containers | CPU draw mean | CPU pose mean |
|---|---:|---:|---:|
| Legacy, first | 2500 | 10.868 ms | 0.305 ms |
| Stack, first | 192 | 0.802 ms | 0.958 ms |
| Stack, second | 192 | 0.790 ms | 0.865 ms |
| Legacy, second | 2500 | 10.455 ms | 0.299 ms |

Drawing plus pose work averaged approximately **1.71 ms versus 10.96 ms** in this isolated comparison (about 84% lower). Articulation itself costs more than the old poses; the reduction comes from replacing many individual shape objects with batched shared-atlas quads. The stack samples ran at approximately 60 frames/s, but this is **not a full-city FPS claim**. Traffic, streaming, buildings and browser scheduling were excluded. Source resolution was not reduced.
