# Input system

_Status: implemented in Milestone 1; browser regression validation remains required before the milestone is marked fully complete._

## Purpose

`InputSystem` is the authoritative source of gameplay input. Keyboard, pointer buttons, pointer position and mouse-wheel movement are collected once per simulation frame and exposed as an action snapshot. Gameplay systems no longer decide independently whether Space, E, Q, R, F or a mouse button was pressed.

The UI scene still owns UI-only keys such as menu/help and mission-panel navigation. World actions are suppressed centrally whenever the game is paused, a task reveal is active or the tutorial selects a restricted control mode.

## Files

- `phaser/src/input/actions.js` — action names, control modes, empty-frame factory and pure action gating.
- `phaser/src/input/InputSystem.js` — raw browser/Phaser input collection and frame creation.
- `phaser/src/input/input-runtime.js` — integration with `GameScene`, interactions, powers, combat, player damage and draining.
- `phaser/src/input/tutorial-input-adapter.js` — maps tutorial states to central control modes.
- `phaser/src/utils/geometry.js` — pure vector, cone, client-to-game and screen-to-world helpers.
- `phaser/src/movement-controls.js` — thin bootstrap plus HUD copy compatibility; it no longer owns gameplay controls.

## Frame contract

Every active `GameScene` update receives one object with this shape:

```js
{
  timestamp,
  controlMode,
  worldEnabled,
  move: { x, y },
  hasMovementIntent,
  aimWorld: { x, y },
  pointerInside,
  sprintHeld,
  primaryHeld,
  primaryPressed,
  drainHeld,
  drainPressed,
  traversePressed,
  interactPressed,
  weaponStep,
  dashPressed,
  whisperPressed,
  bloodSensePressed,
  menuUpPressed,
  menuDownPressed,
  menuConfirmPressed,
  menuCancelPressed,
  menuDigitPressed,
  debugLayerPressed
}
```

The same frame is consumed by movement, traversal, interactions, powers, unarmed combat, enemy-damage filtering and contextual draining. Weapon cycling remains a future consumer rather than a future input path.

## Current bindings

- WASD / arrows create the normalized `move` vector.
- Mouse position creates responsive `aimWorld` coordinates.
- Left mouse creates `primaryHeld` and `primaryPressed`; `CombatSystem` consumes the pressed edge for one unarmed attack.
- Right mouse creates `drainHeld` and `drainPressed`; `DrainSystem` uses the pressed edge to start and the held state to maintain the channel.
- Space creates `traversePressed` and currently remains `sprintHeld` for compatibility with the existing tutorial.
- E creates `interactPressed` and menu confirmation. It no longer starts a drain.
- Q creates `dashPressed`.
- R creates `whisperPressed`.
- F creates `bloodSensePressed`.
- Wheel events are coalesced into a discrete `weaponStep` for Milestone 7.

Space stops modifying speed in Milestone 5. The compatibility behaviour is intentionally isolated to one line in `InputSystem`.

## Control modes

| Mode | Allowed world actions |
|---|---|
| `full` | All current and future world actions. |
| `movement` | Movement, aim and traversal. |
| `drain` | Movement, aim, primary attack, right-click drain, traversal and limited tutorial interaction. |
| `tip` | Movement, aim, traversal and clue interaction. |
| `locked` | Aim tracking only; no world action is emitted. |

The tutorial adapter changes modes instead of disabling individual gameplay keys. Raw keys remain enabled so dialogue handling and later remapping are not coupled to tutorial logic.

## Pointer mapping

Responsive CSS changes the displayed canvas size without changing its internal game coordinate system. Pointer conversion therefore follows two explicit stages:

1. Browser client coordinates are converted to internal game coordinates using the canvas bounding rectangle and camera dimensions.
2. Internal game coordinates are converted to world coordinates using the camera world view and zoom.

`CombatSystem` and `DrainSystem` consume this shared result directly. Neither performs a second viewport conversion.

## Browser lifecycle

`InputSystem` resets held and edge-triggered input when:

- the browser window loses focus;
- the document becomes hidden;
- the UI pause state actually changes;
- the task-reveal/cinematic lock actually changes;
- the tutorial changes control mode or disables world input;
- the scene shuts down.

`UIScene` republishes its current pause state during rendering. The input layer compares new and previous lock values and ignores identical publications, preventing WASD and other keyboard state from being erased every frame.

Pointer-held actions are cancelled when the pointer leaves the canvas. This also causes an active right-click drain to cancel on the next simulation frame. The canvas is focusable and receives focus after dialogue clicks so keyboard control returns immediately. Pointer and wheel actions received while world input is locked are discarded rather than replayed after a dialogue or modal closes. Context-menu suppression is scoped to the game canvas only. Wheel scrolling is only prevented when a future `WeaponSystem` explicitly enables wheel capture.

## Runtime ownership

`GameScene` consumes one input frame and owns:

- traversal dispatch;
- E interaction dispatch;
- movement-vector application;
- interaction-menu navigation;
- power action dispatch;
- forwarding primary attack and aim to `CombatSystem`;
- forwarding right-button state and aim to `DrainSystem`;
- applying `PlayerDamageSystem` action filtering during hit stun.

`PowersSystem`, `InteractionSystem`, `CombatSystem`, `DrainSystem` and `PlayerDamageSystem` receive abstract actions rather than querying raw keys or browser events.

## Tests

Run:

```bash
npm test
```

The zero-dependency Node suite covers:

- action gating for every tutorial mode;
- world-lock behaviour;
- pointer/wheel suppression while locked;
- reset behaviour across real UI/task lock transitions;
- preservation of keyboard state when the UI republishes an unchanged pause value;
- wheel-step normalization;
- vector normalization and cone queries;
- responsive client-to-game mapping;
- camera screen-to-world mapping;
- InputSystem edge consumption;
- combat-mode permission for primary attack and right-click drain.

The same command runs automatically in GitHub Actions on pushes to `main` and on pull requests.

## Known limitations

- The integration layer still replaces a small set of legacy prototype methods because the original vertical slice predates first-class bootstrap composition. Final core-file migration belongs to Milestone 10.
- UI-only keyboard handling remains in `UIScene`; the new system is authoritative for world/gameplay input.
- Wheel events are collected but not consumed by gameplay until `WeaponSystem` exists.
- Browser smoke tests have not yet been automated.
