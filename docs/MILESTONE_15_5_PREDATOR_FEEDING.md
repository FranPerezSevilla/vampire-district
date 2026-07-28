# Milestone 15.5 — predator feeding depths

_Last updated: 2026-07-28_

## Goal

Turn feeding from one all-or-nothing drain into a held predator action with three intentional release depths while preserving direct control and the existing deterministic range, aim, awareness, geometry and interruption rules.

The player holds the existing contextual right-click action and chooses when to release. Viceblood does not add a separate rhythm minigame.

## Feeding depths

### Quick Bite

- reached first;
- modest Hunger relief;
- victim remains alive and conscious or briefly disoriented;
- short interaction and witness window;
- no abandoned body;
- limited bite evidence and partial memory;
- may still be poaching or protected-prey harm.

### Full Feed

- reached second;
- substantial Hunger relief;
- victim survives but becomes unconscious/downed;
- visible bite and victim evidence remain;
- the unconscious victim can be dragged, dropped or hidden through the existing evidence interactions;
- higher interruption and discovery risk than Quick Bite.

### Drain

- reached at the end of the hold;
- maximum Hunger relief;
- victim dies;
- body and abnormal feeding evidence remain;
- severe political and investigative consequences;
- preserves the current drain result as the deepest outcome.

## Runtime contract

`FeedingSystem` owns one progress value and resolves exactly one result when the player releases or reaches the final threshold.

Expected result data:

```text
feedingDepth
progress
thresholdReached
hungerBefore
hungerAfter
hungerRelief
victimOutcome
victimAlive
victimConscious
bodyEvidence
biteEvidence
memoryState
interrupted
source
eligibility
```

Expected events:

```text
feeding:started
feeding:threshold-reached
feeding:resolved
feeding:interrupted
```

The existing `feeding:completed` event may remain as a compatibility event during migration, but new systems should consume the resolved depth contract.

## Hunting-law integration

Every resolved feeding depth is assessed using the real victim outcome and evidence profile.

- Quick Bite can be legal, tolerated, poaching or protected without creating a corpse.
- Full Feed creates recoverable-victim evidence but not a dead body.
- Drain creates body and bite evidence.
- Protected prey overrides any district permission at every depth.
- The territory owner remains evidence-limited rather than omniscient.

## Player feedback

The hold must communicate the next meaningful release point without becoming a timing minigame.

- one compact progress/readiness indicator;
- clear labels for `QUICK BITE`, `FULL FEED` and `DRAIN`;
- release resolves the deepest threshold already reached;
- interruption explains why feeding stopped;
- the Night Ledger records the resolved depth and political discovery state.

## Initial tuning targets

These values are implementation starting points and remain data-owned:

```text
Quick Bite threshold   0.65 s
Full Feed threshold    1.65 s
Drain threshold        3.00 s

Quick Bite relief      14 Hunger
Full Feed relief       34 Hunger
Drain relief           58 Hunger
```

Relief is clamped to the current Hunger value. Rats remain exempt from faction hunting law and may keep a simplified feed outcome where appropriate.

## Deliberate limits

- no blood-quality, emotion or resonance system;
- no stored-blood inventory yet;
- no autonomous district hunting-pressure simulation;
- no faction retaliation chain;
- no new permanent resource meter;
- no arbitrary input seizure;
- no authored feeding cinematics.

## Acceptance

- the player can intentionally release at Quick Bite, Full Feed or Drain;
- each depth has a distinct Hunger value, victim outcome and evidence profile;
- full hold preserves the existing lethal drain outcome;
- interruption before the first threshold produces no feeding reward;
- interruption before a new threshold cancels, while interruption after one resolves the deepest newly reached depth;
- hunting law records the actual depth and evidence state;
- checkpoint/chunk projections preserve cumulative victim depth so blood cannot be farmed after reload;
- Night Ledger incidents distinguish the three outcomes;
- feeding remains playable when campaign/faction services are absent;
- unit, boot, campaign and systems suites remain green.
