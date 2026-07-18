# Project snapshot

_Last updated: 2026-07-18_

## Product vision

**Vampire District** is a top-down urban stealth-action game inspired by the readable city layout, systemic police pressure and immediate navigation of early Grand Theft Auto games, but built around a vampire fantasy.

The player is a young vampire carrying out orders for their sire. The current vertical slice teaches traversal, feeding, Hunger, witnesses, police pressure, combat, weapon choice, damage-to-Hunger, contextual draining, quiet movement, environmental destruction, type-specific AI reactions and the veil through one contained mission.

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
- Mouse-directed combat with NPC resilience, stagger and downed state.
- Enemy damage converted into Hunger with hit stun and invulnerability.
- Right-click draining for downed targets and unaware rear approaches.
- Default running, Shift quiet movement and traversal-only Space.
- Deterministic route selection and world-space traversal prompt.
- Damageable streetlights using the same attack contract as NPC combat.
- Broken streetlights remove light, create persistent darkness and trigger sight/hearing reactions.
- Three-weapon inventory: Unarmed, Iron Pipe and Pistol.
- Mouse-wheel weapon cycling, persistent weapon/ammo HUD and change toast.
- Shared melee and hitscan damage across NPCs and props.
- Explicit per-NPC AI priority state, role and intent.
- Police attacker/containment roles instead of every officer stacking on the player.
- Civilian and journalist reaction/flee/report flow with deterministic interruption.
- Slow rooftop-thug retaliation after the first confirmed hit.
- Hunter movement prediction and last-known-position memory through shadow.
- Police/hunter downed recovery with type-specific timings and restored resilience.
- Refuge-gated completion: sire dialogue first, report second.

## Current mission flow

1. The intro establishes the player as an inexperienced vampire.
2. The sire orders the player to silence a journalist.
3. Rooftop traversal is introduced.
4. The rooftop thug confronts the player, becomes hostile after the first hit and can retaliate with a slow readable swing.
5. The player knocks him down and right-click drains him while weapon cycling remains tutorial-locked.
6. Hunger and witness rules are explained.
7. The police informant gives the journalist's location.
8. Full controls unlock, including mouse-wheel weapon selection.
9. The player reaches the club and handles the journalist.
10. The mission changes to returning to the rooftop refuge.
11. At the refuge, the sire acknowledges the result in a dialogue bubble.
12. Only after dismissing the bubble does `REPORT ACCEPTED` open.

## Current controls

- WASD / arrows: run by default.
- Hold Shift: slower quiet movement with a much smaller hearing radius.
- Mouse: face and aim.
- Left mouse: use equipped weapon against NPCs or world props.
- Mouse wheel: previous/next owned weapon.
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

## Movement snapshot

- Default run multiplier: `1.55`.
- Quiet movement multiplier: `0.72`.
- Run footstep base hearing radius: `120` for enhanced listeners.
- Ordinary NPC run-hearing range: `42`.
- Quiet footstep base hearing radius: `42`; ordinary NPCs ignore quiet footsteps.
- Space has no held-speed behaviour.
- Traversal selection order: committed close/forward route, distance, aim, route priority, stable ID.

## Weapon snapshot

| Weapon | Type | Damage | Range | Ammo |
|---|---|---:|---:|---:|
| Unarmed | Melee | 1 | 32 | Unlimited |
| Iron Pipe | Melee | 2 | 42 | Unlimited |
| Pistol | Hitscan | 3 | 260 | 8 |

- The wheel wraps through the three owned weapons one step at a time.
- Pistol shots use one ordered ray across NPC and prop candidates.
- The nearest aligned, unobstructed candidate wins.
- Ammo is consumed on every valid pistol shot, including misses.
- Empty pistol attacks are rejected; reload/replenishment is not implemented yet.
- Gunshots have a `280`-unit sound radius and create stronger police pressure than melee.

## Combat and AI snapshot

Player pressure:

- Police baton: `Hunger +12`.
- Hunter heavy strike: `Hunger +20`.
- Rooftop thug swing: `Hunger +8` with `520 ms` windup.
- Player hit stun: `260 ms`.
- Player invulnerability: `720 ms`.
- Critical Hunger: `85`.
- Frenzy failure: `100`.

Resolved AI priority:

```text
inactive/dead
→ downed
→ being drained
→ staggered
→ attacking
→ chasing
→ fleeing/reporting
→ lured
→ investigating sound
→ searching
→ patrolling/idle
```

Police roles:

- one stable officer receives the `attacker` role;
- other officers with visual contact move to deterministic containment slots;
- containment radii are `43`, `49` and `55` at wanted levels 1–3;
- attack leadership can hand off after the current turn/recovery;
- existing separation, reinforcements, search, arrest and helicopter systems remain active.

Witnesses:

- confirmed sight creates reaction, then flight toward a report point;
- stagger pauses the flight and the witness resumes afterward;
- downing, draining, killing, hiding or intercepting cancels the report;
- hearing alone remains temporary orientation and `WTF`.

Hunter:

