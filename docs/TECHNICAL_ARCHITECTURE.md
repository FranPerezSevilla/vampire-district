# Technical architecture

_Last updated: 2026-07-17_

## 1. Runtime and stack

- Browser runtime.
- Phaser 3 for world rendering, cameras, tweens, scene timing and the low-level keyboard/pointer plugin.
- DOM/CSS overlay for HUD, dialogue, prompts and modals.
- Native ES modules loaded directly by the browser.
- Data-driven world definitions in JavaScript modules.
- Node's built-in test runner for pure logic and input tests.
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
- interaction collection and dispatch;
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

World/gameplay input and UI-only input are intentionally separate. `InputSystem` is authoritative for gameplay; `UIScene` still owns menu/help/mission navigation while the game scene is paused.

## 3. First-class systems

Current world systems:

- `InputSystem`
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

## 4. Milestone 1 input architecture

### Authoritative files

- `phaser/src/input/actions.js`
- `phaser/src/input/InputSystem.js`
- `phaser/src/input/input-runtime.js`
- `phaser/src/input/tutorial-input-adapter.js`
- `phaser/src/utils/geometry.js`

`phaser/src/movement-controls.js` is now a thin bootstrap and HUD-copy compatibility module. It no longer decides gameplay actions.

### Frame lifecycle

```text
DOM / Phaser keyboard, pointer and wheel events
  → InputSystem.beginFrame()
  → raw edge/held state
  → central control-mode and world-lock gating
  → one immutable-style frame snapshot
  → GameScene dispatches traversal, interaction and powers
  → simulation systems update
  → GameScene publishes presentation state
```

A frame contains:

```js
{
  timestamp,
  controlMode,
  worldEnabled,
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
  bloodSensePressed,
  menuUpPressed,
  menuDownPressed,
  menuConfirmPressed,
  menuCancelPressed,
  menuDigitPressed,
  debugLayerPressed
}
```

Combat fields exist before combat implementation so later milestones reuse the same contract.

### Action ownership

- `GameScene` owns Space traversal dispatch.
- `GameScene` owns E interaction dispatch.
- `PowersSystem` receives Q/R/F actions from the frame.
- `InteractionSystem` receives abstract menu actions.
- No active gameplay path in `movement-controls.js` queries Space/E/Q/R/F directly.

### Control modes

| Mode | World actions |
|---|---|
| `full` | All current/future world actions. |
| `movement` | Move, aim and traverse. |
| `drain` | Move, aim, traverse and current tutorial E-drain interaction. |
| `tip` | Move, aim, traverse and clue interaction. |
| `locked` | No world action; aim position may continue updating. |

The tutorial maps narrative states to these modes. Gameplay keys remain enabled at the Phaser layer; the central action gate decides what reaches simulation.

### World locks

World actions are suppressed when:

- `uiPaused` is set;
- `taskRevealActive` is set;
- the tutorial/cinematic explicitly disables world input.

Held and edge input is reset on:

- window blur;
- document visibility loss;
- pointer leaving the canvas;
- world lock transitions;
- scene shutdown.

### Pointer mapping

Responsive CSS changes display size independently from internal render size. Aim conversion is explicit:

```text
client pointer
  → canvas bounding-rect normalization
  → internal game coordinate
  → camera world-view + zoom conversion
  → aimWorld
```

The conversion does not depend on the selected Low/High/Very high/Ultra render-quality label. Tests cover CSS scaling and camera zoom; browser smoke tests remain required.

### Pointer and wheel browser rules

- Right-click context menu is suppressed only inside the game canvas.
- Pointer-held actions cancel when the pointer leaves the canvas.
- Wheel delta becomes a discrete `-1`, `0` or `1` step.
- Page scrolling is not suppressed until a future `WeaponSystem` explicitly owns wheel input.

## 5. Current technical debt

Rapid vertical-slice iteration introduced runtime prototype adapters. Milestone 1 removes the previous overlapping movement/power/interaction input patch, but some integration still replaces legacy methods because the original core classes predate explicit composition.

Remaining risks:

