# City topology reset — mission constraint retirement

_Last updated: 2026-07-23_

## Status

**Implementation candidate in PR #32.**

This change removes every authored mission from the production registry so the next city pass can replace the original street core, landmark placement and traversal assumptions without preserving obsolete objective coordinates.

The campaign and mission framework remains available. What is retired is the currently registered content and its authority over city geometry.

## Why this reset exists

The original vertical slice authored its opening journalist mission directly against fixed locations:

- rooftop refuge;
- police station roof;
- nightclub district;
- rooftop blocker route;
- service alley and exposed body;
- fixed return-to-refuge finale.

The City Compiler then treated the Old Quarter and several buildings as protected landmarks. That made later city expansion additive: new wards could change, but the original road arrangement remained effectively permanent.

Visual playtesting exposed the cost of this constraint:

- roads and sidewalk strips overlap at intersections;
- crosswalks do not always connect meaningful pedestrian paths;
- buildings sit too close to or over road corridors;
- lamps are positioned from road strips rather than valid sidewalk anchors;
- the Old Quarter cannot be regenerated freely because narrative coordinates depend on it.

The correct dependency is now:

```text
city topology and landmark sites
→ stable navigation/traversal contracts
→ missions authored against the accepted city
```

Not:

```text
mission coordinates
→ protected old roads
→ all future city work forced around them
```

## Production mission registry

Production `CampaignSystem` now starts with:

```text
registered definitions  0
active mission          null
mission records         {}
completed missions      []
failed missions         []
checkpoint              null when tied to retired content
```

The following definition files remain in source control as archived/reference content, but are not registered or booted:

- `silenceTheJournalistMission`;
- `cleanTheSceneMission`.

Tests can still pass these definitions explicitly to `CampaignSystem`. Future content modules can do the same after the new city has an accepted topology.

## Normal boot contract

The normal public build now opens as persistent street free roam:

```text
persistent campaign      yes
campaign auto-load/save  yes
campaign entry modal     no
mission board             no
opening mission           no
authored tutorial         no
spawn layer               street
spawn                     438, 326
```

Wallet, reputation, authored vehicles, hull condition, trunks, garage maintenance and other campaign services remain persistent.

Explore/scenario modes remain isolated and non-persistent as before.

## Save migration

When an existing save is loaded, `CampaignSystem` compares stored mission state with the definitions explicitly registered for that build.

Unregistered mission state is pruned:

- stale active mission ID;
- retired mission records;
- retired completed/failed IDs;
- checkpoint belonging to a retired mission.

Unrelated state is preserved:

- cash and ledger;
- reputation;
- inventory;
- owned vehicles and condition;
- world flags not owned by retired missions;
- unlocked refuges.

The pruned state is saved immediately when persistent autosave is active.

## Runtime mission facade

`MissionSystem` is now definition-agnostic.

With no active definition it reports:

```text
No active contract · city free roam.
No active contract · explore the city freely.
```

It publishes no marker and no mission-specific interactions.

When a future definition is explicitly registered and started, the facade still:

- reads the current objective from `MissionRunner`;
- forwards typed neutralization events;
- reports generic objective text and markers;
- handles failure/results;
- preserves one campaign objective authority.

The journalist-specific presentation bridge and sire finale are retired.

## Retired mission actors

The following definitions remain available for explicit tests/content, but are inactive in production free roam:

- journalist;
- exposed body;
- rooftop thug.

The tutorial-created police-roof informant is immediately hidden because the tutorial completes on boot.

Entity streaming only pins mission targets/informants/intercepts while a mission is actually active. Retired actors no longer keep the original city core resident.

## City Compiler boundary

The imported current city is now an **unconstrained comparison baseline**.

```text
protected zones  []
fixed landmarks  []
```

Every district, including `old-quarter`, has `protected: false`.

Existing runtime buildings and roads still render until the topology pass replaces them, but none is a compiler-protected narrative landmark. The list of current building/road overlaps remains diagnostic debt, not an allowed rule for generated candidates.

## Future landmark policy

Important buildings must not be restricted to rectangular leftovers between parallel roads.

Future landmarks use a site-first model:

```text
landmark site / campus footprint
→ required forecourt, parking, service and pedestrian clearances
→ roads and curved approaches adapt around the site
→ surrounding blocks and ordinary parcels fill remaining space
```

Examples:

- police station with yard/parking and controlled access;
- hospital campus with emergency/service approaches;
- church with plaza, garden or cemetery;
- industrial plant with yard and loading perimeter;
- station, civic complex or large club.

Roads may be polylines/curves. Buildings and sites may be polygonal or compound footprints. The next topology model must not assume:

- all buildings are rectangles;
- all blocks are four-sided;
- all streets are horizontal/vertical;
- every intersection is 90 degrees;
- streets always exist before important buildings.

## Next active pass

### City topology and readability

The next implementation phase owns:

1. one authoritative road/intersection topology;
2. intersections generated as unique pieces rather than overlapping road strips;
3. explicit carriageway, curb, sidewalk and furniture bands;
4. connected pedestrian graph;
5. crosswalks only between valid sidewalk nodes;
6. building/site setbacks from roads and intersections;
7. lamps anchored to valid sidewalk/building corners;
8. site-first landmark reservations;
9. curved/polyline street support;
10. compiler errors for invalid overlap and dead-end pedestrian geometry.

### Acceptance direction

- no building intersects or visually crowds a road corridor;
- no crosswalk ends without a pedestrian continuation;
- no duplicated sidewalk strip crosses the middle of an intersection;
- road, sidewalk and parcel space are visually distinct;
- street furniture has semantic anchors;
- the entire Old Quarter can be regenerated or removed;
- large landmarks can shape nearby streets rather than being squeezed into leftover rectangles;
- future missions can reference stable semantic sites instead of raw legacy coordinates.

## Deliberately not done in this reset

- redesigning or regenerating the city geometry itself;
- deleting the generic mission/campaign framework;
- deleting archived mission definitions;
- introducing new missions;
- implementing faction territory;
- implementing curved-road rendering;
- replacing the Old Quarter immediately.

This PR removes the constraints first. The topology pass can then change the city without carrying narrative compatibility debt.

## Automated coverage

Unit coverage verifies:

- empty production mission registry;
- pruning of old mission state/checkpoint;
- persistent missionless normal boot;
- no protected district or fixed compiler landmark;
- retired mission actors inactive and unpinned.

Chromium coverage verifies:

- normal URL loads directly into street free roam;
- old mission save data is pruned and persisted;
- cash survives migration;
- no campaign entry modal or mission board exists;
- no objective marker is published;
- tutorial and retired mission actors remain inactive;
- no page errors.
