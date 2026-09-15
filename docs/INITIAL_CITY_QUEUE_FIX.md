# Initial city: do not expire runnable local hydration

Authority: ChunkStreamSystem prepares and indexes required geometry; ChunkFileStore
owns transport/cache. MainMenuScene retains its existing readiness/handoff gate.

Scope: initial-view scheduling in ChunkStreamSystem, a cancellable resource-task
helper, real-seed regression tests and the production-package verifier.
Acceptance: all nine required chunks become resident even when local batches are
delayed past the transport deadline; no partial-ready shortcut, extra city fetch,
scene frame or early gameplay. Each batch respects the existing activation budget.
Blocked transport and invalid/non-progressing activation still fail explicitly;
shutdown disposes pending tasks. Existing fast boot, UI, camera, audio and saves
are non-goals. No PR merge, main update or browser execution.

Reproduction on source 555833f1: real compiler seed, blocked city transport and a
controlled clock advancing 2,200 ms per activation batch. Four batches hydrate
8/9 chunks; the absolute 8,000 ms cutoff rejects with the exact screenshot message
`Timed out preparing city: 3:3 (queued)`. A zero transport-wait budget also rejects
already queued data. This demonstrates a deadline bug; it does not establish what
made callbacks late in the user's browser.

## Correction
Continue budgeted local hydration before checking a deadline for unresolved
resources. Validate actual residency progress so a broken activator cannot loop.
The existing finite preparation now yields via a cancellable MessageChannel task
between ready batches, rather than waiting a fixed 16 ms or a render frame. Only
pending I/O retains polling/deadlines; the fallback uses zero-delay tasks for
ready local work. Success, errors and shutdown close the task source and timers.
The normal frame-owned streaming loop and activation budget are unchanged.

No required chunk is removed. No timeout constant is increased. The title still
requires all nine real chunks, entity preparation and the existing audio gate.
Transport errors, final-chunk hydration errors and non-progress reject explicitly.

## Validation
Two new assertions fail before the correction, including the exact 3:3 (queued)
message. Nine real-seed regressions cover delayed batches, a late first callback,
eight-resident/one-queued recovery, zero transport allowance, absence of timer
waits for local work, timer fallback, stalled I/O, broken activation and an invalid
final chunk. Four task-source tests check yielding, deduplication, cancellation,
late messages, both ports closing, fallback and finite completion.

Local check:fast: 1,065 passed, zero failed; static ownership of 41 browser specs
passed without execution. The first unconstrained run exceeded the local 200s
command limit; a complete rerun on four CPU cores passed in 118s. Focused streaming,
readiness and scheduler suite: 63 passed. Production build, package verification
with zero transport-wait allowance and actual compiled HUD/chapter smoke for both
entry points passed. The affected plan against origin/main selects RC coverage
because of accumulated branch infrastructure changes; browser execution remains
excluded under the user's standing instruction. No city/compiler data changed.

These are native/task/DOM and delivery checks, not a browser performance profile.
The controlled late-clock reproduction explains the false queued timeout but does
not identify the exact source of callback latency on the user's machine. Native
MessageChannel batches add no recurring loop, worker, asset request or UI text.

## Remote concurrency check
The source native/build gate passed; a separate PR native run exposed a timing
assumption in an older ownership regression (25 resident versus an expected 9).
That test waited for optional downloads, then assumed initial preparation was
still pending. Faster task-based preparation may already have completed, so normal
frame prefetch legitimately resumes. The test now explicitly holds required chunk
3:3 until after the frame-ownership assertions, then releases it and verifies
prefetch resumes. No runtime changes or relaxed assertion: both pending exclusion
and post-completion resumption are still tested without relying on I/O ordering.

The deterministic test follow-up passed all 25 focused readiness/task cases locally.
Its attempted full local rerun hit the command execution limit before completion;
no pass is claimed for that interrupted run. The earlier full 1,065-case local
run and the initial remote source/build gate passed. The final remote CI must
validate this test-only follow-up before publication.
