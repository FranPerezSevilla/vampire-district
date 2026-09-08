# Viceblood

**Viceblood** is a Phaser 3 top-down urban vampire action, stealth and crime game for the browser.

The long-term structure is intentionally GTA2-like: readable districts, vehicles, traffic, weapons, factions, territory, cash and systemic police chaos. The original vampire setting adds Hunger, feeding, powers, rooftops, sewers, Retainers, safehouses and political consequences.

Vampire progression now runs from survival to **Prince of the city**: meet contacts, complete supply deliveries, repay favours, obtain blood and hunting access, invest in businesses, buy control and earn political support. See [Vampire city power](docs/VAMPIRE_CITY_POWER.md) for the playable sequence and exact rules. This feature requires player review; the public Pages link may still serve the earlier accepted traffic branch.

The current public build is a **persistent free-roam systems sandbox** running City Topology V2: a `4800 × 3600` world with exactly five times the previous area.

Open `index.html` through a local/static web server, or use the [published GitHub Pages build](https://franperezsevilla.github.io/vampire-district/). ES modules will not work reliably through every browser's `file://` mode.

## Current playable state

The normal title screen opens the persistent street sandbox through New Night / Continue, with no active contract. The retired campaign-entry modal and authored mission tutorial remain disabled.

Available systems:

- responsive Phaser presentation and selectable internal render quality;
- street, rooftop and sewer traversal;
- Hunger, feeding and vampire powers;
- involuntary feeding frenzy at Hunger 100, with warnings at 85/95 and bounded exhaustion;
- four named vampire contacts, two persistent human donors and three businesses with production and operating policies;
- CONTACTS/BLOOD HUD actions, persistent directions and explicit agreement, debt and breach feedback;
- an earned Prince compact granting hunting access across all fourteen districts;
- separate NPC sight/hearing reactions;
- witnesses, evidence and exposure;
- foot-police escalation, containment, arrest and helicopter pressure;
- motorized police pursuit and partial roadblocks;
- mouse-directed combat, resilience, stagger and knockdown;
- Unarmed, Iron Pipe and Pistol prototype loadout;
- held right-click feeding with intentional Quick Bite, Full Feed and Drain release depths;
- dumpsters that favour alleys, building gaps and industrial/service frontage;
- authored vehicles with arcade driving, handbrake drift, hull and trunks;
- any non-police authored vehicle can be stolen;
- 600 civilian cars follow broad repeating city circuits, with physical steering, braking, reverse and obstruction recovery;
- a fixed 64-slot local traffic pool materializes outside the camera and retains vehicles while followed;
- six buses serve three lines with stops and real boarding/alighting NPCs; the player can ride or steal a bus;
- three continuous radio stations with three tracks each, in-car wheel selection and quiet nearby-car ambience;
- distant civilian scheduling, incremental accounting and cached collision geometry reduce traffic CPU work;
- civilian traffic vehicles can be hijacked, converting them into capped transient drivable cars;
- one or more civilian occupants jump out with a visible `WTF` reaction when a traffic car is stolen;
- refuge-garage repair and owned-wreck recovery;
- streamed multi-ward city;
- persistent campaign wallet, reputation, authored vehicles and save state;
- persistent ownership and influence state for all fourteen districts, with entry notices and reputation-derived territory relations;
- persistent hunting-right, protected-prey and evidence-driven poaching assessments for completed feeding;
- paused Night Ledger panel for faction relations, territory, hidden/known violations, police pressure and recent incidents;
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

- one authoritative 107-node / 148-edge road graph, geometry v5;
- 150-unit avenues with two lanes per direction, 96-unit local streets and 88-unit service streets;
- 660 directed traffic lanes, with sidewalks, building setbacks and roofs fitted to the wider roads;
- clipped road segments and one unique authority surface per intersection;
- explicit carriageway, curb and connected sidewalk bands;
- valid pedestrian crossings outside junction centres;
- compound site-first landmark reservations and setback-validated rectangular runtime parcels;
- bent/polyline road corridors with curve metadata for the next renderer;
- site-first large landmarks such as police stations, hospitals, churches and industrial campuses.

Future missions will be authored against stable semantic city sites after the topology is accepted, rather than forcing the city to preserve obsolete mission coordinates.

## Original setting direction

The project will not use factions, terminology, ranks, lore or symbols from an existing licensed vampire property.

Canonical faction direction:

- **The First Estate** — the old institutional elite: wealth, property, influence and controlled violence;
- **The Gutter Crown** — a territorial street coalition built on force, reputation and the ability to hold ground;
- **The Houses** — a provisional umbrella term for independent operators and bloodlines, never one unified faction;
- **Retainers** — named enhanced mortals with Loyalty, Dependence, Exposure, upkeep and failure states.

The First Estate and The Gutter Crown are the accepted design names. Commercial trademark clearance is still required before release. See [`docs/FACTION_NAMING.md`](docs/FACTION_NAMING.md) and [`docs/ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md`](docs/ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md).

## Controls

- WASD / arrows: move or control a vehicle.
- Hold Shift: move quietly on foot.
- Mouse: aim and face.
- Left mouse: use the equipped weapon.
- Mouse wheel: previous/next owned weapon on foot; radio station / OFF while driving.
- Right mouse: hold on a valid target; release for Quick Bite or Full Feed, or continue to Drain.
- Enter: enter, steal or exit non-police vehicles; near a bus choose passenger boarding or theft.
- Space: contextual traversal on foot; handbrake while driving.
- E: interactions, trunks and garage.
- Q: Shadow Dash.
- R: Vampiric Whisper.
- F: Blood Sense.
- B: Give In to the Beast for a short speed, feeding and melee burst at Hunger/evidence cost.
- M: mission panel; currently reports no active contract.
- L: open the paused Night Ledger for faction and police consequences.
- H: horn while driving.
- Escape / Menu: pause/help/accessibility settings or close the active UI/dialogue.

## Traffic lifecycle

Civilian traffic uses two bounded layers:

```text
600 civilian identities + 6 scheduled buses
→ compiler journeys + shared vehicle kinematics
→ maximum 64 local visual proxies
→ off-camera materialization
→ generous camera/follow retention
→ ordinary proxy despawn only when far and off-camera
```

Hijacking a proxy converts it into a transient `VehicleSystem` car. These cars are not written to campaign persistence and are capped separately, so following or stealing traffic cannot grow the runtime indefinitely. Police vehicles remain unavailable for theft.

## Production sequence

```text
narrative constraint retirement
→ city topology and readability
→ original factions, territory and hunting law
→ predator feeding depths and evidence pressure
→ safehouses, stash and ammunition economy
→ Retainers
→ expanded arsenal and vehicle combat
→ new district campaign authored against semantic city sites
```

See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Tests

The accepted 2026-09-08 implementation passes **911 native tests**, city validation with zero errors/warnings, and deterministic regeneration of all 99 city/chunk/pack files. Automated browser execution is excluded for this traffic/road review at the user's request. In PR CI, the exception follows `codex/traffic-junction-topology`; the repository retains its browser suites for other validation contexts.

Fast checks:

```bash
npm run check:fast
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
