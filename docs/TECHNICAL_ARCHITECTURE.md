# Technical architecture

_Last updated: 2026-07-18_

## 1. Runtime and stack

- Browser runtime with Phaser 3.
- DOM/CSS overlay for HUD, dialogue, prompts and result screens.
- Native ES modules.
- Data-driven world, input, movement, traversal, combat, drain, prop, weapon and AI definitions.
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
- AI state pre/post resolution;
- world-prop damage;
- specialist system update order and UI registry publication.

### `UIScene`

Owns:

- Hunger/exposure/power HUD;
- weapon/ammo HUD;
- mission drawer and interaction presentation;
- intro, pause, failure and success modals;
- UI-only keyboard handling while world input is paused.

`InputSystem` remains authoritative for every world action.

## 3. Current systems

- `InputSystem`
- `WeaponSystem`
- `CombatSystem`
- `PlayerDamageSystem`
- `AiStateSystem`
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

Feature modules also provide responsive layout, tutorial flow/copy, dialogue anchoring, objective guidance, city outskirts, police-informant behaviour, sensory-awareness bridges, weapon UI, police-alert escalation, AI integration and the refuge finale.

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
  → AiStateSystem resolves pre-frame priority/recovery
  → GameScene dispatches movement/traversal/interactions/powers
  → CombatSystem consumes equipped weapon + aim/primary attack
  → DrainSystem consumes right-button state
  → NPC / witness / police / hunter specialist simulation
  → PlayerDamageSystem resolves role-approved enemy attacks
  → MovementNoiseSystem measures actual displacement
  → AiStateSystem resolves final state/role conflicts
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

| Weapon | Type | Damage | Range | Ammo |
|---|---|---:|---:|---:|
| Unarmed | melee | 1 | 32 | unlimited |
| Iron Pipe | melee | 2 | 42 | unlimited |
| Pistol | hitscan | 3 | 260 | 8 |

Every attack snapshots its equipped weapon config at start. Cycling is blocked while an attack is active, and the snapshot prevents a later selection change from bending timing or damage already in progress.

## 7. Player attack and NPC resilience

Authoritative files:

- `phaser/src/data/combat.js`
- `phaser/src/data/weapons.js`
- `phaser/src/combat/CombatSystem.js`
- `phaser/src/combat/combat-compatibility.js`
- `tests/combat.test.js`
- `tests/weapons.test.js`

`CombatSystem` owns the player attack lifecycle:

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

NPC resilience remains civilian/target 3, police/thug 4 and hunter 5. Combat state subset:

```text
active → staggered → downed → dead / drained
```

Combat state is one input to the higher-level AI priority resolver.

## 8. Damageable world props

Authoritative files:

- `phaser/src/data/props.js`
- `phaser/src/systems/PropDamageSystem.js`
- `phaser/src/world/milestone6-runtime.js`
- `tests/props.test.js`

Each district light is a streetlight prop with one durability point and a seven-unit hit radius.

Melee flow:

```text
CombatSystem melee active window
  → NPC arc query
  → PropDamageSystem arc query with the same weapon config
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

`PlayerDamageSystem` still owns timing, telegraphing, range/arc confirmation, player hit stun, invulnerability and Hunger damage. `AiStateSystem` and the specialist AI systems decide whether an enemy is allowed to request an attack.

Attack permission:

- police: only the current `attacker` role while chasing;
- hunter: active hunt or valid remembered pursuit;
- rooftop thug: hostile after the first confirmed player hit.

Baselines:

| Enemy | Hunger | Windup | Recovery |
|---|---:|---:|---:|
| Rooftop thug | +8 | 520 ms | 900 ms |
| Police | +12 | 300 ms | 620 ms |
| Hunter | +20 | 430 ms | 880 ms |

Confirmed damage interrupts the current weapon attack or drain, applies 260 ms hit stun and 720 ms invulnerability, raises Hunger and causes frenzy failure at 100.

## 10. AI state architecture

Authoritative files:

- `phaser/src/data/ai.js`
- `phaser/src/systems/AiStateSystem.js`
- `phaser/src/ai/milestone8-runtime.js`
- `phaser/src/ai/police-turn-guard.js`
- `phaser/src/ai/sensory-priority-guard.js`
- `tests/ai.test.js`

Every NPC receives a resolved `npc.ai` object:

```js
{
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
}
```

Priority:

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

A higher state suppresses incompatible lower state effects. `AiStateSystem` runs before and after the existing specialist update loop so legacy intent changes become one coherent final state.

### Police roles

When officers have confirmed contact:

- one stable officer is selected as `attacker`;
- other visible officers use deterministic `contain` positions around the player;
- only `attacker` may begin a baton telegraph;
- leadership remains stable for a finite window and can hand off after attack/recovery;
- existing soft separation still modifies movement targets;
- search, heat investigation, patrol, reinforcements, arrest and helicopter remain owned by `PoliceSystem`.

Containment radii are 43/49/55 world units for alert levels 1/2/3.

### Witnesses

`WitnessSystem` remains the owner of report-point selection and report completion. AI priority adds deterministic interruption:

```text
confirmed sight
  → reaction
  → flee/report
  → stagger pauses
  → resume after stagger
  → downed/drained/dead/intercepted cancels
