# Vehicle speed recovery after gearbox retune

_Date: 2026-08-17 · PR #55 · branch `audio/playtest-p0`_

## Finding

The slowdown report was reproducible in the driving model even though the nominal speed caps had not changed in the gearbox pass. The main regression was the combination of two post-retune constraints: fifth gear retained only about **58%** of base drive torque, and high-speed acceleration began tapering at **58%** of top speed with a steep exponent. The launch still felt lively, but 3rd–5th gear spent too long adding the final speed.

## Recovery tuning

- Driveable top-speed caps move from **310 / 330 / 275 / 365 px/s** to **340 / 360 / 300 / 400 px/s** for compact, sedan, van and police respectively.
- Fifth-gear torque now retains **70%** of base drive torque. Existing shift duration, gear dwell and first-gear hold are unchanged.
- The high-speed taper begins at **62%** of top speed and falls less aggressively, preserving a visible final pull without restoring instant acceleration.
- At a deterministic 20 Hz full-throttle benchmark, 99% of top speed changes from approximately **3.55 / 4.10 / 4.55 / 4.10 s** to **2.50 / 2.90 / 3.25 / 2.90 s** for compact, sedan, van and police. All forward gears are still visited.
- Civilian macro traffic uses a shared **1.12×** travel-speed multiplier. On a canonical 1500 px / 10 s edge this raises authority speed from **150 to 168 px/s** without increasing traffic density; the existing local catch-up/braking authority remains responsible for visible spacing and yielding.
- Police route response is intentionally not accelerated further in this increment: the existing Wanted 2/3 route multipliers correspond to roughly **397.5 / 420 px/s** on the same canonical edge, which remains above the new sedan/police caps. Local RAM/PIT telegraph speeds remain unchanged to preserve counterplay.

## Regression coverage

`tests/vehicle-speed-recovery.test.js` locks the four speed caps, measures time-to-speed and gear traversal for every driveable archetype, verifies the upper-gear torque/taper contract, checks the civilian traffic multiplier and proves that Wanted route response remains faster than the quicker player cars. `tests/vehicle-model.test.js` is updated only where its old 3-second minimum encoded the intentionally superseded slow upper-gear behavior.

## In-game acceptance

- Player cars should feel materially faster after second gear without snapping immediately to top speed.
- Gear changes must remain audible/readable and no archetype may skip forward gears.
- Civilian traffic should feel livelier but still brake/yield normally.
- Wanted 2 police must still be able to close on a fast sedan; RAM/PIT telegraphs must remain readable.
