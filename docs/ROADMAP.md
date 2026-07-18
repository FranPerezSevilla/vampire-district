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
- Mouse wheel actions are collected but remain unconsumed until the weapon milestone.
- Left-click is consumed by Milestone 2 and right-click by Milestone 4 through the same frame contract.

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
- ✅ Rooftop tutorial requires punching the thug down before draining.
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

**Status: 🟡 Implementation complete; browser regression and tuning pending**

### Goal

Make Hunger the player's attrition/health pressure during combat.

### Implemented

- ✅ Police melee attack requests reuse existing chase intent.
- ✅ Hunter melee attacks reuse existing hunt intent.
- ✅ Enemy windup, active and recovery phases.
- ✅ Stored direction, range and arc hit validation.
- ✅ Player hit stun and central action suppression.
- ✅ 720 ms invulnerability window against overlapping attacks.
- ✅ Incoming damage increases Hunger instead of reducing health.
- ✅ Police strike baseline: Hunger +12.
- ✅ Hunter heavy strike baseline: Hunger +20.
- ✅ Damage interrupts the current punch or drain channel.
- ✅ Floating Hunger feedback, player flicker, impact ring and camera shake.
- ✅ Critical Hunger feedback from 85.
- ✅ Frenzy mission failure at 100 Hunger.
- ✅ Pure tests for damage, invulnerability, timing, range and thresholds.
- ✅ Dedicated Milestone 3 regression checklist and updated combat documentation.

### Acceptance status

- ✅ Pure tests verify that overlapping damage is rejected during invulnerability.
- ✅ Damage is capped at 100 Hunger and attack strength changes the amount gained.
- ✅ Enemy active windows attempt a hit only once.
- ✅ Hit stun filters movement, attacks, traversal, interactions and powers through the existing input frame.
- 🟡 Complete browser validation is still required for dodge readability, simultaneous attackers, control recovery and frenzy failure.
- 🟡 Police/hunter timings and damage values remain tuning baselines.

## Milestone 4 — Contextual right-click drain

**Status: 🟡 Implementation complete; browser regression and tuning pending**

### Goal

Turn feeding into a precise combat/stealth verb.

### Implemented

- ✅ Existing `drainPressed` and `drainHeld` actions now drive feeding.
- ✅ Downed targets are drainable from any approach angle.
- ✅ Standing targets require an unaware rear approach.
- ✅ Alert, chasing, attacking and reporting targets are rejected.
- ✅ Aim alignment, start range and blocking-geometry validation.
- ✅ Deterministic target priority: downed, rats, standing rear targets.
- ✅ Hold-to-channel behaviour.
- ✅ Cancellation on release, movement, damage, invalid range/layer or blocked geometry.
- ✅ Compact valid-target, active-channel and invalid-click feedback.
- ✅ Existing visual witness behaviour remains active.
- ✅ Heard-only NPCs turn toward the struggle and enter `WTF` without pursuit.
- ✅ E drain removed from the interaction list.
- ✅ Rooftop tutorial updated to use right mouse after knockdown.
- ✅ Pure tests for rear/downed eligibility, awareness, aim, range, geometry and priority.
- ✅ Dedicated documentation and browser regression checklist.

### Acceptance status

- ✅ Pure tests verify downed draining from any side.
- ✅ Pure tests verify rear-only standing draining.
- ✅ Alert/front-facing targets are rejected.
- ✅ Damage and movement share the established cancellation paths.
- ✅ Right-click remains context-menu-safe inside the game canvas.
- 🟡 Complete browser validation is still required for channel feel, multiple candidates, witness/hearing reactions and viewport/render-quality combinations.
- 🟡 Range, rear angle and aim assistance remain tuning baselines.

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

- Expand police combat priorities beyond the Milestone 3 baseline melee.
- Civilian flee/report behaviour.
- Thug retaliation and richer hunter aggression.
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
- ✅ Teach right-click drain after knockdown.
- Teach rear-approach standing drain in a later encounter.
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
