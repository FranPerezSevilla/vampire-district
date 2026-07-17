# Project snapshot

_Last updated: 2026-07-17_

## Product vision

**Vampire District** is a top-down urban stealth-action game inspired by the readable city layout, systemic police pressure and immediate navigation of early Grand Theft Auto games, but built around a vampire fantasy.

The player is a young vampire carrying out orders for their sire. The current vertical slice teaches traversal, feeding, Hunger, witnesses, police pressure and the veil through one contained mission: identify and silence a journalist before the clan is exposed.

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

## Current mission flow

1. Intro banner establishes the player as an inexperienced vampire.
2. The player hears their sire and receives the journalist assignment.
3. The tutorial teaches rooftop traversal.
4. A rooftop blocker confronts the player.
5. The player drains the blocker and learns how Hunger and witnesses work.
6. A police informant on the station roof gives the journalist's location.
7. The sire gives one final instruction.
8. The player reaches the nightclub area, handles the journalist and returns to the refuge.
9. The final report is presented as approval from the sire.

## Current control model

**Implemented today**

- WASD / arrow keys: movement.
- Space: run and contextual traversal.
- E: contextual interaction.
- Q: Dash.
- R: Whisper.
- F: Blood Sense.
- M: mission panel.
- H: menu.
- Escape: advance narrative dialogue or close UI.

The visible controls are unchanged by Milestone 1, but Space, E, Q, R and F now flow through one action frame. Pointer buttons, responsive world aim and wheel steps are already captured for the upcoming combat milestones.

**Planned replacement**

- WASD / arrows: movement, with running as the default speed.
- Mouse: aim/facing direction.
- Left mouse: attack or fire in the aimed direction.
- Right mouse: contextual drain.
- Mouse wheel: cycle weapons.
- Space: traversal only.
- E: non-movement interactions such as talking, collecting and operating mission objects.

See [Control scheme](CONTROL_SCHEME.md) and [Input system](INPUT_SYSTEM.md).

## Architecture snapshot

The prototype currently uses:

- `GameScene` for world simulation and rendering.
- `UIScene` for DOM-backed HUD and modal state.
- Dedicated systems for missions, NPCs, police, witnesses, exposure, feeding, powers, evidence, hunters, interactions and transitions.
- `InputSystem` as the authoritative gameplay-input source.
- A single frame snapshot consumed by movement, traversal, interactions, powers and interaction-menu navigation.
- Pure input/geometry helpers tested through Node's built-in test runner.
- Data modules for balance, district layout and NPC definitions.
- Feature modules that still patch some scene/system prototypes for newer vertical-slice behaviour.

Milestone 1 removes the previous multi-purpose movement-control patch and centralizes world input. The remaining runtime adapters are documented technical debt; combat should consume the new frame contract rather than add another input path.

## Milestone 1 validation state

- Action gating, pointer scaling, camera conversion, wheel normalization and reset behaviour have automated coverage.
- Fifteen zero-dependency Node tests pass in the implementation workspace.
- The full tutorial/mission still requires manual browser regression at representative viewport sizes and at least two render-quality presets before the milestone is marked completely done.

## Locked design decisions

- The game remains top-down and readable rather than camera-heavy.
- The city should feel larger than the playable district, but the current mission stays geographically contained.
- Narrative dialogue remains short, speaker-anchored and player-advanced with Escape.
- The sire should sound authoritative and old, but tutorial language must remain immediately understandable.
- Vision and hearing are separate perception channels.
- Hearing alone creates attention and orientation, not an automatic pursuit.
- Space is reserved for physical traversal in the target control scheme.
- Feeding is both a tactical action and the primary way to reduce Hunger.
- Taking damage will increase Hunger instead of introducing a separate conventional player health bar in the first combat implementation.
- New combat code must consume `InputSystem` actions rather than query raw browser or Phaser keys.

## Open design decisions

- Whether holding Shift should switch the default run into a quiet walk/sneak mode.
- Exact player Hunger increase per incoming hit.
- Whether downed NPCs recover after a timer or remain down until the encounter ends.
- Initial weapon set for the first combat milestone.
- Whether hearing visualization is always visible or only shown through Blood Sense/debug options.
- Whether civilians can fight back or only flee/report in the first combat pass.

## Main risks

1. **Remaining prototype patch depth** — several non-input features still modify prototype methods and must eventually move into explicit bootstrap/core ownership.
2. **Browser regression coverage** — automated browser tests do not yet verify the complete mission, responsive aim and control locks.
3. **AI state collisions** — pursuit, witness reporting, sound reactions, stun, feeding and future combat states need explicit priority.
4. **Positive feedback difficulty** — damage increasing Hunger can create a rapid failure spiral unless hit values, invulnerability and feeding opportunities are tuned carefully.
5. **Visual noise** — permanent vision, hearing, prompts, objective arrows and combat feedback can overcrowd the screen.

## Immediate project priority

Complete the Milestone 1 browser regression, then begin Milestone 2 on top of the established action frame: mouse-facing direction, unarmed attack timing, hit arcs, NPC resilience, stagger and knockdown. Right-click drain and weapons remain later milestones and must reuse the same input and combat contracts.
