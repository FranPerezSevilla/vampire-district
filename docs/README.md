# Vampire District documentation

This directory is the project source of truth for design, implementation and planning.

## Documents

- [Project snapshot](PROJECT_SNAPSHOT.md) — current playable state, product direction, known risks and open decisions.
- [Functional specification](FUNCTIONAL_SPEC.md) — intended player experience and gameplay rules.
- [Technical architecture](TECHNICAL_ARCHITECTURE.md) — current architecture, target architecture and engineering constraints.
- [Input system](INPUT_SYSTEM.md) — implemented Milestone 1 frame contract, browser mapping, control modes and tests.
- [Control scheme](CONTROL_SCHEME.md) — target keyboard-and-mouse controls and interaction priority rules.
- [Roadmap](ROADMAP.md) — ordered milestones with acceptance criteria.

## Status language

- **Implemented**: available in the current playable build.
- **Planned**: agreed direction, not yet implemented.
- **Proposed**: recommended direction that can still be changed before implementation.
- **Deferred**: intentionally outside the current vertical slice.

## Maintenance rule

Any gameplay change that alters controls, mission flow, AI behaviour, combat rules, UI behaviour or architecture should update the relevant document in the same pull request or commit series.
