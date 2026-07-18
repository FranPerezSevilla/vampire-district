# Damageable world props

_Status: Milestone 6 implementation complete; browser regression and tuning remain pending._

## Purpose

World destruction now uses the same directional attack language as NPC combat. Streetlights are no longer broken through E. The player aims with the mouse and lands a normal left-click attack on the object.

## Authoritative files

- `phaser/src/data/props.js` — pure prop state, durability and melee-arc eligibility.
- `phaser/src/systems/PropDamageSystem.js` — streetlight entities, damage application, break effects and events.
- `phaser/src/world/milestone6-runtime.js` — connects prop damage to `CombatSystem` and removes E light interactions.
- `tests/props.test.js` — pure hit/miss and durability tests.

## Streetlight contract

Each configured district light becomes a damageable prop:

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

A baseline streetlight breaks after one confirmed unarmed damage point.

## Attack integration

`CombatSystem` still owns attack timing and one per-attack `hitIds` set. During the active window:

1. NPC targets use the existing resilience query.
2. `PropDamageSystem` evaluates world props against the same stored origin, direction, range and arc.
3. A prop receives a `prop:<id>` hit key, preventing duplicate damage during the same attack.
4. A miss, rear-facing attack or out-of-range attack leaves the prop intact.

The prop radius slightly expands edge contact while preserving directional aim.

## Break result

Breaking a streetlight:

- adds its ID to `GameScene.brokenLights`;
- swaps the map drawing to the broken pole;
- removes its light field;
- creates the existing circular broken-light shadow;
- plays the glass/break sound;
- shows a short `BROKEN` burst;
- adds a small amount of district exposure/heat;
- emits visual and heard-only reactions through sensory awareness;
- redraws the current layer.

## Perception

The existing `breakLight` sensory profile is reused.

- NPCs that see the attack use their type-specific visual response.
- Civilian visual witnesses can enter witness behaviour.
- Police visual confirmation escalates their response.
- NPCs that only hear the break turn toward it and show `WTF`.
- Hearing alone does not automatically start pursuit or reporting.

## Interaction ownership

`GameScene.collectInteractions()` is filtered so `breakLight` options never reach the E interaction layer. The old method remains compatibility debt but has no normal player-facing route.

Current ownership:

- Left mouse: attack NPC or damage aimed prop.
- E: clues, dialogue, bodies and mission objects.

## Events

Implemented plain-data events:

- `prop:damaged`
- `prop:broken`
- `noise:emitted` with `kind: "streetlightBreak"`

## Automated coverage

`tests/props.test.js` verifies:

- a correctly aimed in-range attack hits;
- targets behind the player are rejected;
- targets beyond expanded reach are rejected;
- one damage point breaks a baseline streetlight;
- broken props ignore repeated damage.

## Known limitations

- Only streetlights currently implement the reusable prop contract.
- Prop integration currently enters through a runtime adapter and should move into explicit scene composition during Milestone 10.
- Break noise still bridges into the existing sensory-awareness implementation rather than a consolidated perception service.
- Exact hit radius, feedback and exposure values require browser playtesting.
