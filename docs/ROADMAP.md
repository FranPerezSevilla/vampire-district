# Roadmap

This roadmap is ordered by dependency, not calendar date. Each milestone is marked complete only after implementation, browser regression and documentation agree.

## Status legend

- ✅ Complete
- 🟡 Implemented or partially implemented; browser validation/tuning pending
- ⬜ Planned
- ◇ Deferred or optional

## Milestone 0 — Vertical slice foundation

**Status: ✅ Complete / ongoing polish**

Implemented:

- Phaser 3 district with street, rooftop and sewer layers.
- Hunger, feeding, powers, witnesses, police escalation and mission flow.
- Narrative tutorial, police informant, journalist objective and refuge-gated finale.
- Vision and hearing reactions.
- Responsive presentation, render-quality presets and surrounding-city backdrop.
- Project documentation baseline.

## Milestone 1 — Architecture stabilization

**Status: 🟡 Implementation complete; browser regression pending**

Implemented:

- Central action-based `InputSystem`.
- One frame for keyboard, pointer, aim and wheel input.
- Central Space/E/Q/R/F ownership.
- Tutorial control modes and world locks.
- Focus/visibility/reset protection.
- Pure geometry and input tests.

Pending:

- Complete mission regression at representative viewport sizes and Low/Ultra quality.
- Final migration of temporary adapters during Milestone 10.

## Milestone 2 — Mouse aim and unarmed combat

**Status: 🟡 Implementation complete; browser regression and tuning pending**

Implemented:

- Mouse-facing direction and aim dead zone.
- Left-click unarmed attack with windup, active and recovery phases.
- Directional melee arc and duplicate-hit prevention.
- NPC resilience, stagger and persistent downed state.
- Civilian/target 3, police/thug 4, hunter 5 resilience.
- Rooftop blocker combat tutorial.

Pending:

- Browser validation of cursor accuracy, attack feel and exact tuning.

## Milestone 3 — Player damage and Hunger combat loop

**Status: 🟡 Implementation complete; browser regression and tuning pending**

Implemented:

- Police and hunter melee attacks using existing chase/hunt intent.
- Enemy telegraphs, stored attack direction and hit validation.
- Player hit stun and 720 ms invulnerability.
- Incoming damage converted to Hunger.
- Police +12 and hunter +20 Hunger baselines.
- Critical Hunger feedback and frenzy failure at 100.
- Damage interruption for attacks and draining.

Pending:

- Browser validation of dodging, simultaneous attackers and control recovery.

## Milestone 4 — Contextual right-click drain

**Status: 🟡 Implementation complete; browser regression and tuning pending**

Implemented:

- Right-click held drain using central `drainPressed` / `drainHeld` actions.
- Downed targets drainable from any side.
- Standing targets drainable only from an unaware rear approach.
- Awareness, range, aim and line-clear validation.
- Deterministic candidate priority.
- Cancellation on release, movement, damage or invalid geometry.
- Visual witness and heard-only `WTF` integration.
- Rooftop tutorial migrated from E drain to right-click.

Pending:

- Browser validation of channel feel, multiple candidates and perception reactions.

## Milestone 5 — Traversal-only Space and quiet movement

**Status: 🟡 Implementation complete; browser regression and tuning pending**

Implemented:

- WASD/arrows run at the normal fast speed without a modifier.
- Shift switches to slower quiet movement.
- Space no longer changes speed and only emits traversal.
- `quietHeld` added to the central frame; obsolete sprint state is neutralized.
- Deterministic traversal scoring:
  1. committed close-and-forward route;
  2. distance;
  3. aim angle;
  4. route priority;
  5. stable ID.
- The same candidate drives both the prompt and execution.
- World-space `SPACE` marker before activation.
- Footstep audio follows actual movement rather than raw key state.
- Ordinary NPCs only show footstep `WTF` when running inside the short range.
- Police and hunters retain enhanced hearing.
- Pure movement and traversal tests.
- Dedicated movement documentation and regression checklist.

Acceptance status:

- ✅ Holding Space cannot produce sprint state.
- ✅ Shift is the quiet-movement modifier.
- ✅ Space with no route has no world action.
- ✅ E remains separate from traversal.
- ✅ Pure tests cover speed differences, hearing tiers and deterministic route selection.
- 🟡 Browser validation remains required for all route types, overlapping routes, NPC hearing and viewport/render-quality combinations.
- 🟡 Speed, hearing radius and route-scoring thresholds remain tuning baselines.

