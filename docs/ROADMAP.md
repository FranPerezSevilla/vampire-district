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

**Status: 🟡 Implementation and automated regression complete; final manual acceptance pending**

- Central action-based `InputSystem`.
- One frame for keyboard, pointer, aim and wheel.
- Tutorial modes and focus/reset protection.
- Pure geometry/input tests.
- Browser lock and dialogue-input coverage.

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

The current all-owned starting inventory is a vertical-slice convenience. Milestone 15 replaces it with hard weapon slots, carried-ammunition limits, refuge stash and paid resupply.

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

**Status: 🟡 Automated accessibility coverage green; manual assistive-technology validation pending**

- First-use weapon teaching.
- Recovery countdowns.
- Separated HUD regions.
- High-contrast aim.
- ARIA state and reduced-motion handling.
- Keyboard activation, narrow layout and persistence coverage.

## Milestone 10 — Consolidation, tests and performance

**Status: 🟡 Runtime consolidation and physical cleanup complete; final manual acceptance pending**

Delivered:

- one `GameplayRuntime` update owner;
- direct `GameScene` / `UIScene` composition;
- first-class tutorial, task reveal, objective marker, outskirts, perception and police-violence systems;
- runtime owner diagnostics;
- spatial NPC queries and camera-margin culling;
- change-aware registry and DOM publication;
- deterministic pinned Phaser bootstrap;
- Playwright smoke, golden-path, police-stress and accessibility coverage;
- input-remapping data/storage groundwork;
- physical deletion of superseded runtime, tutorial, AI, UI and perception patch files;
- source-ownership tests that require the retired files to remain absent.

Automated cleanup acceptance passed on source `7e311aa1119603c5b7cdca5040ee8a90699dd0a5`:

```text
unit-tests    ✅
browser-smoke ✅
```

Covered automatically:

- killed and drained journalist golden paths;
- sire dialogue before `REPORT ACCEPTED`;
- armed free roam and unarmed impacts after the report;
- `/` and `/phaser/` boot routes;
- Low and Ultra render quality;
- wide, narrow and resized viewports;
- UI keyboard and accessibility checks;
- police escalation, helicopter, recovery and perception split;
- sustained level-three structural/performance smoke;
- no runtime owner conflict or critical browser error.

Still required for final manual acceptance:

- normal-timing complete mission on both routes;
- physical mouse-wheel and trackpad validation;
- longer level-three memory inspection;
- one screen-reader/browser verification.

## Milestone 10.1 — Vertical Slice Release Candidate

**Status: 🟡 Automated RC and dead-code cleanup green; manual acceptance and release tag pending**

Delivered:

- consolidation regressions resolved;
- sire-first refuge finale restored and tested;
- both journalist outcomes tested end to end;
- post-report weapons, drain and free roam restored;
- tutorial camera ownership stabilized;
- police escalation 1 → 2 → 3, helicopter, recovery and witnesses tested;
- pause/task/dialogue input leakage covered;
- deterministic local Phaser used in CI;
- lower-right weapon HUD and keyboard-accessible high-contrast aim stabilized;
- thirty retired source files physically removed;
- obsolete patch-specific tests migrated or deleted;
- unit failures now preserve a downloadable log artifact;
- final cleanup unit and browser jobs pass together.

Remaining acceptance:

- complete the mission manually on `/` and `/phaser/`;
- inspect normal-speed tutorial and task-reveal camera feel;
- validate a physical wheel and trackpad;
- inspect memory during a longer level-three encounter;
- verify one screen-reader/browser combination;
- create tag `v0.1.0-rc.1` after those checks are recorded.

See `MILESTONE_10_1_STATUS.md` for the validation record.

## Milestone 11 — Campaign foundation

**Status: ✅ Complete**

### 11.1 delivered

- Versioned, serializable `CampaignState`.
- Data-driven `MissionDefinition` and generic `MissionRunner`.
- Reusable objectives: reach, talk, collect, neutralize, destroy, escape, return, steal vehicle, deliver vehicle and lose wanted level.
- Cash wallet and immutable transaction ledger.
- Separate faction and contact reputation.
- Save/load, import/export and reset.
- Opening journalist mission definition.
- `Clean the Scene` second mission definition.

### 11.2 delivered

- `MissionRunner` is authoritative for opening-mission objective, status, failure and reward state.
- `MissionSystem` derives markers, text and compatibility step from the active definition rather than maintaining a parallel progression variable.
- `CampaignRuntimeBridge` physically removed.
- Campaign schema version 2 with an atomic latest-safe-checkpoint snapshot.
- Objective-authored checkpoint policies and conservative migration spawns.
- Restore of player position/layer, Hunger, selected weapon, inventory and ammunition.
- Restore of broken streetlights, static NPC outcomes, corpses, blood evidence and counters.
- Completed tutorial and informant departure restored without replaying the opening sequence.
- Unsafe autosaved progress rolls back to the latest safe objective checkpoint.
- Failed retries preserve their latest safe checkpoint; starting another mission clears it.
- Completed missions require a completion checkpoint, protecting idempotent rewards from stale rollback.
- Browser API for save, checkpoint inspection, reload, discard, import and reset.
- Deterministic local Phaser and observable unit/Chromium validation.

### 11.3 delivered

- Player-facing New Game, Continue, Retry-from-checkpoint, Retry-mission and completed free-roam entry decisions.
- Campaign-entry keyboard focus ownership, Escape protection, native-modal isolation and narrow-layout support.
- Refuge contract-board interaction driven from campaign definitions and availability rules.
- Selectable and replayable `Clean the Scene` contract.
- Data-authored placement for the service alley, compromised camera roll, exposed body and refuge report.
- World adapter for reach, collect, body removal, police-attention loss and return events without a parallel objective index.
- Five-step board-contract presentation while preserving the opening mission's validated four-task and sire-first flow.
- Objective and completion checkpoints, atomic reload and idempotent money/reputation rewards.
- Explicit Enter/Space activation before Phaser can consume focused modal input.
- Chromium coverage on `/` and `/phaser/`, including the complete cleanup flow and post-report armed free roam.

Acceptance record:

```text
PR #9   direct authority and safe checkpoints
PR #11  deterministic automated browser validation
PR #12  player-facing campaign entry
PR #13  refuge board and playable Clean the Scene

manual opening-mission acceptance  ✅
unit-tests                         ✅
browser-smoke                      ✅
Netlify deploy previews            ✅
```

Final Milestone 11 merge chain:

```text
11.2 implementation  b14520b37b525cb10796f5b448cfb9ec434e27f7
11.2 CI hardening    dc4210eba60eb752202e5b323e10f91ab2c32713
11.3A entry          8b5a96f80837c88d4831e83e6c735b4698865bdb
11.3B board          7eefb061a05d2066929b7a2d61017d3fed0687be
```

No retired campaign bridge or duplicate progression authority remains. Milestone 12 is now the active production milestone.

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

- Player moves seamlessly between foot, roof/sewer traversal and vehicles.
- A vehicle never grants access to the complete refuge stash.
- Vehicle theft produces witness and police consequences.

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

Working structure:

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

- no floating street-ammunition pickups;
- one melee, one sidearm and one long/special weapon slot;
- carried-ammunition caps;
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

Original enhanced-mortal terminology:

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
- Full player-facing key-remapping screen.
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
