# Milestone 12 — Vehicle core and expanded district

_Last updated: 2026-07-21_

## Status

**🟡 Milestone 12.1 driving is automated-green. Milestone 12.2 urban expansion and systemic vehicle damage are implemented on a stacked branch; repository CI and manual acceptance are pending.**

Milestone 12 keeps the first-class vehicle runtime from PR #15 and responds to the first driving review by making the district large enough for vehicles, reducing crowd/police density, moving civilians onto authored pedestrian surfaces and connecting vehicle impacts to the evidence system.

## 12.1 — Vehicle runtime

Delivered:

- compact, sedan, van and police-cruiser archetypes;
- contextual Space entry/exit;
- W/S acceleration, braking and reverse;
- A/D arcade steering;
- player occupant state and vehicle-follow camera;
- speed-sensitive zoom;
- vehicle health, solid-world collisions and disabled state;
- theft ownership, witness, Exposure and police consequences;
- bounded per-vehicle trunks that never expose the refuge stash;
- campaign persistence for ownership, health, position, angle and trunk contents;
- on-foot checkpoint safety while a vehicle is occupied;
- vehicle browser diagnostics and Chromium coverage on both routes.

Final automated 12.1 head:

```text
921ad1b1f0cc960c7872baac7231f49b86660b1c
unit-tests              ✅
browser-smoke           ✅ 31/31
Netlify preview         ✅
```

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

That is **5.625 times the original area**.

The render viewport remains 960×640 logical units. World bounds and camera bounds expand; canvas allocation does not scale to the entire map.

The original mission quarter keeps its coordinates and is extended east and south by:

- four north/south avenues;
- three major east/west boulevards;
- long service lanes and back alleys;
- expanded sewer arteries and additional manholes;
- more than thirty building blocks;
- Glasshouse, Foundry, Canal, Blackwater and Harbor wards.

### Pedestrians and police

Baseline street population is deliberately sparse:

```text
6 active civilians
2 active police officers
```

Five civilians follow authored loops whose complete segments remain on sidewalks, service-lane edges and zebra crossings. They no longer choose random road positions. Witness flight, lures, combat and police pursuit may temporarily override the pedestrian route when systemic gameplay requires it.

Wanted-level totals are reduced and reinforcements enter from separated district approaches:

```text
wanted 0  → 2 officers
wanted 1  → 3 officers
wanted 2  → 5 officers
wanted 3  → 7 officers
```

### Sidewalk streetlights

All authored streetlights stand on sidewalks or crossings.

A vehicle impact:

- blocks at very low speed;
- breaks the light above the authored threshold;
- applies minor hull damage;
- creates darkness through `PropDamageSystem`;
- emits noise, Exposure and police consequences;
- persists through campaign world flags and the existing broken-light checkpoint state.

Melee and vehicle damage share the same broken-light authority.

### Destructible dumpsters

Dumpsters are first-class street objects and remain valid body hiding spots.

At low speed, a dumpster is a solid obstacle. A harder impact:

- ruptures it;
- damages the vehicle;
- persists the broken visual/state;
- emits noise, local heat and Exposure.

When that dumpster contains a corpse:

1. the dumpster ruptures;
2. the corpse becomes visible in the street;
3. its hiding-spot identity is cleared;
4. a seven-stain blood trail is created;
5. evidence and police pressure rise;
6. `evidence:body-exposed` and `street-prop:broken` events are emitted.

The hidden container id is included in static NPC checkpoint state, so save/restore retains the body-to-dumpster relationship.

### Vehicle impact blood

Pedestrian impacts now create evidence:

- non-lethal impacts leave a small pattern;
- lethal impacts leave a longer directional trail;
- blood uses the existing evidence lifetime, discovery and checkpoint systems;
- lethal vehicle hits still emit the normal mission-neutralization event.

Moving civilian traffic and driver occupants remain Milestone 13. This slice applies to on-foot NPCs struck by the player vehicle.

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
VehicleDriving            ← kinematics, geometry and collision ordering
GameplayRuntime           ← single frame owner
```

No prototype patch or second frame loop is introduced.

## Browser APIs

```js
window.NBD_VEHICLES.snapshot()
window.NBD_PEDESTRIANS.snapshot()
window.NBD_STREET_PROPS.snapshot()
window.NBD_STREET_PROPS.breakDumpster(id)
window.NBD_STREET_PROPS.impact(vehicleId, dumpsterId, speed)
```

## Automated boundary

Pure coverage verifies:

- area is at least five times the original;
- viewport remains 960×640;
- all lights stand on pedestrian surfaces;
- complete pedestrian route segments remain on sidewalks/crossings;
- baseline civilian/police counts stay sparse;
- every dumpster maps to a hiding spot;
- vehicles are distributed across the expanded map;
- light/dumpster break thresholds and blocking rules;
- runtime ownership and absence of prototype patches;
- hidden dumpster identity in checkpoints.

Chromium coverage verifies:

- both playable routes boot a 2400×1440 world;
- canvas allocation remains bounded;
- pedestrians remain on authored surfaces;
- baseline police count is two;
- a moving vehicle breaks and persists a sidewalk light;
- a ruptured dumpster ejects a hidden corpse and blood;
- a lethal vehicle impact leaves visible blood evidence.

## Acceptance still required

- complete repository unit and Chromium jobs on the stacked head;
- publish the stacked preview;
- drive from the Old Quarter to Canal, Foundry and Harbor wards;
- inspect road width, camera travel and corner readability;
- validate pedestrian crossings under normal timing;
- test light and dumpster impacts at low and high speeds;
- hide a corpse, rupture its dumpster and confirm evidence pressure;
- tune density or block spacing from the manual pass.

Traffic, moving civilian drivers, motorized police pursuit, roadblocks and officers exiting vehicles remain Milestone 13.
