# Technical architecture

_Last updated: 2026-07-18_

## 1. Runtime and stack

- Browser runtime.
- Phaser 3 for world rendering, camera, timing, tweens and low-level input.
- DOM/CSS overlay for HUD, dialogue, prompts and result screens.
- Native ES modules.
- Data-driven world, input, movement, traversal and combat definitions.
- Node's built-in test runner with no test dependencies.
- No backend dependency for the current vertical slice.

## 2. Scene ownership

### `GameScene`

Coordinates:

- player/world simulation;
- map and route rendering;
- camera updates;
- one gameplay input-frame consumption point;
- movement and traversal dispatch;
- interactions and powers;
- combat, drain and player-damage updates;
- system update order;
- registry publication for the UI.

### `UIScene`

Owns:

- Hunger/exposure/power HUD;
- mission drawer;
- interaction prompt/menu;
- intro, pause, failure and success modals;
- UI-only keyboard handling while the world is paused.

World input and UI input remain separate. `InputSystem` is authoritative for gameplay actions.

## 3. Current systems

- `InputSystem`
- `CombatSystem`
- `PlayerDamageSystem`
- `DrainSystem`
- `MovementNoiseSystem`
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

Feature modules also provide responsive layout, tutorial flow/copy, dialogue anchoring, objective guidance, city outskirts, police informant behaviour, sensory-awareness patches and the refuge finale.

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
  → Milestone 5 movement migration: Shift quiet, sprint false
  → PlayerDamageSystem hit-stun filter
  → GameScene dispatches movement/traversal/interactions/powers/combat/drain
  → NPC/police/hunter simulation
  → enemy damage resolution
  → movement-noise update from actual displacement
  → UI registry publication
```

Important frame fields:

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

## 5. Movement architecture

Authoritative files:

- `phaser/src/data/movement.js`
- `phaser/src/data/traversal.js`
- `phaser/src/systems/MovementNoiseSystem.js`
- `phaser/src/movement/milestone5-runtime.js`
- `tests/movement.test.js`

### Speed contract

```js
movementSpeed(playerSpeed, quietHeld)
```

- normal run multiplier: `1.55`;
- quiet multiplier: `0.72`.

Space does not affect speed.

### Traversal contract

Existing world systems still produce route options. `selectTraversalCandidate()` gives deterministic ownership:

1. close and forward committed route;
2. distance;
3. aim angle;
4. route priority;
5. stable ID.

The same selected object drives the world prompt and Space execution.

### Footstep contract

`MovementNoiseSystem` measures actual player displacement instead of raw key state.

```js
{
  mode: "run" | "quiet",
  stepDistance,
  hearingRadius,
  reactionSeconds
}
```

A heard-only footstep turns an eligible NPC, stops it briefly and shows `WTF`. It does not set pursuit/reporting. Already alarmed, chasing, attacking, downed or inactive NPCs are excluded.

`movement:footstep` emits plain data: mode, position, layer, hearing radius and heard-only count.

## 6. Player attack and NPC resilience

Authoritative files:

- `phaser/src/data/combat.js`
- `phaser/src/combat/CombatSystem.js`
- `phaser/src/combat/combat-compatibility.js`
- `tests/combat.test.js`

Player attack:

- mouse-facing direction;
- 10-unit aim dead zone;
- 90 ms windup;
- 110 ms active window;
- 240 ms recovery;
- 32-unit directional arc;
- one damage point;
- per-attack hit-ID set.

NPC resilience:

- civilian/target: 3;
- police/thug: 4;
- hunter: 5.

State subset:

```text
active → staggered → downed → dead / drained
```

Downed NPCs stop movement, pursuit and reporting and remain valid drain targets.

## 7. Enemy attacks and damage-to-Hunger

Authoritative files:

- `phaser/src/data/player-combat.js`
- `phaser/src/combat/PlayerDamageSystem.js`
- `tests/player-damage.test.js`

Police attacks reuse `chasingPlayer`; hunters reuse active hunt intent.

Confirmed damage:

```text
enemy active window
  → stored arc/range validation
  → invulnerability check
  → current punch/drain interrupted
  → Hunger increased
  → hit stun + invulnerability
  → player:damaged / hunger:changed events
  → frenzy failure at 100
```

Baselines:

- police: Hunger +12;
- hunter: Hunger +20;
- hit stun: 260 ms;
- invulnerability: 720 ms;
- critical: 85;
- frenzy: 100.

## 8. Drain architecture

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

The right button uses pressed state to start and held state to maintain. Release, movement, damage or invalid geometry cancels.

Visual witnesses retain veil behaviour. Heard-only NPCs turn and show `WTF` without automatic pursuit.

## 9. Mission completion architecture

Handling the journalist sets mission step 3 and the refuge marker. It does not publish success.

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

## 10. Perception architecture

Current perception is distributed between witness, sensory-awareness, drain and movement systems.

Shared rule:

- confirmed sight promotes NPC-type response;
- hearing alone creates temporary orientation/investigation;
- hearing alone does not automatically pursue or report.

Target consolidation remains a future `PerceptionSystem` with explicit `canSee()` and `canHear()` queries.

## 11. Events

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

Events carry identifiers and values rather than system instances.

## 12. Testing

Run:

```bash
npm test
```

Pure coverage includes:

- input gating and reset behaviour;
- responsive pointer conversion;
- aim and melee geometry;
- resilience/downed transitions;
- enemy attack phases and damage thresholds;
- invulnerability overlap rejection;
- drain eligibility and target priority;
- default/quiet movement speeds;
- deterministic traversal scoring.

Browser regression remains manual and is described in `docs/MILESTONE_1_REGRESSION.md` through `docs/MILESTONE_5_REGRESSION.md`.

## 13. Technical debt

- `movement-input-adapter.js` should be folded into `InputSystem`.
- `input-runtime.js` and `milestone5-runtime.js` adapt legacy scene methods.
- `combat-compatibility.js` shields new downed behaviour from older marker/violence paths.
- AI still uses competing flags instead of one priority state machine.
- Perception is not yet consolidated.
- Browser smoke tests are not automated.

Rules for new work:

- no new raw-input path;
- no duplicate damage or drain implementation;
- new geometry/state rules require pure tests;
- cross-system behaviour should prefer plain-data events;
- adapter debt must be removed in Milestone 10.

## 14. Migration plan

1. ✅ Central input frame.
2. ✅ Mouse aim, unarmed combat and resilience.
3. ✅ Enemy attacks and damage-to-Hunger.
4. ✅ Contextual right-click drain.
5. ✅ Default run, Shift quiet movement and traversal-only Space.
6. Validate Milestones 1–5 in-browser.
7. Convert streetlights to damageable props.
8. Add weapons and wheel cycling.
9. Implement explicit AI priority states.
10. Consolidate adapters and add browser smoke tests.
