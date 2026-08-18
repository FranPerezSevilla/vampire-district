# Browser boot regression cleanup

_Last updated: 2026-08-18_

This note records the browser-boot portion of the final regression cleanup for PR #55. It changes browser assertions only; production runtime behavior is intentionally unchanged.

## Current authority

- The playtest loading cover and the interactive playtest intro deliberately share the current narrative headline: **“Immortality was never the luxury you imagined.”** The interactive intro is polished by `phaser/src/playtest/bootstrap.js` after `PlaytestUi` mounts, so the older **“Hunt. Feed. Escape.”** assertion no longer describes the shipped presentation.
- The loading cover is allowed to be the first visible surface while the city is preparing. Once `NBD_PLAYTEST_READY` is true, the boot cover must be gone and the interactive `#playtest-intro` must be open.
- `taskRevealActive` deliberately owns world/UI input while an objective reveal is active. The pause-menu hotkey **H** is therefore expected to do nothing until the reveal authority is idle.

## Regression alignment

- `tests/browser/playtest-entry.spec.js` now validates the narrative headline from the first visible playtest surface using rendered `innerText`, then verifies that the boot cover is removed and the same headline remains on the interactive intro.
- `tests/browser/playtest-slice.spec.js` explicitly requires the boot cover to be gone before validating the interactive playtest intro and the rest of the hunt → feed → escape loop.
- `tests/browser/ui-accessibility.spec.js` waits for the RC harness task-reveal authority to become idle before pressing **H**, preserving the intentional input lock instead of racing it.

## Acceptance

- No generic intro appears during playtest boot.
- The first visible playtest surface and the ready interactive intro present one coherent narrative headline.
- The ready playtest remains paused behind its own intro until the player starts it.
- H remains blocked while a task reveal owns input, then opens the pause menu once that authority is idle.
- The high-contrast aim setting remains keyboard-operable and persists through reload.
- Browser-system shard failures, if any remain after this boot cluster is green, are separate increments and must not be folded into this cleanup.
