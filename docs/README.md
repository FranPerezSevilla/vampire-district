# Vampire District documentation

This directory is the project source of truth for design, implementation and planning.

## Start here

- [Project blueprint](PROJECT_BLUEPRINT.md) — canonical product, campaign, runtime, vehicle, city-streaming and production-priority map.
- [Project snapshot](PROJECT_SNAPSHOT.md) — concise current playable state, controls, locked decisions, risks and immediate priority.
- [Technical architecture](TECHNICAL_ARCHITECTURE.md) — authoritative runtime ownership, update order, persistence boundaries and testing contracts.
- [Roadmap](ROADMAP.md) — completed, active and planned milestones ordered by dependency.

## Product and campaign

- [Visual art bible](VISUAL_ART_BIBLE.md) — classic urban gothic-punk direction, palette, lighting and art-test criteria.
- [Functional specification](FUNCTIONAL_SPEC.md) — intended player experience and gameplay rules.
- [Original setting, factions, retainers and economy](ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md) — original-IP guardrails, factions, Retainers, weapon slots, safehouses, ammunition and cash economy.
- [Mission flow](MISSION_FLOW.md) — journalist handling, return-to-refuge rule and sire-dialogue-to-report ordering.
- [Campaign foundation](CAMPAIGN_FOUNDATION.md) — versioned state, MissionRunner authority, campaign entry, refuge board, cash, reputation and safe checkpoints.
- [Milestone 11 status](MILESTONE_11_STATUS.md) — campaign-foundation scope and acceptance record.
- [Milestone 11.2 status](MILESTONE_11_2_STATUS.md) — direct mission authority and checkpoint policy.
- [Milestone 11.3 status](MILESTONE_11_3_STATUS.md) — campaign entry, refuge board and playable `Clean the Scene` flow.

## Vehicles, city and traffic

- [Milestone 12 status](MILESTONE_12_STATUS.md) — vehicle runtime, expanded district, pedestrians, destructible street furniture and evidence integration.
- [Vehicle maintenance](VEHICLE_MAINTENANCE.md) — costed refuge-garage repair, atomic wallet/condition updates and owned-wreck recovery.
- [Testing strategy](TESTING_STRATEGY.md) — normal/explore/scenario profiles, focused browser loops and parallel PR checks.
- [City Compiler](CITY_COMPILER.md) — deterministic city blueprints, district recipes, validation and scoring.
- [City Compiler baseline](CITY_COMPILER_BASELINE.md) — current-city score and legacy geometry debt.
- [Foundry pilot](CITY_COMPILER_FOUNDRY_PILOT.md) — seeded Foundry generation and candidate review.
- [Foundry selection](CITY_COMPILER_FOUNDRY_SELECTION.md) — selected `foundry-pilot-04` record.
- [City streaming](CITY_STREAMING.md) — asynchronous chunks, entity dormancy, spatial queries, LRU retention and deltas.
- [City Streaming 4A](CITY_STREAMING_4A.md) — district resource profiles, road-aware prefetch and dormant pedestrians.
- [City Streaming 4B](CITY_STREAMING_4B.md) — macro graph, abstract traffic, dormant police travel and patrol recovery.
- [City Streaming 4C](CITY_STREAMING_4C.md) — pooled traffic materialization and explicit lane polylines.
- [City Streaming 4D](CITY_STREAMING_4D.md) — following, braking, catch-up and junction priority.
- [City Streaming 4E](CITY_STREAMING_4E.md) — soft physical contact, blocked vehicles and lane recovery.
- [City Streaming 4F](CITY_STREAMING_4F.md) — graduated impact damage, alerts, cooldown and severe stalls.

## Gameplay systems

- [Runtime consolidation](RUNTIME_CONSOLIDATION.md) — Milestone 10 ownership, spatial queries and diagnostics.
- [Milestone 10 status](MILESTONE_10_STATUS.md) — consolidation validation boundary.
- [Input system](INPUT_SYSTEM.md) — central frame contract and control modes.
- [Combat system](COMBAT_SYSTEM.md) — mouse combat and damage-to-Hunger loop.
- [Police alert](POLICE_ALERT.md) — wanted escalation for police assault and neutralization.
- [NPC AI](AI_SYSTEM.md) — priority states, police roles, witnesses, hunter memory and recovery.
- [Drain system](DRAIN_SYSTEM.md) — eligibility, channel cancellation and perception.
- [Movement system](MOVEMENT_SYSTEM.md) — running, quiet movement, footsteps and traversal.
- [Damageable props](PROP_SYSTEM.md) — streetlights, darkness, reactions and events.
- [Weapon system](WEAPON_SYSTEM.md) — prototype inventory, wheel selection, attacks, ammo and noise.
- [Tutorial UX and accessibility](UX_ACCESSIBILITY.md) — teaching, HUD, semantic labels and accessibility.
- [Control scheme](CONTROL_SCHEME.md) — keyboard/mouse controls and interaction priority.

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
- **Proposed**: recommended direction that can still change.
- **Deferred**: intentionally outside the current production horizon.
- **Working name**: terminology that still requires commercial trademark clearance.

## Maintenance rule

Any change to controls, mission/save authority, AI/combat, vehicle/traffic persistence, city dimensions, streaming order, UI, setting terminology, economy or active production priority must update `PROJECT_BLUEPRINT.md` and the relevant detailed document in the same PR.
