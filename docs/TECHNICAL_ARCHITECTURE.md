# Technical architecture

_Last updated: 2026-07-18_

## 1. Runtime and stack

- Browser runtime with Phaser 3.
- DOM/CSS overlay for HUD, dialogue, prompts and result screens.
- Native ES modules.
- Data-driven world, input, movement, traversal, combat, drain, prop and weapon definitions.
- Node's built-in test runner with no test dependencies.
- No backend dependency for the current vertical slice.

## 2. Scene ownership

### `GameScene`

Coordinates:

- player/world simulation and rendering;
- camera and map layers;
- one gameplay input-frame consumption point;
- movement, traversal, interactions and powers;
- weapon selection, player combat, draining and enemy damage;
- world-prop damage;
- system update order and UI registry publication.

### `UIScene`

Owns:

- Hunger/exposure/power HUD;
- weapon/ammo HUD;
- mission drawer and interaction presentation;
- intro, pause, failure and success modals;
- UI-only keyboard handling while world input is paused.

`InputSystem` remains authoritative for all world actions.

## 3. Current systems

- `InputSystem`
- `WeaponSystem`
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

Feature modules also provide responsive layout, tutorial flow/copy, dialogue anchoring, objective guidance, city outskirts, police-informant behaviour, sensory-awareness bridges, weapon UI and the refuge finale.

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
  → WeaponSystem consumes weaponStep
  → GameScene dispatches movement/traversal/interactions/powers
  → CombatSystem consumes equipped weapon + aim/primary attack
  → DrainSystem consumes right-button state
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

No active gameplay feature added after Milestone 1 reads raw Space/E/Q/R/F, mouse buttons or wheel input independently.

### Wheel ownership

`InputSystem` normalizes canvas wheel delta to one signed step. `WeaponSystem` enables wheel capture while the playable scene is active. The browser page scrolls normally outside the canvas. Tutorial modes and UI/combat locks suppress selection through the same frame gating.

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

## 6. Weapon architecture

Authoritative files:

- `phaser/src/data/weapons.js`
- `phaser/src/systems/WeaponSystem.js`
- `phaser/src/weapons/milestone7-ui.js`
- `tests/weapons.test.js`

`WeaponSystem` owns:

- ordered owned-weapon IDs;
- equipped index and wheel wraparound;
- per-weapon ammunition;
- empty-shot rejection;
- weapon-change and firing events;
- weapon-specific attack audio;
- gunshot and melee-impact perception bridges;
- registry publication for the weapon HUD/report.

Starting inventory:

```text
Unarmed → Iron Pipe → Pistol → wrap
```

The opening tutorial blocks `weaponStep`, so it remains Unarmed until full control.

### Weapon definitions

| Weapon | Type | Damage | Range | Ammo |
|---|---|---:|---:|---:|
| Unarmed | melee | 1 | 32 | unlimited |
| Iron Pipe | melee | 2 | 42 | unlimited |
| Pistol | hitscan | 3 | 260 | 8 |

Every attack snapshots its equipped weapon config at start. Cycling is blocked while an attack is active, but the snapshot also prevents later selection changes from bending timing or damage already in progress.

## 7. Player attack and NPC resilience

Authoritative files:

- `phaser/src/data/combat.js`
- `phaser/src/data/weapons.js`
- `phaser/src/combat/CombatSystem.js`
- `phaser/src/combat/combat-compatibility.js`
- `tests/combat.test.js`
- `tests/weapons.test.js`

`CombatSystem` now owns the complete player attack lifecycle independently of weapon type:

```text
primaryPressed
  → snapshot equipped weapon + aim direction
  → WeaponSystem validates/consumes ammo
  → windup
  → active resolution
  → recovery
```

### Melee

Unarmed and Iron Pipe share the forward arc query. The attack owns one `hitIds` set across NPCs and props. Each valid entity can be damaged once during the active window.

### Hitscan

Pistol resolution builds one candidate pool from active NPCs and unbroken props:

```text
candidate in front
  → inside range
  → inside shot-line width + entity radius
  → line-clear validation
  → nearest forward candidate wins
```

Perpendicular distance and stable ID break exact ties. The shot resolves once and stores a tracer endpoint.

