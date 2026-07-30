# Playtest Slice 0.1 — Hunt, Feed, Escape

_Last updated: 2026-07-30_

**Status: 🔵 Draft PR #50 — implementation complete; automated and manual validation pending.**

## Product question

This slice exists to answer one question before more campaign, faction-service or progression work is added:

> Is it understandable and enjoyable to hunt, choose how far to feed, create consequences and escape back to safety?

It is not a commercial demo and it is not the opening chapter of the future campaign.

## Launch mode

The slice uses an isolated browser boot profile:

```text
?mode=playtest
```

Playtest mode:

- does not load or overwrite the player's persistent free-roam campaign;
- does not register retired journalist missions or tutorial content;
- starts from the accepted City Topology V2 street spawn;
- reuses the current feeding, Hunger, powers, Heat, Exposure, witnesses, police, vehicles, rooftops and sewer systems;
- restarts reliably through a full page reload into the same isolated mode.

Normal production boot remains persistent missionless free roam.

## Session contract

Target duration: **10–15 minutes**.

```text
start at the refuge with high Hunger
→ leave the safe area
→ find a valid victim
→ choose Quick Bite, Full Feed or Drain
→ lower Hunger to 25% or less
→ survive or avoid the resulting police response
→ return to the refuge on foot
→ review the run report
→ submit feedback or play again
```

Completion requires:

- the player has moved beyond the refuge perimeter;
- at least one feeding action has resolved;
- Hunger is `25%` or lower;
- Police Heat is clear;
- the player is back inside the refuge radius;
- the player is not still inside a vehicle.

The run fails when its fifteen-minute limit expires. The first playtest deliberately avoids additional arbitrary failure meters.

## Player-facing package

The social playtest build must provide:

- a dedicated title/start screen with the goal and four essential controls;
- a three-step objective coach and countdown;
- a contextual pulse/arrow toward the nearest active civilian while hunting or feeding;
- a visible refuge zone and directional marker during the return step;
- the existing mission drawer repurposed as the run checklist;
- a deterministic end screen with run statistics;
- `Play again` and `Send feedback` actions;
- an always-available feedback button and `P` shortcut;
- local feedback backup if the external collector cannot be reached.

The result report records:

- time;
- final Hunger;
- total feeds and each feeding depth;
- maximum Police Heat;
- maximum Exposure;
- witness reports;
- whether a vehicle was used;
- whether a rooftop or sewer layer was used.

## Feedback questions and collector contract

The embedded form asks:

1. fun rating from 1 to 5;
2. whether the objective was understood;
3. what was most fun;
4. where the player felt lost or frustrated;
5. whether Hunger, Heat and Exposure were understandable;
6. whether the player would play another run or longer version;
7. optional name or handle;
8. optional bug or extra comment.

A technical snapshot of the run and browser is submitted with the answers. The payload keeps the existing Google Apps Script fields (`liked`, `disliked`, `missing`, `playerName` and `snapshot`) so the current Sheet continues receiving meaningful columns, while retaining the richer structured answers for a future collector migration.

## Readiness gate for a social-media call

Before the link is posted publicly:

- ten consecutive runs can start, complete or fail, restart and submit feedback without a blocker;
- one real submission is verified in the configured Google Sheet;
- three blind testers receive no verbal explanation;
- at least two understand the goal within the first minute;
- at least two complete the run or correctly understand why they failed;
- no tester is blocked because they cannot discover how to feed;
- the supported desktop browsers and keyboard/mouse requirement are stated in the post;
- the generated itch.io ZIP contains `index.html` at its root and runs without repository setup.

## Deliberate non-goals

- persistent hunter investigation;
- a new authored campaign or narrative contract;
- faction favours and vampire-city services;
- safehouse progression, stash or dawn simulation;
- Retainers;
- expanded weapon catalogue or drive-by combat;
- new city geometry;
- final art, animation, audio or balance.

The slice should reveal which of those investments are actually supported by player behaviour rather than delaying the first useful playtest.
