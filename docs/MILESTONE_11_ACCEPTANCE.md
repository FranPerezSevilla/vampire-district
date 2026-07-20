# Milestone 11 campaign foundation acceptance

_Date: 2026-07-20_

## Automated result

The first campaign-foundation integration passed on the merged `main` revision:

- unit test job: passed;
- Chromium browser-smoke job: passed;
- both playable routes boot the campaign layer;
- campaign state is versioned and JSON serializable;
- active mission progress survives export/import and storage reload;
- killed and drained journalist outcomes grant the same opening reward;
- the opening reward cannot be duplicated after reload;
- the existing tutorial, sire-first finale and post-report free roam remain covered by the release-candidate browser suite.

## Delivered foundation

- `CampaignState`
- `CampaignStorage`
- `CampaignEventBus`
- `WalletSystem`
- `ReputationSystem`
- `MissionDefinition`
- `MissionRunner`
- `CampaignSystem`
- `CampaignRuntimeBridge`
- `Silence the Journalist` data definition
- `Clean the Scene` data definition
- browser API under `window.NBD_CAMPAIGN`

## Current status

**🟡 Foundation accepted; direct mission authority and world checkpoint restoration remain.**

The current playable `MissionSystem` still owns world presentation and narrative timing. `CampaignRuntimeBridge` mirrors validated public events into the persistent runner. The next migration removes that bridge only after the generic runner directly owns objective activation, markers, failure rules and mission selection without changing the current tutorial or finale.

An RC snapshot branch exists at `release/v0.1.0-rc.1`. It is a branch, not a Git tag. Creating the formal tag remains a release-administration step.
