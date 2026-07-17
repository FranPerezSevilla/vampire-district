# Roadmap

This roadmap is ordered by dependency, not by calendar date. Combat should be built on a stable input and state foundation rather than added as another prototype patch.

## Status legend

- ✅ Complete
- 🟡 In progress / implemented but awaiting validation
- ⬜ Planned
- ◇ Optional or deferred

## Milestone 0 — Vertical slice foundation

**Status: ✅ Complete / ongoing polish**

- ✅ Phaser 3 playable district.
- ✅ Street, rooftop and sewer traversal.
- ✅ Hunger, feeding and vampire powers.
- ✅ Mission/tutorial narrative.
- ✅ Police informant and journalist mission flow.
- ✅ Police escalation and helicopter support.
- ✅ Vision and hearing reactions.
- ✅ Responsive browser presentation and render-quality options.
- ✅ Extended city backdrop and district boundary warning.
- ✅ Project documentation baseline.

## Milestone 1 — Architecture stabilization

**Status: 🟡 Implementation complete; browser regression validation pending**

### Goal

Create safe foundations for mouse combat without adding more overlapping input patches.

### Implemented

- ✅ Added a central action-based `InputSystem`.
- ✅ Keyboard, pointer buttons, pointer position and wheel input now produce one frame snapshot.
- ✅ Space traversal dispatch has one authoritative runtime owner.
- ✅ E interaction dispatch has one authoritative runtime owner.
- ✅ Q/R/F power dispatch consumes abstract actions instead of Phaser keys.
- ✅ Tutorial restrictions use central control modes rather than per-gameplay-key ownership.
- ✅ Window blur, document visibility, pointer-leave and scene shutdown reset input.
- ✅ Added pure geometry and responsive pointer-mapping helpers.
- ✅ Added a zero-dependency Node test setup.
- ✅ Replaced the old multi-purpose `movement-controls.js` implementation with a thin bootstrap/UI compatibility module.
- ✅ Added dedicated technical documentation in `docs/INPUT_SYSTEM.md`.

### Preserved compatibility

- Space still doubles as sprint and traversal in the current playable build. Its sprint role is isolated inside `InputSystem` and is removed in Milestone 5.
- Right-click and wheel actions are collected but remain unconsumed until their drain/weapon milestones.
- Left-click now consumes the existing primary-attack action through Milestone 2.

### Acceptance status

- ✅ Space/E/Q/R/F have one authoritative gameplay implementation.
- ✅ Dialogue/tutorial locks suppress world actions centrally.
- ✅ Responsive client-to-game and screen-to-world conversion is unit-tested.
- ✅ Existing tutorial control modes are mapped to the input layer.
- 🟡 Full browser regression of the complete mission at representative viewport sizes and quality presets is still required.

## Milestone 2 — Mouse aim and unarmed combat

**Status: 🟡 Implementation complete; browser regression and tuning pending**

### Goal

Deliver the first complete directional combat loop without weapons.

### Implemented

- ✅ Mouse-driven player facing through responsive world coordinates.
- ✅ Aim dead zone and last-direction retention.
- ✅ Left-click unarmed attack.
- ✅ Explicit windup, active and recovery windows.
- ✅ Directional melee hit arc.
- ✅ Duplicate-hit prevention per attack.
- ✅ Data-driven NPC resilience.
- ✅ Stagger and downed states.
- ✅ Civilian/target resilience: 3.
- ✅ Police/thug resilience: 4.
- ✅ Hunter resilience: 5.
- ✅ Temporary resilience feedback and clear downed visuals.
- ✅ Downed NPCs stop moving, pursuing and reporting.
- ✅ Rooftop tutorial now requires punching the thug down before the temporary E drain.
- ✅ Pure combat geometry and resilience tests.
- ✅ Dedicated documentation in `docs/COMBAT_SYSTEM.md`.

### Acceptance status

- ✅ Pure tests verify three-hit civilian and four-hit police knockdown.
- ✅ One attack owns a hit set and cannot damage the same target twice.
- ✅ Pure arc tests reject targets behind or outside range.
- ✅ Combat actions are gated by the central UI/tutorial input modes.
- 🟡 Complete browser validation is still required for cursor accuracy, attack cadence, tutorial knockdown/drain and different viewport/render-quality combinations.
- 🟡 Feel tuning for range, timings and feedback remains open after playtesting.

## Milestone 3 — Player damage and Hunger combat loop

**Status: ⬜ Planned**

### Goal

Make Hunger the player's attrition/health pressure during combat.

### Work

- Enemy attack requests and hit validation.
- Player hit stun and invulnerability frames.
- Incoming damage adds Hunger.
- Hunger gain varies by attack strength.
- Critical-Hunger feedback during combat.
- Tuning pass to prevent unavoidable damage spirals.

### Acceptance criteria

- Repeated overlap cannot instantly max Hunger.
- Feeding clearly recovers combat pressure.
- Taking damage remains readable without a separate health bar.
- Critical Hunger still uses the established loss-of-control rules.

## Milestone 4 — Contextual right-click drain

**Status: ⬜ Planned**

### Goal

Turn feeding into a precise combat/stealth verb.

### Work

- Use the existing right-button action from `InputSystem`.
- Downed-target drain from any angle.
- Standing stealth drain from rear arc only.
- Awareness/alert eligibility checks.
- Drain channel, interruption and cancellation.
- Reticle feedback for valid/invalid drain.
- Witness and hearing integration.

