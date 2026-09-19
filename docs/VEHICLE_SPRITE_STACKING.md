# Sedan sprite stacking pilot

Current fleet behaviour is documented in [VEHICLE_STACK_FLEET.md](VEHICLE_STACK_FLEET.md). This file records the earlier sedan pilot and measurements; its landmark-to-car coupling has now been removed at the user's request.

## Goal and authority

Give the existing civilian sedan a layered 1990s silhouette, with camera-dependent height and crisp paint, glass and metal. `VehicleView.paintVehicle` remains the composition point for authored and pooled cars. VehicleSystem, traffic, collisions, damage and saves retain their existing authority.

## Scope

- One authored slice atlas in `phaser/assets/vehicles/`, shared by every sedan and paint colour.
- `VehicleSpriteStack.js`: one render object per sedan, batched atlas quads, height projection at render time, material handles compatible with existing damage presentation.
- `VehicleView.js`, `VehicleVisibility.js`, GameScene preload; focused rendering/culling tests and browser comparison.

## Non-goals

No changes to vehicle dimensions, driving, population, simulation, camera quality, buildings or city layout. Other vehicle families retain their current art. No per-car texture generation, render targets, frame listeners or new update loop.

## Acceptance

- Recognisable sedan in every heading, camera-relative height that does not rotate with the car.
- Paint variants, damage, repair, wrecks, pooled replacement and offscreen culling continue to work.
- One shared atlas at 8 pixels per world unit; no reduction to existing render resolution.
- Compare the same stationary scene with 64 visible cars, legacy versus stacked, including CPU render cost and frame times. Also check normal gameplay.

## Validation

Focused vehicle/render tests, production package, actual browser rotation/camera/damage/pool inspection; affected plan and run against origin/main. Record results and limitations below.

## Result — 2026-09-19

### Follow-up: independent vehicle volume control

Authority: the existing stack renderer owns vehicle height projection; the existing landmark control panel owns the two debug inputs. Scope: `VehicleStackSettings.js`, `VehicleSpriteStack.js`, `LandmarkFrontage.js`, focused projection/culling/control tests. No vehicle physics, footprints, pedestrians, building projection, assets, population, new update loop or extra slices.

Acceptance: a separate 0–300% vehicle slider, default 200%, with 100% preserving the previous projection and 0% flattening the stack. Above 100%, a small overhead tilt reveals the body even at camera centre while turning. Landmark projection remains continuous and both controls work independently. Culling covers the maximum setting, with unchanged atlas and render-object counts.

Result: implemented in the existing bottom-left panel. Applies to the currently stacked sedan; other vehicle art is unchanged. The setting is a live scene debug value, not a saved-game preference. The conservative visibility padding covers the complete 0–300% range.

Validation: 32/32 focused tests pass, including independent DOM controls, isolated key events, shutdown cleanup, zero-volume ground contact, all cardinal rotations and maximum culling bounds. Production browser checks exercised 0/100/200/300% at the hospital and both controls independently, with no page errors. The car stayed at (480,610), heading -π/4, footprint 34 × 16, one render object, 21 quads and one shared atlas. Six headings were visually reviewed at 100/200/300%, with radial and landmark projection. Screenshot: `docs/screenshots/vehicle-volume-hospital-200.png`. The larger settings deliberately exaggerate the body; no overall FPS claim is made.

Production package and city validation pass. Full native suite: 1265 tests, 1221 pass / 44 fail; the failing names exactly match the preceding frontage run. Affected plan reviewed and invoked; its Windows npm subprocess still exits before running checks. Native and city checks were run directly; the entire selected 32-spec browser set remains unrun, with the targeted production browser checks above completed.

### Follow-up: landmark frontage perspective

Scope: `LandmarkFrontage.js` / `BuildingParallax.js` remain the sole owner of the active landmark perspective and its smoothing. `VehicleSpriteStack.js` reads that same-frame state for nearby cars. Focused frontage/stack tests cover activation, fade-out, corner falloff, unchanged ground contact and bounded displacement. The perspective slider controls the shared transition; the follow-up above adds a separate vehicle volume multiplier. No pedestrian, asset, physics, collision, simulation or population changes; no additional timer, smoothing loop, texture, slice or draw call.

