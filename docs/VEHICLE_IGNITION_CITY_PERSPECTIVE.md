# Ignition and common city perspective

## Scope and acceptance

- VehicleModel / VehicleSystem and CampaignVehicleSystem own a persistent `engineRunning` flag, independent of occupancy and parking. Existing RawAudio owns all starter and idle voices.
- Parked authored vehicles default off. Entering starts an off engine exactly once; exiting leaves it running. Running traffic retains ignition when hijacked. Disabled vehicles have no engine or headlights.
- BuildingParallax and a shared CityPerspective projection replace all landmark proximity blends. The south/front facade has a constant height-proportional bias, with the same projection for ordinary buildings, landmarks, attached volumes and street furniture.
- Preserve car/character projection, city layout, collisions, cathedral cutaway, vehicle art and current audio budgets. Remove only the landmark perspective control; retain the car control.

## Files in scope

VehicleModel, VehicleSystem, VehicleInteractions, VehicleDriving, CampaignVehicleSystem, VehicleMaintenanceService, VehicleView (diagnostics), GameplayRuntime (existing audio frame and pause lifecycle), TrafficMaterializationSystem, MotorizedPoliceSystem, NightStreetLights, BuildingParallax, PropSpriteStack, perspective controls and GameScene composition. Focused tests cover ignition, persistence, light gating, common projection and controls. Removed obsolete door/frontage projection modules and their superseded tests.

## Validation

Run the affected plan/runner and fast gate; distinguish existing failures from regressions. Verify engine entry/reentry and city projection in the production preview. No asset resolution reduction, new simulation loop, traffic budget expansion or change to vehicle perspective.

## Next art pass

Evaluate ordinary buildings against the user's night-city reference after this change. Keep the existing roof/facade surfaces as the main volume: improve silhouettes, dark material families, window rhythm and localized warm light before considering stacked detail modules. Full-building sprite stacking is not a prerequisite for this style.

### Concrete sequence for ordinary buildings

1. Build one representative residential block as the visual acceptance target at the real gameplay zoom.
2. Author a small dark brick/stone facade kit, with clear window frames, sills, recessed doors and restrained shop fronts. The current generic path still paints many openings as flat rectangles and all its walls use the same stone base.
3. Give roofs recognizable silhouettes with parapets, chimneys, access structures and vents. Ordinary roofs still take the simpler Graphics path in BuildingParallax; use the same cached material surfaces as the landmarks.
4. Make window interiors and small street-level pools the warm accents. Reuse current light stamps and bake stationary facade illumination when composing resident materials; avoid a new light object per window.
5. Evaluate a night screenshot against the reference before expanding to residential, commercial/hotel and industrial families. Share source atlases and a bounded set of composed facade variants.
6. Keep the current roof/wall planes for the main building. Use small stacked or projected modules only where their silhouette matters (fire escapes, balconies, water tanks). More stack slices across a whole building would increase geometry/overdraw; they do not fix repetitive shapes or flat materials.

### Validation results — 2026-09-19

- 61 focused native tests passed, including ignition, primitive save flags, traffic handoff, maintenance, projection, light budgets and controls.
- Production preview passed a real browser scenario: parked ambulance off (zero vehicle light stamps/voices); enter (one starter); exit (lights and spatial idle remain); reenter (still one starter); pause/resume (silence, then idle without starter); hijack running traffic (no extra starter).
- Five production viewpoints checked: hospital, closer hospital frontage, police, club and ordinary street. No page errors, no landmark proximity state; vehicle volume remains 200%. Roof and annex joins and lamp alignment were inspected in screenshots.
- Production packaged successfully (295 gameplay modules). City validation: zero errors/warnings. Browser-suite coverage checker passed.
- The affected runner exits at its npm child launch on Windows, before executing tests. Its native safety net was run directly: 1,286 tests, 1,238 passed / 48 failed before updating three obsolete perspective assertions and the expected saved-state shape. Those four checks are resolved or superseded by the focused suite; 44 unrelated failures remain in the broader branch (UI/campaign/old city/traffic expectations). The full browser plan was not run; the scoped production browser scenario above passed.
- Existing engine voice limit (10), vehicle light budget (48), shared atlases and car textures/projection are unchanged. No new per-vehicle timers or independent update loop.
