# Player aim orientation

_Last updated: 2026-08-18_

## Status

Implemented on `audio/playtest-p0` as the independent post-playtest orientation increment for PR #55.

## Player-facing rule

The vampire's body remains upright on screen during normal on-foot gameplay. Moving the mouse around the player changes the combat aim direction, reticle, muzzle direction and melee/hitscan attack direction, but never rotates the full player container.

## Implementation

- `CombatSystem.updateAim()` remains the authority for converting `aimWorld` into normalized `aimDirection`.
- The old cursor-derived `atan2(...)` rotation of `scene.player` has been removed.
- Every aim update explicitly normalizes the player container back to rotation `0`, preventing a stale body angle from surviving aim changes or a preceding presentation/transitional state.
- Aim presentation continues to derive from `aimDirection`: reticle line, muzzle flash/projectile origin and melee arc still follow the mouse independently of body orientation.
- Vehicle visuals keep their own vehicle angle authority; this rule applies to the vampire body, not the driven vehicle.

## Regression contract

`tests/combat.test.js` moves the pointer to multiple sides of the player and verifies both conditions independently:

1. `aimDirection` follows the pointer.
2. the player container rotation remains exactly `0`.

## Out of scope

This increment does not change weapon balance, projectile collision, movement, camera behavior, vehicle rotation, death/hospital recovery, explosion presentation, mission failure, blood-bag pickup or audio mix.
