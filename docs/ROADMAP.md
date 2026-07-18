# Roadmap

This roadmap is ordered by dependency, not calendar date. A milestone is complete only after implementation, browser regression and documentation agree.

## Status legend

- ✅ Complete
- 🟡 Implemented; browser validation or tuning pending
- ⬜ Planned
- ◇ Deferred or optional

## Milestone 0 — Vertical slice foundation

**Status: ✅ Complete / ongoing polish**

Phaser district with street, rooftop and sewer layers; narrative tutorial; Hunger, feeding, powers, witnesses, police escalation, informant/journalist mission, responsive presentation and documentation baseline.

## Milestone 1 — Architecture stabilization

**Status: 🟡 Implementation complete; browser regression pending**

- Central action-based `InputSystem` and one frame for keyboard, pointer, aim and wheel.
- Central Space/E/Q/R/F ownership, tutorial modes and focus/reset protection.
- Pure geometry/input tests.
- Pending: complete mission regression and final adapter migration in Milestone 10.

## Milestone 2 — Mouse aim and unarmed combat

**Status: 🟡 Implementation complete; browser regression and tuning pending**

- Mouse facing, stored attack direction and aim dead zone.
- Left-click windup/active/recovery attack.
- Directional melee, resilience, stagger and downed state.
- Civilian/target 3, police/thug 4, hunter 5 resilience.
- Rooftop blocker combat tutorial.

## Milestone 3 — Player damage and Hunger combat loop

**Status: 🟡 Implementation complete; browser regression and tuning pending**

- Police/hunter melee telegraphs and stored hit arcs.
- Incoming damage becomes Hunger.
- 260 ms hit stun, 720 ms invulnerability and frenzy at 100.
- Attack/drain interruption on confirmed damage.

## Milestone 4 — Contextual right-click drain

**Status: 🟡 Implementation complete; browser regression and tuning pending**

- Held right-click drain through the central input frame.
- Downed targets from any side; standing targets only from an unaware rear approach.
- Range, aim, awareness, geometry, cancellation and perception rules.
- Rooftop tutorial migrated away from E.

## Milestone 5 — Traversal-only Space and quiet movement

**Status: 🟡 Implementation complete; browser regression and tuning pending**

- WASD/arrows run by default; Shift moves quietly.
- Space is traversal only.
- Deterministic route selection and one matching world prompt.
- Actual-displacement footsteps and heard-only `WTF` responses.
- Ordinary NPC short-range run hearing; enhanced police/hunter hearing.

## Milestone 6 — Damageable streetlights and world props

**Status: 🟡 Implementation complete; browser regression and tuning pending**

- Streetlights use shared attack geometry and one durability point.
- E destruction removed.
- Broken lights update `brokenLights`, remove illumination and create persistent darkness.
- Sight/hearing reactions and plain-data prop/noise events.

## Milestone 7 — Weapon system and mouse-wheel inventory

**Status: 🟡 Implementation complete; browser regression and tuning pending**

- Data-driven `WeaponSystem`: Unarmed, Iron Pipe and eight-round Pistol.
- One-slot wheel cycling with wraparound and canvas-only scroll capture.
- Shared melee/hitscan NPC/prop damage contracts.
- Ammo, empty rejection, tracer, weapon HUD and weapon-specific sound pressure.

## Milestone 8 — AI combat behaviours

**Status: 🟡 Implementation complete; browser regression and tuning pending**

Resolved priority:

```text
inactive/dead → downed → being drained → staggered → attacking
→ chasing → fleeing/reporting → lured → investigating → searching → patrol/idle
```

- Higher states suppress contradictory lower behaviour.
- Civilians/journalist react, flee and report; stagger pauses and downing cancels reporting.
- One police attacker plus deterministic containment roles and finite handoff.
- Slow rooftop-thug retaliation.
- Hunter prediction and 6.2-second last-known memory.
- Police recover after 18 s with 2/4 resilience; hunters after 24 s with 3/5. Other types remain down.

## Milestone 9 — Tutorial and UX update

**Status: 🟡 Implementation complete; browser regression and accessibility validation pending**

Implemented:

- Compact first-use weapon teaching after the informant leaves and full control returns.
- Persistent `WHEEL` guidance and weapon-HUD attention until the first successful cycle.
- Brief `LMB` confirmation after `weapon:changed`.
- Recovery explanation appears only when the first recoverable enemy is downed.
- World countdowns consume authoritative AI time: `POLICE RISES Ns` / `HUNTER RISES Ns`.
- Recovery labels hide during drain, pause, task reveals, death and non-downed states.
- Weapon HUD moved lower-right; power dock remains lower-left; typography increased.
- Optional locally saved high-contrast black-and-white aim reticle in the Pause Menu.
- Hunger, wanted state, weapon, prompts, toasts and HUD buttons expose meaningful ARIA state.
- Keyboard-operable accessibility control and visible focus styles.
- Reduced-motion preference removes non-essential UI/tutorial animation.
- Pause content avoids unnecessary per-frame DOM replacement.
- Both playable routes use current title, render-quality wording and controls.
- Pure tests cover tutorial phase, preference parsing, recovery countdowns and aim geometry.
- Dedicated `UX_ACCESSIBILITY.md` and `MILESTONE_9_REGRESSION.md`.

Acceptance status:

- ✅ Guidance consumes existing events rather than raw wheel input.
- ✅ Tutorial restrictions still block early weapon cycling.
- ✅ Recovery UI cannot change AI timers or combat state.
- ✅ Non-recoverable NPC types never receive countdowns.
- ✅ High-contrast aim does not rely on weapon colour.
- ✅ Obsolete visible Space-sprint/E-lamp copy is removed from both routes.
- 🟡 Validate tutorial timing, HUD separation, labels, resizing and complete mission in-browser.
- 🟡 Validate keyboard and screen-reader behaviour across supported browsers.
- 🟡 Guidance duration, reticle dimensions and label density remain tuning baselines.

## Milestone 10 — Consolidation, tests and performance

**Status: ⬜ Planned**

- Fold runtime adapters into first-class composition.
- Remove superseded patches.
- Add Playwright/browser smoke tests.
- Performance pass for perception, outskirts, formations, recovery labels and combat visuals.
- Input-remapping groundwork and final documentation consistency pass.

Acceptance:

- No method has multiple active owners.
- Core control/combat/AI/UX rules have automated and browser coverage.
- Supported viewport and render-quality combinations pass.

## Deferred roadmap

Vehicles, full inventory/catalogue, save/load campaign progression, multiple districts, faction reputation, advanced civilian combat, full gamepad support and multiplayer.

## Definition of done

1. Feature works in the playable build.
2. Tutorial and mission flow pass regression.
3. Resizing and at least two render-quality presets pass.
4. Input/UI conflicts are covered.
5. Pure logic has automated tests where applicable.
6. Documentation records implementation and limitations.
