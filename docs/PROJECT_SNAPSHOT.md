# Project snapshot

_Last updated: 2026-07-18_

## Product vision

**Vampire District** is a top-down urban stealth-action game inspired by the readable city layout, systemic police pressure and immediate navigation of early Grand Theft Auto games, but built around a vampire fantasy.

The player is a young vampire carrying out orders for their sire. The current vertical slice teaches traversal, feeding, Hunger, witnesses, police pressure, unarmed combat, damage-to-Hunger, contextual draining, quiet movement, environmental destruction and the veil through one contained mission.

## Current playable vertical slice

Implemented:

- Phaser 3 browser build with responsive presentation and render-quality presets.
- Street, low-rooftop, high-rooftop and sewer layers.
- Contextual jumps, roof drops, fire escapes, sewer access and refuge shaft.
- Narrative tutorial with speaker-anchored, click-advanced dialogue.
- Police-roof informant and journalist mission.
- Objective guidance, Hunger, powers, exposure, evidence and witnesses.
- Police escalation, pursuit, melee attacks, arrest and helicopter support.
- Vision and hearing reactions, including heard-only `WTF` behaviour.
- Mouse-directed unarmed combat, resilience, stagger and downed state.
- Enemy damage converted into Hunger with hit stun and invulnerability.
- Right-click draining for downed targets and unaware rear approaches.
- Default running, Shift quiet movement and traversal-only Space.
- Deterministic route selection and world-space traversal prompt.
- Damageable streetlights using the same directional attack contract as NPC combat.
- Broken streetlights remove light, create persistent darkness and trigger sight/hearing reactions.
- Refuge-gated completion: sire dialogue first, report second.

## Current mission flow

1. The intro establishes the player as an inexperienced vampire.
2. The sire orders the player to silence a journalist.
3. Rooftop traversal is introduced.
4. The player knocks down and right-click drains the rooftop blocker.
5. Hunger and witness rules are explained.
6. The police informant gives the journalist's location.
7. The player reaches the club and handles the journalist.
8. The mission changes to returning to the rooftop refuge.
9. At the refuge, the sire acknowledges the result in a dialogue bubble.
10. Only after dismissing the bubble does `REPORT ACCEPTED` open.

## Current controls

- WASD / arrows: run by default.
- Hold Shift: slower quiet movement with a much smaller hearing radius.
- Mouse: face and aim.
- Left mouse: directional unarmed attack against NPCs or world props.
- Right mouse: hold to drain a valid aimed target.
- Space: contextual traversal only.
- E: contextual non-traversal interactions; it does not drain, traverse or break streetlights.
- Q: Dash.
- R: Whisper.
- F: Blood Sense.
- M: mission panel.
- H: menu/help.
- Left click during dialogue: advance one bubble.
- Escape: dialogue/UI keyboard fallback.

Mouse wheel weapon cycling remains planned.

## Movement snapshot

- Default run multiplier: `1.55`.
- Quiet movement multiplier: `0.72`.
- Run footstep base hearing radius: `120` for enhanced listeners.
- Ordinary NPC run-hearing range: `42`.
- Quiet footstep base hearing radius: `42`; ordinary NPCs ignore quiet footsteps.
- Space has no held-speed behaviour.
- Traversal selection order: committed close/forward route, distance, aim, route priority, stable ID.

## Combat pressure snapshot

- Police baton: `Hunger +12`.
- Hunter heavy strike: `Hunger +20`.
- Player hit stun: `260 ms`.
- Player invulnerability: `720 ms`.
- Critical Hunger: `85`.
- Frenzy failure: `100`.

## Drain snapshot

- Start range: `34` units.
- Break range: `42` units.
- Downed target: any approach angle.
- Standing target: unaware rear arc only.
- Hold right mouse to channel.
- Release, movement, damage, invalid layer/range or blocked geometry cancels.

## World-prop snapshot

- Streetlights: `1` durability.
- Hit query: stored unarmed origin, direction, range and arc plus a small prop radius.
- Input: left mouse; E destruction is removed.
- Broken state persists in `brokenLights`.
- Result: light removed, shadow created, glass feedback and perception reaction.
- Hearing-only break response remains `WTF` without automatic pursuit/reporting.

## Architecture snapshot

The prototype currently uses:

- `GameScene` for world coordination and rendering.
- `UIScene` for DOM-backed HUD and modals.
- `InputSystem` for the authoritative action frame.
- `CombatSystem` for aim, player attacks, resilience and knockdown.
- `PlayerDamageSystem` for enemy attacks, hit stun, invulnerability and Hunger damage.
- `DrainSystem` for right-click eligibility and channel validation.
- `MovementNoiseSystem` for actual-displacement footsteps and heard-only reactions.
- `PropDamageSystem` for streetlight durability, attack resolution and break effects.
- Existing systems for NPCs, police, witnesses, missions, feeding, exposure, powers, evidence, hunters, interactions and transitions.
- Pure data modules for combat, player damage, drain, movement, traversal and props.

Temporary adapters still patch legacy scene/system methods. Milestone 10 will fold them into explicit composition.

## Validation state

Automated pure coverage includes:

- input gating and stuck-input prevention;
- responsive pointer mapping;
- melee geometry and resilience;
- enemy attack timing and damage thresholds;
- right-click drain eligibility and priority;
- default/quiet movement speed and hearing tiers;
- deterministic traversal scoring;
- prop hit/miss geometry, durability and repeated-damage protection.

Manual browser regression remains required across the complete mission, representative viewport sizes, Low/Ultra quality and every route/prop reaction before Milestones 1–6 become fully complete.

## Locked design decisions

- Top-down readability over camera-heavy presentation.
- Vision and hearing remain separate channels.
- Hearing alone creates attention, not automatic pursuit.
- Space is exclusively traversal.
- Running is normal; Shift is quiet movement.
- Hunger is the player's combat attrition resource.
- Feeding is tactical recovery.
- NPC durability is resilience leading to downed state.
- World destruction uses the same aimed attack language as combat.
- E does not break streetlights.
- Journalist handling requires an actual return to the refuge.
- Finale order is sire dialogue, then final report.

## Open design decisions

- Final speed and footstep-hearing tuning after browser playtesting.
- Final police/hunter attack values.
- Final drain range, rear angle and channel feel.
- Final streetlight hit radius, exposure cost and break feedback.
- Whether downed NPCs recover.
- Initial weapon set.
- Whether perception visualization is always visible.
- Civilian and thug retaliation scope.
- Final unarmed feel and feedback.

## Main risks

1. Prototype adapter depth and import-order sensitivity.
2. Missing automated browser regression.
3. Competing AI flags before the final priority state machine.
4. Hunger damage creating a positive feedback difficulty spiral.
5. Screen clutter from objectives, perception and combat feedback.
6. Footstep, traversal and prop-hit tuning differing across zoom levels.

## Immediate project priority

Validate Milestone 6 in-browser: aimed hit alignment, E removal, persistent broken-light darkness, visual witnesses, heard-only `WTF` reactions and full mission compatibility. Then implement Milestone 7: weapons and mouse-wheel inventory on the shared NPC/prop damage contracts.