1. Import order can still affect non-input feature adapters.
2. Some effective behaviour remains distributed between core classes and feature modules.
3. Browser-level mission regression is manual.
4. AI behaviour still uses several competing flags instead of one explicit state machine.

Rules for new work:

- no system may query raw Space/E/Q/R/F or mouse buttons;
- combat and weapons consume `InputSystem` frames;
- new pure geometry/state logic requires unit tests;
- new cross-system behaviour should prefer events/plain data over another prototype replacement;
- known adapter debt must be documented.

## 6. Target high-level architecture

```text
GameScene
 ├─ InputSystem                 implemented
 ├─ TraversalSystem             evolves from TransitionSystem
 ├─ CombatSystem               Milestone 2
 ├─ WeaponSystem               Milestone 7
 ├─ FeedingSystem
 ├─ NpcSystem
 ├─ PerceptionSystem           consolidates vision + hearing
 ├─ PoliceSystem
 ├─ WitnessSystem
 ├─ MissionSystem
 └─ World/Presentation adapters

UIScene
 ├─ HudPresenter
 ├─ DialoguePresenter
 ├─ PromptPresenter
 └─ ModalPresenter
```

The project does not need a full ECS rewrite for the current scope. Plain objects remain suitable if state ownership and transitions are explicit.

## 7. Combat architecture

### `CombatSystem`

Planned responsibilities:

- resolve attack requests;
- create windup, active and recovery windows;
- create directional hit shapes;
- prevent duplicate hits within one attack;
- apply resilience damage and hit stun;
- transition targets to staggered/downed/dead states;
- emit noise and combat events;
- notify Hunger/feedback systems when the player takes damage.

### `WeaponSystem`

Planned responsibilities:

- inventory and equipped weapon;
- consume `weaponStep` from the existing input frame;
- weapon data lookup;
- ammo/reload state when introduced;
- convert primary input into attack requests for `CombatSystem`;
- enable wheel capture only while weapon cycling is active.

Recommended data modules:

- `data/combat.js`
- `data/weapons.js`
- `data/controls.js`

Example weapon definition:

```js
{
  id: "unarmed",
  type: "melee",
  damage: 1,
  range: 28,
  arcRadians: 0.95,
  windupMs: 90,
  activeMs: 110,
  recoveryMs: 230,
  soundRadius: 72,
  soundKind: "melee"
}
```

## 8. NPC combat state

Human NPCs should receive an explicit combat object:

```js
npc.combat = {
  maxResilience: 3,
  resilience: 3,
  state: "active", // active | staggered | downed | dead | drained
  staggerUntil: 0,
  downedUntil: 0,
  invulnerableUntil: 0,
  lastHitBy: null
};
```

Police, hunters and special targets receive data-driven overrides.

State priority, highest first:

1. dead / drained / hidden body;
2. downed;
3. active feeding/drain victim;
4. staggered;
5. arrested/mission cinematic lock;
6. confirmed visual alert/pursuit;
7. witness reporting;
8. heard-only sound reaction;
9. investigation;
10. normal patrol/wander/loiter.

## 9. Pure geometry contract

Implemented helpers already cover:

- vector normalization;
- dot products and angles;
- point-in-cone checks;
- browser-client to internal-game mapping;
- internal-screen to camera-world mapping;
- directional candidate scoring.

Combat milestones extend this module with:

- point-inside-attack-arc;
- line/segment obstruction checks;
- rear-drain eligibility;
- drain-target selection;
- deterministic traversal selection.

Pure helpers must not depend on Phaser globals so they run in Node tests.

## 10. Damage-to-Hunger flow

```text
Enemy attack confirms hit
  → CombatSystem applies hit stun / invulnerability
  → CombatSystem emits player:damaged
  → Feeding/Hunger system adds Hunger
  → UI receives updated registry state
  → Perception receives impact/noise event if applicable
```

Hunger remains the single player attrition resource for the first combat milestone.

## 11. Drain flow

