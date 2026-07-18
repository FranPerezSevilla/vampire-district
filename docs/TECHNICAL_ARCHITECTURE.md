# Technical architecture

_Last updated: 2026-07-18_

## 1. Runtime and stack

- Browser runtime.
- Phaser 3 for world rendering, cameras, tweens, scene timing and low-level input.
- DOM/CSS overlay for HUD, dialogue, prompts and modals.
- Native ES modules.
- Data-driven JavaScript modules for world, input, combat and drain rules.
- Node's built-in test runner for pure logic.
- No backend dependency for the current vertical slice.

## 2. Scene model

### `BootScene`

Owns startup required by the Phaser scene list.

### `GameScene`

Coordinates:

- player and world state;
- map/layer rendering;
- camera updates;
- one gameplay input-frame consumption point;
- traversal and E interaction dispatch;
- player attacks, enemy attacks and contextual draining;
- mission and simulation-system updates;
- registry publication for the UI.

### `UIScene`

Owns:

- Hunger and police HUD;
- mission panel;
- power dock;
- prompts and interaction menu;
- intro, pause, failure, frenzy and success modals;
- UI-only keyboard navigation.

World input and UI input remain separate. `InputSystem` is authoritative for gameplay; `UIScene` owns UI actions while the game scene is paused or blocked.

## 3. Current first-class systems

- `InputSystem`
- `CombatSystem`
- `PlayerDamageSystem`
- `DrainSystem`
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

Feature modules also provide tutorial flow, responsive layout, objective guidance, police-informant behaviour, sensory awareness, city outskirts, dialogue layout, mission-return finale and final-report presentation.

## 4. Input architecture

### Authoritative files

- `phaser/src/input/actions.js`
- `phaser/src/input/InputSystem.js`
- `phaser/src/input/input-runtime.js`
- `phaser/src/input/tutorial-input-adapter.js`
- `phaser/src/utils/geometry.js`

`phaser/src/movement-controls.js` is a thin bootstrap/UI compatibility module. It no longer decides gameplay actions.

### Frame lifecycle

```text
DOM / Phaser keyboard, pointer and wheel events
  → InputSystem.beginFrame()
  → control-mode and world-lock gating
  → PlayerDamageSystem filters actions during hit stun
  → one gameplay frame
  → powers / player combat / contextual drain
  → traversal and E interaction dispatch
  → NPC, police, hunter and witness simulation
  → enemy attack resolution
  → mission update
  → UI registry publication
```

Important fields:

```js
{
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
  bloodSensePressed
}
```

### Action ownership

- `GameScene`: Space traversal and E interaction dispatch.
- `PowersSystem`: Q/R/F abstract actions.
- `CombatSystem`: aim and left-click attack.
- `DrainSystem`: aim plus right-button pressed/held state.
- `PlayerDamageSystem`: temporary action suppression during hit stun.
- `InteractionSystem`: abstract menu actions.

No active gameplay system queries raw mouse buttons or raw Space/E/Q/R/F independently.

### Control modes

| Mode | World actions |
|---|---|
| `full` | All current/future world actions. |
| `movement` | Move, aim and traverse. |
| `drain` | Move, aim, punch, right-click drain, traverse and limited tutorial interaction. |
| `tip` | Move, aim, traverse and clue interaction. |
| `locked` | Aim tracking only; no world action. |

### World locks and lifecycle

World input is suppressed by:

- UI pause/result state;
- task reveal;
- tutorial/cinematic locks;
- scene transitions where appropriate.

Held and edge input resets on:

- browser blur;
- document visibility loss;
- pointer leaving the canvas;
- real lock-state changes;
- scene shutdown.

### Pointer mapping

```text
browser client coordinate
  → canvas bounding-rect normalization
  → internal game coordinate
  → camera world view + zoom
  → aimWorld
```

`CombatSystem` and `DrainSystem` consume the same `aimWorld`; no second viewport calculation exists.

## 5. Player attack architecture

### Files

- `phaser/src/data/combat.js`
- `phaser/src/combat/CombatSystem.js`
- `phaser/src/combat/combat-compatibility.js`
- `tests/combat.test.js`

### Unarmed contract

```js
{
  id: "unarmed",
  damage: 1,
  range: 32,
  halfAngle: 0.62,
  windupMs: 90,
  activeMs: 110,
  recoveryMs: 240,
  staggerMs: 320
}
```

The direction is captured at attack start. Each attack owns a target-ID set, preventing duplicate damage during one active window.

### NPC combat state

```js
npc.combat = {
  maxResilience,
  resilience,
  state: "active", // active | staggered | downed | dead | drained
  staggerUntil: 0,
  feedbackUntil: 0,
  lastHitBy: null
};
```

Resilience:

- civilian/target: 3;
- police/thug: 4;
- hunter: 5.

Downed NPCs receive a compatibility stun so patrol, pursuit and reporting stop. They remain valid drain/kill targets.

## 6. Enemy attack and player-damage architecture

### Files

- `phaser/src/data/player-combat.js`
- `phaser/src/combat/PlayerDamageSystem.js`
- `tests/player-damage.test.js`

### Current enemy attacks

Police baton:

