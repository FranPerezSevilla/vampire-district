# Vehicle fleet stacking

## Follow-up — body forms and night art, 2026-09-19

All 21 visual assemblies now combine horizontal sections with sloped glazing,
body-side panels, wheel arches and tyre sidewalls. The sedan/patrol proportions
have a separate long bonnet, boot and inset cabin; the repeated nested sunroof is
removed. Lights use authored body coordinates. The shared atlas remains
1024 x 2048, and physical vehicle data is unchanged. See
[night art direction](NIGHT_ART_DIRECTION.md) for the current implementation,
performance measurements, visual evidence and validation limits.

## Follow-up — vehicle Y sorting, 2026-09-19

- Authority: the existing `GameplayRuntime.update` completes all vehicle movement; Phaser's scene display list remains the rendering authority.
- Scope: `rendering/VehicleDrawOrder.js`, one call at the end of `GameplayRuntime.update`, focused ordering tests and this record.
- Acceptance: authored/driven vehicles, civilian traffic/buses/ambulances and motorized police share ground-Y ordering. Greater Y draws later; heading, roof height and camera/parallax do not change the key. Ties remain deterministic, pool reuse/visibility changes are handled, and existing building/actor/effect bands stay intact.
- Performance: reuse a small buffer of existing local visual containers; change Phaser depth only when relative rank changes, not on every position change. Do not traverse dormant citywide traffic, add a parent container, change culling, create textures, or add another update loop.
- Non-goals: no pedestrian sorting, physical movement, collision, simulation, camera or stack-geometry changes.

Result: all three existing local vehicle collections now share stable ground-Y/X ordering after the final runtime movement step. Each complete vehicle retains its container and internal section ordering. Depths stay inside [46,47), and unchanged ranks do not request a Phaser display-list sort.

Validation: all four new tests pass (mixed fleets, crossing, ties/reuse/visibility, large-city coordinates, and no depth writes during parallel movement). The broader 44-test vehicle/runtime run has 43 passes and the pre-existing CRLF-sensitive CI-workflow assertion failure in `runtime-performance-diagnostics.test.js`; that same failure is present in both earlier fleet baseline logs. Production build and browser review pass: 18 live vehicle containers correctly ordered by the actual runtime; an ambulance/patrol crossing swaps both depth and actual Phaser display-list order at 300% volume, with no page errors. An isolated browser microbenchmark of 80 local containers over 2,000 parallel-movement updates averaged 0.0071 ms/update and zero depth writes after initial ordering; this measures only sorting overhead, not overall game FPS. Screenshots: `screenshots/vehicle-order-ambulance-front.png`, `screenshots/vehicle-order-police-front.png`. Affected plan reviewed/invoked, with the same aggregate Windows npm-launch limitation documented below.

## Follow-up — fleet colour direction, 2026-09-19

- Authority: `VehicleView.paintVehicle` chooses paint; the existing shared `fleet-stack.svg` supplies glass, metal and service markings.
- Scope: `VehicleView.js`, `fleet-stack.svg` and this record. Share the muted paint selection with the existing Canvas fallback.
- Acceptance: darker, less saturated paints and restrained aged trim; readable silhouettes, warm headlamps and distinct ambulance/taxi/police markings. Inspect all 21 models and the hospital in the production preview.
- Non-goals: no geometry, parallax, population, physics, damage, controls or texture-resolution changes; no filters, additional layers or per-frame work. Existing damage/repair checks remain applicable.

Result: charcoal, desaturated oxblood, olive and cold-grey civilian paint; grey-ivory ambulances, weathered ochre taxis and soot-green buses. The existing atlas now has lower-contrast matte highlights, smoked glass, aged metal and quieter service markings; warm headlamps remain readable. Canvas fallback shares the paint selection. Atlas dimensions, slice count, projection and renderer are unchanged.

Validation: 28 focused vehicle/model/stack/visibility/control tests pass, SVG parses, production package builds, and the production preview starts without page errors. All 21 models were captured at three headings and visually reviewed alongside the hospital/road view (`screenshots/vehicle-mood-diagonal.png`, `screenshots/vehicle-mood-hospital.png`). The reused frontage-slider harness initially stopped on a fixed-delay settling assertion (0.059 instead of 0); that unrelated assertion was excluded from the colour review, while the native projection checks pass. The affected plan was reviewed/invoked; its existing Windows npm-launch failure still prevents the aggregate command from running. The entire branch suite was not rerun for this colour-only follow-up; prior suite limitations below still apply. No new FPS claim is made.

## Goal

All authored vehicle archetypes use shared sprite sections with independent car-only parallax. Add medical ambulances, including two parked units at the existing hospital layby and occasional civilian traffic appearances.

## In scope

