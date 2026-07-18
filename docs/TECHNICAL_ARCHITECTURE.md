# Technical architecture

_Last updated: 2026-07-18_

## 1. Runtime and stack

- Browser runtime.
- Phaser 3 for world rendering, cameras, tweens, scene timing and low-level keyboard/pointer input.
- DOM/CSS overlay for HUD, dialogue, prompts and modals.
- Native ES modules loaded directly by the browser.
- Data-driven world, input and combat definitions in JavaScript modules.
- Node's built-in test runner for pure input, geometry and combat tests.
- No backend dependency for the current vertical slice.

## 2. Scene model

### `BootScene`

Owns startup/bootstrap work required by the Phaser scene list.

### `GameScene`

Owns the playable world and coordinates:

- player container and movement application;
- map and route rendering;
- camera updates;
- one gameplay input-frame consumption point;
- traversal and interaction dispatch;
- player and enemy combat updates;
- layer switching;
- registry publication for the UI.

### `UIScene`

Owns the DOM-backed presentation layer:

- Hunger and police HUD;
- power dock;
- mission panel;
- interaction prompt/menu;
- intro, pause, failure and success modals;
- UI-only keyboard navigation.

World input and UI input are intentionally separate. `InputSystem` is authoritative for gameplay; `UIScene` owns menu/help/mission behaviour while the game scene is paused.

## 3. Current systems

- `InputSystem`
- `CombatSystem`
- `PlayerDamageSystem`
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

Feature modules also provide tutorial flow, responsive layout, objective guidance, police-informant behaviour, city outskirts, dialogue layout, mission-return finale, final-report presentation and sensory awareness.

## 4. Input architecture

### Authoritative files

- `phaser/src/input/actions.js`
- `phaser/src/input/InputSystem.js`
- `phaser/src/input/input-runtime.js`
- `phaser/src/input/tutorial-input-adapter.js`
- `phaser/src/utils/geometry.js`

`phaser/src/movement-controls.js` is a thin bootstrap and HUD-copy compatibility module. It does not decide gameplay actions.

### Frame lifecycle

```text
DOM / Phaser keyboard, pointer and wheel events
  → InputSystem.beginFrame()
  → held and pressed state
  → control-mode and world-lock gating
  → one frame snapshot
  → PlayerDamageSystem filters actions during hit stun
  → GameScene dispatches traversal, interaction, powers and player combat
  → NPC/police/hunter simulation updates
  → PlayerDamageSystem resolves hostile melee
  → GameScene publishes presentation state
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

- `GameScene` owns Space traversal dispatch.
- `GameScene` owns E interaction dispatch.
- `PowersSystem` receives Q/R/F actions.
- `CombatSystem` receives aim and primary-attack actions.
- `PlayerDamageSystem` may suppress gameplay actions while the player is hit-stunned.
- `InteractionSystem` receives abstract menu actions.
- No gameplay system queries raw mouse buttons or Space/E/Q/R/F independently.

### Control modes

| Mode | World actions |
|---|---|
| `full` | All current and future world actions. |
| `movement` | Move, aim and traverse. |
| `drain` | Move, aim, punch, traverse and temporary tutorial E drain. |
| `tip` | Move, aim, traverse and clue interaction. |
| `locked` | No world action; aim position may continue updating. |

### Hit-stun frame filter

`PlayerDamageSystem.filterFrame()` creates a temporary filtered frame while hit stun is active.

Suppressed fields:

- movement intent and sprint;
- primary attack and drain;
- traversal and E interaction;
- weapon step;
- Dash, Whisper and Blood Sense;
- debug layer changes.

Aim coordinates and UI-menu fields remain available. Raw keyboard state is not permanently disabled, so controls resume after the short stun without requiring a reload.

### World locks

World actions are suppressed when:

- `uiPaused` is set;
- `taskRevealActive` is set;
- the tutorial/cinematic disables world input;
- result or failure UI pauses the game.

Held and edge input resets on:

- window blur;
- document visibility loss;
- pointer leaving the canvas;
- real world-lock transitions;
- scene shutdown.

### Pointer mapping

```text
client pointer
  → canvas bounding-rect normalization
  → internal game coordinate
  → camera world-view + zoom conversion
  → aimWorld
