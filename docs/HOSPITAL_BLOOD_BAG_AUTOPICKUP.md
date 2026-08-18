# Hospital blood-bag walk-over pickup

_Last updated: 2026-08-18_

**State: implemented on PR #55; pending in-game validation.**

This increment changes only the hospital recovery blood bag. It does not alter death authority, the lackey presentation, Vitality/Hunger amounts, mission failure, police grace, or the replacement vehicle.

## Contract

- The lackey recovery beat remains mandatory. While the lackey is speaking or leaving, `hospitalRecoveryIntroComplete` is false and the blood bag cannot trigger.
- After the lackey has departed and full control has been restored, the bag becomes a walk-over pickup: entering its **16-unit** pickup radius consumes it automatically. No `E`, Enter, interaction menu, or explicit confirmation is required.
- The bag is intentionally placed outside that smaller radius at the hospital spawn, so restoring control does not consume it immediately; the player must actually move over to it.
- Runtime checks the recovery option before ordinary interaction input. When the player reaches the bag, the existing interaction option is executed immediately through `InteractionSystem.runOption()`, preserving standard pickup feedback without exposing an interaction menu.
- Consumption remains single-owner and idempotent in `DeathRecoverySystem.consumeBloodBag()`: `recoveryBagCollected` blocks a second pickup, the bag is hidden/deactivated, and the recovery state is published as unavailable.
- The existing reward remains unchanged: **+30 Vitality** and up to **35 Hunger relief**.
- Pickup is street-only and is suppressed while another interaction menu or a transition owns input.

## Regression coverage

`tests/hospital-death-recovery.test.js` verifies that the walk-over hook exists before normal interaction input, is gated by completed hospital introduction, respects the reduced pickup radius, and still relies on the existing single-consume guard.

## In-game acceptance

1. Die and reach the hospital.
2. Confirm the bag does not disappear while the lackey speaks or while he walks away.
3. After control returns, stand still: the bag should remain present.
4. Walk onto the bag: it should consume immediately without pressing an interaction key or opening a menu.
5. Verify the bag disappears once, restores Vitality/relieves Hunger once, and cannot be collected again during that recovery.
