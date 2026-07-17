# Control scheme decision

## Decision

Use a **modern top-down keyboard-and-mouse control scheme**, not a strict recreation of the original GTA2 controls.

The original GTA2 PC layout was keyboard-centric: directional keys for movement/turning, Left Control for attack, Enter for vehicles, Space for jump/handbrake and Z/X for weapon cycling. Vampire District keeps the immediate top-down readability and contextual traversal, but replaces the historical attack model with mouse-directed combat.

## Why this direction

- Directional melee is clearer when the player points at the intended target.
- Firearms can later use the same aiming model without replacing the movement system.
- Right-click provides a dedicated vampire action instead of overloading E.
- Mouse-wheel weapon selection is fast and familiar.
- Space can become a reliable traversal verb across roofs, ladders and sewers.
- The scheme works naturally with the existing top-down camera and responsive browser layout.

## Target bindings

| Input | World action |
|---|---|
| WASD / arrows | Move at default run speed. |
| Mouse | Aim and face. |
| Left mouse | Attack/fire equipped weapon. |
| Right mouse | Drain valid target. |
| Wheel up/down | Previous/next owned weapon. |
| Space | Execute contextual traversal. |
| E | Talk, collect, inspect and use non-traversal objects. |
| Q | Shadow Dash. |
| R | Vampiric Whisper. |
| F | Blood Sense. |
| M | Mission panel. |
| H | Menu/help. |
| Escape | Advance dialogue or close the active UI layer. |

## Movement behaviour

### Default run

The normal WASD speed becomes the current fast movement speed. Space no longer changes speed.

### Quiet movement

**Proposed:** Shift temporarily reduces movement speed and footstep noise. This preserves a stealth choice without returning Space to a dual-purpose run/traverse key.

### Facing

- Outside combat, the player may continue to face the cursor.
- When the cursor is within a small dead zone around the player, retain the last aim direction.
- Movement direction does not override aim direction.
- Dash uses aim direction when valid, otherwise movement direction.

## Primary attack rules

- Left mouse always means “use the equipped weapon toward the cursor”.
- Unarmed attacks use a short arc and range.
- Holding the button does not generate one hit per frame; each weapon owns its cadence.
- Attacks can hit NPCs and damageable props.
- Attacking while a modal, dialogue or menu is open is suppressed.

## Drain rules

Right mouse is a dedicated context-sensitive drain input.

Valid target order:

1. Closest downed target in range.
2. Closest unaware standing target in range whose rear arc contains the player.
3. No action.

Tie-breakers:

1. Shorter distance.
2. Smaller angle from the player's aim direction.
3. Mission target priority only when distance and angle are effectively equal.

A standing target cannot be drained from the front merely because the cursor is over it.

## Traversal rules

Space selects exactly one traversal candidate.

### Candidate filtering

A traversal point must:

- be on the current layer;
- be enabled by mission/world state;
- be within activation radius;
- not be blocked by an active transition, combat lock or dialogue;
- have a valid destination.

### Selection score

Recommended score:

```text
score = worldDistance
      + aimAnglePenalty
      + facingPenalty
      + priorityPenalty
```

Lower scores win. This prevents accidental sewer entry or ladder use when another route is clearly in front of the player.

### Input examples

- Space beside a rooftop gap: jump.
- Space beside a manhole: enter sewer.
- Space at a fire escape on the street: climb.
- Space at a fire escape on a roof: descend.
- Space with no valid route: no action.

## E interaction rules

E remains deliberately narrow:

- speak to NPC;
- collect mission clue;
- inspect/use mission object;
- manipulate evidence/body where that remains part of the design;
- confirm a contextual non-movement interaction.

E does not:

- run;
- jump;
- climb;
- enter sewers;
- attack;
- drain;
- break streetlights.

## Mouse-wheel rules

- Only consume wheel input while the pointer is over the game area.
- Convert wheel delta into discrete ±1 steps.
- Debounce rapid trackpad noise.
- Do not change weapons while a modal/menu is open.
- Show a short equipped-weapon toast.
- Add optional inverted wheel direction in settings later.

## Browser-specific requirements

- Suppress the context menu on right-click inside the game frame only.
- Do not suppress browser right-click elsewhere on the page.
- Prevent page scrolling from the wheel only while the game is consuming weapon-cycle input.
- Clear held mouse actions on window blur or pointer leaving during a channelled drain.

## Accessibility and fallback

Planned later:

- remappable bindings;
- keyboard-only aim fallback;
- optional click-to-toggle drain instead of hold;
- high-contrast reticle;
- reduced screen shake;
- wheel-direction setting;
- gamepad action mapping using the same abstract input actions.

## Acceptance checklist

- [ ] Aim remains accurate after browser resizing.
- [ ] Aim remains accurate at every camera zoom.
- [ ] Left mouse attacks once per valid cadence.
- [ ] Right-click never opens the browser menu over the game.
- [ ] Right mouse cannot front-drain an alert standing target.
- [ ] Wheel changes one weapon step without scrolling the page.
- [ ] Space never runs or activates Dash.
- [ ] E never selects a traversal route.
- [ ] Two nearby traversal points resolve deterministically.
