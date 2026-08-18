# Control UX — main-menu authority

Last updated: 2026-08-18

## Status

Implemented on `audio/playtest-p0` as the post-playtest control-UX increment for PR #55.

## Player-facing rules

- The mouse wheel still changes the equipped weapon, but the old contextual in-game `WHEEL` tutorial is removed. Weapon cycling is documented rather than repeatedly taught during play.
- `Escape` is the canonical pause/back key. In normal gameplay, pressing `Escape` with no higher-priority modal open opens the existing pause menu; pressing it again closes that menu. `H` is no longer an alternate pause/help shortcut and remains available for the vehicle horn while driving.
- The fullscreen main menu now includes a dedicated `CONTROLS` entry. It presents the active on-foot, combat/feeding, vampire-power, driving and menu bindings before the player starts the night.
- Remappable keyboard labels in the main-menu reference are derived from the same input-binding authority used by `InputSystem`, so saved remaps are reflected instead of duplicating fixed display strings.
- Mouse inputs and the fixed Mission/Night Ledger shortcuts are listed explicitly because they do not currently have remappable keyboard bindings.

## Canonical control reference

The main-menu panel covers:

- movement: W/A/S/D or arrows;
- quiet movement: Shift;
- interaction/dialogue/evidence: E;
- traversal: Space;
- mouse aim, left-click weapon use, hold right-click Feed/Drain, mouse-wheel weapon cycle;
- Q Dash, R Whisper, F Blood Sense, B Give In;
- driving: W/S accelerate/brake, A/D steer, Space handbrake, Enter enter/exit, H horn;
- Esc pause/back, M Mission, L Night Ledger.

Where a keyboard action is remapped, the displayed label follows the active binding rather than the default shown above.

## Regression contract

Automated coverage must keep the following true:

1. `UxGuidanceSystem` contains no contextual weapon-wheel tutorial path or `weapon:changed` listener solely used to dismiss that tutorial.
2. `weaponGuidanceState()` moves directly from locked tutorial control to complete guidance state; it never requires a weapon cycle.
3. `MainMenuScene` exposes a dedicated `CONTROLS` panel using the canonical control-reference builder.
4. Browser boot coverage opens that panel on the real main-menu scene and checks the key combat, feeding, power, driving and pause entries.
5. Browser coverage verifies `Escape` opens and closes the existing pause menu after gameplay control is handed over.
6. `H` is not treated as a pause/help shortcut by `UIScene`, preserving its vehicle-horn role.

## Out of scope for this increment

- No changes to weapon cycling itself.
- No changes to weapon balance, combat, feeding, powers or vehicle physics.
- No work on player-body orientation versus mouse aim; that is the next independent increment.
- No changes to death/hospital recovery, explosions, mission failure, blood-bag pickup, engine mix, traffic polish or performance work.
