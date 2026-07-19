# Roadmap

This roadmap is ordered by dependency, not calendar date. A milestone is complete only after implementation, automated coverage, browser regression and documentation agree.

## Status legend

- ✅ Complete
- 🟡 Implemented; validation or tuning pending
- ⬜ Planned
- ◇ Deferred or optional

## Milestone 0 — Vertical slice foundation

**Status: ✅ Complete / ongoing polish**

Phaser district with street, rooftop and sewer layers; narrative tutorial; Hunger, feeding, powers, witnesses, police escalation, informant/journalist mission, responsive presentation and documentation baseline.

## Milestone 1 — Architecture stabilization

**Status: 🟡 Implementation complete; final release-candidate regression pending**

- Central action-based `InputSystem`.
- One frame for keyboard, pointer, aim and wheel.
- Tutorial modes and focus/reset protection.
- Pure geometry/input tests.

## Milestone 2 — Mouse aim and unarmed combat

**Status: 🟡 Implementation complete; final tuning pending**

- Mouse facing and aim dead zone.
- Left-click timed attacks.
- Directional melee, resilience, stagger and downed state.
- Rooftop blocker combat tutorial.

## Milestone 3 — Player damage and Hunger combat loop

**Status: 🟡 Implementation complete; final tuning pending**

- Police, hunter and thug melee telegraphs.
- Incoming damage becomes Hunger.
- Hit stun, invulnerability and frenzy failure.
- Attack/drain interruption on confirmed damage.

## Milestone 4 — Contextual right-click drain

**Status: 🟡 Implementation complete; final tuning pending**

- Held right-click drain.
- Downed targets from any side.
- Standing targets only from an unaware rear approach.
- Range, aim, awareness, geometry and cancellation rules.

## Milestone 5 — Traversal-only Space and quiet movement

**Status: 🟡 Implementation complete; final tuning pending**

- WASD/arrows run by default.
- Shift moves quietly.
- Space is traversal only.
- Deterministic route selection and actual-displacement footsteps.

## Milestone 6 — Damageable streetlights and world props

**Status: 🟡 Implementation complete; final tuning pending**

- Streetlights use shared attack geometry.
- E destruction removed.
- Broken lights remove illumination and create darkness.
- Sight/hearing reactions and prop events.

## Milestone 7 — Weapon system and wheel inventory

**Status: 🟡 Prototype implementation complete; campaign inventory replacement planned**

- Unarmed, Iron Pipe and Pistol.
- One-step wheel cycling.
- Shared melee/hitscan contracts.
- Ammo, empty rejection, tracer and HUD.

The current all-owned starting inventory is a vertical-slice convenience. Milestone 15 replaces it with hard weapon slots, carried ammunition limits, refuge stash and paid resupply.

## Milestone 8 — AI combat behaviours

**Status: 🟡 Implementation complete; final tuning pending**

```text
inactive/dead → downed → being drained → staggered → attacking
→ chasing → fleeing/reporting → lured → investigating → searching → patrol/idle
```

- Higher states suppress contradictory lower behaviour.
- Witness flight/report interruption.
- One police attacker plus containment roles.
- Thug retaliation.
- Hunter prediction and memory.
- Police/hunter recovery.

## Milestone 9 — Tutorial and UX update

**Status: 🟡 Implementation complete; accessibility validation pending**

- First-use weapon teaching.
- Recovery countdowns.
- Separated HUD regions.
- High-contrast aim.
- ARIA state and reduced-motion handling.

## Milestone 10 — Consolidation, tests and performance

**Status: 🟡 Core implementation complete; CI and complete mission regression pending**

Implemented:

- one `GameplayRuntime` update owner;
- direct `GameScene` / `UIScene` composition;
- first-class tutorial, task reveal, objective marker, outskirts, perception and police-violence systems;
- runtime owner diagnostics;
- spatial NPC queries and camera-margin culling;
- change-aware registry and DOM publication;
- Playwright browser smoke tests;
- input-remapping data/storage groundwork.

Acceptance still required:

- unit and Playwright CI green on the same commit;
- complete mission run on both playable routes;
- Low and Ultra render quality;
- wide, narrow and resized viewports;
- keyboard/accessibility verification;
- sustained level-3 police encounter;
- physical deletion of superseded unloaded patch files after validation.

## Milestone 10.1 — Vertical Slice Release Candidate

**Status: ⬜ Immediate next step**

- Resolve consolidation regressions.
- Confirm sire dialogue before `REPORT ACCEPTED`.
- Run the complete mission through both journalist outcomes.
- Validate police escalation 1 → 2 → 3, helicopter, recovery and witnesses.
- Confirm unit and browser CI.
- Remove verified-dead prototype files.
- Tag the first stable vertical-slice release candidate.

Acceptance:

- Complete mission passes without manual state editing.
- No runtime owner conflict.
- No input leakage from dialogue, pause or task reveals.
- No critical browser errors across supported configurations.

## Milestone 11 — Campaign foundation

**Status: ⬜ Planned**

- Data-driven `MissionDefinition` and `MissionRunner`.
- Reusable objective types: reach, talk, collect, steal, chase, neutralize, destroy, escape and return.
- Cash wallet and transaction ledger.
- Original faction/contact reputation model.
- Persistent campaign state and save/load foundation.
- Persistent player inventory and refuge records.
- Migrate the journalist mission without changing its narrative result.

Acceptance:

- The journalist mission runs from data rather than mission-specific step branches.
- A second test mission can be authored without changing the runner.
- Cash, reputation and inventory serialize and restore deterministically.