## Milestone 6 — Damageable streetlights and world props

**Status: 🟡 Implementation complete; browser regression and tuning pending**

Implemented:

- Every district light is represented as a damageable streetlight prop.
- Baseline durability is one damage point.
- Left-click attacks use the same stored melee origin, direction, range and arc as NPC combat.
- Per-attack prop hit IDs prevent repeated damage in one active window.
- E-based `Break streetlight` interactions are removed from player-facing options.
- Broken lights update the existing `brokenLights` world state.
- Light fields disappear and circular darkness appears immediately.
- Glass audio, break burst and `BROKEN` feedback.
- Visual witnesses use their type-specific reaction.
- Heard-only NPCs turn and show `WTF` without automatic pursuit/reporting.
- Plain-data `prop:damaged`, `prop:broken` and `noise:emitted` events.
- Reusable pure prop durability and hit-query contract.
- Pure hit/miss and repeated-damage tests.
- Dedicated prop documentation and browser regression checklist.

Acceptance status:

- ✅ A valid aimed hit breaks a baseline streetlight.
- ✅ Behind/out-of-range attacks are rejected by pure tests.
- ✅ A broken prop ignores repeated damage.
- ✅ E no longer exposes streetlight destruction.
- ✅ Broken-light shadow and light suppression reuse existing world rules.
- 🟡 Browser validation remains required for visual alignment, persistent darkness, witness/hearing reactions and mission regression.
- 🟡 Hit radius, exposure cost and break feedback remain tuning baselines.

## Milestone 7 — Weapon system and mouse-wheel inventory

**Status: ⬜ Planned**

Planned:

- Data-driven `WeaponSystem` and inventory.
- Consume existing discrete `weaponStep` input.
- Wheel capture only while the game owns weapon cycling.
- Improvised melee weapon and pistol/hitscan baseline.
- Weapon-specific damage, cadence, ammo and sound where required.

Acceptance:

- One wheel gesture changes one owned weapon step.
- Unarmed and weapon attacks share NPC/prop damage contracts.
- Gunshots create stronger hearing/police pressure than punches.

## Milestone 8 — AI combat behaviours

**Status: ⬜ Planned**

Planned:

- Explicit AI priority state machine.
- Richer police approach/attack behaviour.
- Civilian flee/report behaviour.
- Thug retaliation and expanded hunter aggression.
- Downed recovery decision.
- Separation, backup and deterministic state transitions.

Acceptance:

- Confirmed visual violence overrides `WTF`.
- Hearing alone still does not create pursuit.
- Downed NPCs cannot patrol, report or attack.

## Milestone 9 — Tutorial and UX update

**Status: 🟡 Partially implemented**

Implemented:

- Mouse aim and left-click punch tutorial.
- Right-click drain tutorial.
- Default-run, Shift quiet movement and traversal-only Space tutorial copy.

Planned:

- Weapon cycling tutorial.
- Final HUD/icon accessibility pass.
- High-contrast aim option and obsolete-copy sweep.

## Milestone 10 — Consolidation, tests and performance

**Status: ⬜ Planned**

Planned:

- Fold runtime adapters into first-class scene/system composition.
- Remove superseded prototype patches.
- Playwright/browser smoke tests.
- Performance pass for perception, outskirts and combat visuals.
- Input remapping groundwork.
- Final documentation consistency pass.

Acceptance:

- No method has multiple active owners.
- Core control/combat rules have automated and browser coverage.
- Supported viewport/quality combinations pass.

## Deferred roadmap

- Vehicles and vehicle combat.
- Full inventory UI and large weapon catalogue.
- Save/load campaign progression.
- Multiple districts.
- Faction reputation.
- Advanced civilian combat.
- Full gamepad support.
- Multiplayer/networking.

## Definition of done

A milestone is complete only when:

1. The feature works in the playable build.
2. Existing tutorial and mission flow pass regression.
3. Browser resizing and at least two render-quality presets pass.
4. Input/UI conflicts are covered.
5. Pure logic has automated tests where applicable.
6. Documentation describes the implementation and records limitations.
