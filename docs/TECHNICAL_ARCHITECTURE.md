# Technical architecture

_Last updated: 2026-07-18_

## 1. Runtime and stack

- Browser runtime with Phaser 3.
- DOM/CSS overlay for HUD, dialogue, prompts and result screens.
- Native ES modules.
- Data-driven world, input, movement, traversal, combat, drain and prop definitions.
- Node's built-in test runner with no test dependencies.
- No backend dependency for the current vertical slice.

## 2. Scene ownership

### `GameScene`

Coordinates:

- player/world simulation and rendering;
- camera and map layers;
- one gameplay input-frame consumption point;
- movement, traversal, interactions and powers;
- player combat, draining, enemy damage and world-prop damage;
- system update order and UI registry publication.

### `UIScene`

Owns:

- Hunger/exposure/power HUD;
- mission drawer and interaction presentation;
- intro, pause, failure and success modals;
- UI-only keyboard handling while world input is paused.

`InputSystem` remains authoritative for all world actions.

## 3. Current systems

- `InputSystem`
- `CombatSystem`
- `PlayerDamageSystem`
- `DrainSystem`
- `MovementNoiseSystem`
- `PropDamageSystem`
- `NpcSystem`
- `PoliceSystem`
- `WitnessSystem`
- `MissionSystem`
- `FeedingSystem`
- `ExposureSystem`
- `PowersSystem`
- `EvidenceSystem`
- `HunterSystem`
- `InteractionSystem`
- `TransitionSystem`

Feature modules also provide responsive layout, tutorial flow/copy, dialogue anchoring, objective guidance, city outskirts, police-informant behaviour, sensory-awareness bridges and the refuge finale.

## 4. Input architecture

Authoritative files:

- `phaser/src/input/actions.js`
- `phaser/src/input/InputSystem.js`
- `phaser/src/input/movement-input-adapter.js`
- `phaser/src/input/input-runtime.js`
- `phaser/src/input/tutorial-input-adapter.js`
- `phaser/src/utils/geometry.js`

Frame lifecycle:

```text
browser / Phaser input
  → InputSystem.beginFrame()
  → control-mode and world-lock gating
  → Shift quiet movement / obsolete sprint neutralization
  → PlayerDamageSystem hit-stun filter
  → GameScene dispatches movement/traversal/interactions/powers/combat/drain
  → CombatSystem resolves NPCs and PropDamageSystem resolves world props
  → NPC/police/hunter simulation and enemy damage
  → MovementNoiseSystem measures actual displacement
  → UI registry publication
```

Important fields:

```js
{
  move,
  hasMovementIntent,
  quietHeld,
  sprintHeld: false,
  aimWorld,
  primaryPressed,
  primaryHeld,
  drainPressed,
  drainHeld,
  traversePressed,
  interactPressed,
  weaponStep,
  dashPressed,
  whisperPressed,
  bloodSensePressed
}
```

No active gameplay feature added after Milestone 1 reads raw Space/E/Q/R/F or mouse buttons.

## 5. Movement and traversal

Authoritative files:

- `phaser/src/data/movement.js`
- `phaser/src/data/traversal.js`
- `phaser/src/systems/MovementNoiseSystem.js`
- `phaser/src/movement/milestone5-runtime.js`
- `tests/movement.test.js`

Speed contract:

- normal run multiplier: `1.55`;
- quiet multiplier: `0.72`;
- Space does not affect speed.

Traversal candidate order:

1. close and forward committed route;
2. distance;
3. aim angle;
4. route priority;
5. stable ID.

Footsteps follow actual displacement. Ordinary NPCs only hear running inside the short 42-unit range and ignore quiet footsteps. Police and hunters retain enhanced hearing. Heard-only footsteps produce orientation and `WTF`, not automatic pursuit/reporting.

## 6. Player attack and NPC resilience

Authoritative files:

- `phaser/src/data/combat.js`
- `phaser/src/combat/CombatSystem.js`
- `phaser/src/combat/combat-compatibility.js`
- `tests/combat.test.js`

Unarmed contract:

```js
{
  damage: 1,
  range: 32,
  halfAngle: 0.62,
  windupMs: 90,
  activeMs: 110,
  recoveryMs: 240
}
```

Each attack stores origin/direction and owns a `hitIds` set. NPC resilience is civilian/target 3, police/thug 4 and hunter 5. The state subset is:

```text
active → staggered → downed → dead / drained
```

Downed NPCs stop movement, pursuit and reporting and remain valid drain targets.

## 7. Damageable world props

Authoritative files:

- `phaser/src/data/props.js`
- `phaser/src/systems/PropDamageSystem.js`
- `phaser/src/world/milestone6-runtime.js`
- `tests/props.test.js`

