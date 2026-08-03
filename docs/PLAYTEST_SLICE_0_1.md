# Playtest Slice 0.1 — Hunt, Feed, Escape

_Last updated: 2026-08-02_

**Status: 🔵 Draft PR #50 — active manual iteration. Not release-ready until validation is green.**

## Agent handoff — read first

This is the authoritative continuation point for future AI agents.

- **Repository:** `FranPerezSevilla/vampire-district`
- **Branch:** `agent/playtest-slice-0-1`
- **PR:** `#50 — Playtest Slice 0.1: Hunt, Feed, Escape`
- **Preview:** `https://deploy-preview-50--vampire-district.netlify.app/?mode=playtest`
- Work only on this branch unless the user explicitly requests otherwise.
- Update this document after every material gameplay, balance, UX, boot or scope change.
- Never claim CI is green without checking the latest head commit.

Current priorities:

1. manually validate the full Hunt → Feed → Escape → Return loop;
2. retest keyboard movement immediately after intro dismissal;
3. validate police perception, Heat pacing and repeated vehicle exit;
4. keep the slice narrow and avoid adding campaign content;
5. repair outdated tests when an intentional contract change invalidates them.

## Product question

> Is it understandable and enjoyable to hunt, choose how far to feed, create consequences and escape back to safety?

This is not a commercial demo and not the opening campaign chapter.

## Narrative framing

Player-facing copy:

> **VICEBLOOD · ONE MORE NIGHT**
>
> **Immortality was never the luxury you imagined.**
>
> You were turned into a vampire decades ago. Since then, clan wars and keeping the Veil hidden from humanity have defined every night of your existence.
>
> Tonight, hunger comes first. Feed, lose the police, and return to the refuge.

Presentation contract:

- two balanced headline lines;
- all content shares one left edge;
- ordinary body copy, not an indented quotation;
- brief premise followed immediately by the objective;
- no lore dump.

## Boot and intro contract

The playtest uses `?mode=playtest` and is isolated from persistent free-roam saves.

There are two presentation phases but only one visible narrative:

1. `PlaytestBootCover` displays the final narrative while Phaser and the city load; its disabled button reads `Preparing the city…`.
2. The interactive intro displays the same narrative and enables `Step into the night · Enter`.

They must never show different copy or visibly swap between an obsolete and current design.

### Keyboard blocker invariant

The loading cover temporarily blocks keyboard input. That blocker must be globally unique and must always be removed when the cover finishes.

- `app-bootstrap.js` imports `PlaytestBootCover.js` through one canonical, unversioned module URL.
- The blocker is stored under `window.__NBD_PLAYTEST_BOOT_KEY_BLOCKER__` so duplicate module evaluation cannot register an orphan listener.
- `finishPlaytestBootCover()` removes the global listener and deletes the global key.
- A regression previously left WASD disabled while mouse input still worked because the cover module was imported once with `?v=...` and once without it. Do not reintroduce version parameters on the `PlaytestBootCover.js` import.

Top-level playtest bootstrap may still be cache-versioned. Static HTML, JS and CSS are served with no-cache headers in the Deploy Preview.

## Session contract

Target duration: **10–15 minutes**.

```text
start at the refuge with high Hunger
→ leave the safe area
→ find a victim
→ choose Quick Bite, Full Feed or Drain
→ lower Hunger to 25% or less
→ survive or avoid police response
→ clear Heat
→ return to the refuge on foot
→ review the run report
→ submit feedback or replay
```

Completion requires leaving the refuge, resolving at least one feed, reaching Hunger ≤25%, clearing Heat, returning inside the refuge radius and not being inside a vehicle. The run fails after fifteen minutes.

## Pedestrians and witnesses

- Ordinary pedestrians and foot police may use sidewalks, zebra crossings and open pedestrian space between roads and buildings.
- They should not normally walk along road surfaces.
- Terrified witnesses may run into traffic and risk being struck.
- Crowds and police must not stack into one point.
- Traffic occupants can act as lightweight witness groups.
- Witnesses require real visual contact and line of sight.
- Feeding victims remain stationary until feeding resolves or is interrupted.
- Sustained obvious violence can create local Heat without surviving direct witnesses, but never Exposure or live player tracking.

Ambient unwitnessed death Heat currently diminishes as `4`, `5`, `6`, then `4`. Three rapid deaths produce `15` Heat.

## Heat pacing

Wanted thresholds:

- **Wanted 1:** `22`
- **Wanted 2:** `55`
- **Wanted 3:** `85`

Vehicle impact bursts:

- non-lethal: `7`, `4`, `3`, `2`;
- lethal: `14`, `8`, `5`, `3`.

A rapid burst cannot climb more than one Wanted band by itself. A police impact must not double-count into instant Wanted 3.

## Police contract

Population targets:

- Wanted 0: two ambient foot patrols;
- Wanted 1: four officers;
- Wanted 2: eight potential officers plus two pursuit cruisers;
- Wanted 3: up to twelve officers, a third roadblock cruiser and helicopter pressure.

Temporary responders withdraw toward district exits when pressure falls.

Police knowledge follows an arcade GTA2-inspired model:

- **Wanted 1:** last known position; direct sight starts chase.
- **Wanted 2:** approximate predicted dispatch update every ~1.8 seconds while visible on the street and outside shadow.
- **Wanted 3:** near-live street tracking while visible.
- **Shadows:** break dispatch updates.
- **Rooftops and sewers:** cut surface tracking.
- **Direct sight:** overrides stale information.

Diagnostic API:

```js
window.NBD_PLAYTEST_SESSION.policeKnowledge()
```

## Vehicle contract

- Enter and exit use `Enter`.
- Exit requires a valid landing point and walkable escape corridor.
- The player must appear clear of the vehicle footprint.
- Occupancy, residual movement, body activation and input edges must be reset explicitly.
- Unsafe exits are rejected rather than trapping the player.
- Repeated entry and exit is a mandatory manual regression test.

## Validation status

Required before public recruitment:

- [ ] latest-head GitHub Actions green;
- [ ] intro displays one consistent design from first frame to interactive state;
- [ ] WASD works immediately after starting, with no stale boot key blocker;
- [ ] ten consecutive sessions start, complete/fail, restart and open feedback;
- [ ] repeated vehicle entry/exit never immobilizes the player;
- [ ] Heat pacing is readable for feeding, gunfire, collisions and police violence;
- [ ] Wanted 1 searches last-known positions;
- [ ] Wanted 2 can be broken with shadows or layer changes;
- [ ] Wanted 3 pressures the street without invalidating rooftops and sewers;
- [ ] surplus police visibly withdraw;
- [ ] one real feedback row reaches the configured Google Sheet;
- [ ] three blind testers receive no verbal explanation;
- [ ] itch.io ZIP has `index.html` at its root and runs independently.

Known test debt from an earlier full run included obsolete pedestrian wording/surface expectations and narrow vehicle-exit fixture geometry. Always inspect the newest run because this status changes after each commit.

## Deliberate non-goals

- persistent hunter investigation;
- new campaign missions;
- faction services;
- safehouse progression or dawn simulation;
- Retainers;
- expanded weapon catalogue or drive-by combat;
- new city geometry;
- final art, animation, audio or balance.
