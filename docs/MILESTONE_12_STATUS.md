# Milestone 12 — vehicle core and expanded district

_Last updated: 2026-07-22_

## Status

**✅ Accepted and complete.**

Milestone 12 delivered the first-class arcade vehicle runtime, persistent authored vehicle condition, a `2400 × 1440` district, sidewalk-routed pedestrians, destructible street furniture, evidence consequences and focused browser-system regression infrastructure.

Traffic materialization and local civilian traffic behaviour continue under Milestone 13 and `CITY_STREAMING_4A.md` through `CITY_STREAMING_4F.md`.

## Vehicle controls

```text
Enter      enter / exit
W          accelerate
S          brake, then reverse
A / D      steer
Space      handbrake / drift
E          inspect nearby trunk while on foot
```

Enter is filtered exclusively to vehicle entry/exit. It cannot trigger traversal, fire escapes or sewers. Space remains contextual traversal on foot and becomes the handbrake while driving.

## Driving model

Vehicle state separates:

```text
angle         body / nose heading
travelAngle   actual velocity heading
```

The model includes:

- low-speed launch boost;
- arcade acceleration and top speed;
- braking before reverse;
- reduced handbrake grip and lateral slip;
- progressive grip recovery;
- drag and steering authority by archetype;
- speed-sensitive camera;
- persistent hull health and disabled state.

Accepted archetype baselines:

```text
Compact          325 max internal speed · 285 acceleration
Sedan            352 max internal speed · 268 acceleration
Van              286 max internal speed · 214 acceleration
Police cruiser   388 max internal speed · 312 acceleration
```

## Collision recovery

A blocked frame does not simply bounce or disappear:

1. binary contact search finds the furthest safe point;
2. long-to-short slide candidates try each free axis;
3. body rotation is attempted at contact;
4. a fully trapped vehicle retains a small controllable state rather than an exaggerated rebound.

Oblique impacts slide along walls; head-on contact remains recoverable with steering or reverse.

## Persistent vehicle consequences

Authored vehicles persist:

- position and heading;
- hull health;
- parked/disabled state;
- ownership/status;
- limited trunk contents.

An occupied wreck remains occupied and immobile until the player exits explicitly with Enter through a valid side/rear position.

## Expanded district

```text
old world     960 × 640   = 614,400 units²
new world     2400 × 1440 = 3,456,000 units²
ratio         5.625×
```

The logical viewport remains `960 × 640`; the game does not allocate a full-map canvas.

The city includes:

- original mission quarter at stable coordinates;
- Glasshouse, Foundry, Canal, Blackwater and Harbor wards;
- four north/south avenues;
- three major east/west boulevards;
- service lanes, alleys and crossings;
- expanded sewers and additional manholes;
- more than thirty building blocks.

## Pedestrians and police baseline

```text
6 active civilians
2 baseline police officers
```

Five civilians follow authored sidewalk, service-edge and crossing loops. Witness flight, lures, combat and pursuit can temporarily override their routes.

Wanted totals:

```text
wanted 0  → 2 officers
wanted 1  → 3 officers
wanted 2  → 5 officers
wanted 3  → 7 officers
```

Reinforcements enter from separated district approaches.

## Systemic street damage

### Streetlights

Fast vehicle impact can break a streetlight through `PropDamageSystem`, damaging the vehicle, removing illumination, creating persistent darkness and generating noise/exposure/police pressure.

### Dumpsters

Hard impact can rupture a dumpster. If it contains a corpse:

1. the corpse returns to the street;
2. container identity is cleared;
3. a directional blood trail is created;
4. evidence and police pressure rise;
5. the corpse can be moved and hidden elsewhere.

### Pedestrian impacts

- non-lethal impacts leave a smaller blood pattern;
- lethal impacts leave a longer directional trail;
- evidence lifetime/discovery/checkpoint rules are reused;
- lethal hits emit the normal neutralization event.

## Runtime ownership

```text
district data             roads, alleys, sidewalks, crossings and wards
PedestrianSystem          authored civilian loops
NpcSystem                 combat, witnesses and fallback navigation
PoliceSystem              baseline, reinforcements and local heat
StreetFurnitureSystem     dumpster and vehicle/prop consequences
PropDamageSystem          streetlight durability and darkness
EvidenceSystem            bodies, container identity and blood
VehicleSystem             persistent vehicle facade and occupancy
VehicleModel              pure kinematics and impact helpers
VehicleDriving            collision ordering, contact search and sliding
GameplayRuntime           single frame/input owner
```

No prototype patch or second frame loop remains.

## Boot and regression profiles

```text
normal    persistent campaign and entry screen
explore   isolated in-memory free roam
scenario  isolated deterministic test loop
```

Focused scenarios include vehicle core, street damage, police escalation, input locks and urban exploration.

PR CI domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

## Acceptance record

Validated through the Milestone 12 vehicle/expanded-city PR chain and all subsequent City Streaming 4A–4F matrices.

Accepted boundary:

- vehicle entry/exit and input separation;
- launch, braking, reverse and drift;
- collision slide/recovery;
- persistent health, wreck and trunk state;
- expanded-world boot on both routes;
- pedestrians and distributed police;
- streetlight, dumpster, corpse and blood consequences;
- campaign/checkpoint compatibility;
- unit, boot, systems and campaign domains green.

## Follow-on work

Active next phase: vehicle repair and disabled-vehicle recovery (`ROADMAP.md`, Milestone 12.1).

Milestone 13 owns:

- city streaming and dormancy;
- macro and local civilian traffic;
- physical traffic contact and impact consequences;
- future motorized police pursuit, interception and roadblocks.
