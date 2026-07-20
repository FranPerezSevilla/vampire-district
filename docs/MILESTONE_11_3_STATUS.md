# Milestone 11.3 — Player-facing campaign flow and refuge board

_Last updated: 2026-07-20_

## Status

**🟡 Milestone 11.3A is merged; 11.3B is rebased onto `main` with final automated acceptance pending.**

Milestone 11.3 exposes persistent campaign state to the player and then turns the rooftop refuge into the first reusable contract hub. It does not add vehicles or replace `MissionRunner` as campaign authority.

Acceptance history:

```text
11.3A final head   f1dbec9ab6393159026891d17e8453d288a5126c
11.3A squash merge 8b5a96f80837c88d4831e83e6c735b4698865bdb
11.3B pull request #13
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

A successful New Game or Retry action writes one session-only automatic-entry token, reloads the page and lets the existing checkpoint/tutorial boot order restore one coherent world. A normal later visit presents Continue again.

The final 11.3A head passed unit tests, the complete Chromium suite and its Netlify deploy preview before merge.

## 11.3B — Refuge contract board

After `Silence the Journalist` is complete, the rooftop refuge exposes a contextual contract-board interaction. The board:

- pauses the world through a first-class `MissionBoardSystem`;
- traps keyboard focus inside one accessible dialog;
- lists board-authored mission definitions and rewards;
- prevents a second contract while a mission or unresolved failure exists;
- supports replayable contracts without duplicating rewards on reload;
- returns automatically after the player dismisses a completed board contract report.

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

`CleanTheSceneSystem` never stores a parallel objective index. It reads the active `MissionRunner` record and emits the existing typed campaign events. Camera-roll visibility and body state are reconstructed from the mission record and the atomic world checkpoint.

## Save and retry rules

- Accepting a board contract clears the previous mission-completion checkpoint.
- The board requests a safe checkpoint for the contract's first objective immediately after acceptance.
- Later objective checkpoints continue to use definition-authored policies.
- The exposed body is a static campaign NPC and is included in normal checkpoint capture.
- Camera-roll visibility is derived from objective completion and therefore rolls back with the mission record.
- A completion checkpoint is written before the success report is dismissed.
- Reloading completed `Clean the Scene` preserves $775 total campaign cash and two ledger entries after the opening contract.
- Failed board contracts remain subject to the 11.3A Retry-from-checkpoint entry decision.

## Accessibility and presentation

- The board is a modal dialog with one accessible title.
- Tab and Shift+Tab remain inside enabled board actions.
- Escape closes the board without mutating campaign state.
- Enter and Space activate focused campaign and result actions explicitly.
- The native game modal is hidden and inert while the board owns focus.
- Narrow layouts stack contract actions vertically.
- The mission drawer reads the active campaign snapshot for the five-step cleanup checklist while retaining the opening mission's validated four-task presentation.
- Dismissing a board-contract result cannot erase the opening mission's accepted compatibility state.

## Automated boundary

Coverage includes:

- pure board unlock, active/failure exclusion and replay labels;
- complete `Clean the Scene` typed-event progression and reward idempotency;
- bootstrap ordering for campaign entry then mission board;
- both playable routes rendering the accessible board;
- keyboard focus loop, Escape close, focused result activation and narrow layout;
- world camera-roll collection, body hiding, police-attention loss and refuge completion;
- completion checkpoint reload without duplicate money or reputation;
- opening-mission armed free roam after `REPORT ACCEPTED` while the board is installed.

## Final acceptance gate

Before PR #13 can merge:

```text
unit-tests              must be green on the final rebased head
browser-smoke           must be green on the same head
Netlify deploy preview  must be green on the same head
```

## Next milestone

After Milestone 11.3 is accepted, production moves to **Milestone 12 — Vehicle core**: contextual entry/exit, arcade handling, health and collisions, occupant state, speed-sensitive camera, parked/owned/stolen metadata and limited trunk storage.