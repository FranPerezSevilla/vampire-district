# Combat system

_Status: Milestones 2–7 are implemented; browser regression and feel tuning remain pending._

## Purpose

The combat layer covers:

- mouse-directed attacks using the equipped weapon;
- NPC resilience, stagger and persistent downed state;
- damageable world props;
- hostile police/hunter melee attacks;
- incoming damage converted into Hunger;
- right-click contextual draining;
- weapon-specific noise and visual reactions.

All gameplay input comes from the authoritative `InputSystem` frame.

## Files

- `phaser/src/data/combat.js` — NPC combat states, resilience and shared melee helpers.
- `phaser/src/data/weapons.js` — equipped-weapon definitions, ammo and hitscan helpers.
- `phaser/src/data/player-combat.js` — enemy melee definitions and player damage state.
- `phaser/src/data/drain.js` — drain eligibility and target selection.
- `phaser/src/combat/CombatSystem.js` — aim, equipped attack lifecycle, melee/hitscan resolution and NPC damage.
- `phaser/src/combat/PlayerDamageSystem.js` — hostile attacks, player stun, invulnerability and Hunger damage.
- `phaser/src/combat/DrainSystem.js` — right-click target/channel behaviour.
- `phaser/src/systems/WeaponSystem.js` — inventory, wheel selection, ammo, weapon audio and attack noise.
- `phaser/src/systems/PropDamageSystem.js` — world-prop damage endpoint.
- `phaser/src/systems/FeedingSystem.js` — Hunger relief and drain completion.
- `phaser/src/input/input-runtime.js` — central system update order.
- `tests/combat.test.js`, `tests/player-damage.test.js`, `tests/drain.test.js`, `tests/weapons.test.js`.

## Controls

- Mouse: aim and face.
- Left mouse: use equipped weapon.
- Mouse wheel: previous/next owned weapon.
- Right mouse: hold a valid drain.
- Space: traversal only.
- E: non-traversal interactions.

Weapon cycling is blocked by tutorial modes, UI locks, active attacks, draining, hit stun and transitions.

## Equipped attack lifecycle

Each attack snapshots:

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

1. Candidate lies in front of stored direction.
2. Forward distance is inside range.
3. Perpendicular distance intersects target radius plus bullet width.
4. Navigation/world geometry reports a clear segment.
5. Closest valid forward candidate wins.
6. Perpendicular distance and stable ID break ties.

The same ordered ray decides between NPCs and props. A nearer entity or building blocks a farther target. A stored endpoint draws the tracer.

## NPC resilience

| NPC type | Maximum resilience |
|---|---:|
| Civilian | 3 |
| Journalist | 3 |
| Police | 4 |
| Rooftop thug | 4 |
| Hunter | 5 |

State flow:

```text
active → staggered → downed → dead / drained
```

At zero resilience the NPC stops movement, pursuit, attacking and reporting. It remains a valid drain target.

Resulting baseline hit counts:

| Weapon | Civilian / journalist | Police / thug | Hunter |
|---|---:|---:|---:|
| Unarmed | 3 | 4 | 5 |
| Iron Pipe | 2 | 2 | 3 |
| Pistol | 1 | 2 | 2 |

## Violence and noise

### Melee

A confirmed melee hit uses ordinary-violence witness/police paths. Heard-only NPCs inside weapon sound range turn and show `WTF`; hearing alone does not pursue or report.

### Pistol

A gunshot emits even on a miss:

- sound radius: 280;
- police who see it pursue and add strong heat;
- civilians/journalist who see it enter witness behaviour;
- hunters/thugs who see it become alarmed;
- heard-only NPCs turn and show `WTF` without automatic pursuit/reporting.

## Enemy attacks

Milestone 3 reuses existing hostility rather than a final AI state machine.

### Police baton

- Hunger damage: +12;
- start range: 29;
- hit range: 25;
- windup: 300 ms;
- active: 120 ms;
- recovery: 620 ms;
- cooldown: 260 ms.

### Hunter heavy strike

- Hunger damage: +20;
- start range: 34;
- hit range: 29;
- windup: 430 ms;
- active: 150 ms;
- recovery: 880 ms;
- cooldown: 420 ms.

The direction and attacker position are captured at attack start. The player can dodge outside the stored range/arc.

## Player damage and Hunger

The player has no conventional health bar.

- hit stun: 260 ms;
- invulnerability: 720 ms;
- critical Hunger: 85;
- frenzy failure: 100.

A confirmed hit:

```text
enemy active window
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

The channel requires held right mouse and cancels on release, movement, damage, layer/range loss or blocked geometry. See [Drain system](DRAIN_SYSTEM.md).

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

Enemy combat provides telegraph arcs, camera shake, invulnerability flicker and `HUNGER +N` feedback.

Draining provides valid-target rings, active tether, `HOLD RMB`, progress and invalid feedback.

## Tutorial compatibility

The rooftop sequence remains Unarmed:

1. aim at the thug;
2. knock him down with four punches;
3. aim and hold right mouse to drain.

Weapon cycling is not allowed by the tutorial control mode. It becomes available after full control is restored.

## Automated tests

Run:

```bash
npm test
```

Coverage includes:

- aim dead-zone and melee hit/miss geometry;
- resilience/downed transitions;
- enemy attack timing, damage and invulnerability;
- drain eligibility and priority;
- weapon inventory/cycling;
- pipe strength/range/cadence;
- pistol ammo/empty rejection;
- hitscan nearest-target, width, range and obstruction;
- prop durability and repeated-damage rejection.

## Known limitations

- Enemy combat still relies on existing police/hunter flags rather than a unified AI priority state machine.
- The rooftop thug and civilians do not retaliate yet.
- All three prototype weapons are owned from the start.
- Pistol reload/replenishment is not implemented.
- Hitscan obstruction reuses navigation line-clear checks.
- Legacy E stun/kill actions remain temporarily available outside the guided tutorial.
- Combat/weapon/perception integration still contains adapter debt.
- Browser-level validation of wheel ownership, tracer alignment, obstruction, weapon balance and the complete mission remains required.
