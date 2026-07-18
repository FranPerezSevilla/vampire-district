# Damageable world props

_Status: Milestone 6 implementation complete and extended by Milestone 7; browser regression and tuning remain pending._

## Purpose

World destruction uses the same equipped-weapon attack language as NPC combat. Streetlights are never broken through E. The player aims with the mouse and uses left click.

## Authoritative files

- `phaser/src/data/props.js` — pure prop state, durability and melee-arc eligibility.
- `phaser/src/data/weapons.js` — melee and hitscan weapon geometry.
- `phaser/src/systems/PropDamageSystem.js` — streetlight entities, damage application, break effects and events.
- `phaser/src/combat/CombatSystem.js` — melee and ordered NPC/prop hitscan dispatch.
- `phaser/src/world/milestone6-runtime.js` — creates prop state and removes E light interactions.
- `tests/props.test.js` and `tests/weapons.test.js`.

## Streetlight contract

Each configured district light becomes:

```js
{
  id,
  type: "streetlight",
  x,
  y,
  layer: LAYERS.STREET,
  hitRadius: 7,
  maxDurability: 1,
  durability: 1,
  broken: false
}
```

Any current weapon deals at least one damage point, so one confirmed attack breaks a baseline streetlight.

## Melee integration

Unarmed and Iron Pipe attacks use the equipped forward arc:

1. `CombatSystem` owns attack timing, stored direction and `hitIds`.
2. NPC targets use resilience.
3. `PropDamageSystem.resolveAttack()` evaluates props with the same weapon range/arc.
4. A prop receives `prop:<id>` in the shared hit set.
5. Behind, out-of-range and missed attacks leave the prop intact.

The prop radius slightly expands edge contact while preserving directional aim.

## Pistol integration

The Pistol does not run a separate prop ray. `CombatSystem` creates one combined candidate list containing active NPCs and unbroken props.

- target must intersect the stored shot line;
- range and blocking geometry must pass;
- the nearest valid NPC or prop wins;
- a nearer entity blocks a farther streetlight;
- a streetlight can block a farther NPC;
- `PropDamageSystem.damage()` remains the only prop durability mutation endpoint.

## Break result

Breaking a streetlight:

- adds its ID to `GameScene.brokenLights`;
- swaps map drawing to the broken pole;
- removes its light field;
- creates the circular broken-light shadow;
- plays break audio;
- shows a short `BROKEN` burst;
- adds a small amount of district pressure;
- emits visual and heard-only reactions;
- redraws the current layer.

## Perception

- NPCs that see the attack use type-specific visual responses.
- Civilian visual witnesses can enter witness behaviour.
- Police visual confirmation escalates.
- NPCs that only hear the break turn and show `WTF`.
- Hearing alone does not automatically pursue or report.

A pistol also emits its own gunshot perception before the prop break. The break remains a separate glass event.

## Interaction ownership

`GameScene.collectInteractions()` filters `breakLight`, so it never reaches E.

- Left mouse: use equipped weapon against NPC or aimed prop.
- E: clues, dialogue, bodies and mission objects.

## Events

- `prop:damaged`
- `prop:broken`
- `noise:emitted` with `kind: "streetlightBreak"`

Pistol attacks additionally emit weapon and gunshot events through `WeaponSystem`.

## Automated coverage

Tests verify:

- valid melee contact;
- rejection behind and beyond melee reach;
- one-point durability;
- repeated-damage rejection;
- nearest combined hitscan target;
- hitscan range, width and obstruction rejection.

## Known limitations

- Only streetlights implement the reusable prop contract.
- Prop creation and E filtering still enter through a runtime adapter.
- Hitscan obstruction reuses navigation line-clear checks.
- Break perception is not yet a consolidated perception service.
- Exact hit radius, feedback and exposure values require browser playtesting.
