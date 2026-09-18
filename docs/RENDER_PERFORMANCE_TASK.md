# Render performance and projected lamps
Goal: reduce repeated geometry work while panning, and project police lamps as elevated props.
Authority: BuildingParallax camera render hook; PoliceCampusGround static light cache.
Files: BuildingParallax, ProjectedStreetLamps, PoliceCampusGround, prop assets and focused tests.
Acceptance: fixed lamp bases, camera-responsive heads; cached facade span layout; no new game loop; boot and projection tests pass; profile before/after under same browser conditions.
Non-goals: collision, traffic behaviour, world layout, publication.

## Measured follow-up
CPU sampling during camera movement identified whole-city pointOnPedestrianSurface / pointInsideBuilding scans among the largest named game costs. A read-only 128-unit spatial candidate index now narrows those queries; the exact existing rectangle/polygon predicates and world bounds are unchanged. No navigation authority or collision rules are replaced. Regression coverage compares samples and surface corners against the full scans.

Isolated benchmark: 60,000 Vesper-area pedestrian queries, same points, same 29,868 true results: full scans 6269.7ms; indexed 64.1ms. This is query throughput, not an FPS multiplier. Browser capture ran software rendering and is not a representative hardware FPS baseline.

Facade span/height layout and attached-volume descriptions are reused across camera frames. Lamps are presentation objects in the existing camera hook: 3.6m elevation, fixed base, projected stem/head; their ground light remains statically cached. Higher-resolution source extraction (128x204 lossless WebP) from the previously generated lamp atlas, not an upscale of the small web asset. New runtime frames isolate base/stem/head. Scene shutdown destroys instances.

Validation: 18 focused tests, production build, police browser scene without page errors and screenshot inspection. Automatic affected runner stops at spawning npm test on Windows; direct unit execution used separately.

Broad unit run was also attempted directly because the affected runner cannot spawn npm on this Windows setup. It surfaced unrelated-area failures (saved-game preload expectations, CRLF-sensitive CI assertion, city density/topology and legacy presentation expectations); the full run was stopped after several minutes to release test worker CPU. This is not a green full suite; the 18 focused tests and live browser check above passed. Do not infer full release validation.
