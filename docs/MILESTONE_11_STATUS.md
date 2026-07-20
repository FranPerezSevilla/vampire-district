# Milestone 11 status

_Last updated: 2026-07-20_

## Status

**✅ Complete and merged into `main`.**

Milestone 11 converted the validated vertical slice into a persistent, reusable campaign with one mission authority, safe world checkpoints, explicit player-facing entry decisions and a refuge contract board.

## Acceptance record

```text
11.2 implementation
PR #9   final head   88d90ef5467526d43f8cc11ae6e7f76632383930
        squash merge b14520b37b525cb10796f5b448cfb9ec434e27f7

11.2 automated-validation hardening
PR #11  final head   1f0bedc02514efbf57c96a200fe4d7bc5b9caa40
        squash merge dc4210eba60eb752202e5b323e10f91ab2c32713

11.3A campaign entry
PR #12  final head   f1dbec9ab6393159026891d17e8453d288a5126c
        squash merge 8b5a96f80837c88d4831e83e6c735b4698865bdb

11.3B refuge board and Clean the Scene
PR #13  final head   d6b19bf047b62e6f206ef9e2be591bc4ee24629c
        squash merge 7eefb061a05d2066929b7a2d61017d3fed0687be
```

Final acceptance on 2026-07-20:

```text
manual opening-mission acceptance  ✅
unit-tests                         ✅
browser-smoke                      ✅
Netlify deploy previews            ✅
merge conflicts                    none
open Milestone 11 pull requests    none
```

## 11.1 — Campaign foundation

Delivered:

- versioned, serializable, JSON-only `CampaignState`;
- save, load, import, export and reset;
- corrupt-save fallback and explicit future-version rejection;
- cash wallet with deterministic transaction ids and auditable ledger;
- independent faction and contact reputation;
- validated serializable `MissionDefinition` data;
- generic typed-event `MissionRunner`;
- reusable reach, talk, collect, neutralize, destroy, escape, return, vehicle and wanted-level objectives;
- authored definitions for `Silence the Journalist` and `Clean the Scene`;
- browser campaign API through `window.NBD_CAMPAIGN`.

## 11.2 — Direct authority and safe checkpoints

Delivered:

- `MissionRunner` is authoritative for objective, status, progress, failure and rewards;
- `MissionSystem` is a scene-facing world and presentation facade, not a second state machine;
- `CampaignRuntimeBridge` physically removed;
- campaign schema version 2 with one atomic latest-safe checkpoint;
- objective-authored checkpoint policies and conservative migration spawns;
- restoration of mission record, player position/layer, Hunger, loadout and ammunition;
- restoration of broken lights, static NPC outcomes, corpses, blood evidence and tutorial completion;
- rollback of unsafe autosaved progress to the latest safe objective boundary;
- same-mission failed retry preserving its safe checkpoint;
- completion checkpoints protecting idempotent rewards;
- deterministic local Phaser and observable CI diagnostics.

Accepted ownership:

```text
MissionDefinition
      ↓
MissionRunner     ← progression, status, failure and reward authority
      ↓
MissionSystem     ← world triggers, markers, copy and narrative presentation
```

The compatibility `MissionSystem.step` value is derived from the active definition. It is not independently mutable campaign progress.

## 11.3 — Player-facing campaign and contract hub

Delivered campaign-entry choices:

```text
fresh state                 → New Game
active mission              → Continue / New Game
failed + safe checkpoint    → Retry from checkpoint / New Game
failed without checkpoint   → Retry mission / New Game
completed opening contract  → Continue free roam / New Game
```

Delivered refuge-board flow:

```text
complete Silence the Journalist
  → return to rooftop refuge
  → open contract board
  → select Clean the Scene
  → reach service alley
  → recover compromised camera roll
  → remove exposed body
  → lose police attention
  → return to refuge
  → receive rewards
  → board reopens
```

`Clean the Scene` rewards:

```text
Cash                         $275
Blackglass Directorate       +2
Directorate cleaner          +3
World flag                   cleaner_contact_unlocked
```

The board is definition-driven, keyboard accessible, focus trapped, responsive on narrow layouts and unavailable while another mission or unresolved failure owns the campaign.

## Persistence guarantees

- Rewards are granted once and recorded in the ledger.
- Reloading a completed opening mission preserves `$500`, Blackglass `+5` and sire `+1`.
- Reloading completed `Clean the Scene` preserves total campaign cash of `$775`, two ledger entries and its reputation rewards.
- A failed mission is not restored behind the player's back; Retry is explicit.
- New Game resets campaign history, money, reputation and checkpoints before starting the opening contract.
- Starting another mission clears the previous mission checkpoint.
- Dynamic police/hunter reinforcements and active pursuits reset on checkpoint restoration by design.

## Automated acceptance

Unit coverage includes schema migration, storage, wallet, reputation, mission definitions, typed-event progression, checkpoint safety, campaign entry classification, board availability, replay policy and reward idempotency.

Chromium coverage includes:

- `/` and `/phaser/` boot routes;
- New Game, Continue and Retry;
- killed and drained journalist golden paths;
- sire dialogue before `REPORT ACCEPTED`;
- objective and completion checkpoint reload;
- refuge board keyboard and narrow-layout behaviour;
- complete `Clean the Scene` world flow;
- completion reload without duplicate rewards;
- post-report armed free roam while the board is installed;
- no critical browser error or runtime ownership conflict.

## Scope boundary

Milestone 11 does not implement vehicles, traffic, complete stash/ammunition economy, multiple refuges or the broader faction campaign. Those remain later milestones.

## Next production milestone

**Milestone 12 — Vehicle core** is now active: contextual entry/exit, arcade handling, health and collisions, occupant state, speed-sensitive camera, vehicle ownership/theft metadata and limited trunk storage.
