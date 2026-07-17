# Technical architecture

## 1. Runtime and stack

- Browser runtime.
- Phaser 3 for world rendering, cameras, tweens, input and timing.
- DOM/CSS overlay for HUD, dialogue, prompts and modals.
- ES modules loaded directly by the browser.
- Data-driven world definitions in JavaScript modules.
- No backend dependency for the current vertical slice.

## 2. Current scene model

### `BootScene`

Responsible for startup/bootstrap work required by the Phaser scene list.

### `GameScene`

Owns the playable world and currently coordinates:

- player container and movement;
- map and route rendering;
- camera updates;
- interaction collection;
- system updates;
- layer switching;
- state publication to the registry.

### `UIScene`

Owns the DOM-backed presentation layer:

- Hunger and police HUD;
- power dock;
- mission panel;
- interaction prompt/menu;
- intro, pause, failure and success modals.

## 3. Current first-class systems

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

Newer feature modules also provide tutorial flow, responsive layout, objective guidance, police informant behaviour, city outskirts, dialogue layout, final report presentation and sensory awareness.

## 4. Current technical debt

Rapid iteration has introduced feature modules that patch scene and system prototypes at runtime. This preserved the playable build while requirements changed quickly, but it creates four problems:

1. Import order can change behaviour.
2. Multiple modules can replace the same method.
3. The effective implementation is distributed across core files and patches.
4. Unit testing individual behaviours is difficult.

The combat milestone must not continue this pattern. The next engineering phase should consolidate input and simulation ownership before adding weapons.

## 5. Target high-level architecture

