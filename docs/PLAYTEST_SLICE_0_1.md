# Playtest Slice 0.1 — Hunt, Feed, Escape

_Last updated: 2026-08-02_

**Status: 🔵 Draft PR #50 — active manual iteration. Do not treat the slice as release-ready until the validation section is green.**

## Agent handoff — read this first

This document is the authoritative continuation point for future AI agents working on the playtest.

- **Repository:** `FranPerezSevilla/vampire-district`
- **Working branch:** `agent/playtest-slice-0-1`
- **Pull request:** `#50 — Playtest Slice 0.1: Hunt, Feed, Escape`
- **Launch URL:** `?mode=playtest`
- **Deploy Preview:** `https://deploy-preview-50--vampire-district.netlify.app/?mode=playtest`
- **Do not move this work to `main` or another branch without an explicit user request.**
- After every material gameplay, balance, UX or scope change, update this document in the same branch.

Current continuation priorities:

1. keep manual-testing the complete Hunt → Feed → Escape → Return loop;
2. validate police perception, Heat pacing and vehicle exit reliability in the browser;
3. keep the slice narrow instead of adding campaign content;
4. update outdated tests whenever an intentional contract change makes their old wording or values invalid;
5. do not claim CI is green without checking the latest head commit.

## Product question

This slice exists to answer one question before more campaign, faction-service or progression work is added:

> Is it understandable and enjoyable to hunt, choose how far to feed, create consequences and escape back to safety?

It is not a commercial demo and it is not the opening chapter of the future campaign.

## Narrative framing

The playtest uses a minimal narrative beat rather than a long exposition screen.

Player-facing copy:

> **VICEBLOOD · ONE MORE NIGHT**
>
> **Immortality was never the luxury you imagined.**
>
> You were turned into a vampire decades ago. Since then, clan wars and keeping the Veil hidden from humanity have defined every night of your existence.
>
> Tonight, hunger comes first. Feed, lose the police, and return to the refuge.

Presentation contract:

- the title is deliberately broken into two balanced lines;
- all copy shares one left edge;
- the headline is slightly smaller than the first iteration so it does not dominate the whole panel;
- the narrative paragraph is ordinary body copy, not an indented quotation;
- the intro must establish vampire identity, clan conflict and the Veil, then move immediately into play;
- it must not become a lore dump.

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

- the short narrative intro defined above;
- a three-step objective coach and countdown;
- a contextual pulse or arrow toward the nearest active civilian while hunting or feeding;
- a visible refuge zone and directional marker during the return step;
- the existing mission drawer repurposed as the run checklist;
- a deterministic end screen with run statistics;
- `Play again` and `Send feedback` actions;
- an always-available feedback button and `P` shortcut;
- local feedback backup if the external collector cannot be reached.

The result report records time, final Hunger, feeding depths, maximum Police Heat, maximum Exposure, witness reports, vehicle use and alternate-layer use.

## Pedestrians and navigation

Pedestrian routes are guidance, not narrow rails.

- Ordinary pedestrians and foot police may use sidewalks, zebra crossings and open pedestrian space between roads and buildings.
- They should not walk along ordinary road surfaces during normal behaviour.
- A terrified witness may choose a direct route through the road and accepts the risk of being struck by traffic.
- Spawn separation and local collision resolution must prevent crowds and police from stacking into one point.

## Consequence density

The playtest cannot validate feeding consequences if the streets are empty or obvious violence is ignored.

- every authored pedestrian route receives distributed ambient civilians;
- materialized civilian traffic contributes one witness group per occupied vehicle;
- visible feeding, violence or power use beside occupied traffic may create a delayed report;
- ordinary witnesses still require real visual contact and line of sight;
- a feeding victim remains stationary until feeding resolves or is interrupted;
- obvious sustained violence can generate local Heat even when no direct witness survives;
- ambient violence never creates supernatural Exposure or magically reveals the player's live position.

Current ambient-violence pacing:

- rapid unwitnessed street deaths add diminishing Heat: `4`, then `5`, then `6`, then `4`;
- three rapid deaths therefore produce `15` Heat, below Wanted 1 by themselves;
- further escalation requires another source of attention or continued violence.

## Heat pacing

Current Wanted thresholds:

- **Wanted 1:** `22` Heat;
- **Wanted 2:** `55` Heat;
- **Wanted 3:** `85` Heat.