```

The same `aimWorld` value is consumed by player combat. Render quality and CSS display size do not create a second aim calculation.

## 5. Player attack architecture

### Authoritative files

- `phaser/src/data/combat.js`
- `phaser/src/combat/CombatSystem.js`
- `phaser/src/combat/combat-compatibility.js`
- `tests/combat.test.js`

### `CombatSystem` responsibilities

Implemented:

- derive stable player-facing direction from `aimWorld`;
- retain last direction inside the aim dead zone;
- start unarmed attacks from `primaryPressed`;
- own windup, active and recovery phases;
- resolve directional melee hit geometry;
- prevent duplicate hits per attack;
- initialize and damage NPC resilience;
- apply stagger and downed transitions;
- stop downed NPC movement, pursuit and reporting;
- draw aim, attack-arc, resilience and downed feedback;
- emit plain-data combat events.

### Unarmed attack contract

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

The attack direction is captured when the attack begins. A `Set` of target IDs prevents repeated damage during the active window.

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

Resilience overrides:

- civilian/target: 3;
- police/thug: 4;
- hunter: 5.

Downed NPCs receive an infinite compatibility stun so existing police, witness and navigation systems stop processing them. `combat-compatibility.js` suppresses the legacy `STUNNED` marker while the new `DOWN` presentation is active.

## 6. Enemy attack and player-damage architecture

### Authoritative files

- `phaser/src/data/player-combat.js`
- `phaser/src/combat/PlayerDamageSystem.js`
- `tests/player-damage.test.js`

### `PlayerDamageSystem` responsibilities

- derive attack eligibility from existing police chase and hunter hunt intent;
- create enemy windup, active and recovery phases;
- capture attacker position and direction at attack start;
- lock the attacker visually while the attack resolves;
- validate player position against stored range and arc;
- apply Hunger damage only once per active window;
- interrupt current player attack or drain;
- apply player hit stun and invulnerability;
- filter gameplay actions during hit stun;
- emit `player:damaged` and `hunger:changed` events;
- trigger frenzy failure at the configured Hunger limit;
- draw enemy telegraphs and player damage feedback.

### Enemy attack contract

Police baseline:

```js
{
  id: "police_baton",
  hungerDamage: 12,
  startRange: 29,
  range: 25,
  halfAngle: 0.90,
  windupMs: 300,
  activeMs: 120,
  recoveryMs: 620,
  cooldownMs: 260
}
```

Hunter baseline:

```js
{
  id: "hunter_heavy_strike",
  hungerDamage: 20,
  startRange: 34,
  range: 29,
  halfAngle: 0.96,
  windupMs: 430,
  activeMs: 150,
  recoveryMs: 880,
  cooldownMs: 420
}
```

### Enemy attack lifecycle

```text
existing AI enters chase/hunt intent
  → enemy reaches start range
  → direction and attacker position captured
  → windup telegraph
  → active window attempts one hit
  → range + forward-arc validation
  → recovery
  → per-attacker cooldown
```

The active window is spent after one attempt, even when the player dodges or invulnerability rejects the damage.

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

Baseline values:

- hit stun: 260 ms;
- invulnerability: 720 ms;
- damage feedback: 620 ms;
- critical threshold: 85 Hunger;
- frenzy threshold: 100 Hunger.

### Damage-to-Hunger flow

```text
enemy active window confirms hit
  → invulnerability check
  → player punch/drain interrupted
  → Hunger increased and capped at 100
  → hit stun + invulnerability applied
  → player:damaged event
  → hunger:changed event
  → HUD/world feedback
  → frenzy failure when Hunger reaches 100
```

Hunger remains the single player attrition resource. No conventional health bar is introduced.

### AI scope boundary

Milestone 3 does not implement a final combat state machine.

- Police attack only while `chasingPlayer` is already true.
- Hunters attack only while active, hunting and outside shadow.
- Civilians, the journalist and rooftop thug do not autonomously attack.
- Richer retaliation, recovery and priority arbitration remain Milestone 8 work.

## 7. Pure geometry and state helpers

Implemented helpers include:

- vector normalization;
- dot products and angles;
- point-in-cone checks;
- browser-client to internal-game mapping;
- internal-screen to camera-world mapping;
- directional candidate scoring;
- world aim with dead-zone retention;
- player melee-arc hit query;
- data-driven NPC resilience creation;
- resilience-to-downed transition;
- player hit-stun and invulnerability state transition;
- enemy attack phase selection;
- enemy range/arc hit validation;
- critical and frenzy threshold calculation.

Pure helpers do not depend on Phaser globals and run under Node tests.

Future helpers:

- line/segment obstruction;
- rear-drain eligibility;
- drain-target selection;
- deterministic traversal selection.

## 8. Combat events

Implemented plain-data events:

- `combat:attack-started`
- `combat:hit`
- `combat:entity-downed`
- `combat:enemy-attack-started`
- `player:damaged`
- `hunger:changed`

Planned events:

- `combat:entity-killed`
- `noise:emitted`
- `weapon:changed`
- `traversal:started`
- `traversal:completed`

Events carry identifiers and values, not system instances.

## 9. Drain flow

Planned for Milestone 4:

```text
right-button action pressed/held
  → target query
  → downed target: any approach angle
  → standing unaware target: rear arc only
  → FeedingSystem starts channel
  → movement/damage/invalid geometry cancels
  → completion reduces Hunger and resolves target