- Authority: `VehicleView.paintVehicle` composes visuals; `VehicleSpriteStack` projects height; existing vehicle definitions, traffic selection and VehicleSystem own vehicles, driving, damage and persistence.
- Files: shared vehicle SVG atlas, `VehicleStackModels.js`, `VehicleSpriteStack.js`, `VehicleView.js`, GameScene preload, `vehicles.js`, hospital-access bay positions; remove the obsolete car/frontage bridge from BuildingParallax/LandmarkFrontage. Focused tests and browser review.
- Distinct profiles and roof furniture for small cars, saloons, sports cars, SUVs, pickups, vans, buses, limousine/hearse, police and ambulances. Existing physical footprints remain authoritative.

## Out of scope

No pedestrian changes, emergency-dispatch AI, new siren simulation, city expansion, population increase, extra gameplay loop, per-car texture baking or save schema. Existing building landmark perspective remains intact. Ambulances use normal driving and traffic rules.

## Acceptance criteria

- [x] Changing the building perspective never changes car projection; the car slider still works.
- [x] Every registered archetype has an explicit layered visual; marked police, taxi, bus and ambulance remain recognisable.
- [x] Pool reuse, damage/repair, bus route badges and culling remain compatible.
- [x] Two hospital ambulances fit inside the authored bays and can be driven.
- [x] All models share one atlas; inspect rotation and collect a controlled rendering comparison.

## Validation

Focused projection/model/vehicle/control tests, affected plan and invocation, native suite and city validation, production build, all-model rotation sheet, hospital parking, actual ambulance entry/driving and representative traffic/police/bus pool reuse. Record limitations alongside results.

## Result — 2026-09-19

All 21 archetypes have authored assemblies. The atlas is 1536 × 1792 (10.5 MiB RGBA), loaded once; each car uses one render object and 21–33 batched sections. Buses keep their existing route-text object in addition. Assemblies are cached by body style and dimensions, with physical footprints unchanged. The car slider remains 0–300%, default 200%; the renderer no longer reads BuildingParallax and the obsolete frontage sampler is removed.

Two ambulances start at (584,651) and (656,651), facing north in the hospital's existing recessed bays. They have a tall medical compartment, cross, red side band and roof bar. They use ordinary vehicle/traffic rules, not emergency dispatch. A deterministic one-in-five selection among delivery vans introduces medical variants (roughly 1% of all ambient traffic). Both share commercial running gear and footprint, preserving existing clearances and driving trajectories. Their definitions are appended, preserving existing garage-slot indices and saves.

### Browser and focused checks

- 45 focused projection/model, bus, control, visibility and roster tests passed. A subsequent 29-test regression run passed after preserving existing garage ordering and traffic model assignments.
- Replacing arbitrary small cars with larger medical vehicles exposed a long-queue regression. Medical variants now replace only delivery vans with identical running gear; the new trajectory-equivalence test exercises 1800 acceleration, steering, braking and reverse steps. The subsequent 23-test model/roster/contact/maintenance run passes.
- Final density regression: all three tests pass, including 180 simulated seconds at each of old-quarter, Blackwater and north-harbor, 600 civilian identities plus six buses, at most 64 local slots, no overlaps/contacts/visible spawns and no unresolved long queues. Maximum stops: 14.8 / 42.15 / 8.3 seconds.
- Last complete native run (before that final commercial-chassis correction): 1263 tests, 1218 passed / 45 failed. Forty-four failing names matched the existing baseline; the additional density failure is resolved by the final targeted rerun above. The complete suite was not rerun again after that correction; the suite is not claimed green.
- Production browser: all authored vehicles and all 21 pool replacements use stacking; no stale render objects survive replacement, one shared atlas, bus route C → N → E updates correctly, no page errors.
- The hospital perspective slider changed the building influence from 0 to 1 while the parked ambulance's projection stayed exactly (0.008664357, -0.307038108).
- Actual keyboard entry, reverse out of the hospital bay, and exit passed: the first ambulance moved from y=651 to y=746.61, retaining health 138.
- All 21 models reviewed from diagonal, side and rear headings. Screenshots: `screenshots/vehicle-fleet-diagonal.png`, `screenshots/vehicle-fleet-hospital.png`.
- Production package and city validation pass (0 errors/warnings, A 87.8). The affected selector was reviewed and invoked; its Windows npm subprocess still stops before executing checks, so native/city checks and targeted production browser checks were run directly. The entire selected 32-spec legacy browser set was not executed.

### Controlled drawing comparison

Same isolated scene, 64 mixed vehicles, identical positions/headings, 200% car volume; city simulation paused. Headless Chromium / ANGLE D3D11, Intel HD 530, 2160 × 1440 framebuffer. Order: legacy → stack → stack → legacy, five-second samples after warmup.

| Drawing | Child objects | Submitted stack sections | CPU render mean, ms |
|---|---:|---:|---:|
| Legacy, first | 1435 | — | 2.779 |
| Stack, first | 67 | 1521 | 1.156 |
| Stack, second | 67 | 1521 | 1.157 |
| Legacy, second | 1435 | — | 2.809 |

CPU drawing averaged about 59% lower. However, both paths showed irregular scheduling pauses of hundreds of milliseconds outside the measured render call; frame counts varied substantially. These samples **do not establish an FPS improvement or a 60 FPS guarantee**. Source image resolution remains unchanged; no per-car textures or extra update loop were added.
