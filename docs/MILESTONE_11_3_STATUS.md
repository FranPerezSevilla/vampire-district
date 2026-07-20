# Milestone 11.3 — Player-facing campaign flow and refuge board

_Last updated: 2026-07-20_

## Status

**✅ Complete and merged into `main`.**

Milestone 11.3 exposes persistent campaign state to the player and turns the rooftop refuge into the first reusable contract hub. It does not add vehicles or replace `MissionRunner` as campaign authority.

Acceptance history:

```text
11.3A campaign entry
PR #12  final head   f1dbec9ab6393159026891d17e8453d288a5126c
        squash merge 8b5a96f80837c88d4831e83e6c735b4698865bdb

11.3B refuge board and Clean the Scene
PR #13  final head   d6b19bf047b62e6f206ef9e2be591bc4ee24629c
        squash merge 7eefb061a05d2066929b7a2d61017d3fed0687be
```

Final automated acceptance on the PR #13 head:

```text
unit-tests              ✅
browser-smoke           ✅
Netlify deploy preview  ✅
merge conflicts         none
branch behind main      0 commits
```

## 11.3A — Campaign entry

The boot-time campaign state is classified before Phaser scenes are composed:

```text
fresh state                 → New Game
active mission              → Continue / New Game
failed + safe checkpoint    → Retry from checkpoint / New Game
failed without checkpoint   → Retry mission / New Game
completed opening contract  → Continue free roam / New Game
```

A successful New Game or Retry action writes one session-only automatic-entry token, reloads the page and lets the checkpoint/tutorial boot order restore one coherent world. A normal later visit presents Continue again.

Rules:

- A fresh campaign does not start until the player chooses New Game.
- Continue never resets state or duplicates rewards.
- A failed checkpoint remains serialized but is not applied behind the player's back.
- Retry starts the same mission record and restores the safe checkpoint after reload.
- New Game resets money, reputation, mission history, inventory contracts and checkpoints before starting the opening contract.
- Continuing completed state dismisses the old report and enters free roam.

## 11.3B — Refuge contract board

After `Silence the Journalist` is complete, the rooftop refuge exposes a contextual contract-board interaction. The board:

- pauses the world through a first-class `MissionBoardSystem`;
- traps keyboard focus inside one accessible dialog;
- lists cards derived from mission definitions and campaign state;
- prevents a second contract while a mission or unresolved failure exists;
- supports replayable contracts without duplicating rewards on reload;
- returns automatically after the player dismisses a completed board-contract report.

`Clean the Scene` is the first selectable contract. Its complete world flow is:

```text
refuge board
  → reach nightclub service alley
  → recover compromised camera roll
  → drag exposed body into a valid hiding place
  → lose Exposure / police attention
  → return to rooftop refuge
  → receive $275, Directorate +2 and cleaner contact +3
  → contract board reopens
```

## Ownership

```text
MissionDefinition           ← objectives, rewards, board and placement metadata
MissionRunner               ← objective, status, progress and reward authority
MissionSystem               ← stable scene-facing mission facade
CleanTheSceneSystem         ← mission-specific world triggers and entities
MissionBoard                ← pure availability/card model
MissionBoardSystem          ← refuge interaction, accessible UI and selection
CampaignCheckpointSystem    ← safe objective and completion restoration
```

`CleanTheSceneSystem` never stores a parallel objective index. It reads the active `MissionRunner` record and emits existing typed campaign events. Camera-roll visibility and body state are reconstructed from the mission record and atomic world checkpoint.

## Save and retry rules

- Accepting a board contract clears the previous mission-completion checkpoint.
- The board requests a safe checkpoint for the contract's first objective immediately after acceptance.
- Later objective checkpoints use definition-authored policies.
- The exposed body is a static campaign NPC and is included in normal checkpoint capture.
- Camera-roll visibility is derived from objective completion and rolls back with the mission record.
- A completion checkpoint is written before the success report is dismissed.
- Reloading completed `Clean the Scene` preserves `$775` total campaign cash and two ledger entries after the opening contract.
- Failed board contracts use the 11.3A Retry-from-checkpoint entry decision.

## Accessibility and presentation

- The campaign entry and board each expose one modal dialog with an accessible title.
- Tab and Shift+Tab remain inside enabled actions.
- Escape cannot dismiss a required campaign-entry decision.
- Escape closes the optional board without mutating campaign state.
- Enter and Space activate focused campaign, board and success-result actions explicitly before Phaser can consume them.
- The native game modal is hidden and inert while campaign UI owns focus.
- Narrow layouts stack actions vertically.
- The mission drawer uses a five-step cleanup checklist while retaining the opening mission's validated four-task presentation.
- Dismissing a board-contract result cannot erase the accepted opening-mission compatibility state.

## Automated coverage

Coverage includes:

- pure fresh/active/failed/completed entry classification;
- explicit automatic-start gate and safe Retry flow;
- both playable routes showing New Game and later Continue;
- board unlock, active/failure exclusion and replay labels;
- complete `Clean the Scene` typed-event progression and reward idempotency;
- bootstrap ordering for campaign entry then mission board;
- keyboard focus loops, Escape behaviour, focused result activation and narrow layout;
- world camera-roll collection, body hiding, police-attention loss and refuge completion;
- completion checkpoint reload without duplicate money or reputation;
- opening-mission armed free roam after `REPORT ACCEPTED` while the board is installed.

## Browser APIs

```js
window.NBD_CAMPAIGN_ENTRY_READY

window.NBD_MISSION_BOARD.snapshot()
window.NBD_MISSION_BOARD.open()
window.NBD_MISSION_BOARD.close()
window.NBD_MISSION_BOARD.accept("clean_the_scene")
```

## Next milestone

Production now moves to **Milestone 12 — Vehicle core**: contextual entry/exit, arcade handling, health and collisions, occupant state, speed-sensitive camera, parked/owned/stolen metadata and limited trunk storage.
