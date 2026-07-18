# Combat system

_Status: Milestones 2–8 are implemented; browser regression and feel tuning remain pending._

## Purpose

The combat layer covers:

- mouse-directed attacks using the equipped weapon;
- NPC resilience, stagger and downed state;
- damageable world props;
- role-approved police, hunter and rooftop-thug melee attacks;
- incoming damage converted into Hunger;
- right-click contextual draining;
- weapon-specific noise and visual reactions;
- AI priority, reporting interruption and timed recovery.

All gameplay input comes from the authoritative `InputSystem` frame.

## Files

- `phaser/src/data/combat.js` — NPC combat states, resilience and shared melee helpers.
- `phaser/src/data/weapons.js` — equipped-weapon definitions, ammo and hitscan helpers.
- `phaser/src/data/player-combat.js` — enemy melee definitions and player damage state.
- `phaser/src/data/ai.js` — AI priority, roles, recovery, police formation and hunter prediction.
- `phaser/src/data/drain.js` — drain eligibility and target selection.
- `phaser/src/combat/CombatSystem.js` — aim, equipped attack lifecycle, melee/hitscan resolution and NPC damage.
- `phaser/src/combat/PlayerDamageSystem.js` — hostile attacks, player stun, invulnerability and Hunger damage.
- `phaser/src/combat/DrainSystem.js` — right-click target/channel behaviour.
- `phaser/src/systems/WeaponSystem.js` — inventory, wheel selection, ammo, weapon audio and attack noise.
- `phaser/src/systems/AiStateSystem.js` — resolved NPC state, conflict cancellation and recovery.
- `phaser/src/systems/PropDamageSystem.js` — world-prop damage endpoint.
- `phaser/src/systems/FeedingSystem.js` — Hunger relief and drain completion.
- `phaser/src/ai/milestone8-runtime.js` — police roles, witness interruption, thug retaliation and hunter memory.
- `tests/combat.test.js`, `tests/player-damage.test.js`, `tests/drain.test.js`, `tests/weapons.test.js`, `tests/ai.test.js`.

## Controls

- Mouse: aim and face.
- Left mouse: use equipped weapon.
- Mouse wheel: previous/next owned weapon.
- Right mouse: hold a valid drain.
- Space: traversal only.
- E: non-traversal interactions.

Weapon cycling is blocked by tutorial modes, UI locks, active attacks, draining, hit stun and transitions.

## Equipped attack lifecycle

Each player attack snapshots:

- equipped weapon config;
- aim direction;
- serial ID;
- elapsed phase time;
- one shared `hitIds` set;
- hitscan resolution/tracer state when relevant.

All weapons use:

```text
windup → active → recovery → complete
```

Cycling cannot change an attack already in progress.

## Weapon baselines

| Weapon | Type | Damage | Range | Windup | Active | Recovery | Ammo |
|---|---|---:|---:|---:|---:|---:|---:|
| Unarmed | melee | 1 | 32 | 90 ms | 110 ms | 240 ms | unlimited |
| Iron Pipe | melee | 2 | 42 | 130 ms | 125 ms | 360 ms | unlimited |
| Pistol | hitscan | 3 | 260 | 65 ms | 45 ms | 430 ms | 8 |

The pistol consumes ammo when a valid shot starts, including a miss. At zero rounds, left click produces `EMPTY` feedback without starting an attack or noise event.

## Melee resolution

Unarmed and Iron Pipe use a forward cone/arc:

- stored origin and direction;
- weapon-specific range and half-angle;
- every valid NPC and prop inside the arc can be hit once;
- NPC and `prop:<id>` keys share the same attack hit set;
- moving the cursor after attack start does not bend the active swing.

The Iron Pipe removes two resilience points, reaches farther, staggers longer and creates more sound than Unarmed.

## Hitscan resolution

The Pistol resolves once during its active phase.

Candidate pool:

- active/staggered human NPCs on the current layer;
- unbroken damageable props on the current layer.

