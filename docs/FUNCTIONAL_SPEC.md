# Functional specification

## 1. Experience goals

The game should feel immediate, readable and systemic:

- crossing a block should be enjoyable rather than administrative;
- mouse aim should make attacks and draining understandable;
- traversal should be one contextual action without a route menu;
- feeding should be powerful, risky and tactically useful;
- vision and hearing should create different reactions;
- movement, stealth, violence, feeding and route choice should solve situations.

## 2. Core gameplay loop

1. Receive an order from the sire.
2. Navigate streets, rooftops and sewers.
3. Read NPC vision, hearing and alert state.
4. Avoid, distract, strike, knock down or drain targets.
5. Control Hunger and protect the veil.
6. Manage evidence and police pressure.
7. Complete the objective and return to report.

## 3. Current control scheme

| Action | Input | Behaviour |
|---|---|---|
| Move | WASD / arrows | Run by default. |
| Quiet movement | Hold Shift | Slower movement and much smaller footstep hearing radius. |
| Aim / face | Mouse | Player faces the cursor's world position. |
| Primary attack | Left mouse | Punch or use the equipped weapon in the aimed direction. |
| Drain | Hold right mouse | Drain a valid aimed target while the channel remains valid. |
| Traverse | Space | Jump, climb, descend or enter/exit a sewer. No speed effect. |
| Interact | E | Talk, collect, inspect and use non-traversal objects. |
| Dash | Q | Shadow Dash. |
| Whisper | R | Vampiric Whisper. |
| Blood Sense | F | Reveal relevant supernatural/perception information. |
| Mission | M | Toggle mission information. |
| Menu | H | Toggle menu/help. |
| Dialogue | Left click / Escape | Advance one dialogue bubble. |

Mouse-wheel weapon cycling is planned but not implemented.

## 4. Movement and stealth

### Default run

Normal WASD movement uses the fast traversal speed. Space is never a sprint modifier.

### Quiet movement

Holding Shift lowers speed and footstep pressure. Quiet movement should allow deliberate approaches without making every nearby NPC react.

Current baselines:

| Mode | Speed multiplier | Base hearing radius |
|---|---:|---:|
| Run | 1.55 | 120 |
| Quiet | 0.72 | 42 |

Footsteps only create `WTF`/orientation when heard without a confirmed sighting. Hearing alone does not start pursuit or reporting.

## 5. Traversal

Space is exclusively physical movement between navigation layers.

Supported actions:

- rooftop jump;
- roof drop;
- fire escape up/down;
- street-to-sewer entrance;
- sewer-to-street exit;
- private shaft to the refuge.

Selection order:

1. a route already close and in the aimed direction;
2. closest valid route;
3. smallest aim angle;
4. route priority;
5. stable ID.

The highlighted route and executed route must always be the same. Space with no valid route does nothing. E never activates traversal.

## 6. Aiming and primary attacks

- Cursor coordinates are projected through the active camera.
- The last valid aim direction is retained near the player.
- A short indicator shows facing.
- Aim must remain correct after resizing, CSS scaling, zoom and quality changes.

Unarmed baseline:

- short directional arc;
- one resilience damage;
- windup, active and recovery phases;
- one hit per target per attack;
- brief victim stagger;
- ordinary-violence witness/police consequences.

## 7. NPC resilience and states

| NPC type | Resilience |
|---|---:|
| Civilian | 3 |
| Journalist | 3 |
| Police | 4 |
| Rooftop thug | 4 |
| Hunter | 5 |

State flow:

```text
active → staggered → downed → drained / killed
```

Downed NPCs cannot move, pursue, attack or report. Recovery is not implemented yet.

## 8. Contextual drain

### Downed drain

- target is downed;
- within range;
- aimed toward;
- clear geometry;
- approach angle does not matter.

### Rear stealth drain

- target is standing and unaware;
- player is behind its facing direction;
- within range and aimed toward;
- target is not alarmed, chasing, attacking, reacting or reporting.

### Channel

- right mouse must remain held;
- movement cancels;
- taking damage cancels;
- release cancels;
- range/layer/geometry loss cancels;
- witnesses and hearing continue evaluating.

Completion lowers Hunger and resolves the target as drained.

## 9. Player damage and Hunger

The player has no conventional health bar in the current slice.

- police melee: Hunger +12;
- hunter heavy strike: Hunger +20;
- hit stun: 260 ms;
- invulnerability: 720 ms;
- critical feedback: 85 Hunger;
- frenzy failure: 100 Hunger.

Invulnerability prevents overlapping enemies from instantly filling Hunger. Feeding functions as recovery.

## 10. Perception

### Vision

Confirmed sight uses facing, cone, range and layer. It promotes the appropriate response:

- police pursue/escalate;
- civilians and the journalist react/report;
- hunters use hostile behaviour.

### Hearing

Sound uses wider event-specific ranges.

- heard-only NPCs stop and turn toward the source;
- `WTF` or investigate feedback appears;
- hearing alone does not pursue or report;
- later confirmed sight can promote the response.

This rule applies to footsteps, roof drops, streetlight impacts and drain struggle sounds.

## 11. Mission completion

Handling the journalist is not mission completion.

```text
journalist handled
  → objective becomes return to refuge
  → player reaches refuge
  → sire approval dialogue
  → player dismisses dialogue
  → mission marked complete
  → final report opens
```

The report never appears before the return objective and never precedes the sire's final dialogue.

## 12. World props

Streetlights are still a legacy E interaction. Milestone 6 will convert them to damageable props:

- punches/weapons apply damage;
- misses do nothing;
- break updates lighting;
- visual witnesses react;
- heard-only NPCs turn without automatic pursuit.

## 13. Weapons

Weapons will reuse the existing aim, attack timing and damage contracts.

Initial proposed set:

1. unarmed;
2. improvised melee weapon;
3. pistol.

Each weapon defines damage, range, cadence, hit shape/spread, sound and ammo rules where relevant.

## 14. UI and browser behaviour

- dialogue click owns input before combat;
- world-space `SPACE` marker shows selected traversal;
- target resilience appears briefly rather than permanently;
- downed state is visually obvious;
- right-click context menu is suppressed only over the game;
- wheel scroll remains normal until weapon cycling owns it;
- blur/pause/task reveal clear held input;
- perception feedback should not permanently overcrowd the screen.

## 15. Acceptance criteria for the current combat-movement slice

- Aim remains accurate across supported sizes and zooms.
- Left mouse attacks in the aimed direction.
- Resilience counts are exact.
- Overlapping enemy attacks respect invulnerability.
- Right mouse drains downed targets and unaware rear targets only.
- Taking damage raises Hunger.
- WASD runs without a modifier.
- Shift is measurably slower and quieter.
- Space performs traversal only.
- E never performs traversal or draining.
- Nearby traversal conflicts resolve deterministically.
- Handling the journalist still requires returning to the refuge.
