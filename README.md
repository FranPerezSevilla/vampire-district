# Viceblood

**Viceblood** is a Phaser 3 top-down urban vampire action, stealth and crime game for the browser.

The long-term structure is intentionally GTA2-like: readable districts, vehicles, traffic, weapons, factions, territory, cash and systemic police chaos. The original vampire setting adds Hunger, feeding, powers, rooftops, sewers, Retainers, safehouses and political consequences.

The current public build is a **persistent free-roam systems sandbox** running City Topology V2: a `4800 × 3600` world with exactly five times the previous area. The repository keeps its historical `vampire-district` slug for compatibility, but the product name is now Viceblood.

Open `index.html` through a local/static web server, or use the published GitHub Pages build. ES modules will not work reliably through every browser's `file://` mode.

## Current playable state

Normal boot starts directly on the street with no active contract.

Available systems:

- responsive Phaser presentation and selectable internal render quality;
- street, rooftop and sewer traversal;
- Hunger, feeding and vampire powers;
- separate NPC sight/hearing reactions;
- witnesses, evidence and exposure;
- foot-police escalation, containment, arrest and helicopter pressure;
- motorized police pursuit and partial roadblocks;
- mouse-directed combat, resilience, stagger and knockdown;
- Unarmed, Iron Pipe and Pistol prototype loadout;
- contextual right-click draining;
- dumpsters that favour alleys, building gaps and industrial/service frontage;
- authored vehicles with arcade driving, handbrake drift, hull and trunks;
- any non-police authored vehicle can be stolen;
- civilian traffic materializes outside the camera, remains while followed and uses a fixed local pool;
- civilian traffic vehicles can be hijacked, converting them into capped transient drivable cars;
- one or more civilian occupants jump out with a visible `WTF` reaction when a traffic car is stolen;
- refuge-garage repair and owned-wreck recovery;
- streamed multi-ward city;
- persistent campaign wallet, reputation, authored vehicles and save state;
- runtime ownership diagnostics and Playwright regression infrastructure.

Streetlight rendering, damage, darkness patches and their stealth logic are retired. Street visibility is now independent of lamps and authored shadow zones.

Current production mission state:

```text
registered missions     0
active mission          none
campaign entry modal    disabled
mission board           disabled
authored tutorial       disabled
```

Archived mission definitions remain source-controlled framework examples, but they are not production content.

## City Topology V2

The current city uses:

- one authoritative 114-node / 158-edge road graph;
- clipped road segments and one unique authority surface per intersection;
- explicit carriageway, curb and connected sidewalk bands;
- valid pedestrian crossings outside junction centres;
- compound site-first landmark reservations and setback-validated rectangular runtime parcels;
- bent/polyline road corridors with curve metadata for the next renderer;
- site-first large landmarks such as police stations, hospitals, churches and industrial campuses.

Future missions will be authored against stable semantic city sites after the topology is accepted, rather than forcing the city to preserve obsolete mission coordinates.

## Original setting direction

The project will not use factions, terminology, ranks, lore or symbols from an existing licensed vampire property.

Working structure:

- **Blackglass Directorate** — secretive institutional establishment;
- **Red Assembly** — violent territorial coalition;
- **Unaligned Houses** — separate independent operators;
- **Retainers** — named enhanced mortals with Loyalty, Dependence, Exposure, upkeep and failure states.

These are working names pending commercial trademark clearance. See [`docs/ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md`](docs/ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md).

## Controls

- WASD / arrows: move or control a vehicle.
- Hold Shift: move quietly on foot.
- Mouse: aim and face.
- Left mouse: use the equipped weapon.
- Mouse wheel: previous/next owned weapon.
- Right mouse: hold to drain a valid target.
- Enter: enter, steal or exit non-police vehicles.
- Space: contextual traversal on foot; handbrake while driving.
- E: interactions, trunks and garage.
- Q: Shadow Dash.
- R: Vampiric Whisper.
- F: Blood Sense.
- M: mission panel; currently reports no active contract.
- H: pause/help/accessibility settings.
- Escape: UI/dialog fallback.

## Traffic lifecycle

Civilian traffic uses two bounded layers:

```text
macro traffic tokens
→ maximum ten local visual proxies
→ off-camera materialization
→ generous camera/follow retention
→ ordinary proxy despawn only when far and off-camera
```

Hijacking a proxy converts it into a transient `VehicleSystem` car. These cars are not written to campaign persistence and are capped separately, so following or stealing traffic cannot grow the runtime indefinitely. Police vehicles remain unavailable for theft.

## Production sequence

```text
narrative constraint retirement
→ city topology and readability
→ original factions and territory
→ safehouses, stash and ammunition economy
→ Retainers
→ expanded arsenal and vehicle combat
→ new district campaign authored against semantic city sites
```

See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Tests

Unit tests:

```bash
npm test
```

Chromium tests:

```bash
npm install
npx playwright install chromium
npm run test:browser
```

Release-candidate domains:

```bash
npm run test:rc
```

## itch.io build

A manual GitHub Actions workflow can package any selected branch as a final itch.io-ready HTML ZIP:

```text
Actions → Build itch.io ZIP → Run workflow
```

Choose the branch, run the workflow and download the artifact. The downloaded ZIP is the definitive package: upload it directly to itch.io without extracting or repackaging it.

See [`docs/ITCH_IO_BUILD.md`](docs/ITCH_IO_BUILD.md) for the full process and package contract.

## Documentation

Start with [`docs/README.md`](docs/README.md), then read:

- [`docs/PROJECT_BLUEPRINT.md`](docs/PROJECT_BLUEPRINT.md)
- [`docs/PROJECT_SNAPSHOT.md`](docs/PROJECT_SNAPSHOT.md)
- [`docs/CITY_TOPOLOGY_RESET.md`](docs/CITY_TOPOLOGY_RESET.md)
- [`docs/CITY_TOPOLOGY_V2.md`](docs/CITY_TOPOLOGY_V2.md)
- [`docs/ROAD_GRAPH_GEOMETRY.md`](docs/ROAD_GRAPH_GEOMETRY.md)
- [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)
