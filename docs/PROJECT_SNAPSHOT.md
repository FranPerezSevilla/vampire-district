# Project snapshot

_Last updated: 2026-07-18_

## Product vision

**Vampire District** is a top-down urban stealth-action game inspired by the readable city layout, systemic police pressure and immediate navigation of early Grand Theft Auto games, but built around a vampire fantasy.

The player is a young vampire carrying out orders for their sire. The current vertical slice teaches traversal, feeding, Hunger, witnesses, police pressure, unarmed combat, damage-to-Hunger and the veil through one contained mission: identify and silence a journalist before the clan is exposed.

## Current playable vertical slice

**Implemented**

- Phaser 3 browser build with responsive presentation and selectable internal render quality.
- Street, low-rooftop, high-rooftop and sewer layers.
- Contextual traversal between rooftops, fire escapes, roof drops and sewer entrances.
- Narrative tutorial with player dialogue, sire thoughts and NPC dialogue anchored above the speaker.
- Police-roof informant who gives the journalist's location and leaves after the exchange.
- Objective guidance for the tutorial path.
- Hunger, feeding, vampire powers and veil/exposure pressure.
- Police search escalation, pursuit, arrest conditions and helicopter support at high alert.
- NPC vision and hearing awareness, including heard-only `WTF` reactions.
- Responsive HUD, mission drawer, interaction prompts and result screens.
- A visually extended city around the playable district while keeping the mission boundary intact.
- Central action-based gameplay `InputSystem` with responsive pointer conversion and automated unit tests.
- Mouse-facing direction and left-click unarmed attacks.
- Data-driven NPC resilience, stagger feedback and persistent downed state.
- Police and hunter melee telegraphs built on existing pursuit/hunt intent.
- Player hit stun and invulnerability against overlapping attacks.
- Incoming enemy damage converted into Hunger rather than a health bar.
- Critical Hunger feedback and frenzy failure at the Hunger limit.

## Current mission flow

1. Intro banner establishes the player as an inexperienced vampire.
2. The player hears their sire and receives the journalist assignment.
3. The tutorial teaches rooftop traversal.
4. A rooftop blocker confronts the player.
5. The player aims with the mouse, knocks the blocker down with four punches and drains him with the temporary E interaction.
6. The player learns how Hunger and witnesses work.
7. A police informant on the station roof gives the journalist's location.
8. The sire gives one final instruction.
9. The player reaches the nightclub area and handles the journalist.
10. Handling the journalist does not complete the mission; the active objective becomes returning to the rooftop refuge.
11. On reaching the refuge, the sire acknowledges the completed order in a dialogue bubble.
12. Only after that bubble is dismissed does the mission become complete and the final night report open.

## Current control model

**Implemented today**

- WASD / arrow keys: movement.
- Mouse: face and aim.
- Left mouse: unarmed directional attack.
- Space: run and contextual traversal.
- E: contextual interaction and temporary tutorial drain.
- Q: Dash.
- R: Whisper.
- F: Blood Sense.
- M: mission panel.
- H: menu.
- Left click: advance narrative dialogue while a dialogue bubble is open.
- Escape: keyboard fallback for dialogue and UI closing.

Space, E, Q, R, F and pointer actions flow through one central action frame. Hit stun filters that frame so movement, attacks, powers, traversal and interaction cannot fire while the player is reeling.

**Planned replacement still pending**

- Right mouse: contextual drain.
- Mouse wheel: cycle weapons.
- Space: traversal only, with running becoming the normal movement speed.
- E: non-movement interactions such as talking, collecting and operating mission objects.

See [Control scheme](CONTROL_SCHEME.md), [Input system](INPUT_SYSTEM.md) and [Combat system](COMBAT_SYSTEM.md).

## Combat pressure snapshot

Current enemy attack baselines:

- police baton strike: `Hunger +12`;
- hunter heavy strike: `Hunger +20`;
- player hit stun: `260 ms`;
- player invulnerability: `720 ms`;
- critical Hunger: `85`;
- frenzy failure: `100`.

Police attack only while their existing system marks them as actively chasing. Hunters attack while active and hunting outside shadow. Civilians, the journalist and rooftop thug do not autonomously attack in this milestone.

