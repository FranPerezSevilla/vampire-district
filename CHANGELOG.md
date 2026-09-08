# Changelog

## 2026-09-08 — Wider roads and documentation reconciliation (PR #82)

- Widened avenues from 120 to 150 units, local streets from 72–84 to 96, and service streets from 60–68 to 88.
- Rebuilt lane centres, junction approaches, sidewalks and streamed city packs from geometry v5; retained two lanes per avenue direction.
- Reserved sidewalk/façade space, adjusted 66 buildings and attached roofs/access points, and retained all 93 building identities.
- Kept 600 civilian cars and six buses; native geometry/flow/transit/performance checks pass, with some junction waits still present.
- Reconciled the snapshot, blueprint, roadmap, controls, architecture, index and traffic closure state; distinguished historical records from current contracts.
- User approved the widened Pages build and authorized integration. Validated gameplay implementation: `163e870`, 911 native tests, city 87.8/A with zero errors/warnings. Browser tests were excluded by user instruction.

## 2026-09-08 — Physical city traffic, buses, CPU and Pages radio (PR #73)

- Rebuilt civilian driving around shared player-vehicle kinematics and broad repeating city circuits.
- Added whole-body junction permissions, safe bypass/reverse/reassessment and fair recovery attempts.
- Introduced four-lane avenues and three two-bus services with stops, real passenger transfers, and passenger/theft selection through the existing interaction menu.
- Settled density at 600 civilian cars after the 1,000-car experiment; retained a fixed 64-slot materializer.
- Reduced CPU work with incremental route accounting, staggered distant simulation, lazy diagnostics and cached spatial/body geometry.
- Enabled the existing nine radio sources on the exact ViceBlood Pages project, with continuous three-station broadcasts and shared nearby-car ambience.
- Merged with explicit user approval at `7ee3af6`.

## 2026-07-29 — Predator powers and the Beast

- Expanded Blood Sense into heartbeat, wound, feeding-trace, drained-body, blood-trail and heartbeat-absence readings through cover.
- Added knowledge-limited protected-prey marks.
- Replaced automatic Whisper lure with contextual Come Here, Walk Away, Stay Calm, Forget This, Open It, Get In and Call Them Off commands.
- Added deterministic resistance, Hunger prices and witnessed/resisted power evidence.
- Added four readable Beast pressure states and a remappable B / Give In burst.
- Give In accelerates movement and feeding, strengthens melee, breaks hit stun and creates visible-power risk.
- Removed automatic 100-Hunger frenzy failure; critical Hunger remains fully player-controlled.

## 2026-07-29 — Heat and evidence-backed Exposure

- Separated ordinary police Heat from supernatural Veil Exposure.
- Made persistent district Heat the sole authority for search, pursuit, cruisers and air support.
- Added concrete witness, bite-mark, drained-body, unconscious-victim, blood-pattern and visible-power evidence.
- Added latent, reported, institutional and resolved knowledge states.
- Added crime-as-an-alibi support that can exchange Exposure for mundane Heat.
- Persisted both domains through campaign schema v5 and checkpoint schema v3.
- Split the Night Ledger into Police/Heat and Veil/Evidence explanations.

## 2026-07-24 — Foundry industrial road-block simplification

- Removed the redundant Foundry Works Road, north-drop and east-link micro-grid.
- Preserved a four-edge perimeter around a usable industrial loading yard.
- Added graph validation for parallel roads that leave less than 36 units of block depth.
- Migrated the Foundry semantic corridor and pedestrian route anchor to the perimeter.
- Regenerated City Topology V2 and all affected chunks from road geometry v4.

## Prototype snapshot

Initial repository setup for the single-file browser prototype.

Current working local artifact:

- `index.html` single-file HTML/CSS/JS prototype.
- Top-down urban vampire sandbox.
- Journalist interception mission for clan hierarchy narrative.
- Hunger driven by power usage.
- Shadow Dash, Whisper and Blood Sense.
- Witnesses, police attention, hunters, evidence, body hiding, rooftops, sewers and safehouse loop.
- Procedural audio enabled in the prototype.
- Current preference: keep the project runnable as a single `index.html` opened directly in a browser.

## Repo setup

- Added README.
- Added changelog.
- Added TODO planning file.
