# Vampire District documentation

This directory is the project source of truth for design, implementation and planning.

## Documents

- [Project snapshot](PROJECT_SNAPSHOT.md) — current playable state, product direction, known risks and locked decisions.
- [Visual art bible](VISUAL_ART_BIBLE.md) — approved classic urban gothic-punk direction, palette, lighting, character language and art-test criteria.
- [Functional specification](FUNCTIONAL_SPEC.md) — intended player experience and gameplay rules.
- [Original setting, factions, retainers and economy](ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md) — original-IP guardrails, working factions, enhanced mortal Retainers, weapon slots, safehouses, ammunition and cash economy.
- [Mission flow](MISSION_FLOW.md) — journalist handling, return-to-refuge completion rule and sire-dialogue-to-report ordering.
- [Campaign foundation](CAMPAIGN_FOUNDATION.md) — versioned state, MissionRunner authority, campaign entry, refuge contract board, cash, reputation and safe world checkpoints.
- [Milestone 11 status](MILESTONE_11_STATUS.md) — completed campaign-foundation scope, acceptance record and transition to vehicles.
- [Milestone 11.2 status](MILESTONE_11_2_STATUS.md) — accepted direct mission authority, checkpoint policy, merge and validation record.
- [Milestone 11.3 status](MILESTONE_11_3_STATUS.md) — accepted player-facing campaign entry, refuge contract board and playable `Clean the Scene` flow.
- [Milestone 12 status](MILESTONE_12_STATUS.md) — vehicle runtime, five-times-larger district, sidewalk population, destructible street furniture, evidence and remaining acceptance work.
- [Testing strategy](TESTING_STRATEGY.md) — normal/explore/scenario boot profiles, focused browser loops, parallel PR checks and deferred golden paths.
- [City Compiler](CITY_COMPILER.md) — deterministic city blueprints, district recipes, semantic block templates, hard validation, scoring and the Foundry pilot plan.
- [City Compiler baseline](CITY_COMPILER_BASELINE.md) — measured score for the current city, legacy geometry debt and acceptance targets for the Foundry pilot.
- [Foundry pilot](CITY_COMPILER_FOUNDRY_PILOT.md) — seeded Foundry generation, stable semantic IDs, candidate ranking, review artifacts and integration boundary.
- [Foundry selection](CITY_COMPILER_FOUNDRY_SELECTION.md) — decision record selecting `foundry-pilot-04` and its production-integration requirements.
- [City streaming](CITY_STREAMING.md) — asynchronous chunk files, entity dormancy, incremental static queries, LRU retention and chunk-local deltas.
- [City Streaming 4A](CITY_STREAMING_4A.md) — district resource profiles, road-aware prefetch and low-frequency dormant pedestrian progression.
- [City Streaming 4B](CITY_STREAMING_4B.md) — district macro graph, abstract traffic flow, dormant police travel and district-local patrol recovery.
- [City Streaming 4C](CITY_STREAMING_4C.md) — pooled local traffic materialization, explicit road lanes, smooth macro interpolation and nearby vehicle occupancy.
- [City Streaming 4D](CITY_STREAMING_4D.md) — local following distance, player-vehicle braking, bounded catch-up and deterministic junction yielding.
- [Technical architecture](TECHNICAL_ARCHITECTURE.md) — architecture and engineering constraints.
- [Runtime consolidation](RUNTIME_CONSOLIDATION.md) — Milestone 10 system ownership, spatial queries, diagnostics and browser smoke tests.
- [Milestone 10 status](MILESTONE_10_STATUS.md) — current implementation and validation boundary.
- [Input system](INPUT_SYSTEM.md) — central frame contract, browser mapping, control modes and tests.
- [Combat system](COMBAT_SYSTEM.md) — mouse combat, NPC resilience and damage-to-Hunger loop.
- [Police alert](POLICE_ALERT.md) — progressive wanted escalation for police assault and neutralization.
- [NPC AI](AI_SYSTEM.md) — priority states, police roles, witness interruption, hunter memory, thug retaliation and recovery.
- [Drain system](DRAIN_SYSTEM.md) — right-click eligibility, rear/downed targeting, channel cancellation and perception.
- [Movement system](MOVEMENT_SYSTEM.md) — default running, Shift quiet movement, footsteps and deterministic traversal.
- [Damageable props](PROP_SYSTEM.md) — streetlight durability, attack integration, darkness, reactions and events.
- [Weapon system](WEAPON_SYSTEM.md) — prototype inventory, wheel cycling, melee/hitscan attacks, ammo, HUD and noise.
- [Tutorial UX and accessibility](UX_ACCESSIBILITY.md) — first-use weapon teaching, recovery countdowns, HUD layout, semantic labels and high-contrast aim.
- [Control scheme](CONTROL_SCHEME.md) — target keyboard-and-mouse controls and interaction priority rules.
- [Roadmap](ROADMAP.md) — release-candidate stabilization, completed campaign authority, vehicles, traffic, original factions, economy, Retainers and campaign content.

## Regression checklists

- [Milestone 1](MILESTONE_1_REGRESSION.md)
- [Milestone 2](MILESTONE_2_REGRESSION.md)
- [Milestone 3](MILESTONE_3_REGRESSION.md)
- [Milestone 4](MILESTONE_4_REGRESSION.md)
- [Milestone 5](MILESTONE_5_REGRESSION.md)
- [Milestone 6](MILESTONE_6_REGRESSION.md)
- [Milestone 7](MILESTONE_7_REGRESSION.md)
- [Milestone 8](MILESTONE_8_REGRESSION.md)
- [Milestone 9](MILESTONE_9_REGRESSION.md)
- [Milestone 10](MILESTONE_10_REGRESSION.md)
- [Milestone 11.2](MILESTONE_11_2_REGRESSION.md)

## Status language

- **Implemented**: available in the current playable build.
- **Planned**: agreed direction, not yet implemented.
- **Proposed**: recommended direction that can still be changed before implementation.
- **Deferred**: intentionally outside the current production horizon.
- **Working name**: design terminology that still requires commercial trademark clearance.

## Maintenance rule

Any gameplay change that alters controls, mission flow, save/checkpoint behaviour, AI behaviour, combat rules, UI behaviour, setting terminology, economy or architecture should update the relevant document in the same commit series.