Acceptance: a sedan near an active hospital/club/police/cathedral frontage opens toward the same direction as its facade, then returns continuously to the usual radial projection when the effect fades. Cars outside the local frontage area retain the usual projection. The existing culling envelope must remain valid.

Validation: 30/30 focused frontage, parallax, sprite-stack and visibility tests pass. Browser checks passed for hospital, police, Vesper and cathedral, using the actual perspective slider at 0% and 100%. At full effect the car and facade use the same -0.65 height coefficient; the hospital car remained at (480,610), heading -π/4 and footprint 34 × 16. Its renderer remained one object with one shared atlas; the city's unrelated material texture count can still vary as buildings load. Moving away reduced sampled influence below 0.001. No browser errors. Screenshots: `docs/screenshots/vehicle-hospital-radial.png` and `vehicle-hospital-frontal.png`.

Full native rerun: 1263 tests, 1219 pass / 44 fail, exactly the same failing test names as before this follow-up. City validation and browser-suite coverage pass. The affected selector again stops at its Windows npm subprocess; the selected full browser set remains unrun. No new overall FPS measurement was made for this follow-up; it adds a local frontage lookup per visible stacked car, with unchanged textures and submitted quads.

The existing civilian sedan now uses 21 horizontal-section quads inside one render object (the old sedan used 20 individual shape objects, several with additional stroke geometry). The original shape renderer remains available for other archetypes, absent assets and Canvas renderers. Every sedan shares the same 1536 × 896 atlas, including its six paint colours. Tight authored frame bounds reduce transparent overdraw. Rotation, camera projection and opacity are applied at render time; no frame listener is installed.

### Controlled drawing comparison

Headless Chromium, ANGLE D3D11 / Intel HD Graphics 530; framebuffer 2160 × 1440, MSAA off, existing linear filtering. One test scene, 64 visible sedans, six-second samples after two-second warmup, same headings/positions/palettes, legacy → stack → stack → legacy. City simulation was paused to isolate drawing. This does **not** measure whole-game performance or guarantee 60 FPS throughout the city.

| Renderer | Objects inside 64 cars | CPU render mean, ms | Frame p95, ms | Frames over 50 ms |
|---|---:|---:|---:|---:|
| Legacy, first | 1280 | 2.546 | 18.0 | 0 |
| Stack, first | 64 | 0.676 | 18.1 | 0 |
| Stack, second | 64 | 0.677 | 17.9 | 0 |
| Legacy, second | 1280 | 1.931 | 18.0 | 0 |

All four samples averaged approximately 60 FPS; the browser caps frame cadence here. Stack CPU rendering averaged approximately 70% lower across these runs. Texture count remained 167 through all four configurations and 24 real traffic-slot sedan/compact replacements; no old slot render object survived replacement.

### Checks

- 25 focused vehicle/model/render tests passed; the final projection/culling subset passed again after tightening atlas cuts.
- Full native suite: 1260 tests, 1216 pass / 44 fail. The failing test names match the preceding cathedral run's failures, except its already-fixed pavement mock failure is absent. Existing failures include campaign/UI fixtures, old city/population assertions and the blocked-driver search fairness test. This is not a green full-suite result.
- City validation: zero errors/warnings, score A 87.8. Browser suite coverage: 41 specs / 8 suites.
- Affected selector reviewed (the accumulated branch selects 32 browser specs), then invoked with `--run`. On this Windows environment its npm subprocess stopped at `npm test`; the native suite and city check were run directly. The full selected legacy browser set was not executed.
- Browser inspection: all six headings, clean and charred variants, actual gameplay rendering, unchanged atlas count on pooled reuse, no page errors. Comparison screenshot: `docs/screenshots/vehicle-stack-comparison.png`.
- Actual keyboard entry, acceleration, steering and exit passed on `market_sedan`; it moved from (760,760) to (1340,691), turned to -0.834 radians and retained health 88. The subsequent six-second city sample averaged 16.74 ms/frame (~59.7 FPS), p95 19.8 ms, max 34.7 ms, zero frames over 50 ms; two stacked traffic cars were visible. This is a short local observation, not a citywide benchmark. No page errors.
