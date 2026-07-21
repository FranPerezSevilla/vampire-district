# Milestone 12 — Vehicle core and expanded district

_Last updated: 2026-07-21_

## Status

**🟡 Vehicle runtime, expanded district, scalable regression infrastructure and the third driving-feel pass are implemented on PR #16. Final Chromium systems validation, manual acceptance and merge remain.**

Milestone 12 combines a first-class arcade vehicle runtime with a 5.625-times-larger street/sewer district, sparse sidewalk-routed population, destructible street furniture and focused system-loop regression testing.

## Vehicle controls

```text
Enter      enter / exit
W          accelerate
S          brake, then reverse
A / D      steer
Space      handbrake / drift
E          inspect nearby trunk while on foot
```

Enter is filtered exclusively to `vehicleEnter` and `vehicleExit`; it cannot activate jumps, fire escapes or sewers. Space no longer enters/exits vehicles.

## Driving feel — third manual-feedback pass

### Livelier acceleration

All vehicle archetypes now use a low-speed launch boost in addition to higher acceleration and maximum speed:

```text
Compact          325 max internal speed · 285 acceleration
Sedan            352 max internal speed · 268 acceleration
Van              286 max internal speed · 214 acceleration
Police cruiser   388 max internal speed · 312 acceleration
```

The boost is strongest while nearly stopped and fades smoothly as the vehicle approaches top speed. The compact exceeds the previous top speed inside its first second under deterministic simulation.

### Actual arcade drift

The vehicle now stores two separate headings:

```text
angle         direction the vehicle body/nose faces
travelAngle   direction the vehicle is actually moving
```

Holding Space reduces tyre grip, increases steering authority and preserves part of the throttle. The body rotates more quickly than the velocity vector, producing real lateral slip instead of only rotating while braking. Releasing Space restores normal grip and progressively aligns `travelAngle` with the vehicle body.

The HUD exposes `DRIFT N°` while meaningful slip is active. The vehicle snapshot also exposes `travelAngle`, `driftDegrees`, `velocityX` and `velocityY` for regression diagnostics.

### Much softer building contact

A blocked movement no longer discards the whole frame:

1. binary contact search advances the vehicle to the furthest safe point immediately before the obstacle;
2. the system tries twelve long-to-short slide candidates along each free axis;
3. it then attempts rotation at the contact point so steering can free the nose;
4. if fully trapped, the vehicle retains a small forward speed rather than bouncing backwards.

Oblique impacts therefore continue along the wall, while head-on contact is easier to correct with steering or reverse. Collision damage and police/evidence consequences remain active.

### Destroyed vehicles

An occupied wreck remains occupied and immobile. The player exits explicitly with Enter through the first valid side/rear position. The HUD displays `WRECKED · ENTER exit`.

## Expanded urban playground

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

## Pedestrians and police

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

## Systemic street damage

### Sidewalk streetlights

A sufficiently fast vehicle breaks a light through `PropDamageSystem`, applies hull damage, creates darkness, emits noise/Exposure/police pressure and persists the broken state. Low-speed impacts remain solid.

### Destructible dumpsters

A hard impact ruptures a dumpster, damages the vehicle, persists the broken state and raises local pressure. When it contains a corpse:

1. the corpse becomes visible in the street;
2. its hiding-spot identity is cleared;
3. a seven-stain blood trail is created;
4. evidence and police pressure rise;
5. the corpse can be dragged and recontained elsewhere.

The hidden container id is included in static NPC checkpoint state.

### Vehicle-impact blood

- Non-lethal pedestrian impacts leave a small pattern.
- Lethal impacts leave a longer directional trail.
- Blood uses the existing evidence lifetime, discovery and checkpoint systems.
- Lethal vehicle hits still emit the normal mission-neutralization event.

Moving civilian traffic and driver occupants remain Milestone 13.

## Scalable boot and regression profiles

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
NpcSystem                 ← combat, witnesses and navigation fallback
PoliceSystem              ← sparse baseline and distributed reinforcements
StreetFurnitureSystem     ← dumpster state and vehicle/prop impacts
PropDamageSystem          ← streetlight durability and darkness authority
EvidenceSystem            ← corpse-container identity and blood evidence
VehicleSystem             ← occupancy and public vehicle facade
VehicleModel              ← acceleration, grip, body/travel headings and pure kinematics
VehicleDriving            ← collision ordering, contact search and wall sliding
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

## Automated boundary

Pure coverage verifies:

- world area and bounded viewport;
- pedestrian routes and population limits;
- fast launch and maximum speed;
- normal braking before reverse;
- sustained handbrake slip and progressive grip recovery;
- contact interpolation and long/short collision slide candidates;
- streetlight/dumpster impact thresholds;
- hidden dumpster identity in checkpoints;
- ownership, trunks and source ownership.

Chromium coverage verifies:

- both routes boot the expanded world;
- Enter vehicle entry/exit;
- W is bound to vehicle acceleration;
- fixed real `VehicleSystem` frames reach the authored launch target independently of runner FPS;
- handbrake drift preserves speed, creates lateral displacement and separates body/travel headings;
- occupied wreck exit;
- pedestrian routing and sparse police baseline;
- light/dumpster/body/blood consequences;
- campaign entry and checkpoint loops remain valid.

## Acceptance still required

- complete the final `browser-systems` job on the current head;
- manually judge launch, top speed, controllability and drift recovery;
- scrape walls and corners at several angles;
- confirm a car can steer free without excessive reverse;
- tune grip or collision retention only from the manual feel pass.

Traffic, moving civilian drivers, motorized police pursuit, roadblocks and officers exiting vehicles remain Milestone 13.