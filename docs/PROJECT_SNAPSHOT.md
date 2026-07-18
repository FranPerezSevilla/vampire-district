# Project snapshot

_Last updated: 2026-07-18_

## Product vision

**Vampire District** is a top-down urban stealth-action game inspired by the readable city layout, systemic police pressure and immediate navigation of early Grand Theft Auto games, rebuilt around a vampire fantasy.

The current vertical slice follows a young vampire carrying out an order from their sire. It teaches traversal, Hunger, feeding, witnesses, police pressure, combat, weapon choice, contextual draining, environmental destruction, AI reactions and the veil through one contained mission.

## Current playable vertical slice

Implemented:

- Phaser 3 browser build with responsive presentation and selectable internal render quality.
- Street, low-rooftop, high-rooftop and sewer layers.
- Contextual jumps, drops, fire escapes, sewer access and refuge shaft.
- Speaker-anchored narrative tutorial advanced with click or Escape.
- Police-roof informant, journalist objective and mandatory return-to-refuge finale.
- Objective guidance, Hunger, powers, exposure, evidence and witnesses.
- Police search, pursuit, melee attacks, escalating reinforcements, arrest and helicopter support.
- Separate sight and hearing channels, including heard-only `WTF` reactions.
- Mouse-directed combat with resilience, stagger and downed states.
- Incoming damage converted into Hunger with hit stun and invulnerability.
- Right-click drain for downed targets and unaware rear approaches.
- Default running, Shift quiet movement and traversal-only Space.
- Deterministic route selection and matching world prompt.
- Damageable streetlights that remove light and create persistent darkness.
- Three-weapon inventory: Unarmed, Iron Pipe and eight-round Pistol.
- Mouse-wheel cycling, equipped-weapon/ammo HUD and shared melee/hitscan damage.
- Resolved per-NPC AI priority, police combat roles, witness interruption and hunter memory.
- Police/hunter recovery with type-specific delays and restored resilience.
- First-use wheel guidance after the informant sequence.
- Recovery countdown labels for downed police and hunters.
- Optional high-contrast aim, semantic HUD state and reduced-motion UI treatment.

## Mission flow

1. Intro establishes the inexperienced vampire.
2. The sire orders the journalist silenced.
3. Rooftop traversal is introduced.
4. The rooftop thug confronts the player and retaliates after the first hit.
5. The player knocks him down and drains him while weapon cycling remains locked.
6. Hunger and witness rules are explained.
7. The police informant gives the journalist's location and leaves.
8. Full controls unlock; compact wheel guidance teaches weapon selection.
9. The player reaches the club and handles the journalist.
10. The objective changes to returning to the rooftop refuge.
11. The sire acknowledges the result in a dialogue bubble.
12. Only after dismissing the bubble does `REPORT ACCEPTED` open.

## Current controls

- WASD / arrows: run by default.
- Hold Shift: slower quiet movement.
- Mouse: face and aim.
- Left mouse: use equipped weapon.
- Mouse wheel: previous/next owned weapon.
- Hold right mouse: drain a valid aimed target.
- Space: contextual traversal only.
- E: non-traversal interactions only.
- Q: Dash.
- R: Whisper.
- F: Blood Sense.
- M: mission panel.
- H: pause/help and accessibility options.
- Left click / Escape: advance dialogue.

## Movement and perception snapshot

- Run multiplier: `1.55`.
- Quiet multiplier: `0.72`.
- Enhanced-listener run radius: `120`.
- Ordinary NPC run-hearing range: `42`.
- Ordinary NPCs ignore quiet footsteps.
- Hearing alone creates attention/orientation, never automatic pursuit or reporting.
- Confirmed sight overrides heard-only investigation.

## Weapon snapshot

| Weapon | Type | Damage | Range | Ammo |
|---|---|---:|---:|---:|
| Unarmed | Melee | 1 | 32 | Unlimited |
| Iron Pipe | Melee | 2 | 42 | Unlimited |
| Pistol | Hitscan | 3 | 260 | 8 |

- Wheel wraps through owned weapons one step at a time.
- Pistol resolves the nearest aligned unobstructed NPC/prop candidate.
- Every valid shot consumes ammunition, including misses.
- Empty attacks produce feedback but no tracer, damage or noise.
- Gunshot sound radius: `280`.

## Combat and AI snapshot

Player pressure:

- Police baton: `Hunger +12`.
- Hunter heavy strike: `Hunger +20`.
- Rooftop thug swing: `Hunger +8`, `520 ms` windup.
- Player hit stun: `260 ms`.
- Player invulnerability: `720 ms`.
- Critical Hunger: `85`; frenzy failure: `100`.

Resolved AI priority:

```text
inactive/dead → downed → being drained → staggered → attacking
→ chasing → fleeing/reporting → lured → investigating → searching → patrol/idle
```

