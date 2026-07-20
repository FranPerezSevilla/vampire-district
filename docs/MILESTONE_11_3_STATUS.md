# Milestone 11.3 — Player-facing campaign entry

_Last updated: 2026-07-20_

## Status

**🟡 Campaign entry slice implemented; automated and live-browser acceptance pending.**

This slice exposes the persistent campaign state to the player before the mission-board content pass. It does not add vehicles or change the authored result of `Silence the Journalist`.

## Player flow

The boot-time campaign state is classified before Phaser scenes are composed:

```text
fresh state                 → New Game
active mission              → Continue / New Game
failed + safe checkpoint    → Retry from checkpoint / New Game
failed without checkpoint   → Retry mission / New Game
completed opening contract  → Continue free roam / New Game
```

A successful New Game or Retry action writes one session-only automatic-entry token, reloads the page and lets the existing checkpoint/tutorial boot order restore one coherent world. A normal later visit presents Continue again.

## Ownership

```text
CampaignEntry               ← pure state classification and labels
CampaignSystem              ← explicit start/reset/retry mutations
CampaignCheckpointSystem    ← restore only after Retry is chosen
CampaignEntrySystem         ← accessible DOM presentation and input
MissionSystem               ← unchanged opening-mission world adapter
```

`CampaignEntrySystem` is attached after checkpoint and tutorial initialization. It owns its own overlay rather than adding campaign branches to `UIScene`.

## Save and retry rules

- A fresh campaign does not start until the player chooses New Game.
- The existing automatic `MissionSystem` opening start is blocked only while a campaign-entry decision is outstanding.
- A failed run keeps its latest safe checkpoint serialized but does not apply it behind the player's back.
- Retry starts the same mission record, preserves the safe checkpoint, reloads and then restores atomically.
- New Game resets campaign cash, reputation, mission history, inventory contracts and checkpoints before starting the opening contract.
- Continue never duplicates mission rewards or rebuilds campaign state.
- Continuing completed state dismisses the old result presentation and enters free roam.

## Test boundary

The long release-candidate suite keeps its historical deterministic auto-start under `?rcTest=1`. Dedicated entry coverage opts into the real decision screen with:

```text
?rcTest=1&campaignEntryTest=1
```

Automated coverage includes:

- pure fresh/active/failed/completed classification;
- explicit automatic-start gate;
- both playable routes showing New Game and later Continue;
- failed-run checkpoint remaining unapplied until Retry;
- retry reload restoring the same safe checkpoint;
- source ownership and bootstrap order.

## Acceptance still required

- Unit tests green on the final branch head.
- Complete Chromium suite reaches a real conclusion under the extended CI budget.
- New Game, Continue and Retry work on `/` and `/phaser/` in a normal browser.
- Keyboard Enter activates the primary choice and Escape cannot accidentally dismiss the decision.
- Narrow viewport keeps both actions visible and operable.
- Existing tutorial, mission finale, reward idempotency and post-report free roam remain unchanged.

## Next slice

Milestone 11.3B will add the refuge mission board and make `Clean the Scene` selectable with data-driven world placement, completion and return-to-board flow. Vehicle work remains Milestone 12.