## Architecture snapshot

The prototype currently uses:

- `GameScene` for world simulation and rendering.
- `UIScene` for DOM-backed HUD and modal state.
- Dedicated systems for missions, NPCs, police, witnesses, exposure, feeding, powers, evidence, hunters, interactions and transitions.
- `InputSystem` as the authoritative gameplay-input source.
- `CombatSystem` for aim, player attack timing, hit geometry, resilience and knockdown.
- `PlayerDamageSystem` for enemy melee timing, hit validation, player stun, invulnerability and damage-to-Hunger.
- A single frame snapshot consumed by movement, traversal, interactions, powers and combat.
- Pure input, geometry and combat helpers tested through Node's built-in test runner.
- Data modules for balance, combat, player damage, district layout and NPC definitions.
- Feature modules that still patch some scene/system prototypes for newer vertical-slice behaviour.

Milestones 1–3 establish reusable input and bidirectional combat contracts. Right-click draining, weapons and richer AI must reuse these contracts rather than add parallel input, damage or state paths.

## Validation state

- Input gating, pointer scaling, camera conversion, wheel normalization and reset behaviour have automated coverage.
- Aim dead-zone, melee arc and NPC resilience transitions have automated coverage.
- Enemy attack phases, range/arc checks, hit stun, invulnerability and Hunger thresholds have automated coverage.
- The full tutorial/mission still requires manual browser regression at representative viewport sizes and at least two render-quality presets before Milestones 1–3 are marked completely done.

## Locked design decisions

- The game remains top-down and readable rather than camera-heavy.
- The city should feel larger than the playable district, but the current mission stays geographically contained.
- Narrative dialogue remains short, speaker-anchored and player-advanced with click.
- The sire should sound authoritative and old, but tutorial language must remain immediately understandable.
- Vision and hearing are separate perception channels.
- Hearing alone creates attention and orientation, not an automatic pursuit.
- Space is reserved for physical traversal in the target control scheme.
- Feeding is both a tactical action and the primary way to reduce Hunger.
- Taking damage increases Hunger instead of introducing a separate conventional player health bar.
- Overlapping damage is controlled through invulnerability rather than arbitrary per-enemy damage reduction.
- Reaching 100 Hunger currently ends the run as frenzy/loss of control.
- New combat code consumes `InputSystem` actions rather than querying raw browser or Phaser keys.
- NPC durability is represented as resilience, ending in a downed state rather than immediate death.
- Neutralizing the journalist changes the objective to returning home; mission completion occurs only at the refuge.
- The finale order is sire dialogue first, final report second.

## Open design decisions

- Whether holding Shift should switch the default run into a quiet walk/sneak mode.
- Final police/hunter damage and timing values after browser playtesting.
- Whether downed NPCs recover after a timer or remain down until the encounter ends.
- Initial weapon set for the first weapon milestone.
- Whether hearing visualization is always visible or only shown through Blood Sense/debug options.
- Whether civilians can fight back or only flee/report in the first combat pass.
- Whether the rooftop thug retaliates after the tutorial or remains a purely instructional blocker.
- Final unarmed range, timing and feedback values after browser playtesting.

## Main risks

1. **Remaining prototype patch depth** — several non-input features still modify prototype methods and must eventually move into explicit bootstrap/core ownership.
2. **Browser regression coverage** — automated browser tests do not yet verify the complete mission, responsive aim, enemy attack timing and control locks.
3. **AI state collisions** — pursuit, witness reporting, sound reactions, stagger, knockdown, feeding and enemy attacks still need one explicit priority model.
4. **Positive feedback difficulty** — damage increasing Hunger can create a rapid failure spiral unless timings, invulnerability and feeding opportunities are tuned carefully.
5. **Visual noise** — permanent vision, hearing, prompts, objective arrows and combat telegraphs can overcrowd the screen.
6. **Combat fairness** — telegraphs must remain readable at every zoom, viewport and render-quality setting.

## Immediate project priority

Validate the Milestone 3 police/hunter attack loop, control recovery, overlapping attackers and frenzy behaviour in-browser. After that, implement Milestone 4: contextual right-click draining for downed targets and unaware standing targets approached from behind.