Police:

- one stable attacker;
- other visible officers use deterministic containment slots;
- containment radii `43`, `49`, `55` at wanted levels 1–3;
- finite attack leadership and deterministic handoff;
- existing search, reinforcement, arrest and helicopter behaviour retained.

Witnesses:

- confirmed sight creates reaction then flight to a report point;
- stagger pauses flight;
- downing, draining, killing, hiding or intercepting cancels reporting;
- hearing alone remains `WTF`.

Hunter:

- predicts `54` units ahead of player movement;
- remembers the last known point for `6200 ms`;
- can continue a remembered chase through shadow.

Recovery:

| Type | Delay | Restored resilience |
|---|---:|---:|
| Civilian | Never | — |
| Journalist | Never | — |
| Rooftop thug | Never | — |
| Police | 18 s | 2 / 4 |
| Hunter | 24 s | 3 / 5 |

Starting a drain suspends recovery. Completed drain or kill resolves the NPC permanently.

## Milestone 9 UX snapshot

- After full tutorial control returns, a non-blocking `WHEEL` strip persists until the first successful weapon change.
- The weapon HUD pulses during this first-use step, then confirms the equipped weapon and `LMB` attack input.
- The first recoverable knockdown explains that police and hunters can rise.
- Downed recoverable enemies show `POLICE RISES Ns` or `HUNTER RISES Ns` using `npc.ai.recoverAt`.
- The final four seconds use urgent presentation.
- Labels hide while draining, paused, in a task reveal, dead or no longer downed.
- Weapon HUD is lower-right; power dock remains lower-left.
- Pause Menu includes a locally saved high-contrast black-and-white aim toggle.
- Hunger, wanted state, weapon, prompt, toast and buttons expose meaningful assistive state.
- `prefers-reduced-motion` removes non-essential HUD/tutorial animation.
- Both playable routes use `Vampire District`, `Render quality` and current controls.

## Architecture snapshot

Current major systems:

- `InputSystem`
- `WeaponSystem`
- `CombatSystem`
- `PlayerDamageSystem`
- `AiStateSystem`
- `DrainSystem`
- `MovementNoiseSystem`
- `PropDamageSystem`
- `UxGuidanceSystem`
- specialist NPC, police, witness, mission, feeding, exposure, power, evidence, hunter, interaction and transition systems.

Pure data modules cover input actions, AI, combat, weapons, player damage, drain, movement, traversal, props and UX guidance.

Temporary prototype adapters still patch scene/system methods. Milestone 10 will fold them into explicit composition.

## Validation state

Automated pure coverage includes input locks, pointer mapping, melee/resilience, enemy damage, drain eligibility, movement/hearing, traversal scoring, prop damage, weapon cycling/ammo/hitscan, AI priority, police formation, witness interruption, hunter prediction, recovery, first-use guidance, preference parsing and recovery countdown presentation.

Manual browser regression remains required across the complete mission, representative viewport sizes, Low/Ultra quality, police formations, recovery labels, first-use timing and accessibility behaviour before Milestones 1–9 become fully complete.

## Locked design decisions

- Top-down readability over camera-heavy presentation.
- Vision and hearing are separate channels.
- Hearing alone does not pursue or report.
- Space is traversal only; Shift is quiet movement.
- Hunger is combat attrition and feeding is recovery.
- NPC resilience leads to downed state.
- Police/hunters recover; civilians, journalist and thug remain down.
- World destruction uses the combat attack language.
- E does not traverse, drain or break streetlights.
- Mouse wheel owns weapon selection while gameplay is active.
- Journalist handling requires returning to the refuge.
- Finale order is sire dialogue, then report.
- Accessibility presentation must not change hit geometry or gameplay state.

## Open design decisions

- Final movement/hearing tuning.
- Final police, hunter and thug combat values.
- Final formation, memory and recovery values.
- Final drain feel.
- Final weapon balance and pistol replenishment.
- Whether weapons are found rather than initially owned.
- Whether perception visualization remains permanently visible.
- Future reduced-camera-shake option.

## Main risks

1. Prototype adapter depth and import-order sensitivity.
2. Missing automated browser regression.
3. Specialist movement systems still surround the resolved AI state through adapters.
4. Hunger damage can create a positive-feedback difficulty spiral.
5. Screen clutter from perception, objectives, combat and recovery labels.
6. Hitscan obstruction uses navigation-based line checks.
7. UI/accessibility behaviour may vary by browser and assistive technology.

## Immediate project priority

Validate Milestone 9 in-browser: tutorial timing, wheel/trackpad behaviour, HUD separation, recovery countdown alignment, high-contrast aim, keyboard focus, screen-reader labels, resizing, Low/Ultra quality and complete mission compatibility. Then begin Milestone 10 consolidation, browser smoke tests and performance work.