Heat should create consequences without turning one mistake into immediate district saturation.

Vehicle-pedestrian impact bursts use diminishing returns:

- non-lethal: `7`, `4`, `3`, `2`;
- lethal: `14`, `8`, `5`, `3`.

A rapid impact burst cannot climb more than one Wanted band by itself. Police assault and police neutralization retain their own stronger escalation rules, but a single vehicle impact on an officer must not double-count into an instant Wanted 3.

## Police pressure and knowledge contract

Police population targets:

- **Wanted 0:** two ambient foot patrols;
- **Wanted 1:** four officers;
- **Wanted 2:** eight potential officers with two pursuit cruisers;
- **Wanted 3:** up to twelve officers, a third roadblock cruiser and helicopter pressure.

Temporary response officers must withdraw when the Wanted level falls instead of becoming permanent wandering patrols. Retiring officers travel toward district exits and become inactive there.

Police knowledge follows an arcade GTA2-inspired model without removing vampire stealth:

- **Wanted 1 — last known:** police search the incident or last-seen position. Direct sight starts a chase.
- **Wanted 2 — periodic dispatch:** while the player is visible on the street and outside shadow, dispatch updates an approximate predicted interception point roughly every `1.8` seconds.
- **Wanted 3 — live street pressure:** while the player remains visible on the street, police receive near-live tracking and try to contain the player.
- **Shadows:** break periodic and live dispatch updates; police continue toward the last known position.
- **Rooftops and sewers:** cut surface tracking completely. Surface police may search exits but do not know the player's exact alternate-layer position.
- **Direct visual contact:** always overrides stale dispatch information.

Diagnostic browser API:

```js
window.NBD_PLAYTEST_SESSION.policeKnowledge()
```

It reports `last-known`, `periodic` or `live` mode.

## Vehicle contract

- Enter and exit use `Enter`.
- Exiting requires a valid landing point plus a walkable escape corridor.
- The player must be placed clear of the vehicle footprint.
- Vehicle occupancy, residual movement and input-edge state must be cleared explicitly.
- Being unable to exit safely should reject the action instead of trapping the player after dismounting.

Vehicle exit has regressed during manual testing before; always retest it after changes to input, collision, navigation or vehicle geometry.

## Feedback questions and collector contract

The embedded form asks about fun, objective clarity, best moment, frustration, readability of Hunger/Heat/Exposure, willingness to play more, optional identity and optional bug notes.

A technical snapshot of the run and browser is submitted with the answers. The payload keeps the existing Google Apps Script fields (`liked`, `disliked`, `missing`, `playerName` and `snapshot`) while retaining richer structured answers.

## Validation status

Required before public recruitment:

- [ ] latest-head GitHub Actions is green;
- [ ] ten consecutive runs can start, complete or fail, restart and submit feedback without a blocker;
- [ ] repeated vehicle entry and exit cannot immobilize the player;
- [ ] Heat pacing feels readable across ordinary feeding, gunfire, traffic impacts and police violence;
- [ ] Wanted 1 searches last-known positions rather than tracking telepathically;
- [ ] Wanted 2 interception is threatening but can be broken with shadows or layer changes;
- [ ] Wanted 3 creates strong surface pressure without invalidating rooftops and sewers;
- [ ] surplus police visibly withdraw when pressure falls;
- [ ] one real submission appears correctly in the configured Google Sheet;
- [ ] three blind testers receive no verbal explanation;
- [ ] at least two understand the goal within the first minute;
- [ ] at least two complete the run or correctly understand why they failed;
- [ ] the itch.io ZIP contains `index.html` at its root and runs without repository setup.

Known validation debt at the time of this update:

- the last inspected full unit run contained outdated assertions around pedestrian wording/surface labels and vehicle-exit test geometry;
- the new police-knowledge unit tests themselves passed;
- future agents must inspect the newest workflow run because this status can change after every commit.

## Deliberate non-goals

- persistent hunter investigation;
- a new authored campaign or narrative contract;
- faction favours and vampire-city services;
- safehouse progression, stash or dawn simulation;
- Retainers;
- expanded weapon catalogue or drive-by combat;
- new city geometry;
- final art, animation, audio or balance.

The slice should reveal which of those investments are supported by player behaviour rather than delaying the first useful playtest.
