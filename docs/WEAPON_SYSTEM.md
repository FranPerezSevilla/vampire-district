# Weapon system

_Status: Milestone 7 implementation complete; browser regression and tuning remain pending._

## Purpose

Milestone 7 adds a data-driven inventory without changing the established controls:

- mouse position still owns aim;
- left mouse uses the equipped weapon;
- mouse wheel selects one owned weapon step;
- NPC resilience and damageable props continue using shared combat contracts.

## Authoritative files

- `phaser/src/data/weapons.js` — weapon definitions, inventory order, ammo helpers and pure hitscan selection.
- `phaser/src/systems/WeaponSystem.js` — inventory, equipped state, wheel cycling, ammo consumption, sound and perception reactions.
- `phaser/src/combat/CombatSystem.js` — weapon attack timing, melee/hitscan resolution and NPC damage.
- `phaser/src/systems/PropDamageSystem.js` — shared prop damage endpoint.
- `phaser/src/input/input-runtime.js` — updates weapon selection from the central input frame before combat.
- `phaser/src/weapons/milestone7-ui.js` — persistent equipped-weapon/ammo HUD.
- `tests/weapons.test.js` — pure inventory, cycling, ammo and hitscan tests.

## Starting inventory

The vertical slice starts with all three prototype weapons because pickup progression is outside this milestone:

1. Unarmed.
2. Iron Pipe.
3. Pistol.

The opening rooftop tutorial remains unarmed because its restricted control mode does not expose `weaponStep`. Mouse-wheel cycling becomes available once full gameplay control is restored.

## Controls

- Mouse wheel down: next owned weapon.
- Mouse wheel up: previous owned weapon.
- Left mouse: use equipped weapon.

The wheel listener remains scoped to the game canvas. Page scrolling is prevented only because `WeaponSystem` actively owns weapon cycling. UI, dialogue, transitions, draining, hit stun and attack commitment suppress weapon changes.

## Weapon baselines

| Weapon | Type | Damage | Range | Timing | Sound | Ammo |
|---|---|---:|---:|---|---:|---:|
| Unarmed | Melee | 1 | 32 | 90 / 110 / 240 ms | 72 | Unlimited |
| Iron Pipe | Melee | 2 | 42 | 130 / 125 / 360 ms | 104 | Unlimited |
| Pistol | Hitscan | 3 | 260 | 65 / 45 / 430 ms | 280 | 8 rounds |

Timing columns are windup / active / recovery.

The pistol has no reload action in this slice because R is already Whisper and the prototype does not yet have a full inventory/reload interface. At zero ammunition, left click gives an `EMPTY` message and the player must cycle to another weapon.

## Melee resolution

Unarmed and Iron Pipe attacks use the existing forward-arc contract:

- direction captured at attack start;
- range and half-angle from the equipped weapon;
- one `hitIds` set shared across NPC and prop targets;
- every valid entity inside the active arc can be damaged once;
- pipe damage removes two resilience points and uses longer commitment/stagger timings.

Streetlights consume the same melee config. Their one-point durability means either melee weapon breaks one on a valid hit.

## Hitscan resolution

The pistol resolves once during its active window.

Candidate pool:

- active/staggered human NPCs on the current layer;
- unbroken damageable props on the current layer.

Selection rules:

1. Candidate must be in front of the stored shot direction.
2. Candidate must be inside pistol range.
3. Perpendicular distance from the shot line must fit target radius plus bullet width.
4. World geometry must report a clear line.
5. The closest valid candidate along the ray wins.
6. Perpendicular distance and stable ID break exact ties.

This creates one ordered ray across NPCs and props: a nearer NPC blocks a farther streetlight, and a building blocks both.

## Ammo

Pistol ammo is consumed when an attack starts, including a miss. It is not consumed when:

- world input is locked;
- combat cannot start;
- the pistol is already empty.

The HUD displays current ammunition as `remaining/capacity`. Unarmed and pipe display infinity.

## Noise and reactions

### Melee impact

A confirmed punch or pipe strike emits an impact sound event. NPCs that only hear it turn and show `WTF`; hearing alone does not begin pursuit or reporting. Visual assault reactions continue through the existing witness and police paths.

### Gunshot

A pistol shot emits noise even when it misses.

- Sound radius: 280 units.
- Police who see the shot pursue and add strong heat.
- Civilians/journalist who see it enter ordinary witness behaviour.
- Hunters/thugs who see it become alarmed.
- NPCs that only hear it turn and show `WTF` without automatic pursuit or reporting.

The pistol therefore creates substantially more district pressure than unarmed or pipe attacks.

## UI and feedback

- Persistent bottom-left weapon indicator.
- Equipped name and ammo count.
- Empty pistol state uses warning colour.
- Every successful wheel step uses the existing toast with `EQUIPPED: ...`.
- Attack arc/reticle colour follows the weapon.
- Pistol draws a tracer to the first hit or maximum range.
- Final report includes equipped weapon and remaining ammo.

## Events

Implemented plain-data events:

- `weapon:changed`
- `weapon:fired`
- `weapon:empty`
- `combat:attack-started` with `weaponId` and `attackType`
- `combat:hit` with `weaponId` and damage
- `noise:emitted` for punch, melee weapon and gunshot

## Automated coverage

`tests/weapons.test.js` covers:

- starting inventory order;
- one-step wheel cycling and wraparound;
- pipe damage/range/recovery relative to unarmed;
- finite pistol ammunition and empty rejection;
- nearest hitscan target selection across NPC/prop candidates;
- rejection behind the player, outside shot width, beyond range or behind blocking geometry.

Run:

```bash
npm test
```

## Known limitations

- All prototype weapons are owned from the start; pickups/economy are not implemented.
- Pistol ammo cannot be replenished or reloaded yet.
- No projectile travel time, spread growth, recoil or headshots.
- Hitscan obstruction reuses the existing navigation-based line-clear query rather than a dedicated collision ray service.
- Weapon perception is integrated with current witness/AI flags rather than the final unified AI/perception state machine.
- Browser validation remains required for wheel direction, trackpads, tracer alignment, obstruction, simultaneous targets and responsive HUD layout.
