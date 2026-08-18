# Browser boot regression cleanup

_Last updated: 2026-08-18_

This note records the browser-boot portion of the final regression cleanup for PR #55. It primarily aligns stale browser assertions and includes one narrow runtime input-ownership correction for the shared **H** key; combat, vehicle, police and campaign rules are intentionally unchanged.

## Current authority

- The playtest loading cover and the interactive playtest intro deliberately share the current narrative headline: **“Immortality was never the luxury you imagined.”** The interactive intro is polished by `phaser/src/playtest/bootstrap.js` after `PlaytestUi` mounts, so the older **“Hunt. Feed. Escape.”** assertion no longer describes the shipped presentation.
- The loading cover is allowed to be the first visible surface while the city is preparing. Once `NBD_PLAYTEST_READY` is true, the boot cover must be gone and the interactive `#playtest-intro` must be open.
- `taskRevealActive` deliberately owns world/UI input while an objective reveal is active. The pause-menu hotkey **H** is therefore expected to do nothing until the reveal authority is idle.
- **H** is also the default remappable vehicle horn. The UI menu owns H while the player is on foot, even though Phaser has already marked that bound key as handled; while actively driving with H still bound to the horn, vehicle input owns it instead.

## Regression alignment

- `tests/browser/playtest-entry.spec.js` now validates the narrative headline from the first visible playtest surface using rendered `innerText`, then verifies that the boot cover is removed and the same headline remains on the interactive intro.
- `tests/browser/playtest-slice.spec.js` explicitly requires the boot cover to be gone before validating the interactive playtest intro and the rest of the hunt → feed → escape loop.
- `tests/browser/ui-accessibility.spec.js` waits for the RC harness task-reveal authority to become idle before pressing **H**, preserving the intentional input lock instead of racing it.
- `UIScene` now arbitrates the shared H key explicitly: an on-foot menu shortcut is not discarded merely because Phaser captured the horn binding, while an actively driven vehicle still retains horn ownership.

## Acceptance

- No generic intro appears during playtest boot.
- The first visible playtest surface and the ready interactive intro present one coherent narrative headline.
- The ready playtest remains paused behind its own intro until the player starts it.
- H remains blocked while a task reveal owns input, then opens the pause menu on foot once that authority is idle; an actively driven vehicle keeps H for the horn when that remains its configured binding.
- The high-contrast aim setting remains keyboard-operable and persists through reload.
- Browser-system shard failures, if any remain after this boot cluster is green, are separate increments and must not be folded into this cleanup.

## Browser-system increment — assertive traffic behavior semantics

Baseline evidence from workflow run `32114525647`, shard 1 artifact `9316230698`, showed the local-traffic behavior loop failing deterministically because the browser assertion still expected the pre-temperament reason `player-vehicle`. The active playtest policy intentionally decorates an assertive driver's semantic state as `assertive-player-vehicle` and later `assertive-cruise`; the vehicle was braking and recovering correctly, and its pooled traffic slot remained stable.

The same policy decoration exposed a narrower diagnostics defect: `TrafficLocalBehaviorSystem.snapshot()` counts exact base reason strings, so an assertive vehicle reacting to the player's car was reported as `playerReactiveVehicles: 0` even while its state clearly described a player-vehicle response. This increment leaves the assertive driving behavior untouched and fixes only semantic accounting plus the stale browser expectation:

- `TrafficPlaytestPolicy` now derives diagnostic counters from the base semantic reason after removing the optional `assertive-` decorator. Assertive following, yielding and player-reactive traffic therefore remain visible in the same aggregate counters as normal drivers.
- `tests/browser/city-streaming-traffic-behavior.spec.js` normalizes the optional temperament prefix when asserting the blocker and recovery reason. It still requires real braking, recovery, stable slot ownership and a positive player-reactive diagnostic count, and now also verifies that the count returns to zero once the blocker is cleared.
- No speed floor, assertive-driver percentage, collision rule, materialization rule, Heat behavior or vehicle movement behavior changes in this increment.

### Acceptance

- A deterministic assertive civilian driver may report `assertive-player-vehicle` while braking for the occupied player car without failing the browser contract.
- `playerReactiveVehicles` remains greater than zero during that reaction regardless of driver temperament and returns to zero after the player car clears the lane.
- The same traffic token retains the same pooled slot before, during and after the braking event.
- Browser-system traffic-impact failures remain a separate regression cluster for a later increment.
