# Vampire District

**Vampire District** is a Phaser 3 top-down urban vampire action, stealth and crime game for the browser.

The long-term structure is intentionally GTA2-like: readable districts, vehicles, traffic, weapons, factions, territory, cash and systemic police chaos. The original vampire setting adds Hunger, feeding, powers, rooftops, sewers, Retainers, safehouses and political consequences.

The current public build is a **persistent free-roam systems sandbox**. The previous journalist and `Clean the Scene` contracts are no longer registered because their fixed coordinates were forcing the original street layout to remain permanent while the rest of the city evolved around it.

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
- damageable streetlights, dumpsters, bodies and blood evidence;
- authored vehicles with arcade driving, handbrake drift, hull and trunks;
- refuge-garage repair and owned-wreck recovery;
- streamed multi-ward city;
- macro traffic and ten pooled local civilian vehicles;
- persistent campaign wallet, reputation, vehicles and save state;
- runtime ownership diagnostics and Playwright regression infrastructure.

Current production mission state:

```text
registered missions     0
active mission          none
campaign entry modal    disabled
mission board           disabled
authored tutorial       disabled
```

Archived mission definitions remain source-controlled framework examples, but they are not production content.

## Why the missions were retired

The old opening contract depended on fixed raw coordinates for:

- the rooftop refuge;
- police station roof/informant;
- rooftop blocker;
- nightclub/journalist;
- service alley/body;
- return finale.

Those assumptions caused the City Compiler to preserve the Old Quarter and fixed landmarks. The current reset removes that protection so every district, road and landmark may be regenerated.

The next city architecture will use:

- one authoritative road graph;
- unique intersection geometry;
- explicit carriageway, curb and connected sidewalk bands;
- valid pedestrian crossings only;
- polygonal parcels/buildings;
- curved/polyline roads;
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
- Enter: enter/exit vehicles only.
- Space: contextual traversal on foot; handbrake while driving.
- E: interactions, trunks and garage.
- Q: Shadow Dash.
- R: Vampiric Whisper.
- F: Blood Sense.
- M: mission panel; currently reports no active contract.
- H: pause/help/accessibility settings.
- Escape: UI/dialog fallback.

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

## Documentation

Start with [`docs/README.md`](docs/README.md), then read:

- [`docs/PROJECT_BLUEPRINT.md`](docs/PROJECT_BLUEPRINT.md)
- [`docs/PROJECT_SNAPSHOT.md`](docs/PROJECT_SNAPSHOT.md)
- [`docs/CITY_TOPOLOGY_RESET.md`](docs/CITY_TOPOLOGY_RESET.md)
- [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)