```text
GameScene
 ├─ InputSystem
 ├─ TraversalSystem (evolves from TransitionSystem)
 ├─ CombatSystem
 ├─ WeaponSystem
 ├─ FeedingSystem
 ├─ NpcSystem
 ├─ PerceptionSystem (vision + hearing)
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

The project does not need a full entity-component-system rewrite for the current scope. Plain NPC objects are sufficient if state ownership and transitions are explicit.

## 6. Input architecture

### Goal

Move all raw keyboard, pointer and wheel handling behind an action-based `InputSystem`.

### Actions

```js
const INPUT_ACTIONS = {
  move: "move",
  aim: "aim",
  primaryAttack: "primaryAttack",
  drain: "drain",
  traverse: "traverse",
  interact: "interact",
  weaponNext: "weaponNext",
  weaponPrevious: "weaponPrevious",
  dash: "dash",
  whisper: "whisper",
  bloodSense: "bloodSense",
  mission: "mission",
  menu: "menu"
};
```

### Input frame contract

Each simulation frame should consume a snapshot rather than query keys from many systems:

```js
{
  move: { x, y },
  aimWorld: { x, y },
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

### Requirements

- Pointer-to-world conversion uses the active camera.
- Mouse-wheel input is accumulated and debounced into discrete steps.
- Browser context menu is disabled only in the game region.
- UI/modal focus suppresses world input.
- A blur/visibility event clears held inputs.
- Input remapping can be added without changing gameplay systems.

## 7. Combat architecture

### `CombatSystem`

Responsibilities:

- resolve attack requests;
- create attack windows and hit shapes;
- prevent duplicate hits within one attack;
- apply damage and hit stun;
- transition targets to downed/dead states;
- emit noise and combat events;
- notify Hunger/feedback systems when the player takes damage.

### `WeaponSystem`

Responsibilities:

- inventory and equipped weapon;
- mouse-wheel cycling;
- weapon data lookup;
- ammo/reload state when introduced;
- converting input into an attack request for `CombatSystem`.

### Recommended data modules

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

Extend each human NPC with an explicit combat object:

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

### State priority

Highest priority first:

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

Every AI update should derive behaviour from this priority rather than allow several booleans to compete.

## 9. Attack geometry

Pure helper functions should own combat geometry and be unit-testable:

- `worldAimDirection(player, pointer, previousDirection)`
- `pointInsideArc(origin, direction, target, range, halfAngle)`
- `segmentIntersectsObstacle(start, end)`
- `isBehindTarget(player, target, rearHalfAngle)`
- `selectDrainTarget(player, candidates)`
- `selectTraversalAction(player, aimDirection, candidates)`

### Rear-drain rule

A standing target is rear-drainable when the normalized vector from target to player has a sufficiently negative dot product with the target facing vector and the target is not in a confirmed alert state.

Example baseline:

```js
const behind = dot(targetFacing, directionTargetToPlayer) <= -0.35;
```

The exact threshold is a tuning value and should live in `data/combat.js`.

## 10. Damage-to-Hunger flow

```text
Enemy attack confirms hit
  → CombatSystem applies hit stun / i-frames
  → CombatSystem emits player:damaged
  → Feeding/Hunger system adds Hunger
  → UI receives updated registry state
  → Perception/noise systems receive impact event if applicable
```

Hunger remains the single player attrition resource for the first combat milestone. A separate health system should not be introduced unless playtesting shows the combined resource is unclear or too punishing.

## 11. Drain flow

```text
Right mouse pressed/held
  → InputSystem requests drain
  → CombatSystem queries valid candidates
  → FeedingSystem starts channel on selected target
  → target enters feeding-victim state
  → movement/damage/invalid geometry can cancel
  → Witness/Perception systems evaluate sight and sound
  → completion lowers Hunger and resolves target as drained
```

The browser context menu must never appear while the pointer is in the game frame.

## 12. Traversal architecture

`TransitionSystem` should evolve into a first-class traversal service rather than remain tied to specific keys.

### Traversal candidate

```js
{
  id,
  type: "roofJump" | "roofDrop" | "fireEscape" | "sewer",
  from: { x, y, layer },
  to: { x, y, layer },
  activationRadius,
  facingWeight,
  enabled(scene),
  execute(scene)
}
```

The input system emits `traversePressed`; the traversal system selects one candidate using deterministic priority. No combat or interaction system should inspect Space directly.

## 13. Perception architecture

The current sensory-awareness feature should be consolidated into a `PerceptionSystem` with two explicit queries:

- `canSee(observer, subject, eventConfig)`
- `canHear(observer, soundEvent)`

### Sound event

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

Hearing produces an investigate/`WTF` state. Only a later confirmed sighting or special high-severity rule may promote that reaction into pursuit/reporting.

## 14. Damageable world props

Streetlights should be represented as world entities rather than special E interactions:

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

Combat hit queries include damageable props. Breaking a light updates shadow data, emits a noise event and redraws the relevant layer.

## 15. Responsive rendering and pointer mapping

The visual frame is CSS-scaled to fit the browser while render quality controls internal resolution. Combat input must be tested at every combination of:

- narrow and wide browser windows;
- height-constrained layouts;
- Low, High, Very high and Ultra internal quality;
- street, roof and sewer camera zoom;
- tutorial close zoom and return zoom.

### Acceptance test

Place the cursor over a known world marker at each configuration. `aimWorld` must resolve to the same world coordinates within a small tolerance.

## 16. Event model

Phaser's event emitter or a small project event bus should reduce direct cross-system coupling.

Recommended events:

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

Events should carry plain data, not system instances.

## 17. Testing strategy

### Unit tests

Prioritize pure geometry and state transitions:

- aim projection helpers;
- attack arc hit/miss;
- rear-drain eligibility;
- traversal candidate priority;
- resilience and downed transitions;
- invulnerability and duplicate-hit prevention;
- hearing-only versus sight-confirmed reaction.

### Browser smoke tests

Use Playwright when the project introduces a test runner:

- launch game at multiple viewport sizes;
- start/close intro;
- verify pointer aim at a target;
- punch civilian three times;
- punch police four times;
- drain from rear/downed state;
- use each Space traversal type;
- verify right-click context menu is suppressed;
- verify wheel changes weapon but does not scroll the page.

### Manual regression matrix

Maintain a short checklist for tutorial, mission, police levels, helicopter arrest, dialogue, responsive layout, sewers, rooftops and final report.

## 18. Migration plan

1. Add tests for existing aim/cone and traversal geometry.
2. Introduce `InputSystem` while preserving current bindings.
3. Move Space/E/Q/R/F handling out of prototype patches.
4. Introduce `CombatSystem` and NPC resilience with unarmed attacks only.
5. Move drain validation into explicit combat/feeding queries.
6. Convert streetlights into damageable props.
7. Add `WeaponSystem` and wheel cycling.
8. Consolidate sensory awareness into `PerceptionSystem`.
9. Remove superseded prototype patches and update imports.
10. Run the full manual/browser regression matrix.
