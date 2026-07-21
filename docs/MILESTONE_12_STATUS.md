# Milestone 12 — Vehicle core and expanded district

_Last updated: 2026-07-21_

## Status

**🟡 Runtime, city expansion, regression infrastructure and second driving-feedback pass are automated-green on PR #16. Final manual acceptance and merge remain.**

Milestone 12 combines a first-class arcade vehicle runtime with a 5.625-times-larger street/sewer district, sparse sidewalk-routed population, destructible street furniture and scalable system-loop regression testing.

## 12.1 — Vehicle runtime

Delivered:

- compact, sedan, van and police-cruiser archetypes;
- Enter for contextual vehicle entry/exit;
- W/S acceleration, braking and reverse;
- A/D arcade steering;
- Space handbrake with stronger deceleration and increased steering authority;
- higher maximum speed and acceleration across all four archetypes;
- player occupant state and vehicle-follow camera;
- speed-sensitive zoom;
- vehicle health, world collisions and disabled state;
- occupied wrecks retain the player until an explicit Enter exit;
- collision resolution first attempts one-axis wall sliding before a small rebound;
- theft ownership, witness, Exposure and police consequences;
- bounded per-vehicle trunks that never expose the refuge stash;
- campaign persistence for ownership, health, position, angle and trunk contents;
- on-foot checkpoint safety while a vehicle is occupied;
- vehicle browser diagnostics and focused Chromium coverage.

Current vehicle controls:

```text
Enter      enter / exit
W          accelerate
S          brake, then reverse
A / D      steer
Space      handbrake
E          inspect nearby trunk while on foot
```

Enter is filtered exclusively to `vehicleEnter` and `vehicleExit`; it cannot activate jumps, fire escapes or sewers. Space no longer enters/exits vehicles.

## 12.2 — Expanded urban playground

### World scale

The playable world grows from:

```text
960 × 640 = 614,400 world units²
```

to:

```text
2400 × 1440 = 3,456,000 world units²
```

That is **5.625 times the original area**. The viewport remains 960×640 logical units; the game does not allocate a full-map canvas.

The original mission quarter keeps its coordinates and is extended east and south by:

- four north/south avenues;
- three major east/west boulevards;
- long service lanes and back alleys;
- expanded sewer arteries and additional manholes;
- more than thirty building blocks;
- Glasshouse, Foundry, Canal, Blackwater and Harbor wards.

### Pedestrians and police

Baseline street population:

```text
6 active civilians
2 active police officers
```

Five civilians follow authored sidewalk, service-lane edge and zebra-crossing loops. Witness flight, lures, combat and pursuit may temporarily override those routes.

Wanted-level totals:

```text
wanted 0  → 2 officers
wanted 1  → 3 officers
wanted 2  → 5 officers
wanted 3  → 7 officers
```

Reinforcements enter from separated district approaches.

### Sidewalk streetlights

All authored streetlights stand on sidewalks or crossings.

A vehicle impact:

- blocks at very low speed;
- breaks the light above the authored threshold;
- applies hull damage;
- creates darkness through `PropDamageSystem`;
- emits noise, Exposure and police consequences;
- persists through campaign flags and broken-light checkpoint state.

Melee and vehicle damage share the same broken-light authority.

### Destructible dumpsters

Dumpsters are first-class street objects and valid body hiding spots.

A hard impact:

- ruptures the dumpster;
- damages the vehicle;
- persists the broken state;
- emits noise, local heat and Exposure.

When the dumpster contains a corpse:

1. the corpse becomes visible in the street;
2. its hiding-spot identity is cleared;
3. a seven-stain blood trail is created;
4. evidence and police pressure rise;
5. the corpse can be dragged and recontained elsewhere.

The hidden container id is included in static NPC checkpoint state.

### Vehicle-impact blood

- Non-lethal impacts leave a small pattern.
- Lethal impacts leave a longer directional trail.
- Blood uses the existing evidence lifetime, discovery and checkpoint systems.
- Lethal vehicle hits still emit the normal mission-neutralization event.

Moving civilian traffic and driver occupants remain Milestone 13.

## 12.3 — Scalable boot and regression profiles

Boot profiles are selected before campaign or scene composition:

```text
normal    persistent campaign, entry screen and tutorial
explore   isolated in-memory state, no mission/tutorial, direct street spawn
scenario  isolated deterministic test loop, no mission/tutorial
```

The campaign-entry screen exposes **Explore district**, which keeps systemic gameplay active without mutating the normal save.

Focused scenarios:

```text
?testScenario=vehicle-core
?testScenario=street-damage
?testScenario=police-escalation
?testScenario=input-locks
?testScenario=urban-explore
```

PR CI runs these domains in parallel:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

Complete narrative golden paths run on `main`, nightly schedule or manual workflow dispatch rather than on every pull request.

## Runtime ownership

```text
district data             ← roads, alleys, sidewalks, crossings, wards and props
PedestrianSystem          ← authored sidewalk/crosswalk civilian loops
NpcSystem                 ← combat, witnesses and expanded navigation fallback
PoliceSystem              ← sparse baseline and distributed reinforcements
StreetFurnitureSystem     ← dumpster state and vehicle/prop impacts
PropDamageSystem          ← streetlight durability and darkness authority
EvidenceSystem            ← corpse-container identity and blood evidence
VehicleSystem             ← occupancy and public vehicle facade
VehicleDriving            ← kinematics, handbrake, collision ordering and wall sliding
GameplayRuntime           ← single frame/input owner
```

No prototype patch or second frame loop is introduced.

## Browser APIs

```js
window.NBD_BOOT_PROFILE
window.NBD_SCENARIOS.list()
window.NBD_SCENARIOS.apply(id)
window.NBD_VEHICLES.snapshot()
window.NBD_PEDESTRIANS.snapshot()
window.NBD_STREET_PROPS.snapshot()
window.NBD_STREET_PROPS.breakDumpster(id)
window.NBD_STREET_PROPS.impact(vehicleId, dumpsterId, speed)
```

## Automated acceptance

Pure coverage verifies:

- world area and bounded viewport;
- pedestrian routes and population limits;
- vehicle speed limits and acceleration;
- normal braking before reverse;
- Space-style handbrake deceleration and steering authority;
- one-axis collision slide candidates;
- streetlight/dumpster impact thresholds;
- hidden dumpster identity in checkpoints;
- ownership, trunks and source ownership.

Chromium coverage verifies:

- both playable routes boot the expanded district;
- Enter enters and exits vehicles;
- Space does not own entry/exit and applies the handbrake;
- cars accelerate and camera zoom responds;
- an occupied destroyed car retains the player until Enter;
- vehicle-system, police, pedestrian, street-damage and evidence loops;
- campaign entry/checkpoint flows remain unaffected.

Accepted code head before this documentation-only commit:

```text
cbf936450afd7fd504763980e2c7db35e444cadb
unit-tests        ✅
browser-boot      ✅
browser-systems   ✅
browser-campaign  ✅
Netlify preview   ✅
```

## Manual acceptance still required

- confirm Enter entry/exit feels natural;
- tune the new higher speeds if any archetype feels excessive;
- test Space handbrake through several corners;
- collide obliquely with walls and verify recovery feels fluid;
- destroy an occupied vehicle and confirm Enter exit;
- recheck urban density, street furniture destruction and evidence pressure.

Traffic, moving civilian drivers, motorized police pursuit, roadblocks and officers exiting vehicles remain Milestone 13.
