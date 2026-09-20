# Night lighting and value hierarchy

## Goal

Match the user's September 19 street concept: near-black architecture and cars,
quiet cold ground, with local amber windows/street lamps and restrained red/blue
vehicle lights providing the colour. Material detail should recede in shadow.

## Scope and ownership

- Existing building material cache and surface cache own the static material finish.
- Existing post-camera presentation hook owns one bounded, batched street-light view.
- Read existing city lamps, landmark locations and active vehicle proxies; do not
  create a second city, traffic, gameplay lighting or damage authority.
- Shared render palette, building/material tiles, stack material shading, one shared
  light atlas, ground reflections and small elevated source glints are in scope.
- Vehicle art also includes a new shared body silhouette, sloped glazing, side
  panels and recessed wheels. `VehicleStackModels` and `VehicleSpriteStack` remain
  the assembly and presentation owners; `fleet-stack.svg` owns their native art.
- Keep city geometry, parallax magnitude, collisions, population, input, HUD and
  saves unchanged. Vehicle geometry changes are visual only.

## Acceptance

- Native in-game views have genuinely dark roofs/walls and subdued surface patterns.
- Amber light pools reveal pavement, headlights follow cars, and rear/emergency
  reflections remain localized. Light sources are brighter than the surrounding art.
- Light effects stay below buildings; no fullscreen wash over the HUD, no runtime
  per-light render targets, no per-frame texture creation or realtime shadow maps.
- Bound visible light work, preserve pause/layer behaviour, and measure its added
  frame cost. Compare the same camera positions against the previous build.
- Cars must read as distinct 1990s vehicle bodies at actual game scale, with a
  recognisable bonnet, boot, sloping glass and wheel arches in rotated views.
  Keep one shared atlas and one display object per vehicle, including services.

## Validation

Focused presentation tests, production boot, moving vehicles and camera, pause,
broken lamps, layer transitions, cold-start and in-game visual review. Review and
run the affected selector without claiming unrelated pre-existing failures are fixed.

## Implemented — 2026-09-19

- Cached wall exposure separates neutral masonry from warm luminous panes. Front
  glow is added after grading and uploaded once; side glow remains independent.
  Roof planes/pinnacles and the existing ground cache share a cooler low exposure.
  Hospital walkway/parking decals receive the same treatment before their lights.
- One shared 512 x 256 atlas supplies local amber pools, soft headlights, wet
  road reflections and small source glints. Two existing depth bands keep ground
  spill below cars and source glints below building occlusion. No shadow maps.
- At most 64 visible street lamps and 48 visible cars contribute lights. Fixed
  reusable batch records cap each band at 1,024 quads. Broken lamps, wrecks,
  inactive layers and hidden/distant vehicle proxies contribute no light.
- City lamps now use the existing projected prop renderer. The duplicate flat
  yellow pole rectangles are suppressed when that renderer is available.
- Vehicle render geometry includes sloped windshield/rear glass, independent
  side windows, long sculpted flanks with transparent wheel arches, tyre sidewalls
  and bumper/grille faces. Rear/front planes are culled by their projected facing.
  Wheels sit inside the body width; intact bonnets no longer show a damage decal.
  The ubiquitous nested sunroof was removed. Service vehicles retain their
  identifiable cargo bodies, markings, rails and roof lights.
- Lamp coordinates now belong to each vehicle model, rather than its shadow
  bounds. All 21 models still share one 1024 x 2048 mipmapped atlas (10.67 MiB
  RGBA plus mips), despite increasing its authored frames from 32 to 40. Models
  contain 28–37 available surfaces; hidden faces are not submitted. The bus alone
  keeps its existing second display object for its route badge.

## Measured limits and checks

- Production build and 24 focused native checks passed. The vehicle/night subset
  passed again after the final intact-bonnet and ambulance roof-light fixes.
- Real browser: all 21 archetypes can reuse a traffic slot without orphaned
  render objects or extra atlases; two ambulances exist and one was entered,
  driven out of the hospital bay and exited with health intact. Landmark
  perspective does not change vehicle perspective. Six city camera locations,
  broken-light visibility, pause and layer disable checks passed with no errors.
- 1,280-test broad native run: 1,235 passed / 45 failed. One failure was the old
  facade test fixture lacking canvas pixel methods; that fixture was corrected
  and passed in the focused rerun. The broad suite was not rerun after that fix.
  The other 44 failures concern existing campaign/UI/world/traffic assertions;
  this is not a green full-suite claim.
- City validation: 0 errors, 0 warnings, A / 87.8. Browser suite coverage passes.
  Affected plan reviewed and invoked; its Windows npm child launch exited 1 at
  `npm test`. Native checks were invoked directly. Its accumulated 32-spec browser
  selection was not run in full; the scoped browser scenarios above were run.
- At the precinct, three 6.5-second samples (lights on/off/on) averaged
  59.22 / 59.05 / 58.95 FPS. With lights enabled, light update + CPU submission
  averaged 0.11–0.13 ms/frame; vehicle submission averaged 0.18–0.26 ms/frame.
  Visible traffic varied (3–6 lighted cars at sample end), so those FPS differences
  are not a controlled GPU-cost comparison or a citywide 60 FPS guarantee.
- Initial cached canvas pixel passes ranged from 0.1 to 5.7 ms; none run per frame.
  This does not include GPU upload timing. Cold title readiness was 17.9 seconds
  in that capture. Streaming and total startup remain separate performance work.
- An isolated mixed-fleet scene with 64 cars averaged 60.12 FPS and 1.55 ms/frame
  of CPU vehicle submission, with city simulation paused. This verifies drawing
  cost only. It must not be presented as whole-game performance.

Evidence: [vehicle forms](screenshots/car-shape-study.png),
[hospital](screenshots/night-hospital-front.png),
[precinct](screenshots/night-police.png), [street](screenshots/night-avenue.png),
[mixed-fleet measurements](screenshots/car-shape-benchmark.json),
[night measurements](screenshots/night-performance.json) and
[browser checks](screenshots/night-review.json).

The light stamps approximate local illumination and reflections; they do not cast
dynamic physical shadows or relight every vehicle/actor surface. The concept's
material realism remains a visual target, rather than an achieved exact match.