Each district light becomes a streetlight prop with one durability point and a 7-unit hit radius.

```text
CombatSystem active window
  → NPC hit query
  → PropDamageSystem hit query using the same origin/direction/range/arc
  → per-attack prop:<id> duplicate protection
  → durability damage
  → brokenLights world state
  → light removal + shadow creation + feedback/perception events
```

`GameScene.collectInteractions()` is filtered so E no longer exposes `breakLight`. The older core method remains unreachable compatibility debt.

A broken streetlight reuses the existing map rules:

- `currentLight()` excludes its ID;
- `currentShadowAt()` returns the circular broken-light shadow;
- redraws preserve the state through `brokenLights`.

## 8. Enemy attacks and damage-to-Hunger

Authoritative files:

- `phaser/src/data/player-combat.js`
- `phaser/src/combat/PlayerDamageSystem.js`
- `tests/player-damage.test.js`

Police attacks reuse `chasingPlayer`; hunters reuse hunt intent. Confirmed damage interrupts punch/drain, raises Hunger, applies 260 ms hit stun and 720 ms invulnerability, and causes frenzy failure at 100 Hunger.

Baselines:

- police: Hunger +12;
- hunter: Hunger +20;
- critical: 85;
- frenzy: 100.

## 9. Drain architecture

Authoritative files:

- `phaser/src/data/drain.js`
- `phaser/src/combat/DrainSystem.js`
- `phaser/src/systems/FeedingSystem.js`
- `tests/drain.test.js`

Eligibility:

- downed: any side;
- rat: direct;
- standing human: unaware rear arc;
- all require range, aim and clear geometry.

Right-button pressed state starts and held state maintains. Release, movement, damage or invalid geometry cancels.

## 10. Mission completion

```text
journalist handled
  → return-to-refuge objective
  → player reaches refuge
  → world locked
  → sire approval dialogue
  → dialogue dismissed
  → mission completed
  → final report modal
```

Authoritative feature: `phaser/src/mission-return-finale.js`.

## 11. Perception architecture

Perception remains distributed between witness, sensory-awareness, drain, movement and prop systems.

Shared rule:

- confirmed sight promotes the NPC-type response;
- hearing alone creates temporary orientation/`WTF`;
- hearing alone does not automatically pursue or report.

Streetlight break uses the existing `breakLight` sensory profile. Visual witnesses react according to type; heard-only NPCs turn toward the break.

Target consolidation remains a future `PerceptionSystem` with explicit `canSee()` and `canHear()` queries.

## 12. Events

Implemented plain-data events include:

- `combat:attack-started`
- `combat:hit`
- `combat:entity-downed`
- `combat:enemy-attack-started`
- `player:damaged`
- `hunger:changed`
- `feeding:started`
- `feeding:cancelled`
- `feeding:completed`
- `feeding:right-click-started`
- `movement:footstep`
- `prop:damaged`
- `prop:broken`
- `noise:emitted`

Events carry identifiers and values rather than system instances.

## 13. Testing

Run:

```bash
npm test
```

Pure coverage includes:

- input gating/reset and pointer conversion;
- aim, melee geometry and resilience;
- enemy attack phases, damage and invulnerability;
- drain eligibility and priority;
- movement speed/hearing tiers and traversal scoring;
- prop hit/miss geometry, durability and repeated-damage protection.

Browser regression remains manual and is described in `docs/MILESTONE_1_REGRESSION.md` through `docs/MILESTONE_6_REGRESSION.md`.

## 14. Technical debt

- `movement-input-adapter.js` should be folded into `InputSystem`.
- `input-runtime.js`, `milestone5-runtime.js` and `milestone6-runtime.js` adapt legacy scene methods.
- `combat-compatibility.js` shields new downed behaviour from older paths.
- Prop damage currently patches the player attack resolution instead of being first-class composition.
- AI still uses competing flags instead of one priority state machine.
- Perception is not yet consolidated.
- Browser smoke tests are not automated.

Rules for new work:

- no new raw-input path;
- no duplicate NPC, player or prop damage implementations;
- weapons must reuse the current attack and prop contracts;
- new geometry/state rules require pure tests;
- cross-system behaviour should prefer plain-data events;
- adapter debt must be removed in Milestone 10.

## 15. Migration plan

1. ✅ Central input frame.
2. ✅ Mouse aim, unarmed combat and resilience.
3. ✅ Enemy attacks and damage-to-Hunger.
4. ✅ Contextual right-click drain.
5. ✅ Default run, Shift quiet movement and traversal-only Space.
6. ✅ Damageable streetlights and reusable prop damage.
7. Validate Milestones 1–6 in-browser.
8. Add weapons and wheel cycling on shared NPC/prop contracts.
9. Implement explicit AI priority states.
10. Consolidate adapters and add browser smoke tests.
