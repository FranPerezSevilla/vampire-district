# Contextual predator feeding system

_Status: Milestone 4 eligibility complete; Milestone 15.5 feeding-depth implementation active in PR #43._

## Purpose

Feeding is a dedicated vampire action owned by the right mouse button. It never appears as an E interaction. The system distinguishes a vulnerable downed target from a standing target that can only be taken from behind while unaware, then lets the player choose how far to feed by releasing the held button.

## Authoritative files

- `phaser/src/data/drain.js` — pure eligibility, awareness and target-selection rules.
- `phaser/src/data/feeding.js` — feeding thresholds, cumulative Hunger relief and victim/evidence outcomes.
- `phaser/src/combat/DrainSystem.js` — right-button hold, runtime validation, progress feedback and heard-only reactions.
- `phaser/src/systems/FeedingSystem.js` — progress authority, release resolution, incremental Hunger relief and events.
- `phaser/src/systems/WitnessSystem.js` — active feeding sight and depth-specific witness response.
- `phaser/src/systems/EvidenceSystemCore.js` — bite/blood/body evidence and unconscious-victim cleanup/discovery.
- `phaser/src/factions/HuntingLawSystem.js` — territory, permission and protected-prey assessment for the actual feeding depth.
- `phaser/src/systems/AiStateSystem.js` — feeding priority and downed-recovery suppression.
- `tests/drain.test.js` — pure eligibility and priority tests.
- `tests/feeding-depth.test.js` — thresholds, outcomes and anti-farming Hunger arithmetic.
- `tests/browser/feeding-depths.spec.js` — real Quick Bite → Full Feed → Drain browser loop.

## Input contract

`InputSystem` exposes:

```js
{
  drainPressed,
  drainHeld,
  aimWorld
}
```

The action begins while right mouse is held on a valid target. Releasing resolves the deepest new threshold already reached:

```text
0.65 s   Quick Bite
1.65 s   Full Feed
3.00 s   Drain
```

Releasing before the first available threshold cancels with no Hunger reward. After a victim has already received a Quick Bite or Full Feed, a new hold resumes from that cumulative depth and only grants the remaining Hunger value. The same victim therefore cannot be farmed repeatedly.

Browser context-menu suppression remains scoped to the game canvas.

## Feeding outcomes

### Quick Bite

- `14` total Hunger relief;
- living, usually conscious and briefly disoriented victim;
- fresh bite evidence and partial memory;
- no abandoned body and no blood stain;
- may still be poaching or protected-prey harm.

### Full Feed

- `34` total Hunger relief, or only the incremental difference after a Quick Bite;
- living unconscious/downed victim;
- bite evidence plus one blood stain;
- victim can be dragged, dropped or hidden with the evidence interactions;
- a civilian who finds the victim can reveal latent political evidence.

### Drain

- `58` total Hunger relief, or only the remaining difference after shallower feeding;
- dead victim and drained body;
- bite/body evidence plus the strongest blood scene;
- preserves the old lethal drain outcome as the deepest result.

Rats retain one simplified one-second feed, restore `12` Hunger and remain exempt from faction hunting law.

## Eligibility

### Downed target

A target in combat state `downed` is feedable:

- from any approach direction;
- while inside the 34-unit start range;
- while aimed at;
- when no blocking geometry lies between player and target.

The start range deliberately exceeds the 32-unit unarmed punch range, so a maximum-range knockdown is immediately usable.

### Standing target

A standing human is feedable only when:

- inside the start range;
- aligned with the player's aim;
- the player lies inside the target's rear arc;
- the target is not alarmed, chasing, attacking, reporting or otherwise aware;
- the line between player and target is clear.

An active hunter in hunt mode is aware. Police who are searching but have not seen the player may still be approached from behind.

### Selection priority

1. Downed targets.
2. Rats.
3. Standing rear-arc targets.

Within one category, distance and aim angle decide.

## AI and recovery priority

A feeding victim cannot simultaneously attack, chase or report. Police and hunters retain timed downed recovery, but recovery is suspended while the feeding hold is active.

- Full Feed leaves them unconscious until their normal recovery time.
- Recovery clears the runtime unconscious marker but preserves the historical bite/depth record.
- Drain and ordinary death prevent recovery.
- Civilians and other non-recovering types remain downed until another system resolves them.

## Interruption

Feeding is interrupted by movement, damage, invalid geometry, range break, target/layer changes or world/UI locking.

The deterministic rule is:

- before a new threshold: cancel, no new reward;
- after a new threshold: resolve the deepest threshold reached and record that the result was interrupted.

This avoids arbitrary loss of blood already taken while preserving readable risk.

## Perception and evidence

Visual witnesses can react during the hold. A muffled struggle also causes nearby NPCs who only hear it to turn toward the source without immediately gaining perfect knowledge.

At resolution:

- witness radius/severity increases from Quick Bite to Full Feed to Drain;
- hunting law receives the real depth, victim outcome, memory and evidence profile;
- protected prey overrides any general hunting permission;
- evidence remains latent until a witness, protected marker, recovered victim/body or later investigation reveals it;
- the Night Ledger records the depth and discovery state.

## Feedback

- Valid targets show `RMB · FEED`.
- The held action shows one compact progress bar with threshold markers.
- Before a threshold it names the next result.
- After a threshold it says what releasing will resolve and what continued holding reaches next.
- There is no rhythm minigame and no automatic loss of control.

## Events

```text
feeding:right-click-started
feeding:started
feeding:threshold-reached
feeding:resolved
feeding:interrupted
feeding:cancelled
feeding:completed        compatibility event
hunger:changed
```

Events contain identifiers and serializable values rather than runtime objects.

## Persistence

The victim's cumulative feeding depth, memory/evidence markers, unconscious state and linked hunting assessments are included in checkpoint and chunk-delta projections. A reload cannot restore the victim's blood or grant the same Hunger again.

## Deliberate limits

- no blood quality, emotion or resonance system;
- no stored-blood inventory yet;
- no autonomous district hunting-pressure simulation;
- no feeding cinematics or timing minigame;
- final audio, animation and threshold tuning still require manual playtesting.