Validation:

1. candidate lies in front of stored direction;
2. forward distance is inside range;
3. perpendicular distance intersects target radius plus bullet width;
4. navigation/world geometry reports a clear segment;
5. closest valid forward candidate wins;
6. perpendicular distance and stable ID break ties.

The same ordered ray decides between NPCs and props. A nearer entity or building blocks a farther target. A stored endpoint draws the tracer.

## NPC resilience and AI priority

| NPC type | Maximum resilience |
|---|---:|
| Civilian | 3 |
| Journalist | 3 |
| Police | 4 |
| Rooftop thug | 4 |
| Hunter | 5 |

Combat state:

```text
active → staggered → downed → dead / drained
```

Resolved AI priority:

```text
inactive/dead
→ downed
→ being drained
→ staggered
→ attacking
→ chasing
→ fleeing/reporting
→ lured
→ investigating sound
→ searching
→ patrolling/idle
```

At zero resilience an NPC cannot move, pursue, attack or report. It remains a valid drain target. Police and hunters may later recover; civilians, journalist and rooftop thug do not.

Resulting baseline player hit counts:

| Weapon | Civilian / journalist | Police / thug | Hunter |
|---|---:|---:|---:|
| Unarmed | 3 | 4 | 5 |
| Iron Pipe | 2 | 2 | 3 |
| Pistol | 1 | 2 | 2 |

## Violence and noise

### Melee

A confirmed melee hit uses one ordinary-violence dispatch. Visual witnesses enter their type-specific response. Heard-only NPCs inside weapon sound range turn and show `WTF`; hearing alone does not pursue or report.

The hit victim receives its own state transition separately, preventing duplicate victim/witness alarms.

### Pistol

A gunshot emits even on a miss:

- sound radius: 280;
- police who see it pursue and add strong heat;
- civilians/journalist who see it enter witness behaviour;
- hunters/thugs who see it become alarmed;
- heard-only NPCs turn and show `WTF` without automatic pursuit/reporting.

Confirmed visual response clears the heard-only marker before chase/report selection.

## Enemy attacks

`PlayerDamageSystem` owns every enemy attack phase. AI roles decide which enemy may request one.

### Rooftop thug swing

- Hunger damage: +8;
- start range: 28;
- hit range: 24;
- windup: 520 ms;
- active: 150 ms;
- recovery: 900 ms;
- cooldown: 650 ms.

The thug remains passive during dialogue and becomes hostile after the first confirmed player hit. His long windup is designed to be readable in the tutorial.

### Police baton

- Hunger damage: +12;
- start range: 29;
- hit range: 25;
- windup: 300 ms;
- active: 120 ms;
- recovery: 620 ms;
- cooldown: 260 ms.

Only the police officer assigned the current `attacker` role may begin a baton attack. Other visible officers move to containment positions. Leadership can hand off after the active turn/recovery instead of every officer attacking together.

### Hunter heavy strike

- Hunger damage: +20;
- start range: 34;
- hit range: 29;
- windup: 430 ms;
- active: 150 ms;
- recovery: 880 ms;
- cooldown: 420 ms.

A hunter may request the attack while directly hunting or while valid last-known-position memory remains.

The direction and attacker position are captured at attack start. The player can dodge outside the stored range/arc.

## Police encounter roles

During confirmed contact:

- one deterministic officer is `attacker`;
- the role remains stable for a finite window;
- officers in attack cooldown are penalized during the next selection;
- remaining officers use different containment slots;
- soft separation still adjusts paths;
- the existing surrounded-arrest check remains active.

Containment radii are 43/49/55 units for wanted levels 1/2/3.

## Civilian/journalist interruption

Visual violence creates:

```text
reaction → flee/report
```

A hit during flight creates stagger. The witness retains report target/reason and resumes afterward. Downing, draining, killing, hiding or intercepting cancels the report permanently. Heard-only response never creates a report intent.

## Hunter pursuit memory

