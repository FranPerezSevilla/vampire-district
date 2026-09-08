# Accepted city foundation: documentation and merge

## Goal and scope

The user accepted PR #82's wider roads and explicitly requested merging it and catching up the documentation. Start from gameplay implementation `163e870`, with GitHub Tests and Pages successful. PR #73 is already merged at `7ee3af6`.

Reconcile the existing README, project snapshot/blueprint, roadmap, architecture, controls, testing/development guides, road geometry, radio delivery, documentation index and traffic execution state against current code. Mark superseded stage records as historical while preserving their evidence. Record the user acceptance and clear stale automatic continuation tasks. Retain the Pages branch.

Documentation is the only change in this task. Gameplay, generated geometry, dependencies, CI configuration, population and radio assets remain the validated implementation. No browser tests or new gameplay milestone.

## Acceptance

- Current references agree on 600 civilian cars, six buses, 64 local slots, physical driver authority, three bus lines, three radio stations and 150/96/88 road widths.
- Current controls reflect the bus chooser, driving radio wheel, horn, pause and existing input remapping.
- Historical counts/CPU evidence are labelled instead of presented as current measurements; roughly 50-second junction waits remain an explicit limitation.
- Local Markdown links and machine-readable status parse correctly; runtime/generated trees remain identical to the accepted implementation.
- Required fast validation and affected-plan review complete without browser execution; merge uses the exact reviewed PR head and normal branch protections.
- Verify the resulting main commit and PR merge state; retain the branch that serves Pages.

## Validation

The documentation reconciliation changes 26 documentation/status files and no runtime, test, dependency, workflow or generated-city files. All 106 relative Markdown file links in the changed documents resolve and the status JSON parses. `check:affected -- --base=HEAD` identifies the incremental update as documentation-only; the cumulative plan against main still lists the previously validated road changes and browser specifications excluded by the user.

`npm run check:fast` passes 911/911 native tests and static ownership of 41 browser specifications in eight suites. The gameplay implementation and generated assets remain byte-identical to `163e870`; its GitHub Tests and Pages results are successful. Exact publication and merge SHAs are verified and reported in the live PR rather than predicted in this pre-merge document.
