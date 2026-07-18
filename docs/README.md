# Vampire District documentation

This directory is the project source of truth for design, implementation and planning.

## Documents

- [Project snapshot](PROJECT_SNAPSHOT.md) — current playable state, product direction, known risks and open decisions.
- [Visual art bible](VISUAL_ART_BIBLE.md) — approved classic urban gothic-punk direction, palette, lighting, character language and art-test criteria.
- [Functional specification](FUNCTIONAL_SPEC.md) — intended player experience and gameplay rules.
- [Mission flow](MISSION_FLOW.md) — journalist handling, return-to-refuge completion rule and sire-dialogue-to-report ordering.
- [Technical architecture](TECHNICAL_ARCHITECTURE.md) — current architecture, target architecture and engineering constraints.
- [Input system](INPUT_SYSTEM.md) — central frame contract, browser mapping, control modes and tests.
- [Combat system](COMBAT_SYSTEM.md) — mouse combat, NPC resilience and damage-to-Hunger loop.
- [Police alert](POLICE_ALERT.md) — progressive wanted escalation for police assault and neutralization.
- [NPC AI](AI_SYSTEM.md) — priority states, police roles, witness interruption, hunter memory, thug retaliation and recovery.
- [Drain system](DRAIN_SYSTEM.md) — right-click eligibility, rear/downed targeting, channel cancellation and perception.
- [Movement system](MOVEMENT_SYSTEM.md) — default running, Shift quiet movement, footsteps and deterministic traversal.
- [Damageable props](PROP_SYSTEM.md) — streetlight durability, attack integration, darkness, reactions and events.
- [Weapon system](WEAPON_SYSTEM.md) — inventory, wheel cycling, melee/hitscan attacks, ammo, HUD and noise.
- [Tutorial UX and accessibility](UX_ACCESSIBILITY.md) — first-use weapon teaching, recovery countdowns, HUD layout, semantic labels and high-contrast aim.
- [Milestone 1 regression](MILESTONE_1_REGRESSION.md) — browser, viewport, tutorial and stuck-input validation.
- [Milestone 2 regression](MILESTONE_2_REGRESSION.md) — combat, resilience, tutorial and refuge-finale browser validation.
- [Milestone 3 regression](MILESTONE_3_REGRESSION.md) — enemy attacks, Hunger damage, hit stun and invulnerability validation.
- [Milestone 4 regression](MILESTONE_4_REGRESSION.md) — right-click targeting, channel, rear/downed eligibility and perception validation.
- [Milestone 5 regression](MILESTONE_5_REGRESSION.md) — movement speed, quiet footsteps, Space traversal and route-conflict validation.
- [Milestone 6 regression](MILESTONE_6_REGRESSION.md) — prop hit geometry, persistent darkness and visual/heard-only reaction validation.
- [Milestone 7 regression](MILESTONE_7_REGRESSION.md) — wheel ownership, weapon damage, hitscan obstruction, ammo and gunshot reactions.
- [Milestone 8 regression](MILESTONE_8_REGRESSION.md) — state priority, police roles, witness interruption, hunter memory and recovery validation.
- [Milestone 9 regression](MILESTONE_9_REGRESSION.md) — first-use guidance, recovery timers, HUD separation, assistive semantics and high-contrast aim.
- [Control scheme](CONTROL_SCHEME.md) — target keyboard-and-mouse controls and interaction priority rules.
- [Roadmap](ROADMAP.md) — ordered milestones with acceptance criteria.

## Status language

- **Implemented**: available in the current playable build.
- **Planned**: agreed direction, not yet implemented.
- **Proposed**: recommended direction that can still be changed before implementation.
- **Deferred**: intentionally outside the current vertical slice.

## Maintenance rule

Any gameplay change that alters controls, mission flow, AI behaviour, combat rules, UI behaviour or architecture should update the relevant document in the same pull request or commit series.
