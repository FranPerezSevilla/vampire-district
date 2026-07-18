# Weapon system

_Status: Milestone 7 implementation complete; Milestone 9 teaching/HUD pass implemented; browser regression and tuning remain pending._

## Purpose

The weapon layer adds a data-driven inventory without changing the established controls:

- mouse position owns aim;
- left mouse uses the equipped weapon;
- mouse wheel selects one owned weapon step;
- NPC resilience and damageable props use shared combat contracts.

## Authoritative files

- `phaser/src/data/weapons.js` — weapon definitions, inventory order, ammo helpers and pure hitscan selection.
- `phaser/src/systems/WeaponSystem.js` — inventory, equipped state, wheel cycling, ammo, sound and perception reactions.
- `phaser/src/combat/CombatSystem.js` — attack timing, melee/hitscan resolution and NPC damage.
- `phaser/src/systems/PropDamageSystem.js` — shared prop damage endpoint.
- `phaser/src/input/input-runtime.js` — updates weapon selection before combat from the central input frame.
- `phaser/src/weapons/milestone7-ui.js` — persistent equipped-weapon/ammo HUD.
- `phaser/src/systems/UxGuidanceSystem.js` — first-use wheel teaching and HUD attention state.
- `phaser/src/ux/milestone9-runtime.js` — accessible HUD semantics and high-contrast aim integration.
- `tests/weapons.test.js` and `tests/ux-guidance.test.js`.

## Starting inventory

The vertical slice starts with all three prototype weapons because pickup progression is outside the current scope:

1. Unarmed.
2. Iron Pipe.
3. Pistol.

The opening rooftop tutorial remains unarmed because restricted control modes do not expose `weaponStep`. Mouse-wheel cycling becomes available after the police informant leaves and full control returns.

## Controls

- Mouse wheel down: next owned weapon.
- Mouse wheel up: previous owned weapon.
- Left mouse: use equipped weapon.

The wheel listener remains scoped to the game canvas. Page scrolling is prevented only while `WeaponSystem` owns weapon cycling. UI, dialogue, transitions, draining, hit stun and attack commitment suppress weapon changes.

## First-use teaching

Once full control is restored and the task reveal has closed, a compact non-blocking strip appears:

```text
WHEEL · Change weapon. Scroll once to equip the Iron Pipe or Pistol.
```

- the world remains interactive;
- the weapon HUD receives an attention pulse;
- the first successful `weapon:changed` event completes the step;
- the next short message confirms the equipped weapon and `LMB` attack;
- cycling before the strip becomes visible still counts;
- the guidance does not read raw wheel input or create another control path.

## Weapon baselines

| Weapon | Type | Damage | Range | Timing | Sound | Ammo |
|---|---|---:|---:|---|---:|---:|
| Unarmed | Melee | 1 | 32 | 90 / 110 / 240 ms | 72 | Unlimited |
| Iron Pipe | Melee | 2 | 42 | 130 / 125 / 360 ms | 104 | Unlimited |
| Pistol | Hitscan | 3 | 260 | 65 / 45 / 430 ms | 280 | 8 rounds |

Timing columns are windup / active / recovery.

The pistol has no reload action because R is Whisper and the prototype has no full inventory/reload interface. At zero ammunition, left click gives `EMPTY` feedback and the player must cycle to another weapon.

## Melee resolution

Unarmed and Iron Pipe use the existing forward arc:

- direction captured at attack start;
- equipped range and half-angle;
- one `hitIds` set shared across NPCs and props;
- every valid entity inside the active arc can be damaged once;
- pipe removes two resilience points and has longer commitment/stagger.

Streetlights consume the same melee config. Their one-point durability means either melee weapon breaks one on a valid hit.

## Hitscan resolution

The pistol resolves once during its active window.

Candidate pool:

- active/staggered human NPCs on the current layer;
- unbroken damageable props on the current layer.

Selection rules:

1. Candidate is in front of stored shot direction.
2. Candidate is inside range.
3. Perpendicular distance fits target radius plus bullet width.
4. World geometry reports a clear line.
5. Closest valid candidate along the ray wins.
6. Perpendicular distance and stable ID break exact ties.

This creates one ordered ray across NPCs and props: a nearer NPC blocks a farther streetlight, and a building blocks both.

## Ammo

Pistol ammo is consumed when an attack starts, including a miss. It is not consumed when:

- world input is locked;
- combat cannot start;
- the pistol is empty.

The HUD displays `remaining/capacity`. Unarmed and pipe display infinity.

## Noise and reactions

### Melee impact

A confirmed punch or pipe strike emits impact sound. NPCs that only hear it turn and show `WTF`; hearing alone does not begin pursuit or reporting. Visual assault reactions continue through witness and police paths.

### Gunshot

A pistol shot emits noise even when it misses.

- Sound radius: 280 units.
- Police who see it pursue and add strong heat.
- Civilians/journalist who see it enter witness behaviour.
- Hunters/thugs who see it become alarmed.
- NPCs that only hear it turn and show `WTF` without automatic pursuit/reporting.

## UI and feedback

- Persistent lower-right weapon indicator; the power dock remains lower-left.
- Increased weapon name and ammo typography.
- Empty pistol warning state.
- Successful wheel step produces `EQUIPPED: ...`.
- First-use teaching temporarily pulses the weapon HUD.
- Attack arc/reticle colour follows the weapon.
- Optional high-contrast aim adds black outline, white core, larger ring and cross mark.
- Pistol draws a tracer to first hit or maximum range.
- Weapon status exposes name, ammunition and inventory slot to assistive technology.
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

`tests/weapons.test.js` covers inventory order, one-step cycling/wraparound, pipe differences, ammunition, empty rejection, nearest hitscan selection and obstruction rejection.

`tests/ux-guidance.test.js` covers the locked/awaiting/completed first-use phase and high-contrast presentation rules.

Run:

```bash
npm test
```

## Known limitations

- All prototype weapons are owned from the start; pickups/economy are not implemented.
- Pistol ammo cannot be replenished or reloaded.
- No projectile travel time, spread growth, recoil or headshots.
- Hitscan obstruction reuses navigation line-clear rather than a dedicated collision ray.
- Guidance duration and HUD position require browser validation at supported viewports.
- Runtime integration remains adapter-based until Milestone 10.
