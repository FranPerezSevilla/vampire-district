# Input system

_Status: implemented; browser regression remains required before Milestone 1 is marked fully complete._

## Purpose

`InputSystem` is the authoritative source of gameplay input. Keyboard, pointer buttons, pointer position and wheel movement are collected once per simulation frame and exposed as abstract actions. Gameplay systems do not query raw Space, E, Q, R, F or mouse buttons independently.

`UIScene` still owns UI-only navigation while the world is paused.

## Files

- `phaser/src/input/actions.js` — action names, control modes and frame gating.
- `phaser/src/input/InputSystem.js` — raw Phaser/browser collection and pointer conversion.
- `phaser/src/input/movement-input-adapter.js` — Milestone 5 migration from Space sprint to Shift quiet movement.
- `phaser/src/input/input-runtime.js` — world dispatch to movement, traversal, interaction, powers and combat.
- `phaser/src/input/tutorial-input-adapter.js` — tutorial control modes.
- `phaser/src/utils/geometry.js` — pure vector and viewport/camera conversion helpers.

## Frame contract

```js
{
  timestamp,
  controlMode,
  worldEnabled,
  move: { x, y },
  hasMovementIntent,
  aimWorld: { x, y },
  pointerInside,
  quietHeld,
  sprintHeld, // always false; temporary compatibility field
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

The same frame is consumed by movement, traversal, interactions, powers, player attacks, player-damage filtering and contextual draining. Weapon cycling is already represented but remains unconsumed until Milestone 7.

## Current bindings

- WASD / arrows: normalized movement vector.
- Shift held: `quietHeld`.
- Space pressed: one-frame `traversePressed`; holding it has no speed effect.
- Mouse position: responsive world-space aim.
- Left mouse: primary attack held/pressed.
- Right mouse: drain held/pressed.
- E: non-traversal interaction and menu confirmation.
- Q: Dash.
- R: Whisper.
- F: Blood Sense.
- Wheel: discrete `weaponStep`.

The old `sprintHeld` property is intentionally forced to `false` so stale consumers cannot accidentally restore dual-purpose Space behaviour. It can be deleted after the compatibility sweep in Milestone 10.

## Control modes

| Mode | Allowed world actions |
|---|---|
| `full` | All implemented and future world actions. |
| `movement` | Move, quiet modifier, aim and traversal. |
| `drain` | Move, quiet modifier, aim, punch, right-click drain, traversal and limited tutorial interaction. |
| `tip` | Move, quiet modifier, aim, traversal and clue interaction. |
| `locked` | Aim tracking only. |

## Pointer mapping

Responsive CSS display size is separate from internal render size:

1. browser client coordinates → internal canvas coordinates;
2. internal coordinates → camera world coordinates.

`CombatSystem` and `DrainSystem` consume the same `aimWorld` value. They do not recalculate viewport scaling.

## Browser lifecycle

Held and edge state resets on:

- window blur;
- document visibility loss;
- real UI/task lock transitions;
- pointer leaving the canvas for pointer-held actions;
- scene shutdown.

Repeated publication of an unchanged pause value is ignored, preventing the previous stuck/dead-key regression. Right-click context-menu suppression is limited to the game canvas. Wheel scrolling remains available until `WeaponSystem` takes ownership.

## Runtime ownership

`GameScene` owns:

- movement-vector application;
- deterministic Space traversal dispatch;
- E interaction dispatch;
- power dispatch;
- forwarding aim/primary input to `CombatSystem`;
- forwarding right-button state to `DrainSystem`;
- applying hit-stun action filtering;
- updating movement sound after actual world displacement.

No movement or combat feature added after Milestone 1 creates another raw keyboard listener.

## Tests

Run:

```bash
npm test
```

Coverage includes:

- tutorial action gating;
- world locks and reset behaviour;
- unchanged-pause keyboard preservation;
- pointer/wheel suppression;
- responsive pointer and camera conversion;
- one-frame input consumption;
- Shift producing `quietHeld`;
- Space producing traversal without sprint;
- combat and drain permissions.

## Known limitations

- `movement-input-adapter.js` is temporary migration debt and should move into `InputSystem.beginFrame()` during Milestone 10.
- `input-runtime.js` still adapts legacy scene methods rather than using final explicit composition.
- UI-only keyboard handling remains in `UIScene`.
- Browser smoke tests are not automated yet.