```

A sensory guard ensures confirmed police sight clears a heard-only reaction before normal chase selection.

### Hunter memory

A confirmed sighting stores a point predicted 54 units ahead of the current player movement. The hunter retains that point for 6200 ms after losing sight, including through shadow. Blood tracking, route blocking and church patrol resume after memory expires.

### Downed recovery

| Type | Delay | Restored resilience |
|---|---:|---:|
| Civilian | never | — |
| Journalist | never | — |
| Rooftop thug | never | — |
| Police | 18 s | 2 / 4 |
| Hunter | 24 s | 3 / 5 |

Recovery begins with a short stagger. A drain in progress suppresses recovery; kill or completed drain resolves the NPC permanently.

## 11. Drain architecture

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

Right-button pressed state starts and held state maintains. Release, movement, damage or invalid geometry cancels. Drain state has priority over stagger/attack/chase/report, and a valid channel blocks timed recovery.

## 12. Mission completion

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

## 13. Perception architecture

Perception remains distributed between witness, sensory-awareness, weapon, drain, movement and prop systems.

Shared rule:

- confirmed sight promotes the type-specific response and overrides heard-only state;
- hearing alone creates temporary orientation/`WTF`;
- hearing alone does not automatically pursue or report.

Gunshots emit even on misses. Police who see a shot pursue/add heat; civilians who see it enter witness behaviour; heard-only NPCs turn without pursuit. Melee impact noise only emits after a confirmed hit.

Target consolidation remains a future `PerceptionSystem` with explicit `canSee()` and `canHear()` queries.

## 14. Events

Implemented plain-data events include:

- `weapon:changed`
- `weapon:fired`
- `weapon:empty`
- `combat:attack-started`
- `combat:hit`
- `combat:entity-downed`
- `combat:entity-recovered`
- `combat:enemy-attack-started`
- `player:damaged`
- `police:violence-escalated`
- `ai:state-changed`
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

## 15. Testing

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
- hitscan range, width, obstruction and nearest-target ordering;
- AI state priority;
- report interruption;
- police attack-leader and containment selection;
- hunter pursuit prediction and bounds;
- type-specific recovery;
- rooftop-thug retaliation timing.

Browser regression remains manual and is described in `docs/MILESTONE_1_REGRESSION.md` through `docs/MILESTONE_8_REGRESSION.md`.

## 16. Technical debt

- `movement-input-adapter.js` should be folded into `InputSystem`.
- `input-runtime.js`, `milestone5-runtime.js`, `milestone6-runtime.js` and `milestone8-runtime.js` adapt legacy scene/system methods.
- `combat-compatibility.js` shields current damage/witness dispatch from older paths.
- Weapon HUD is installed through a UI adapter rather than first-class scene markup.
- Hitscan obstruction reuses navigation line-clear checks.
- AI priority is resolved centrally, but specialist movement remains distributed across NPC, witness, police and hunter systems.
- Perception is not yet consolidated.
- Browser smoke tests are not automated.

Rules for new work:

- no new raw-input path;
- no duplicate NPC, player or prop damage implementations;
- future weapons must reuse `WeaponSystem` + `CombatSystem` contracts;
- specialist AI behaviour must respect `AiStateSystem` priority/role;
- new geometry/state rules require pure tests;
- cross-system behaviour should prefer plain-data events;
- adapter debt must be removed in Milestone 10.

## 17. Migration plan

1. ✅ Central input frame.
2. ✅ Mouse aim, unarmed combat and resilience.
3. ✅ Enemy attacks and damage-to-Hunger.
4. ✅ Contextual right-click drain.
5. ✅ Default run, Shift quiet movement and traversal-only Space.
6. ✅ Damageable streetlights and reusable prop damage.
7. ✅ Weapon inventory, wheel cycling, melee weapon and pistol hitscan.
8. ✅ Explicit AI priority, type-specific combat roles and recovery.
9. Validate Milestones 1–8 in-browser and complete tutorial/UX teaching.
10. Consolidate adapters and add browser smoke tests.
