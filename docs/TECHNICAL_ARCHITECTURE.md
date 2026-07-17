# Technical architecture

_Last updated: 2026-07-17_

## 1. Runtime and stack

- Browser runtime.
- Phaser 3 for world rendering, cameras, tweens, scene timing and low-level keyboard/pointer input.
- DOM/CSS overlay for HUD, dialogue, prompts and modals.
- Native ES modules loaded directly by the browser.
- Data-driven world and combat definitions in JavaScript modules.
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
- system updates;
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

Feature modules also provide tutorial flow, responsive layout, objective guidance, police-informant behaviour, city outskirts, dialogue layout, final-report presentation and sensory awareness.

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
  → GameScene dispatches traversal, interaction, powers and combat
  → simulation systems update
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

### World locks

World actions are suppressed when:

- `uiPaused` is set;
- `taskRevealActive` is set;
- the tutorial/cinematic disables world input.

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

The same `aimWorld` value is consumed by `CombatSystem`. Render quality and CSS display size do not create a second aim calculation.

## 5. Combat architecture

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

Future responsibilities:

- receive weapon attack requests;
- validate enemy attacks against the player;
- apply player hit stun and invulnerability;
- emit player-damage and combat-noise events;
- coordinate final right-click drain target queries.

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

State priority used by current compatibility:

1. dead / drained / hidden;
2. downed;
3. active drain victim;
4. staggered;
5. cinematic/input lock;
6. visual alert/pursuit;
7. witness reporting;
8. heard-only reaction;
9. investigation;
10. patrol/wander.

Downed NPCs receive an infinite compatibility stun so existing police, witness and navigation systems already stop processing them. `combat-compatibility.js` suppresses the legacy `STUNNED` marker while the new `DOWN` presentation is active.

## 6. Pure geometry and state helpers

Implemented helpers include:

- vector normalization;
- dot products and angles;
- point-in-cone checks;
- browser-client to internal-game mapping;
- internal-screen to camera-world mapping;
- directional candidate scoring;
- world aim with dead-zone retention;
- melee-arc hit query;
- data-driven resilience creation;
- resilience-to-downed transition.

Pure helpers do not depend on Phaser globals and run under Node tests.

Future helpers:

- line/segment obstruction;
- rear-drain eligibility;
- drain-target selection;
- deterministic traversal selection.

## 7. Combat events

Implemented plain-data events:

- `combat:attack-started`
- `combat:hit`
- `combat:entity-downed`

Planned events:

- `combat:entity-killed`
- `player:damaged`
- `hunger:changed`
- `noise:emitted`
- `weapon:changed`
- `traversal:started`
- `traversal:completed`

Events carry identifiers and values, not system instances.

## 8. Damage-to-Hunger flow

Planned for Milestone 3:

```text
Enemy attack confirms hit
  → CombatSystem checks invulnerability
  → player hit stun / i-frames
  → player:damaged event
  → Feeding/Hunger system adds Hunger
  → HUD updates
```

Hunger remains the single player attrition resource. No conventional health bar is planned for the first combat pass.

## 9. Drain flow

Planned for Milestone 4:

```text
right-button action pressed/held
  → CombatSystem selects valid target
  → downed target: any approach angle
  → standing unaware target: rear arc only
  → FeedingSystem starts channel
  → movement/damage/invalid geometry cancels
  → completion reduces Hunger and resolves target
```

The current rooftop tutorial temporarily uses E after the thug is downed.

## 10. Perception integration

Current punches use the existing mundane-violence and police-pressure paths. Full combat perception should consolidate into explicit queries:

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
- melee arc hit/miss;
- civilian, police and hunter resilience;
- downed-state damage protection.

Manual browser validation remains required for:

- complete opening tutorial;
- four-hit thug knockdown followed by E drain;
- civilian and police hit counts;
- attack timing and movement lock;
- aim before/after resizing;
- Low and Ultra render quality;
- narrow and desktop viewports;
- pause/dialogue click ownership.

## 13. Current technical debt

- `input-runtime.js` still adapts legacy scene methods rather than being composed directly inside the original `GameScene` source.
- `combat-compatibility.js` temporarily shields the new downed state from legacy marker rendering.
- AI still uses several booleans instead of one final state machine.
- Combat noise is not yet a first-class perception event.
- Browser smoke tests are still manual.

Rules for future work:

- no new raw-input path;
- no duplicate damage implementation outside `CombatSystem`;
- new geometry/state logic requires pure tests;
- new cross-system behaviour should prefer events and plain data;
- adapter debt must be documented and removed during consolidation.

## 14. Migration plan

1. **Implemented:** central action frame and responsive pointer mapping.
2. **Implemented:** Space/E/Q/R/F ownership centralized.
3. **Implemented:** mouse aim, unarmed attack timing and melee arc.
4. **Implemented:** resilience, stagger and downed state.
5. Validate Milestones 1 and 2 in-browser.
6. Convert incoming enemy damage to Hunger.
7. Move drain validation to right-click rear/downed queries.
8. Remove Space sprint compatibility and add deterministic traversal scoring.
9. Convert streetlights into damageable props.
10. Add `WeaponSystem` and wheel cycling.
11. Consolidate remaining adapters into explicit bootstrap/core ownership.