- predicts `54` units ahead of current player movement;
- remembers the last known point for `6200 ms` after losing sight;
- can continue a remembered chase through shadow;
- falls back to blood tracking, route blocking and patrol after memory expires.

Recovery:

| Type | Recovery | Restored resilience |
|---|---:|---:|
| Civilian | Never | — |
| Journalist | Never | — |
| Rooftop thug | Never | — |
| Police | 18 s | 2 / 4 |
| Hunter | 24 s | 3 / 5 |

Starting a drain before the timer expires prevents recovery. A completed drain or kill resolves the NPC permanently.

## Drain snapshot

- Start range: `34` units.
- Break range: `42` units.
- Downed target: any approach angle.
- Standing target: unaware rear arc only.
- Hold right mouse to channel.
- Release, movement, damage, invalid layer/range or blocked geometry cancels.

## World-prop snapshot

- Streetlights: `1` durability.
- Melee hit query: stored origin, direction, weapon range/arc plus prop radius.
- Pistol hit query: shared nearest hitscan ray.
- Input: left mouse; E destruction is removed.
- Broken state persists in `brokenLights`.
- Result: light removed, shadow created, glass feedback and perception reaction.
- Hearing-only break response remains `WTF` without automatic pursuit/reporting.

## Architecture snapshot

The prototype currently uses:

- `GameScene` for world coordination and rendering.
- `UIScene` for DOM-backed HUD and modals.
- `InputSystem` for the authoritative action frame.
- `WeaponSystem` for inventory, equipped state, wheel cycling, ammo and attack noise.
- `CombatSystem` for aim, weapon attack timing, melee/hitscan resolution, resilience and knockdown.
- `PlayerDamageSystem` for enemy attacks, hit stun, invulnerability and Hunger damage.
- `AiStateSystem` for resolved NPC state, conflict cancellation, recovery and transition events.
- `DrainSystem` for right-click eligibility and channel validation.
- `MovementNoiseSystem` for actual-displacement footsteps and heard-only reactions.
- `PropDamageSystem` for streetlight durability and break effects.
- Existing specialist systems for NPC movement, police, witnesses, missions, feeding, exposure, powers, evidence, hunters, interactions and transitions.
- Pure data modules for AI, combat, weapons, player damage, drain, movement, traversal and props.

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
- prop hit/miss geometry, durability and repeated-damage protection;
- weapon inventory order and wheel wraparound;
- pistol ammo consumption and empty rejection;
- hitscan nearest-target, range, width and obstruction checks;
- AI state priority and sound-versus-sight precedence;
- police leader selection and containment geometry;
- witness interruption rules;
- hunter prediction and bounds;
- type-specific recovery timing/resilience;
- rooftop-thug attack timing and damage.

Manual browser regression remains required across the complete mission, representative viewport sizes, Low/Ultra quality, police formations, hunter memory and recovery before Milestones 1–8 become fully complete.

## Locked design decisions

- Top-down readability over camera-heavy presentation.
- Vision and hearing remain separate channels.
- Hearing alone creates attention, not automatic pursuit/reporting.
- Confirmed sight overrides heard-only investigation.
- Space is exclusively traversal.
- Running is normal; Shift is quiet movement.
- Hunger is the player's combat attrition resource.
- Feeding is tactical recovery.
- NPC durability is resilience leading to downed state.
- Police and hunters can recover; civilians, journalist and rooftop thug remain down.
- World destruction uses the same aimed attack language as combat.
- E does not break streetlights.
- Mouse wheel owns weapon selection while gameplay is active.
- Gunshots are hitscan in the first weapon implementation.
- Journalist handling requires an actual return to the refuge.
- Finale order is sire dialogue, then final report.

## Open design decisions

- Final speed and footstep-hearing tuning after browser playtesting.
- Final police/hunter/thug attack values.
- Final police formation radii and attack-turn cadence.
- Final hunter memory and pursuit-lead values.
- Final police/hunter recovery timings and restored resilience.
- Final drain range, rear angle and channel feel.
- Final streetlight hit radius, exposure cost and feedback.
- Final weapon damage, cadence, ammo and noise tuning.
- Pistol reload/replenishment design.
- Whether weapons should be found/purchased rather than owned from the start.
- Whether perception visualization is always visible.
- Final aim/reticle accessibility options.

## Main risks

1. Prototype adapter depth and import-order sensitivity.
2. Missing automated browser regression.
3. Specialist systems still own movement through adapters around the resolved AI state.
4. Hunger damage creating a positive-feedback difficulty spiral.
5. Screen clutter from objectives, perception, combat and weapon HUD feedback.
6. Hitscan obstruction relying on navigation-based line checks.
7. Police containment and recovery balance differing across zoom levels and crowd density.

## Immediate project priority

Validate Milestone 8 in-browser: priority conflicts, police attacker/containment roles, witness interruption, rooftop-thug retaliation, hunter shadow memory, police/hunter recovery and complete mission compatibility. Then complete Milestone 9: first-use weapon/recovery teaching, final HUD accessibility and obsolete-copy cleanup.
