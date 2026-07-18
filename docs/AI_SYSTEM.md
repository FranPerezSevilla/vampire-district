# NPC AI and combat behaviour

_Status: Milestone 8 implementation complete; browser regression and tuning remain pending._

## Purpose

Milestone 8 replaces contradictory combinations of `alarmed`, `chasingPlayer`, `soundReactionTimer`, `reportTarget`, `enemyAttack` and combat flags with one resolved priority state per NPC. Existing systems still own their specialist movement and presentation, but `AiStateSystem` decides which intent is currently allowed to win.

## Authoritative files

- `phaser/src/data/ai.js` — pure states, priorities, recovery rules, police leader/containment selection and hunter prediction.
- `phaser/src/systems/AiStateSystem.js` — runtime state resolution, conflict cancellation, recovery and events.
- `phaser/src/ai/milestone8-runtime.js` — integration with NPC, witness, police, hunter and enemy-attack systems.
- `phaser/src/data/player-combat.js` — police, hunter and rooftop-thug attack definitions.
- `tests/ai.test.js` — pure priority, formation, recovery and prediction coverage.
- `tests/player-damage.test.js` — enemy attack timing and damage coverage.

## Priority model

The resolved order is:

```text
inactive / dead
→ downed
→ being drained
→ staggered
→ attacking
→ chasing
→ fleeing / reporting
→ lured
→ investigating sound
→ searching
→ patrolling
→ idle
```

A higher state suppresses lower behaviour. Examples:

- a downed witness cannot continue toward a report point;
- a staggered civilian retains the intention to report but cannot move until stagger ends;
- a police officer who confirms the player visually drops the heard-only `WTF` reaction;
- an active enemy attack locks movement even if chase movement would otherwise run;
- a dead, hidden or intercepted NPC cannot retain attack, chase or report intent.

Every NPC receives:

```js
npc.ai = {
  state,
  previousState,
  changedAt,
  role,
  intent,
  downedAt,
  recoverAt,
  leaderUntil,
  lastKnownX,
  lastKnownY
};
```

State changes emit `ai:state-changed` as plain data.

## Police combat roles

Police no longer all move to the exact player coordinate.

When one or more officers have confirmed sight:

1. one eligible officer becomes the stable `attacker`;
2. that officer closes to baton distance and is the only officer allowed to start a melee attack;
3. remaining visible officers receive deterministic `contain` positions around the player;
4. soft separation remains active while they move to those positions;
5. if the attacker is downed, unavailable or too far away, leadership passes to the nearest ready officer.

Leader selection is stable for `1450 ms`, unless the officer becomes invalid. Attack cooldown and heard-only reaction state penalize leadership selection.

Containment radius grows with alert level:

| Alert | Containment radius |
|---:|---:|
| 1 | 43 units |
| 2 | 49 units |
| 3 | 55 units |

Search, heat investigation and normal patrol remain separate roles. The existing level-dependent reinforcement counts and helicopter behaviour remain unchanged.

## Civilian and journalist behaviour

Confirmed visual violence creates a reporting intent:

```text
see violence
→ short reaction
→ flee toward best report point
→ report unless interrupted
```

Rules:

- heard-only events still create only orientation and `WTF`;
- a confirmed visual response clears the heard-only marker;
- a hit creates stagger and stops movement;
- the report target and reason survive stagger, so the witness resumes fleeing afterward;
- downing the witness permanently cancels that report;
- being drained, killed, intercepted or hidden also prevents reporting;
- the journalist follows the same witness rules until handled by the mission.

## Rooftop thug

The blocker becomes hostile after the first confirmed player hit. He does not attack during the opening dialogue and does not recover after knockdown.

Baseline retaliation:

| Property | Value |
|---|---:|
| Hunger damage | +8 |
| Start range | 28 |
| Hit range | 24 |
| Windup | 520 ms |
| Active | 150 ms |
| Recovery | 900 ms |
| Cooldown | 650 ms |

The long windup keeps the tutorial readable while introducing the rule that hostile targets can strike back.

## Hunter memory and prediction

Hunters no longer abandon the chase immediately when the player enters shadow.

On confirmed sight, a hunter:

- stores a predicted point `54` units ahead of the current movement direction;
- keeps that memory for `6200 ms`;
- pursues the last known point while direct sight is lost;
- shortens the remaining memory after reaching an empty last-known position;
- falls back to blood tracking, route blocking and church patrol only after memory expires.

A hunter may attack inside shadow while a valid chase memory remains and both entities are on the same layer.

## Downed recovery

Recovery is type-specific:

| Type | Recovery delay | Resilience after rising |
|---|---:|---:|
| Civilian | Never | — |
| Journalist | Never | — |
| Rooftop thug | Never | — |
| Police | 18 s | 2 / 4 |
| Hunter | 24 s | 3 / 5 |

Recovered police return in a brief stagger and rejoin the search. Recovered hunters resume the hunt with refreshed last-known memory. Starting a drain before the timer expires prevents recovery. Killing or completing the drain resolves the NPC permanently.

Recovery emits `combat:entity-recovered`.

## Compatibility rules

- `CombatSystem` remains the owner of player attack timing and NPC resilience.
- `PlayerDamageSystem` remains the owner of enemy attack timing and Hunger damage.
- Only the current police `attacker` role may start a baton attack.
- Hunter and thug attacks reuse the same enemy-melee contract.
- `WitnessSystem` remains the owner of report points and report completion.
- `PoliceSystem` remains the owner of wanted search, reinforcements, arrest and helicopter support.
- `HunterSystem` remains the owner of hunter spawning, blood tracking and route blocks.
- Hearing alone never promotes directly to pursuit or reporting.

## Automated coverage

`tests/ai.test.js` verifies:

- downed/draining priority over attack, chase, report and sound;
- attacking and chasing priority over heard-only investigation;
- visual witness reporting priority over `WTF`;
- permanent civilian/journalist/thug knockdown;
- timed police/hunter recovery and restored resilience;
- stable police attack leadership and deterministic handoff;
- deterministic containment slots;
- hunter pursuit prediction and world-bound clamping;
- slow, low-damage thug retaliation.

## Known limitations

- The integration layer still adapts existing system prototypes; Milestone 10 will fold this into first-class composition.
- Police containment targets do not yet perform full tactical path planning around complex obstacles.
- Hunter prediction uses current movement direction rather than a learned route model.
- Recovery timers and formation distances are tuning baselines.
- Browser smoke testing remains manual.