A direct sighting stores a point predicted 54 units ahead of current player movement. The hunter retains that point for 6200 ms after losing sight, including through shadow. After memory expires it returns to blood tracking, route blocking or patrol.

## Downed recovery

| NPC type | Delay | Restored resilience |
|---|---:|---:|
| Civilian | never | — |
| Journalist | never | — |
| Rooftop thug | never | — |
| Police | 18 s | 2 / 4 |
| Hunter | 24 s | 3 / 5 |

Recovered enemies begin with a short stagger. Police rejoin search; hunters resume hunt memory. A drain in progress prevents recovery, and a completed drain/kill resolves permanently.

## Player damage and Hunger

The player has no conventional health bar.

- hit stun: 260 ms;
- invulnerability: 720 ms;
- critical Hunger: 85;
- frenzy failure: 100.

A confirmed hit:

```text
enemy active window
  → role/intent permission
  → range/arc check
  → invulnerability check
  → current weapon attack/drain cancelled
  → Hunger increased
  → hit stun + invulnerability
  → feedback/events
```

Hit stun suppresses movement, weapon attack/cycling, powers, traversal, E interaction and draining. Aim continues updating.

## Contextual drain

### Downed

- any approach angle;
- start range 34;
- aimed toward;
- clear geometry.

### Standing

- unaware;
- player inside rear arc;
- not alarmed, chasing, attacking, reacting or reporting;
- range/aim/geometry valid.

The channel requires held right mouse and cancels on release, movement, damage, layer/range loss or blocked geometry. Break range is 42. Active drain has higher AI priority than attack/chase/report and blocks timed recovery. See [Drain system](DRAIN_SYSTEM.md).

## Props

Streetlights have one durability point.

- melee uses the equipped arc;
- pistol uses the shared ordered hitscan ray;
- broken props ignore later damage;
- break removes light and creates persistent shadow;
- E never exposes destruction.

See [Damageable props](PROP_SYSTEM.md).

## Presentation

Player combat provides:

- weapon-coloured aim line/reticle;
- melee arc or pistol tracer;
- temporary resilience pips;
- clear `DOWN` state;
- persistent weapon/ammo HUD;
- weapon-change and empty feedback.

Enemy combat provides telegraph arcs, camera shake, invulnerability flicker and `HUNGER +N` feedback. Police formation is communicated through actual positioning rather than permanent role labels.

Draining provides valid-target rings, active tether, `HOLD RMB`, progress and invalid feedback.

## Tutorial compatibility

The rooftop sequence remains Unarmed:

1. aim at the thug;
2. the first hit makes him retaliate with a slow telegraph;
3. knock him down with four punches;
4. aim and hold right mouse to drain.

Weapon cycling is not allowed by the tutorial control mode. The thug never recovers after knockdown.

## Automated tests

Run:

```bash
npm test
```

Coverage includes:

- aim dead-zone and melee hit/miss geometry;
- resilience/downed transitions;
- enemy attack timing, damage and invulnerability;
- thug timing/damage;
- drain eligibility and priority;
- weapon inventory/cycling;
- pipe strength/range/cadence;
- pistol ammo/empty rejection;
- hitscan nearest-target, width, range and obstruction;
- prop durability and repeated-damage rejection;
- AI priority and sight-over-sound;
- witness interruption;
- police leader/containment selection;
- hunter prediction;
- recovery timing/resilience.

## Known limitations

- AI priority is centralized, but movement is still distributed among specialist systems through runtime adapters.
- Police containment uses target slots and soft separation rather than full tactical path planning.
- Hunter prediction uses current movement direction, not learned route history.
- All three prototype weapons are owned from the start.
- Pistol reload/replenishment is not implemented.
- Hitscan obstruction reuses navigation line-clear checks.
- Legacy E stun/kill actions remain temporarily available outside the guided tutorial.
- Browser-level validation of formations, recovery timing, hunter memory, weapon balance and the complete mission remains required.