```text
right-button action pressed/held
  → CombatSystem queries valid candidates
  → FeedingSystem starts channel on selected target
  → target enters feeding-victim state
  → movement/damage/invalid geometry can cancel
  → Witness/Perception systems evaluate sight and sound
  → completion lowers Hunger and resolves target as drained
```

A standing target is rear-drainable only when unaware and when the player lies inside its rear arc. A downed target ignores approach angle.

## 12. Traversal architecture

`TransitionSystem` should evolve into a first-class traversal service rather than remain coupled to interaction options.

Candidate contract:

```js
{
  id,
  type: "roofJump" | "roofDrop" | "fireEscape" | "sewer",
  from: { x, y, layer },
  to: { x, y, layer },
  activationRadius,
  priorityPenalty,
  enabled(scene),
  execute(scene)
}
```

`InputSystem` already emits `traversePressed`. Milestone 5 moves selection to deterministic distance/aim scoring and removes Space sprint compatibility.

## 13. Perception architecture

The sensory-awareness feature should consolidate into a `PerceptionSystem` with explicit queries:

- `canSee(observer, subject, eventConfig)`
- `canHear(observer, soundEvent)`

Sound event contract:

```js
{
  kind: "roofDrop" | "streetlightBreak" | "melee" | "gunshot",
  x,
  y,
  layer,
  radius,
  directional: false,
  sourceEntityId,
  severity
}
```

Hearing creates investigate/`WTF`; only confirmed sight or a special rule promotes it to pursuit/reporting.

## 14. Damageable world props

Streetlights should become world entities:

```js
{
  id,
  type: "streetlight",
  x,
  y,
  maxDurability: 1,
  durability: 1,
  state: "active" // active | broken
}
```

Combat hit queries include props. Breaking a light updates shadow data, emits noise and redraws the layer.

## 15. Event model

Recommended plain-data events:

- `combat:attack-started`
- `combat:hit`
- `combat:entity-downed`
- `combat:entity-killed`
- `feeding:started`
- `feeding:cancelled`
- `feeding:completed`
- `player:damaged`
- `hunger:changed`
- `noise:emitted`
- `weapon:changed`
- `traversal:started`
- `traversal:completed`

Events should carry identifiers and plain data, not system instances.

## 16. Testing strategy

### Current automated tests

Run:

```bash
npm test
```

The Milestone 1 suite covers:

- input control-mode gating;
- world locks;
- wheel-step normalization;
- vector and cone geometry;
- responsive client-to-game conversion;
- camera screen-to-world conversion;
- input edge consumption;
- pointer/keyboard reset behaviour.

### Next unit tests

- attack arc hit/miss;
- resilience and downed transitions;
- duplicate-hit prevention;
- rear-drain eligibility;
- traversal candidate priority;
- hearing-only versus sight-confirmed reactions;
- invulnerability frames and damage-to-Hunger conversion.

### Browser smoke tests

Playwright or an equivalent harness should eventually verify:

- multiple viewport sizes and render qualities;
- intro/dialogue locks;
- pointer aim at known world markers;
- every Space traversal type;
- right-click context-menu suppression;
- wheel weapon cycling without page scroll;
- unarmed hit counts and drain eligibility.

### Manual Milestone 1 regression still required

- complete tutorial and mission once at laptop size;
- repeat traversal at one narrow viewport;
- test at least Low and Ultra quality;
- test pause, dialogue Escape, interaction menus and boundary warning;
- resize while moving and verify no stuck input;
- blur/refocus while holding movement/Space.

## 17. Migration plan

1. **Implemented:** central action frame and responsive pointer mapping.
2. **Implemented:** Space/E/Q/R/F ownership moved out of the old movement patch.
3. Complete browser regression and record failures.
4. Add `CombatSystem`, mouse facing and unarmed attacks.
5. Add NPC resilience/stagger/downed state.
6. Convert incoming damage to Hunger.
7. Move drain validation into explicit combat/feeding queries.
8. Remove Space sprint compatibility and implement deterministic traversal scoring.
9. Convert streetlights into damageable props.
10. Add `WeaponSystem` and wheel cycling.
11. Consolidate remaining adapters into explicit bootstrap/core ownership.
