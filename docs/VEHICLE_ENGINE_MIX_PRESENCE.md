# Vehicle engine presence mix pass

_Last updated: 2026-08-18_

**State: implemented on PR #55; pending in-game listening validation.**

This increment is a mix-only response to the playtest report that vehicle motors remain too quiet. It does not change vehicle physics, acceleration, gear timing, RPM mapping, playback rate, filters, spatial pan, voice cap, engine assets or distance attenuation.

## Measured baseline

The current world-audio master is `0.20`. `vehicleEngineStart` already uses catalogue volume `0.88`, so its nominal pre-content peak path is intentionally left unchanged. The continuous real engine loop is instead shaped per archetype by the existing sample volumes: compact `0.44`, sedan `0.46`, van `0.50`, police `0.46`. The runtime load/RPM factor spans roughly `0.556` at minimum idle/load to `1.0` at full RPM/load, and non-player vehicles are then reduced further by spatial audibility.

Before this pass a full-load sedan loop at audibility 1 had a nominal gain product of `0.46 × 0.20 = 0.092`, while the skid loop is `0.50 × 0.20 = 0.10`. That explains why the continuous motor could sit too far behind tyre noise even though the source itself was already accepted.

## Mix change

The existing engine-voice priority ownership already distinguishes traffic (`0`), motorized police (`2`) and the player's occupied vehicle (`3`). This pass uses that same stable ownership only as a small presence multiplier on the continuous engine voice:

- civilian traffic: **1.08×**;
- motorized police: **1.10×**;
- player vehicle: **1.28×**.

The multiplier is applied to both the real sample loop and its procedural fallback after spatial audibility, so the fallback does not become unexpectedly quieter than the accepted sample path. Archetype-specific `sampleVolume`, pitch and filtering remain unchanged, preserving compact/sedan/van/police character.

At full load, an audibility-1 sedan now reaches a nominal player gain product of `0.46 × 1.28 × 0.20 ≈ 0.118`; a nearby traffic sedan is about `0.099` before distance attenuation, and police about `0.101` before distance attenuation. Those remain below the nominal siren (`0.72 × 0.20 = 0.144`), heavy collision (`0.82 × 0.20 = 0.164`) and engine-start transient (`0.88 × 0.20 = 0.176`). These are deterministic gain products for mix comparison, not loudness/LUFS measurements.

Narrative ducking still lowers the whole world bus together, so dialogue/feeding narration retains its existing authority and the relative engine/skid/siren relationships remain stable while ducked.

## Regression coverage

`tests/vehicle-audio-balance.test.js` verifies the role-presence factors, confirms that both real-sample and procedural engine paths consume the factor, preserves the accepted per-archetype profile values, and protects the existing start/siren/heavy-impact headroom references.

## In-game acceptance

1. Drive a compact/sedan/van and confirm the motor is continuously readable at idle, launch and upper gears.
2. Drift or handbrake: the skid must still read clearly without erasing the engine.
3. Pass nearby civilian traffic: its engines should be slightly easier to place spatially but remain subordinate to the player's car.
4. Trigger a police pursuit: the police engine should support the vehicle while the siren remains the dominant police cue.
5. Confirm collisions, horn, gunfire and dialogue still cut through without further gain changes.
