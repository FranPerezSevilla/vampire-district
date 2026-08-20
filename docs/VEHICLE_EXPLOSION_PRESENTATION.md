# Vehicle explosion presentation

Last updated: 2026-08-18

## Scope

This slice adds the missing audiovisual presentation for the vehicle-destruction authority that already existed. It does **not** create a second damage/explosion system.

The authoritative flow remains in `VehicleSystem.explodeVehicle()`:

- a vehicle can explode only after the existing `vehicle.exploded` guard allows it;
- occupant and radial Vitality/NPC damage remain owned by the existing destruction path;
- the existing camera shake remains authoritative;
- exactly one `vehicle:exploded` event is emitted by that path.

`GameScene` now installs `VehicleExplosionPresentation` as a listener for that event. Presentation is therefore downstream of authoritative damage/state and cannot apply additional damage or emit another explosion event.

## Visual beat

A presented explosion creates a short deterministic top-down beat at the event position:

1. bright central flash;
2. orange fire bloom;
3. expanding pressure ring;
4. four smoke puffs;
5. eight fixed-direction hot/debris fragments.

The elements expand/fade over roughly 0.18–0.72 seconds and are destroyed by a deterministic cleanup at 860 ms. The disabled vehicle itself remains behind as the already-established dark, low-alpha wreck, so the blast does not replace persistent destruction state.

No random positions are used in the explosion presentation. This keeps screenshots/tests reproducible and prevents a cosmetic effect from perturbing game simulation randomness.

## Sound beat

`playVehicleExplosionSound()` is a dedicated semantic cue on the existing `RawAudio` world bus. It layers the established heavy metal impact, low lethal thump and glass/break transient into one boom/crack signature. Keeping the cue on `RawAudio` means it still obeys the current master and narrative-ducking authority instead of creating an independent WebAudio path.

A dedicated external explosion sample can replace the procedural composite later without changing the `vehicle:exploded` presentation contract.

## One-shot and lifecycle rules

- `VehicleSystem.explodeVehicle()` still rejects an already exploded vehicle before damage/event work.
- The presentation listener also carries a short 1200 ms duplicate guard by vehicle id. This is defensive against accidental repeated event emission on adjacent frames, not a second destruction state.
- The duplicate guard expires, so a legitimately reset/reused vehicle id can present a future explosion.
- Scene `shutdown` / `destroy` removes the listener.
- Temporary blast objects are cleaned up after 860 ms.

## Automated acceptance

`tests/vehicle-explosion-presentation.test.js` verifies:

- the dedicated three-layer boom/crack cue is requested once;
- flash, pressure ring, smoke and debris are created and animated;
- temporary objects are cleaned up;
- duplicate `vehicle:exploded` emission inside the guard window does not replay presentation;
- the guard is temporary rather than permanent vehicle-id suppression;
- `VehicleSystem` retains one authoritative event behind the `vehicle.exploded` guard;
- `GameScene` installs the presentation listener rather than duplicating destruction authority.

Perceptual loudness, readability at game zoom and whether the blast feels sufficiently violent still require the normal deploy-preview playtest after CI passes.