NPC resilience remains civilian/target 3, police/thug 4 and hunter 5. State subset:

```text
active → staggered → downed → dead / drained
```

Downed NPCs stop movement, pursuit and reporting and remain valid drain targets.

## 8. Damageable world props

Authoritative files:

- `phaser/src/data/props.js`
- `phaser/src/systems/PropDamageSystem.js`
- `phaser/src/world/milestone6-runtime.js`
- `tests/props.test.js`

Each district light is a streetlight prop with one durability point and a 7-unit hit radius.

Melee flow:

```text
CombatSystem melee active window
  → NPC arc query
  → PropDamageSystem arc query with same weapon config
  → shared attack hitIds
  → durability damage
```

Hitscan flow:

```text
CombatSystem ordered NPC/prop ray
  → closest valid prop candidate selected
  → PropDamageSystem.damage()
```

Breaking updates `brokenLights`, redraws lighting/shadow state and emits prop/noise events. `GameScene.collectInteractions()` is filtered so E no longer exposes `breakLight`.

## 9. Enemy attacks and damage-to-Hunger

Authoritative files:

- `phaser/src/data/player-combat.js`
- `phaser/src/combat/PlayerDamageSystem.js`
- `tests/player-damage.test.js`

Police attacks reuse `chasingPlayer`; hunters reuse hunt intent. Confirmed damage interrupts the current weapon attack or drain, raises Hunger, applies 260 ms hit stun and 720 ms invulnerability, and causes frenzy failure at 100 Hunger.

Baselines:

- police: Hunger +12;
- hunter: Hunger +20;
- critical: 85;
- frenzy: 100.

## 10. Drain architecture

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

## 11. Mission completion

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

## 12. Perception architecture

Perception remains distributed between witness, sensory-awareness, weapon, drain, movement and prop systems.

Shared rule:

- confirmed sight promotes the NPC-type response;
- hearing alone creates temporary orientation/`WTF`;
- hearing alone does not automatically pursue or report.

Gunshots emit even on misses. Police who see a shot pursue/add heat; civilians who see it enter witness behaviour; heard-only NPCs turn without pursuit. Melee impact noise only emits after a confirmed hit.

Target consolidation remains a future `PerceptionSystem` with explicit `canSee()` and `canHear()` queries.

## 13. Events

Implemented plain-data events include:

- `weapon:changed`
- `weapon:fired`
- `weapon:empty`
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

## 14. Testing

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
- prop hit/miss geometry, durability and repeated-damage protection;
- weapon inventory order and wraparound;
- ammo consumption and empty rejection;
- hitscan range, width, obstruction and nearest-target ordering.

Browser regression remains manual and is described in `docs/MILESTONE_1_REGRESSION.md` through `docs/MILESTONE_7_REGRESSION.md`.

## 15. Technical debt

- `movement-input-adapter.js` should be folded into `InputSystem`.
- `input-runtime.js`, `milestone5-runtime.js` and `milestone6-runtime.js` adapt legacy scene methods.
- `combat-compatibility.js` shields new downed behaviour from older paths.
- Weapon HUD is installed through a UI adapter rather than first-class scene markup.
- Hitscan obstruction reuses navigation line-clear checks.
- Weapon/perception responses still manipulate current AI flags before the final priority state machine.
- Perception is not yet consolidated.
- Browser smoke tests are not automated.

Rules for new work:

- no new raw-input path;
- no duplicate NPC, player or prop damage implementations;
- future weapons must reuse `WeaponSystem` + `CombatSystem` contracts;
- new geometry/state rules require pure tests;
- cross-system behaviour should prefer plain-data events;
- adapter debt must be removed in Milestone 10.

## 16. Migration plan

1. ✅ Central input frame.
2. ✅ Mouse aim, unarmed combat and resilience.
3. ✅ Enemy attacks and damage-to-Hunger.
4. ✅ Contextual right-click drain.
5. ✅ Default run, Shift quiet movement and traversal-only Space.
6. ✅ Damageable streetlights and reusable prop damage.
7. ✅ Weapon inventory, wheel cycling, melee weapon and pistol hitscan.
8. Validate Milestones 1–7 in-browser.
9. Implement explicit AI priority states.
10. Consolidate adapters and add browser smoke tests.
