# Contextual drain system

_Status: Milestone 4 implementation complete; browser regression and tuning remain pending._

## Purpose

Draining is now a dedicated vampire action owned by the right mouse button. It no longer appears as an E interaction. The system distinguishes a vulnerable downed target from a standing target that can only be taken from behind while unaware.

## Authoritative files

- `phaser/src/data/drain.js` — pure eligibility, awareness and target-selection rules.
- `phaser/src/combat/DrainSystem.js` — right-button channel, runtime validation, feedback and heard-only reactions.
- `phaser/src/systems/FeedingSystem.js` — channel progress, Hunger relief, completion and cancellation events.
- `phaser/src/input/input-runtime.js` — updates the drain system from the central input frame.
- `tests/drain.test.js` — pure eligibility and priority tests.

## Input contract

`InputSystem` already exposes:

```js
{
  drainPressed,
  drainHeld,
  aimWorld
}
```

A drain starts only when the right button is pressed and remains held. Releasing the button before completion cancels the channel. Browser context-menu suppression remains scoped to the game canvas.

## Eligibility

### Downed target

A target in combat state `downed` is drainable:

- from any approach direction;
- while inside the 34-unit start range;
- while aimed at;
- when no blocking geometry lies between player and target.

The start range deliberately exceeds the 32-unit unarmed punch range. A target knocked down by a maximum-range punch must be immediately eligible for feeding without requiring a confusing extra step toward the body.

### Standing target

A standing human is drainable only when:

- inside the start range;
- aligned with the player's aim;
- the player lies inside the target's rear arc;
- the target is not alarmed, chasing, attacking, reporting or otherwise aware of the player;
- the line between player and target is clear.

An active hunter in hunt mode is considered aware. Police who are searching but have not seen the player may still be approached from behind.

### Rats

Rats remain directly drainable within range and aim alignment. They do not use human awareness or rear-arc rules.

## Selection priority

When more than one target is valid:

1. Downed targets.
2. Rats.
3. Standing rear-arc targets.

Within the same category, distance and aim angle decide. The journalist receives only a very small tie-break bonus; it cannot override a clearly closer or better-aligned target.

## Channel cancellation

A right-click drain cancels when:

- the right button is released;
- the player moves;
- the player takes damage;
- the target becomes unavailable;
- the target changes layer;
- distance exceeds the 42-unit break range;
- blocking geometry separates player and target;
- UI, dialogue, transition or world locking interrupts gameplay.

Taking damage already cancels `FeedingSystem.active` through `PlayerDamageSystem`, so the same hit that raises Hunger also tears the player away from the victim.

## Perception

Visual witnesses continue to use the existing active-drain witness checks. A drain also emits a muffled struggle at start:

- NPCs who see the drain use their normal visual response.
- NPCs who only hear it turn toward the source and enter `WTF`.
- Hearing alone does not start pursuit or reporting.
- The victim is excluded from witnessing its own drain.

## Feedback

- A valid target receives a compact `RMB · DRAIN` marker.
- Downed candidates use a distinct ring from standing rear-drain candidates.
- During the channel, a tether and `HOLD RMB` label remain visible.
- An invalid right click briefly shows `NO VALID DRAIN`.
- Existing feeding progress remains visible above the player.

## Tutorial

The rooftop blocker sequence now teaches:

1. Aim and left-click four times to knock the thug down.
2. Aim at the downed thug.
3. Hold the right mouse button until the drain completes.

The tutorial control mode permits both primary attack and the abstract drain action. E is no longer used to drain.

## Events

Implemented events:

- `feeding:right-click-started`
- `feeding:started`
- `feeding:cancelled`
- `feeding:completed`
- `hunger:changed`

Events carry identifiers and plain values rather than system instances.

## Known limitations

- Legacy E-based stun and kill options remain temporarily available outside the guided rooftop drain. They are separate from feeding and will be removed or replaced as combat interactions and weapons are consolidated.
- Drain hearing currently reuses the sensory reaction state through a small runtime bridge rather than a final unified `PerceptionSystem` event contract.
- Exact range, rear angle, aim assistance and channel feel require browser playtesting.
- Browser smoke tests are still manual.
