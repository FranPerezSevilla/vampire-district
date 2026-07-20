# Milestone 11 status

_Last updated: 2026-07-20_

## Status

**🟡 Direct opening-mission authority and stable checkpoint restoration implemented; mission selection and the playable second contract remain.**

## Accepted foundation

- Versioned JSON-only campaign schema.
- Corrupt-save fallback and explicit future-version rejection.
- Local-storage save/load/import/export/reset service.
- Cash wallet with deterministic transaction ids and auditable ledger.
- Independent faction and contact reputation.
- Validated serializable mission definitions.
- Generic typed-event `MissionRunner`.
- Future vehicle objective contracts.
- Opening journalist mission definition.
- `$500`, Blackglass `+5` and sire `+1` first-completion rewards.
- Second reusable `Clean the Scene` definition.
- Browser campaign API under `window.NBD_CAMPAIGN`.

## Direct mission authority

The opening contract no longer depends on `CampaignRuntimeBridge` mirroring legacy step changes.

```text
world action
→ MissionSystem presentation adapter
→ typed CampaignRunner event
→ campaign objective advances
→ MissionSystem projects the active objective into HUD, marker and task reveal
```

`CampaignRunner` now owns:

- active objective;
- objective completion and activation;
- neutralization outcome validation;
- mission failure state;
- completion state;
- cash and reputation rewards;
- replay reward idempotency;
- authored checkpoint selection.

`MissionSystem` remains the Phaser-facing presentation adapter for the existing vertical slice. It owns world coordinates, markers, tutorial-compatible four-step text and the sire dialogue presentation, but it can no longer advance the opening mission independently while a campaign is attached.

The final ordering remains:

```text
journalist handled
→ CampaignRunner activates return_to_refuge
→ player returns
→ sire dialogue opens
→ player dismisses both thoughts
→ MissionSystem sends refuge:returned
→ CampaignRunner completes and grants rewards
→ REPORT ACCEPTED opens
```

## Checkpoint policy

Campaign saves now contain one stable checkpoint:

```js
{
  id,
  kind,
  missionId,
  objectiveId,
  locationId,
  capturedAt,
  payload
}
```

The opening mission currently authors these boundaries:

| Checkpoint | Location | Restored objective |
|---|---|---|
| `journalist_mission_start` | Rooftop refuge | Reach the police roof |
| `journalist_tip_acquired` | Police roof | Reach the nightclub |
| `journalist_target_reached` | Nightclub district | Neutralize the journalist |
| `journalist_handled` | Nightclub district | Return to the refuge |
| `journalist_report_accepted` | Rooftop refuge | Mission complete |

A stable checkpoint restores only authored, deterministic state:

- player layer and safe position;
- active campaign objective;
- completed tutorial state where appropriate;
- rooftop blocker resolved;
- informant departed;
- journalist killed or drained for the return objective;
- carried campaign data, cash and reputation.

It deliberately does **not** restore transient simulation state:

- projectiles or attack frames;
- a partially completed drain;
- temporary witness reactions;
- individual police pathfinding positions;
- helicopter spotlight phase;
- task-reveal or camera tween progress;
- short cooldown animation state.

Reloading reconstructs the objective from the latest stable authored boundary rather than attempting to serialize Phaser objects.

Older version-one saves without a mission checkpoint use an objective-specific fallback location and remain loadable.

## Standalone replay policy

Completing the opening contract records the campaign reward once. Reloading the standalone vertical slice can start the journalist mission again for free play, but the replay record inherits `rewardsGranted: true`.

Therefore:

```text
first completion  → $500, Blackglass +5, sire +1
later standalone replay completion → narrative report only, no duplicate reward
```

## Automated coverage

- Direct runner authority for all opening objectives.
- Killed and drained journalist outcomes.
- Sire dialogue before the RETURN event and report.
- Checkpoint serialization and migration.
- Checkpoint capture at authored objective boundaries.
- Stable world restoration at police roof and nightclub.
- Tutorial, blocker and informant reconstruction.
- Completed standalone replay without duplicated ledger entries.
- `/` and `/phaser/` campaign bootstrap.
- Browser reload at an active objective.
- Existing release-candidate golden paths and post-report free roam.

## Remaining Milestone 11 work

1. Add a mission-selection/contact presentation after the opening report.
2. Make `Clean the Scene` playable in the current district.
3. Add generic world bindings for `collect`, `destroy` and `loseWantedLevel` objectives.
4. Decide whether mission failures restart from the latest checkpoint or require explicit retry.
5. Add a player-facing save/continue slot UI; the underlying storage API already exists.
6. Validate normal-timing checkpoint reload manually in both playable routes.

## Migration boundary

`CampaignRuntimeBridge` has been deleted. Direct opening-mission authority is now the protected path.

The next slice is not another architecture rewrite. It is content integration:

```text
mission/contact selector
→ Clean the Scene world entities
→ generic collect/destroy/wanted bindings
→ mission complete and reward presentation
```
