# Project snapshot

_Last updated: 2026-07-19_

## Product vision

**Vampire District** is a top-down urban action, stealth and crime game inspired by the readable city layout, systemic police pressure, vehicles, faction work and immediate navigation of early Grand Theft Auto games, rebuilt around an original vampire setting.

The design rule is:

> GTA2-like city structure; Vampire District consequences.

The game should not become a conventional stealth game that merely uses a top-down camera. Streets, traffic, vehicles, weapons, faction territory, short missions and escalating urban chaos remain core long-term pillars. Rooftops, sewers, Hunger, feeding, the Veil, retainers and supernatural politics differentiate the project.

## Original-IP decision

The project will not use names, lore, ranks, symbols, factions or mechanical terminology from an existing licensed vampire setting.

Working faction structure:

- **Blackglass Directorate** — secretive institutional establishment.
- **Red Assembly** — violent territorial coalition.
- **Unaligned Houses** — separate independent operators, not one unified sect.

Original enhanced-mortal system:

- neutral system term: **Retainer**;
- Directorate term: **Proxy**;
- Assembly term: **Marked**;
- Unaligned term: **Hand**.

These are working setting names pending commercial trademark clearance. The authoritative design is documented in `ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md`.

## Current playable vertical slice

Implemented:

- Phaser 3 browser build with responsive presentation and selectable internal render quality.
- Street, low-rooftop, high-rooftop and sewer layers.
- Contextual jumps, drops, fire escapes, sewer access and refuge shaft.
- Speaker-anchored narrative tutorial advanced with click or Escape.
- Police-roof informant, journalist objective and mandatory return-to-refuge finale.
- Sire approval before `REPORT ACCEPTED` in the intended mission order.
- Objective guidance, Hunger, powers, exposure, evidence and witnesses.
- Police search, pursuit, melee attacks, escalating reinforcements, arrest and helicopter support.
- Separate sight and hearing channels, including heard-only `WTF` reactions.
- Mouse-directed combat with resilience, stagger and downed states.
- Incoming damage converted into Hunger with hit stun and invulnerability.
- Right-click drain for downed targets and unaware rear approaches.
- Default running, Shift quiet movement and traversal-only Space.
- Deterministic route selection and matching world prompt.
- Damageable streetlights that remove light and create persistent darkness.
- Prototype three-weapon inventory: Unarmed, Iron Pipe and eight-round Pistol.
- Mouse-wheel cycling, equipped-weapon/ammo HUD and shared melee/hitscan damage.
- Resolved per-NPC AI priority, police combat roles, witness interruption and hunter memory.
- Police/hunter recovery with type-specific delays and restored resilience.
- First-use wheel guidance after the informant sequence.
- Recovery countdown labels for downed police and hunters.
- Optional high-contrast aim, semantic HUD state and reduced-motion UI treatment.
- Consolidated `GameplayRuntime`, first-class tutorial/task/perception systems, runtime diagnostics and browser smoke-test infrastructure.

## Current mission flow

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

## Prototype weapon snapshot

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

The current all-owned inventory is a vertical-slice convenience. The campaign design replaces it with hard slots, paid ammunition, carried caps and refuge storage.

## Campaign inventory direction

Locked future loadout:

```text
Unarmed always available
1 melee slot
1 sidearm slot
1 long-gun or special slot
```

Locked ammunition principles:

- no floating street ammunition pickups;
- main resupply at refuges and safehouses;
- ammunition purchased with cash;
- carried ammunition limits;
- finite supplier stock;
- separate carried inventory and refuge stash;
- authored mission caches only;
- vehicle trunks provide limited mobile storage;
- a Quartermaster Retainer can improve supply, not create infinite ammunition.

Initial carry-capacity baselines:

| Ammunition | Maximum carried |
|---|---:|
| Pistol | 48 |
| Submachine gun | 150 |
| Shotgun | 24 |
| Special bolts/stakes | 12 |
| Heavy ammunition | 4–6 |

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
- search, reinforcement, arrest and helicopter behaviour.

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

## Faction gameplay direction

### Blackglass Directorate

- covert work;
- police, hospital, property and media influence;
- reliable but expensive supplies;
- discreet vehicles;
- evidence control;
- low tolerance for public chaos.

### Red Assembly

- territorial assaults;
- convoy attacks;
- intimidation and sabotage;
- cheaper irregular weapons;
- stolen or modified vehicles;
- mobile refuges;
- high police pressure.

### Unaligned Houses

- separate contact reputation;
- contract work;
- information trading;
- vehicle fencing;
- specialist equipment;
- neutral markets;
- multiple buyers and betrayals.

Reputation is tracked by faction and contact, not through one morality score.

## Retainer direction

Retainers are named mortals maintained through controlled vampire-blood doses. They gain improved recovery and limited supernatural-adjacent benefits, but retain personal agency.