```

The current rooftop tutorial temporarily uses E after the thug is downed. Milestone 3 already guarantees that confirmed enemy damage cancels an active drain.

## 10. Perception integration

Current punches use the existing mundane-violence and police-pressure paths. Enemy attacks currently use visual telegraphs and damage events but do not yet emit a consolidated first-class noise event.

The target perception API remains:

- `canSee(observer, subject, eventConfig)`
- `canHear(observer, soundEvent)`

Planned sound event:

```js
{
  kind: "melee" | "gunshot" | "roofDrop" | "streetlightBreak",
  x,
  y,
  layer,
  radius,
  sourceEntityId,
  severity
}
```

Hearing creates investigate/`WTF`; confirmed sight promotes the response according to NPC type.

## 11. Damageable props and weapons

Streetlights will become damageable entities consumed by the same hit-query infrastructure.

`WeaponSystem` will own:

- inventory and equipped weapon;
- `weaponStep` consumption;
- weapon data lookup;
- ammo/reload where needed;
- conversion from primary input into a `CombatSystem` attack request;
- wheel capture while weapon cycling is active.

## 12. Testing strategy

Run:

```bash
npm test
```

Current automated coverage includes:

- input control-mode gating;
- real lock transitions and stuck-input prevention;
- responsive pointer conversion;
- vector/cone geometry;
- aim dead-zone retention;
- player melee arc hit/miss;
- civilian, police and hunter resilience;
- downed-state damage protection;
- enemy attack phase timing;
- enemy range/arc validation;
- police and hunter damage differences;
- hit stun and invulnerability timing;
- overlapping damage rejection;
- critical and frenzy thresholds.

Manual browser validation remains required for:

- complete opening tutorial and refuge finale;
- police chase-to-attack behaviour;
- hunter attack behaviour;
- dodging during telegraphs;
- simultaneous attackers and invulnerability;
- control recovery after hit stun;
- drain interruption;
- frenzy failure;
- aim and telegraphs before/after resizing;
- Low and Ultra render quality;
- narrow and desktop viewports;
- pause/dialogue/result ownership.

## 13. Current technical debt

- `input-runtime.js` still adapts legacy scene methods rather than being composed directly inside the original `GameScene` source.
- `combat-compatibility.js` temporarily shields the new downed state from legacy marker rendering and duplicate violence dispatch.
- Enemy attacks temporarily lock/restore NPC positions around the existing police/hunter updates instead of using one final AI combat state machine.
- Hunger mutation still lives on the existing `FeedingSystem` resource rather than a dedicated resource service.
- Combat noise is not yet a first-class perception event.
- Browser smoke tests are still manual.

Rules for future work:

- no new raw-input path;
- no duplicate player or NPC damage implementation outside the combat systems;
- new geometry/state logic requires pure tests;
- new cross-system behaviour should prefer events and plain data;
- adapter debt must be documented and removed during consolidation.

## 14. Migration plan

1. **Implemented:** central action frame and responsive pointer mapping.
2. **Implemented:** Space/E/Q/R/F ownership centralized.
3. **Implemented:** mouse aim, unarmed attack timing and melee arc.
4. **Implemented:** resilience, stagger and downed state.
5. **Implemented:** police/hunter enemy melee requests and telegraphs.
6. **Implemented:** player hit stun, invulnerability and damage-to-Hunger.
7. Validate Milestones 1–3 in-browser.
8. Move drain validation to right-click rear/downed queries.
9. Remove Space sprint compatibility and add deterministic traversal scoring.
10. Convert streetlights into damageable props.
11. Add `WeaponSystem` and wheel cycling.
12. Consolidate remaining adapters into explicit bootstrap/core ownership.