## Milestone 12 — Vehicle core

**Status: ⬜ Planned**

- Enter/exit with contextual Space.
- Arcade acceleration, braking, reverse and steering.
- Vehicle health, collisions, pedestrians and occupant state.
- Speed-sensitive camera.
- Parked, owned, stolen and faction vehicle metadata.
- Vehicle trunk with limited mobile storage.
- Compact, sedan/van and police-car baseline archetypes.

Acceptance:

- Player can move seamlessly between foot, roof/sewer traversal and vehicles.
- A vehicle never grants access to the complete refuge stash.
- Vehicle theft produces witness/police consequences.

## Milestone 13 — Traffic and motorized police

**Status: ⬜ Planned**

- Lane-based traffic and parked vehicles.
- Civilian drivers and reactions.
- Police-car pursuit, interception and roadblocks.
- Officers exit blocked or disabled vehicles.
- Abandoned stolen-car search memory.
- Vehicle alarms, crashes and motor noise integrated with perception.

Acceptance:

- Level 2 and 3 wanted responses use vehicles without invalidating foot pursuit.
- Player can abandon a car and escape through rooftops or sewers.
- Traffic remains readable and arcade rather than simulation-heavy.

## Milestone 14 — Original factions and territory

**Status: ⬜ Planned**

Working setting structure:

- **Blackglass Directorate** — secretive institutional establishment.
- **Red Assembly** — violent territorial coalition.
- **Unaligned Houses** — separate independent operators, not one monolithic faction.

Implementation:

- faction/contact reputation;
- territory and safehouse ownership;
- faction-specific vehicles, suppliers and mission pools;
- hostility, debts, betrayal flags and alternate buyers;
- original symbols, ranks, history and visual identities;
- no shipped names or copied lore from another vampire property.

See `ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md`.

Acceptance:

- Factions differ mechanically, not only visually.
- Unaligned reputation is stored per House/contact.
- Mission choices can improve one relationship and damage another.

## Milestone 15 — Safehouses, stash and ammunition economy

**Status: ⬜ Planned**

Locked direction:

- no floating street ammunition pickups;
- one melee, one sidearm and one long/special weapon slot;
- carried ammunition caps;
- separate carried loadout and refuge stash;
- finite supplier stock;
- ammunition purchased with cash;
- authored mission caches only;
- faction price and availability differences;
- trunks store limited weapons/ammunition but not the complete stash.

Implementation:

- safehouse armoury UI;
- buy-by-bundle transactions;
- restock rules;
- supplier reputation requirements;
- detention, impound and vehicle-destruction loss rules;
- refuge/garage upgrades.

Acceptance:

- The player cannot replenish ammunition infinitely or for free.
- Cash has meaningful competing uses.
- Stash and carried inventory persist through save/load.

## Milestone 16 — Retainers

**Status: ⬜ Planned**

Original ghoul-equivalent terminology:

- system term: **Retainer**;
- Directorate term: **Proxy**;
- Assembly term: **Marked**;
- Unaligned term: **Hand**.

First service roles:

- Quartermaster;
- Driver;
- Cleaner;
- Mechanic;
- Fixer;
- Scout;
- Guard;
- Medic.

Tracked state:

```text
Loyalty
Dependence
Exposure
Condition
Competence
Cash upkeep
Dose due
Assigned refuge/vehicle/task
```

Acceptance:

- Retainers are named characters with agency and loss states.
- They require money and blood maintenance.
- Captured or exposed Retainers can create missions and refuge risk.
- Services integrate with ammunition, vehicles, evidence and police pressure.

## Milestone 17 — Expanded arsenal and vehicle combat

**Status: ⬜ Planned**

- Shotgun.
- Submachine gun.
- Specialist hunter weapon.
- Limited thrown/distraction items.
- Drive-by compatible sidearms/SMGs.
- Vehicle damage from firearms.
- Weapon pickups as authored weapons or mission loot, not infinite ammo drops.
- Enemy and faction loadouts.

Acceptance:

- Every weapon has a distinct tactical role.
- Carry slots and ammunition scarcity remain meaningful.
- Vehicle combat respects police, witness and faction consequences.

## Milestone 18 — District campaign

**Status: ⬜ Planned**

- Journalist mission migrated as the opening Directorate contract.
- Vehicle pursuit mission.
- Red Assembly mission.
- Unaligned contract with multiple buyers.
- Territory consequences.
- Retainer recruitment/rescue mission.
- Safehouse and supplier progression.
- Campaign save/load.

Acceptance:

- The district supports multiple mission solutions and persistent consequences.
- Vehicles, factions, economy and vampiric systems interact in every major mission.
- The city structure feels GTA2-like while the consequences remain specific to Vampire District.

## Later expansion candidates

- Second district.
- Interiors and garages.
- Full player-facing key remapping screen.
- Larger vehicle and weapon catalogues.
- Additional bloodlines and original supernatural rivals.
- Art/audio production pass.
- Full gamepad support.
- Multiplayer/networking remains deferred.

## Definition of done

1. Feature works in the playable build.
2. Tutorial and mission flow pass regression.
3. Resizing and at least two render-quality presets pass.
4. Input/UI conflicts are covered.
5. Pure logic has automated tests where applicable.
6. Browser smoke or end-to-end coverage exists where applicable.
7. Documentation records implementation, tuning baselines and limitations.
8. New commercial-facing names receive trademark clearance before public release.
