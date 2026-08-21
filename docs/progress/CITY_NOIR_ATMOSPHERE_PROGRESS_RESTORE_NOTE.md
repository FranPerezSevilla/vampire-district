# Progress-log restore note

A documentation-only checkpoint commit accidentally replaced the canonical append-only progress file instead of appending to it. No runtime code was affected.

The canonical historical blob before that mistake is `e5254a2c79e7906a5290f514e245611067ebab9b`. The M5.3/M6.1 evidence is preserved separately in `CITY_NOIR_ATMOSPHERE_M5_3_M6_1_CHECKPOINT.md`.

The next corrective commit restores `CITY_NOIR_ATMOSPHERE_PROGRESS.md` to the historical blob so prior execution history is not lost. This note intentionally records the correction rather than hiding it.