Tracked state:

```text
Role
Loyalty
Dependence
Exposure
Condition
Competence
Cash upkeep
Dose due
Assigned refuge
Assigned vehicle
Current task
```

Initial strategic roles:

- Quartermaster;
- Driver;
- Cleaner;
- Mechanic;
- Fixer;
- Scout;
- Guard;
- Medic.

Retainers can be injured, captured, exposed, unpaid, disloyal or killed. They are not free permanent buffs.

## Vehicle direction

Vehicles are a core GTA2-like pillar, not a distant optional extra.

Planned minimum loop:

```text
see vehicle
→ enter or steal with contextual Space
→ drive
→ crash or run targets down
→ receive vehicle damage
→ abandon vehicle
→ continue on foot, rooftops or sewers
```

Vehicles connect to:

- traffic;
- police pursuit and roadblocks;
- faction ownership;
- missions;
- trunks and mobile storage;
- ammunition and weapon transport;
- Retainer drivers/mechanics;
- witness, noise and evidence systems.

## Architecture snapshot

Current high-level ownership:

```text
GameScene.update
→ GameplayRuntime.update
```

Current major first-class systems include:

- `InputSystem`
- `WeaponSystem`
- `CombatSystem`
- `PlayerDamageSystem`
- `DrainSystem`
- `MovementNoiseSystem`
- `PropDamageSystem`
- `SensoryAwarenessSystem`
- `AiStateSystem`
- `PoliceViolenceSystem`
- `TaskRevealSystem`
- `OutskirtsSystem`
- `ObjectiveMarkerSystem`
- `UxGuidanceSystem`
- `TutorialDirector`
- specialist NPC, police, witness, mission, feeding, exposure, power, evidence, hunter, interaction and transition systems.

Milestone 10 added:

- runtime owner diagnostics;
- spatial NPC indexing;
- camera-margin culling;
- change-aware registry publication;
- source-ownership regression tests;
- Playwright browser smoke tests;
- input-remapping storage/API groundwork.

## Validation state

Milestone 10 core code is implemented. Remaining release-candidate requirements:

- unit and Playwright CI green on the same commit;
- complete mission run on both playable routes;
- journalist death and drain variants;
- Low and Ultra render quality;
- wide, narrow and resized viewports;
- keyboard/accessibility verification;
- sustained level-3 police encounter;
- final deletion of superseded unloaded patch files.

## Locked design decisions

- Original setting and terminology; no licensed vampire factions or copied lore.
- Top-down readability over camera-heavy presentation.
- GTA2-like vehicles, traffic, factions, short missions and urban chaos remain core goals.
- Vision and hearing are separate channels.
- Hearing alone does not pursue or report.
- Space is traversal and vehicle entry/exit; Shift is quiet movement on foot.
- Hunger is combat attrition and feeding is recovery.
- NPC resilience leads to downed state.
- Police/hunters recover; civilians, journalist and thug remain down.
- World destruction uses the combat attack language.
- E does not traverse, drain or break streetlights.
- Mouse wheel owns weapon selection while gameplay is active.
- Journalist handling requires returning to the refuge.
- Finale order is sire dialogue, then report.
- Accessibility presentation must not change hit geometry or gameplay state.
- Ammunition is limited, paid and mainly managed through refuges/safehouses.
- Retainers have agency, upkeep and failure states.
- Unaligned Houses are separate relationships, not one faction reputation.

## Open design decisions

- Final commercial faction names after trademark clearance.
- Exact histories, leaders and bloodline taxonomy.
- Final movement/hearing and combat tuning.
- Final vehicle physics values and traffic density.
- Final ammunition prices, caps and restock cadence.
- Whether detention removes all carried ammunition or a difficulty-dependent percentage.
- Blood reserve versus direct Hunger cost for Retainer doses.
- Maximum number of active Retainers.
- Whether perception visualization remains permanently visible.
- Future reduced-camera-shake option.

## Main risks

1. Milestone 10 still needs full browser and mission validation.
2. Vehicle/traffic work can increase world and AI complexity sharply.
3. Hunger damage can create a positive-feedback difficulty spiral.
4. Screen clutter from perception, objectives, combat and recovery labels.
5. Hitscan obstruction still uses navigation-based line checks.
6. Economy can become either irrelevant or overly punitive without careful tuning.
7. Retainers can become menu-only bonuses unless missions expose their risk and agency.
8. Faction names require trademark clearance before commercial announcement.
9. UI/accessibility behaviour may vary by browser and assistive technology.

## Immediate project priority

Complete Milestone 10.1 as a release-candidate stabilization pass. After the current vertical slice is validated, begin Milestone 11: data-driven missions, cash, reputation, persistent inventory and save/load foundations. Vehicles follow immediately as the next major playable pillar.
