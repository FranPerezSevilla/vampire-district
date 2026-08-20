# Footstep audio binary guard

_Last updated: 2026-08-19_

## CI cleanup checkpoint

PR #55 previously guarded every MP3 footstep with a fixed `> 5,000` byte assertion. The shortest authentic `step-01.mp3` is a complete FFmpeg/LAME MP3 with an ID3 tag, MPEG frame sync and Xing stream metadata, but its deliberately short recorded cut encodes below that arbitrary threshold. CI therefore rejected a valid asset even though the stream itself is structurally complete.

The unit guard now validates transport integrity rather than equating file size with validity:

- every runtime footstep must still contain more than a tiny placeholder payload and expose a real MPEG frame;
- when a Xing/Info header is present, its declared frame count must describe several encoded frames;
- its declared MPEG byte count must fit inside the committed payload, so an actually truncated connector/upload result still fails closed;
- only a small bounded trailing allowance is accepted after the declared MPEG payload.

This keeps the original purpose of the regression test—catching placeholder or truncated audio binaries—while allowing genuinely short one-shot samples. Runtime catalogue mapping, volume, cadence and gameplay behavior are unchanged by this increment.

## Next gate

Once branch-wide unit CI is green, the next allowed work remains the relevant City Compiler/browser smoke validation and then the already-instrumented Performance Pass 6 capture. No performance optimization should be chosen until `NBD_PERF_CAPTURE` identifies a repeatable winner.
