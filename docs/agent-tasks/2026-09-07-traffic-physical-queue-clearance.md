# PR 73 corrective cycle — physical queue clearance

## Goal

Restore green validation and let the front vehicle clear a same-lane rear contact
without introducing a reciprocal following lock.

## Authority and scope

- `TrafficAgentPhysicalAuthorityPolicy` owns per-agent physical route locks.
- Focused unit and browser coverage owns the rear-contact regression evidence.
- `TrafficPhysicalConsequencesSystem` retains impact holds and contact resolution.
- Compiler routes and junction admission remain authoritative.
- Remove the completed one-time radio diagnostic rejected by the existing
  `branding-cleanup` guard; preserve the guard unchanged.
- Reconcile the PR status and progress with the actual production implementation.

## Non-goals

No radio implementation/deployment, police changes, generated geometry edits,
materialization pool growth, speculative cleanup, or merge.

## Acceptance

- A same-lane car touching from behind does not become a forward lead blocker.
- Its follower remains held; physical impact/displacement holds still apply.
- Cross-route occupants in front still block the approach.
- Compiler-route token/slot identity and junction permissions remain unchanged.
- Fast checks and the affected release-candidate validation pass.
- PR remains draft for the user's explicit gameplay approval.

## Validation

Run the focused authority regression before and after the fix, then
`npm run check:fast`, `npm run check:affected:plan -- --base=origin/main`, and
`npm run check:affected -- --base=origin/main`. The whole PR diff selects the
release-candidate suite. Record environment limitations and exact CI evidence;
do not substitute a unit pass for browser/gameplay validation.
