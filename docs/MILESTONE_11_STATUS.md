# Milestone 11 status

_Last updated: 2026-07-20_

## Status

**🟡 Campaign foundation implemented; CI, live browser integration and full journalist migration acceptance pending.**

## Implemented

- Versioned JSON-only campaign schema.
- Corrupt-save fallback and explicit future-version rejection.
- Local-storage save/load/import/export/reset service.
- Cash wallet with deterministic transaction ids and ledger.
- Independent faction and contact reputation.
- Validated serializable mission definitions.
- Generic typed-event `MissionRunner`.
- Future vehicle objective contracts.
- Opening journalist mission definition.
- Compatibility bridge from the current playable mission.
- `$500`, Blackglass `+5` and sire `+1` first-completion rewards.
- Second reusable `Clean the Scene` mission definition.
- Browser campaign API exposed through `window.NBD_CAMPAIGN`.
- Automated state, migration, wallet, reputation, runner, storage and integration tests.

## Acceptance still required

- Unit CI green with all new campaign tests.
- Browser smoke confirms campaign bootstrap on `/` and `/phaser/`.
- Journalist killed and drained paths award exactly once.
- Reload after completion preserves cash and reputation.
- Reset returns to a clean campaign.
- Existing tutorial, task reveals, sire finale and post-report free roam remain unchanged.
- Decide and implement the world-checkpoint policy for an active mission reload.
- Replace the compatibility bridge with direct `MissionRunner` authority after full behaviour comparison.
- Add mission-selection/presentation for `Clean the Scene` in a later content pass.

## Migration boundary

During this milestone the current `MissionSystem` remains authoritative for world and narrative presentation. `CampaignRuntimeBridge` mirrors its public progression into the campaign runner. This gives us persistent state and reusable mission data without risking the validated vertical slice.

The compatibility bridge can be deleted only when the data-driven runner directly owns:

- world objective activation;
- objective markers;
- task reveals;
- failure rules;
- sire-first completion ordering;
- mission selection and replay policy.
