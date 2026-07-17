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

**Planned replacement**

The next control milestone changes the game to a modern top-down keyboard-and-mouse model:

- WASD / arrows: movement, with running as the default speed.
- Mouse: aim/facing direction.
- Left mouse: attack or fire in the aimed direction.
- Right mouse: contextual drain.
- Mouse wheel: cycle weapons.
- Space: traversal only.
- E: non-movement interactions such as talking, collecting and operating mission objects.

See [Control scheme](CONTROL_SCHEME.md).

## Architecture snapshot

The prototype currently uses:

- `GameScene` for world simulation and rendering.
- `UIScene` for DOM-backed HUD and modal state.
- Dedicated systems for missions, NPCs, police, witnesses, exposure, feeding, powers, evidence, hunters, interactions and transitions.
- Data modules for balance, district layout and NPC definitions.
- Feature modules that patch scene/system prototypes to add newer behaviour without rewriting the original vertical slice.

This patch-based structure was useful for rapid iteration, but it is now the main technical risk. Input, combat and AI changes should begin with a consolidation pass so new mechanics are first-class systems rather than another layer of prototype patches.

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

## Open design decisions

- Whether holding Shift should switch the default run into a quiet walk/sneak mode.
- Exact player Hunger increase per incoming hit.
- Whether downed NPCs recover after a timer or remain down until the encounter ends.
- Initial weapon set for the first combat milestone.
- Whether hearing visualization is always visible or only shown through Blood Sense/debug options.
- Whether civilians can fight back or only flee/report in the first combat pass.

## Main risks

1. **Prototype patch depth** — several features modify the same prototype methods, making ordering and regressions harder to reason about.
2. **Input overlap** — movement, traversal, interaction, powers and menus currently share key handling across multiple modules.
3. **Responsive pointer mapping** — mouse aim must remain correct at every CSS size, render-quality preset and camera zoom.
4. **AI state collisions** — pursuit, witness reporting, sound reactions, stun, feeding and future combat states must have explicit priority.
5. **Positive feedback difficulty** — damage increasing Hunger can create a rapid failure spiral unless hit values, invulnerability and feeding opportunities are tuned carefully.
6. **Visual noise** — permanent vision, hearing, prompts, objective arrows and combat feedback can overcrowd the screen.

## Immediate project priority

Before adding weapons, implement an action-based input layer and a small combat foundation. The first playable combat milestone should include mouse aim, directional punches, NPC resilience, knockdown, contextual draining and damage-to-Hunger conversion. Weapons should build on that foundation rather than define it.
