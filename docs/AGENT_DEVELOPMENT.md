# Agent development workflow

This is the operational entry point for AI-assisted changes. The architectural source of truth remains [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) and [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md).

## Ninety-second orientation

1. Read [`PROJECT_SNAPSHOT.md`](PROJECT_SNAPSHOT.md) for the current playable state and active priority.
2. Find the affected authority in the table below.
3. Inspect only that authority, its composition point and its focused tests.
4. State the files that are in scope before editing.
5. Run the fast check, then the affected-test selector.

Useful searches:

```bash
rg "class (SystemName|ServiceName)|SystemName" phaser/src tests
rg "new SystemName|SystemName\\(" phaser/src
rg "system-name|domain-name" docs tests
```

Do not scan or rewrite the whole repository to understand one subsystem.

## Change map

| Change | Start from | Authority or composition boundary | Focused validation |
|---|---|---|---|
| boot, HUD, rendering, accessibility | `index.html`, `phaser/src/app-bootstrap.js` | boot profile and Phaser/DOM composition | browser boot |
| controls or action ownership | `phaser/src/input/actions.js`, `phaser/src/input/InputSystem.js` | `InputSystem` frame contract | input unit tests + `input-locks` |
| frame order or cross-system coordination | `GameScene`, `GameplayRuntime` | the single `GameplayRuntime.update` chain | browser boot + affected systems |
| campaign, save, wallet or missions | `CampaignState`, `CampaignSystem`, `MissionRunner` | campaign services and explicit definitions | unit + campaign |
| authored vehicles or maintenance | `VehicleSystem`, `VehicleModel`, `VehicleDriving`, `VehicleMaintenanceService` | authored vehicle/campaign state boundary | vehicle core + maintenance |
| civilian traffic | `TrafficMaterializationSystem`, local traffic policies | fixed proxy pool; never campaign vehicles | traffic browser group |
| police, witnesses, Heat or Exposure | `PoliceSystem`, `HeatSystem`, `ExposureSystem`, `EvidenceSystem` | separate police and supernatural-proof authorities | police/evidence browser group |
| factions, territory or hunting law | `TerritorySystem`, `TerritoryRuntimeSystem` and hunting-law services | persistent campaign authority plus read-only runtime projection | territory/hunting browser group |
| streaming or dormant simulation | `ChunkStreamSystem`, `EntityStreamSystem`, `DistantSimulationSystem` | resident resources before local queries | streaming browser group |
| roads, parcels, sidewalks or generated city | `city-road-graph-v1.js`, `tools/city-compiler/` | road graph and compiler; locate the graph with `rg --files`; never hand-edit generated geometry | city validation + city browser group |

If a symbol has moved, use `rg` to find it. Do not create a second authority because a path in this guide became stale.

## Validation ladder

Fast safety net, expected to stay below one minute on a normal development machine:

```bash
npm run check:fast
```

Preview the checks selected from the branch diff:

```bash
npm run check:affected:plan -- --base=origin/main
```

Run those checks:

```bash
npm run check:affected -- --base=origin/main
```

The selector always runs unit tests for runtime changes, adds city validation when city authority changes and invokes only the matching Playwright specs. Documentation-only changes select no runtime checks. Test infrastructure changes select the full release-candidate suite.

Run the complete release-candidate suite only for cross-cutting changes, test-infrastructure changes, a final release candidate or an explicit request:

```bash
npm run test:rc
```

The selector is a conservative aid, not a replacement for judgment. Add a focused test manually when the change crosses a boundary that its filenames cannot reveal.

## Small-PR protocol

- One concern and one acceptance boundary per PR.
- Name the authoritative system being changed.
- List explicit non-goals.
- Prefer existing public methods and events over cross-system state mutation.
- Keep generated files and their source/compiler change in the same commit when regeneration is required.
- Update the blueprint or detailed documentation only when a documented contract actually changes.
- Hand off the PR while CI runs; follow the bounded-wait rules in the repository `AGENTS.md`.

Use [`templates/AGENT_TASK.md`](templates/AGENT_TASK.md) to turn a broad idea into a bounded implementation task.
