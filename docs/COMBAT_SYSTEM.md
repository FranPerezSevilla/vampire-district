# Combat system

_Status: Milestones 2 and 3 are implemented; browser regression and feel tuning remain pending._

## Purpose

The combat layer now covers both sides of the first melee loop:

- mouse-directed player punches damage NPC resilience;
- existing hostile police and hunter pursuit can create enemy melee attacks;
- confirmed enemy hits increase player Hunger instead of reducing a separate health bar;
- hit stun and invulnerability prevent overlapping enemies from producing unavoidable damage spikes.

All combat input still comes from the authoritative `InputSystem` frame.

## Files

- `phaser/src/data/combat.js` — NPC combat states, unarmed timing, resilience values and pure player-attack helpers.
- `phaser/src/data/player-combat.js` — player damage state, enemy melee definitions, Hunger thresholds and pure hit/timing helpers.
- `phaser/src/combat/CombatSystem.js` — player facing, punch lifecycle, hit resolution, NPC resilience and knockdown presentation.
- `phaser/src/combat/PlayerDamageSystem.js` — hostile melee lifecycle, player hit stun, invulnerability, Hunger damage and feedback.
- `phaser/src/input/input-runtime.js` — instantiates and updates both combat systems from one frame loop.
- `tests/combat.test.js` — aim, player melee arc and NPC resilience tests.
- `tests/player-damage.test.js` — enemy melee, hit-stun, invulnerability and damage-to-Hunger tests.

## Current controls

- Move with WASD or arrows.
- Aim by moving the mouse over the game canvas.
- Left-click performs one unarmed attack toward the stored aim direction.
- Space and E retain their current compatibility behaviour until later milestones.
- Right-click drain and wheel weapon selection are still collected by `InputSystem` but are not yet consumed by their final systems.

## Player unarmed attack

The baseline punch uses three phases:

| Phase | Duration | Behaviour |
|---|---:|---|
| Windup | 90 ms | Direction is committed; movement is briefly locked. |
| Active | 110 ms | Targets inside the melee arc can be hit once. |
| Recovery | 240 ms | No new interaction or traversal starts until recovery ends. |

The hit shape is a 32-unit forward arc with a half-angle of 0.62 radians. Each attack owns a `hitIds` set, preventing duplicate damage to the same NPC during one active window.

## NPC resilience

| NPC type | Maximum resilience |
|---|---:|
| Civilian | 3 |
| Journalist / normal target | 3 |
| Police | 4 |
| Rooftop thug | 4 |
| Hunter | 5 |

Every confirmed punch removes one point.

The implemented NPC state flow is:

`active → staggered → downed → dead / drained`

At zero resilience, the NPC stops moving, pursuing and reporting, receives a persistent downed presentation and remains available to the existing drain/kill layer. Recovery is intentionally deferred.

## Enemy melee attacks

Milestone 3 reuses hostility already established by AI rather than adding a new full AI state machine.

### Police

A police officer may attack only while its existing police behaviour marks it as actively chasing the player.

| Property | Value |
|---|---:|
| Hunger damage | +12 |
| Start range | 29 units |
| Confirmed-hit range | 25 units |
| Windup | 300 ms |
| Active | 120 ms |
| Recovery | 620 ms |
| Post-attack cooldown | 260 ms |

### Hunter

An active hunter can attack while hunting the player outside shadow.

| Property | Value |
|---|---:|
| Hunger damage | +20 |
| Start range | 34 units |
| Confirmed-hit range | 29 units |
| Windup | 430 ms |
| Active | 150 ms |
| Recovery | 880 ms |
| Post-attack cooldown | 420 ms |

Civilians, the journalist and the rooftop thug do not gain autonomous attack behaviour in this milestone. Type-specific retaliation and richer combat priorities remain part of Milestone 8.

## Enemy hit validation

At attack start, the enemy stores:

- its position;
- a normalized direction toward the player;
- attack timing state;
- whether the active window has already attempted a hit.

The enemy is visually locked in place during the attack. The active window succeeds only when the player remains inside both the stored forward arc and the attack range. Moving away or around the attacker can therefore avoid the hit.

Each enemy attack attempts damage once. A missed active window does not keep checking every frame.

## Player damage state

The player does not have a conventional health value. Confirmed damage increases Hunger.

```js
playerCombatState = {
  hitStunUntil,
  invulnerableUntil,
  feedbackUntil,
  lastDamage,
  lastSourceId,
  lastLabel,
  critical
};
```

Baseline timing:

- hit stun: 260 ms;
- invulnerability: 720 ms;
- floating feedback: 620 ms;
- critical Hunger threshold: 85;
- frenzy/failure threshold: 100.

While hit-stunned, movement, attacks, powers, traversal and E interactions are suppressed through a filtered input frame. Aim can continue updating.

Invulnerability prevents several nearby enemies from stacking damage in the same instant. An enemy whose active window overlaps the invulnerability period spends that attack without applying Hunger again.

## Damage-to-Hunger flow

```text
enemy attack active window
  → stored arc/range validation
  → invulnerability check
  → current player attack/drain interrupted
  → Hunger increased and capped at 100
  → hit stun + invulnerability applied
  → player:damaged and hunger:changed events emitted
  → visual/audio feedback
```

At Hunger 85 or above, the hit feedback becomes critical. At 100 Hunger, the current baseline ends the run with a `FRENZY` failure because the vampire loses control before completing the sire's order.

Feeding still reduces Hunger, so it functions as recovery without introducing another resource bar.

## Presentation

Player attacks provide:

- world-space aim line;
- windup/active/recovery arc;
- temporary resilience pips;
- flattened `DOWN` state.

Enemy attacks provide:

- a coloured telegraph arc during windup;
- a stronger active-window arc;
- distinct police-blue and hunter-orange feedback.

Player damage provides:

- brief camera shake;
- player flicker during invulnerability;
- a red impact ring;
- `HUNGER +N` floating feedback;
- an additional critical ring when Hunger is dangerous.

## Tutorial compatibility

The rooftop tutorial continues to teach:

1. aim at the thug;
2. knock him down with four punches;
3. press E to drain him.

The thug remains non-retaliatory for now, keeping the opening tutorial focused. Final right-click drain eligibility belongs to Milestone 4.

## Automated tests

Run:

```bash
npm test
```

Automated coverage includes:

- aim dead-zone retention;
- player melee hit/miss geometry;
- NPC resilience and downed transitions;
- enemy attack phase timing;
- enemy forward-arc and range validation;
- police and hunter damage differences;
- hit stun and invulnerability timing;
- overlapping attacks not stacking Hunger;
- critical and frenzy thresholds.

## Known limitations

- Enemy melee currently relies on existing police/hunter pursuit intent rather than a unified AI combat state machine.
- The rooftop thug and civilians do not retaliate yet.
- Standing targets can still use the legacy E drain outside the specially filtered tutorial path; final rear/downed right-click validation belongs to Milestone 4.
- Punch and enemy-strike sounds do not yet use a fully consolidated perception-event service.
- Combat integration still enters through the input runtime adapter rather than a final core-scene bootstrap.
- Browser-level tests of dodge timing, simultaneous attackers, cursor accuracy and the complete mission remain required.
