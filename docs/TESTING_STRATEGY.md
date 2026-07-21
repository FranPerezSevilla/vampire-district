# Testing strategy

_Last updated: 2026-07-21_

## Goal

The project must keep reliable regression coverage as the district, missions and systemic interactions grow. Every pull request should verify the changed gameplay loops without replaying the complete campaign from the intro.

## Boot profiles

The application resolves one boot profile before campaign state or Phaser scenes are composed.

```text
normal    persistent campaign, campaign entry and tutorial rules
explore   isolated state, no mission, no tutorial, street spawn
scenario  isolated deterministic test state, no mission or tutorial
```

### Exploration mode

Player-facing exploration is available from the campaign-entry screen or directly through:

```text
?mode=explore
```

Exploration mode:

- starts on the street with full controls;
- does not start a mission;
- skips the tutorial and campaign-entry overlay;
- keeps vehicles, pedestrians, police, witnesses, combat and evidence active;
- uses an in-memory campaign and never mutates the player's normal save.

### Browser scenarios

Automated browser tests use:

```text
?testScenario=vehicle-core
?testScenario=street-damage
?testScenario=police-escalation
?testScenario=input-locks
?testScenario=urban-explore
```

A scenario uses real runtime systems. It only replaces the repeated preparation journey with a deterministic starting state.

Browser API:

```js
window.NBD_BOOT_PROFILE
window.NBD_SCENARIOS.list()
window.NBD_SCENARIOS.apply(id)
window.NBD_SCENARIOS.snapshot()
window.NBD_SCENARIO_READY
```

## Regression pyramid

### Unit tests

Run on every commit and own pure rules:

- campaign state and migration;
- mission progression and rewards;
- vehicle kinematics and geometry;
- pedestrian surfaces and routes;
- police population rules;
- checkpoint sanitization;
- street-furniture thresholds;
- source ownership and boot ordering.

### Pull-request browser checks

Three independent jobs run in parallel after unit tests.

```text
browser-boot
  runtime composition, routes, render quality, accessibility

browser-systems
  vehicles, expanded district, evidence, perception, police, input locks

browser-campaign
  New Game, Continue, Retry, checkpoint, board and campaign persistence loops
```

A failure identifies its gameplay domain immediately. No PR browser job needs to complete the full opening mission.

### Golden paths

Complete narrative paths run only on `main`, manual workflow dispatch and the nightly schedule:

```text
journalist killed
journalist drained
post-report free roam
intro/camera narrative ordering
```

Golden paths protect integration and narrative ordering without imposing their cost and timing sensitivity on every pull request.

## Rules for new tests

1. Prefer a pure unit test whenever rendering or browser input is not required.
2. A browser test should verify one gameplay loop or one ownership boundary.
3. Add a scenario when preparation is longer than the interaction being tested.
4. Never mutate the player's persistent save from explore or scenario mode.
5. Do not mock the system under test; prepare real systems into a deterministic state.
6. Keep at least one normal-boot test for each player-facing entry surface.
7. Add a complete golden path only when a cross-system narrative sequence genuinely requires it.
8. Long stress, memory and endurance checks belong to nightly or manual validation.
