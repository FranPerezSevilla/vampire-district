# Combat system

_Status: Milestone 2 implementation complete; browser regression and tuning remain pending._

## Purpose

The first combat slice establishes a shared directional damage contract before weapons, enemy attacks or contextual right-click draining are added. Mouse aim, attack timing, target geometry, resilience and knockdown now flow through the central `InputSystem` frame.

## Files

- `phaser/src/data/combat.js` — combat states, unarmed timing, resilience values and pure geometry/state helpers.
- `phaser/src/combat/CombatSystem.js` — player facing, attack lifecycle, hit resolution, NPC combat state and combat presentation.
- `phaser/src/input/input-runtime.js` — instantiates and updates `CombatSystem` from the authoritative input frame.
- `tests/combat.test.js` — pure aim, arc and resilience tests.

## Current controls

- Move with WASD or arrows.
- Aim by moving the mouse over the game canvas.
- Left-click performs one unarmed attack toward the stored aim direction.
- Space and E retain their current compatibility behaviour until their later milestones.
- Right-click drain and wheel weapon selection are still collected by `InputSystem` but are not yet consumed by combat.

## Aim contract

The cursor is converted to world coordinates by `InputSystem`. `CombatSystem` derives a normalized direction from the player to that point.

- The player container rotates to face the direction.
- A short world-space line and reticle show the active direction.
- When the cursor is inside a 10-unit dead zone around the character, the last valid direction is retained.
- The direction is stored at attack start, so moving the pointer during the punch does not bend an attack already in progress.

## Unarmed attack lifecycle

The baseline punch uses three explicit phases:

| Phase | Duration | Behaviour |
|---|---:|---|
| Windup | 90 ms | Direction is committed; movement is briefly locked. |
| Active | 110 ms | Targets inside the melee arc can be hit once. |
| Recovery | 240 ms | No new interaction or traversal starts until recovery ends. |

One pointer press starts one attack. Holding the mouse button does not produce frame-by-frame damage. Each attack owns a `hitIds` set so a target cannot receive duplicate damage during the same active window.

## Hit geometry

The unarmed hit shape is a forward cone/arc:

- range: 32 world units;
- half-angle: 0.62 radians;
- origin: player world position;
- direction: aim direction captured at attack start.

Targets behind the player, outside the arc or beyond the range are rejected by the pure `targetInsideMeleeArc` query.

## NPC resilience

| NPC type | Maximum resilience |
|---|---:|
| Civilian | 3 |
| Journalist / normal target | 3 |
| Police | 4 |
| Rooftop thug | 4 |
| Hunter | 5 |

Every confirmed unarmed hit removes one resilience point.

## NPC combat states

The implemented state subset is:

`active → staggered → downed → dead / drained`

### Active

The NPC can use its existing AI behaviour and can be hit.

### Staggered

A hit briefly stops movement and normal AI. The remaining resilience is shown for less than one second.

### Downed

At zero resilience:

- movement and velocity stop;
- pursuit, sound reaction and witness reporting stop;
- the NPC receives an infinite compatibility stun so existing police, witness and navigation systems ignore it;
- the sprite is flattened and a `DOWN` marker is shown;
- the rooftop thug no longer blocks the police-roof jump;
- the target remains available to the existing drain/kill interaction layer.

Downed NPC recovery is intentionally not implemented yet.

## Tutorial compatibility

The rooftop encounter now teaches the first combat loop:

1. Aim at the thug with the mouse.
2. Left-click until his four resilience points reach zero.
3. Press E to drain him after he is down.

The tutorial's temporary E-based drain remains until Milestone 4 introduces the final right-click drain rules. Before knockdown, the tutorial filters out the drain action.

## Feedback

- A short aim line communicates facing.
- The attack arc changes appearance through windup, active and recovery.
- Remaining resilience pips appear briefly after a hit.
- Downed NPCs have a flattened silhouette, ring and `DOWN` label.
- Combat events are emitted for attack start, hit and entity downed.

## Perception and police compatibility

Punching is classified as mundane violence through the existing action, witness and police systems.

- Police who observe or suffer an assault raise police pressure.
- Civilian and journalist victims enter their witness reaction while still standing.
- Downed victims cannot flee or report.
- Full combat investigation, retaliation and enemy attack behaviour belong to Milestones 3 and 8.

## Automated tests

Run:

```bash
npm test
```

The combat tests cover:

- aim dead-zone retention;
- normalized mouse direction;
- attack hit/miss geometry;
- three-hit civilian knockdown;
- four-hit police knockdown;
- data-driven hunter resilience;
- tutorial control-mode permission for primary attack.

## Known limitations

- Enemy NPCs do not attack the player yet.
- Taking damage does not raise Hunger until Milestone 3.
- Standing targets can still use the legacy E drain outside the specially filtered tutorial path; final rear/downed right-click validation belongs to Milestone 4.
- Punch-specific hearing is not yet emitted through a consolidated perception event; this will be added alongside combat AI/perception integration.
- Combat integration still enters through the Milestone 1 runtime adapter rather than a final core-scene bootstrap.
- Browser-level tests of cursor accuracy, attack timing and the complete tutorial are still required.