```js
{
  hungerDamage: 12,
  startRange: 29,
  range: 25,
  windupMs: 300,
  activeMs: 120,
  recoveryMs: 620,
  cooldownMs: 260
}
```

Hunter heavy strike:

```js
{
  hungerDamage: 20,
  startRange: 34,
  range: 29,
  windupMs: 430,
  activeMs: 150,
  recoveryMs: 880,
  cooldownMs: 420
}
```

Police attack only while already chasing. Hunters attack only while active, hunting and outside shadow. Richer combat AI remains Milestone 8 work.

### Player damage state

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

Baselines:

- hit stun: 260 ms;
- invulnerability: 720 ms;
- feedback: 620 ms;
- critical: 85 Hunger;
- frenzy failure: 100 Hunger.

### Damage flow

```text
enemy active window confirms hit
  → invulnerability check
  → current punch/drain cancelled
  → Hunger increased and capped at 100
  → hit stun and invulnerability applied
  → player:damaged + hunger:changed
  → feedback / possible frenzy failure
```

## 7. Contextual drain architecture

### Files

- `phaser/src/data/drain.js`
- `phaser/src/combat/DrainSystem.js`
- `phaser/src/systems/FeedingSystem.js`
- `tests/drain.test.js`

### Pure eligibility

`evaluateDrainCandidate()` checks:

- type and entity availability;
- current layer;
- 30-unit start range;
- aim alignment;
- clear geometry;
- downed state or unaware rear approach.

Standing targets are rejected when alarmed, chasing, attacking or reporting. An active hunter in hunt mode is considered aware.

### Selection

```text
valid candidates
  → downed priority
  → rat priority
  → standing rear-target priority
  → distance
  → aim angle
  → small mission-target tie break
```

### Channel

```text
right-button pressed + held
  → select candidate
  → FeedingSystem.startDrain()
  → hold target and advance progress
  → cancel on release / movement / damage / invalid geometry / invalid distance
  → completion lowers Hunger and resolves target
```

Start range is 30 units; break range is 38 units.

### Perception

- Visual witnesses continue through `WitnessSystem.watchActiveDrain()`.
- Police visual detection continues through the action-resolution path.
- Heard-only NPCs receive the existing sound-reaction fields and `WTF` presentation.
- Hearing alone does not create pursuit/reporting.

This hearing bridge is intentionally temporary until sensory code becomes a consolidated `PerceptionSystem`.

## 8. Events

Implemented plain-data events include:

- `combat:attack-started`
- `combat:hit`
- `combat:entity-downed`
- `combat:enemy-attack-started`
- `player:damaged`
- `feeding:right-click-started`
- `feeding:started`
- `feeding:cancelled`
- `feeding:completed`
- `hunger:changed`

Events carry identifiers and values, not system instances.

## 9. Pure helper coverage

Current pure helpers cover:

- vector normalization, dot products and angles;
- point-in-cone checks;
- CSS/client to game coordinates;
- screen to camera-world conversion;
- aim dead-zone retention;
- player melee hit geometry;
- NPC resilience transitions;
- enemy attack phases and hit geometry;
- player hit stun/invulnerability thresholds;
- drain rear/downed eligibility;
- drain awareness rejection;
- drain target priority.

## 10. Testing strategy

Run:

```bash
npm test
```

Manual browser validation remains required for:

- full opening tutorial;
- pointer accuracy at multiple sizes/qualities;
- punch cadence and hit counts;
- police/hunter telegraphs and dodging;
- simultaneous attackers and invulnerability;
- right-click rear/downed eligibility;
- release/movement/damage drain cancellation;
- visual versus heard-only drain reactions;
- journalist resolution and refuge finale;
- pause/dialogue/result ownership.

## 11. Current technical debt

- `input-runtime.js` still adapts legacy scene methods instead of being composed directly in `GameScene`.
- `combat-compatibility.js` shields the new downed state from legacy markers/dispatch.
- Enemy attacks use existing chase/hunt flags rather than one final AI state machine.
- Hunger mutation remains inside `FeedingSystem` rather than a dedicated resource service.
- Drain hearing uses existing sensory flags through a runtime bridge.
- Legacy E stun/kill actions remain outside the final control contract.
- Browser smoke tests are manual.

Rules for future work:

- no new raw-input paths;
- no duplicate damage or drain eligibility implementations;
- pure state/geometry logic requires tests;
- cross-system behaviour should prefer plain events/data;
- adapter debt must be removed during consolidation.

## 12. Migration plan

1. **Implemented:** central action frame and responsive pointer mapping.
2. **Implemented:** Space/E/Q/R/F ownership centralized.
3. **Implemented:** mouse aim, unarmed timing and melee arc.
4. **Implemented:** resilience, stagger and downed state.
5. **Implemented:** police/hunter melee and telegraphs.
6. **Implemented:** player hit stun, invulnerability and damage-to-Hunger.
7. **Implemented:** right-click rear/downed drain eligibility and channel.
8. Validate Milestones 1–4 in-browser.
9. Remove Space sprint compatibility and add deterministic traversal scoring.
10. Convert streetlights into damageable props.
11. Add `WeaponSystem` and wheel cycling.
12. Consolidate adapters into explicit core ownership.