### Acceptance criteria

- Downed targets are drainable.
- Unaware standing targets are drainable from behind.
- Alert/front-facing standing targets are not drainable.
- Moving away or taking damage cancels the drain.
- Right-click never opens the browser menu over the game.

## Milestone 5 — Traversal-only Space and quiet movement

**Status: 🟡 Partially implemented**

### Goal

Remove the final movement/control ambiguity.

### Work

- Running becomes the default movement speed.
- Remove the compatibility `sprintHeld` use of Space.
- Space remains roof jump, roof drop, fire escape and sewer traversal only.
- Deterministic traversal candidate scoring using the geometry helper baseline.
- Context icon before activation.
- **Proposed:** Shift becomes quiet walk/sneak.
- Movement sound levels feed the hearing system.

### Acceptance criteria

- Space with no route does nothing.
- Space never triggers Dash or sprint.
- Nearby route conflicts resolve consistently.
- E never executes traversal.
- Optional quiet movement creates measurably less sound than default running.

## Milestone 6 — Damageable streetlights and world props

**Status: ⬜ Planned**

### Goal

Make environmental interaction part of the combat language.

### Work

- Convert streetlights to damageable prop entities.
- Remove E-based streetlight breaking.
- Allow punches and weapons to damage props.
- Break event updates lighting/shadow state.
- Break event emits visual and sound perception events.
- Add reusable prop-damage interface for future objects.

### Acceptance criteria

- A valid attack breaks a baseline streetlight.
- A miss does not break it.
- Watching NPCs trigger visual reactions.
- Hearing-only NPCs turn and show `WTF` without pursuit.

## Milestone 7 — Weapon system and mouse-wheel inventory

**Status: ⬜ Planned**

### Goal

Add weapons without changing the established aim and damage contracts.

### Work

- Data-driven `WeaponSystem`.
- Inventory and equipped weapon.
- Consume the existing discrete `weaponStep` action.
- Enable wheel-scroll suppression only while the weapon system owns the wheel.
- Weapon-change HUD toast.
- Improvised melee weapon.
- Pistol/hitscan foundation.
- Ammo and reload only if needed for the first weapon slice.
- Weapon-specific damage, cadence and sound.

### Acceptance criteria

- Wheel changes exactly one owned weapon step per gesture.
- Page does not scroll while cycling in-game.
- Unarmed and weapon attacks share target/damage infrastructure.
- Gunshots create stronger hearing/police reactions than punches.

## Milestone 8 — AI combat behaviours

**Status: ⬜ Planned**

### Goal

Make NPC types respond coherently to being attacked and to nearby combat.

### Work

- Police approach/attack behaviour.
- Civilian flee/report behaviour.
- Thug/hunter aggression.
- Downed and optional recovery rules.
- AI priority state machine.
- Friendly/neutral collision and separation during combat.
- Police backup interaction with wanted levels.

### Acceptance criteria

- Police do not remain in a `WTF` state after a confirmed visual attack.
- Hearing alone still does not create pursuit.
- Civilians do not use police combat behaviour.
- Downed NPCs cannot patrol, report or attack.
- Alert transitions are deterministic and testable.

## Milestone 9 — Tutorial and UX update

**Status: 🟡 Partially implemented**

### Goal

Teach the new controls with minimal text and no input ambiguity.

### Work

- Update intro tutorial copy.
- ✅ Teach mouse aim and left-click attack at the rooftop blocker.
- Teach right-click drain after knockdown or rear approach.
- Teach Space as traversal only.
- Teach wheel weapon cycling when the first weapon is acquired.
- Update HUD/prompt icons.
- Add high-contrast/accessible aim feedback.

### Acceptance criteria

- A first-time player can complete the opening route without reading external instructions.
- No tutorial prompt advertises obsolete controls.
- Dialogue remains short and anchored to the speaker.
- Every tutorial lock releases correctly after click/action completion.

## Milestone 10 — Consolidation, tests and performance

**Status: ⬜ Planned**

### Goal

Turn the expanded vertical slice into a maintainable baseline.

### Work

- Move the remaining integration adapters into explicit first-class bootstrap/core methods.
- Remove superseded prototype patches.
- Expand unit tests for combat geometry and state transitions.
- Playwright smoke tests for controls and responsive aim.
- Manual regression checklist.
- Performance pass for cones, sound fields, outskirts and combat effects.
- Input remapping groundwork.
- Update all documentation to match final implementation.

### Acceptance criteria

- No known method is patched by multiple active modules.
- Core combat and control rules have automated coverage.
- The game passes smoke tests at representative mobile, laptop and desktop viewports.
- Documentation describes the implementation rather than an outdated plan.

## Deferred roadmap

These are intentionally outside the immediate combat slice:

- Vehicles and vehicle combat.
- Full inventory UI.
- Large weapon catalogue.
- Save/load campaign progression.
- Multiple districts.
- Faction reputation system.
- Advanced civilian combat.
- Full gamepad support.
- Multiplayer/networking.

## Definition of done for any milestone

A milestone is complete only when:

1. The feature works in the playable build.
2. Existing tutorial/mission flow has been regression-tested.
3. Browser resizing and at least two render-quality presets have been tested.
4. Input/UI conflicts are covered.
5. Relevant documentation is updated.
6. Known limitations are recorded rather than hidden.
