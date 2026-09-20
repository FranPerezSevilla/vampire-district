# West Market: urban layout pilot

## Goal

Replace seven isolated footprints with two readable blocks: a market square and a residential courtyard, with usable service and rooftop routes.

## Authority and files in scope

- City geometry remains owned by `tools/city-compiler`, composed in `generate-road-topology.js`.
- Authored plan: `phaser/src/data/west-market-block.js`; compiler pass: `tools/city-compiler/west-market-block.js`.
- Regenerate canonical topology and streaming outputs together.
- Existing ordinary-building presentation: respect authored entrance sides and remove internal shared walls. Reuse existing materials, heights and rendering caches.
- Focused layout tests, browser review, this task record and handoff.

## Required behaviour / acceptance

- Market and housing have coherent frontages, open public space and a second pedestrian exit.
- Player-sized bodies can reach each authored entrance, pass through service lanes and reach both roof accesses.
- All solids stay clear of roads and sidewalks; shared walls are hidden below the adjoining volume's height.
- Rooftop route endpoints lie on their actual roof footprints.
- Compiler is idempotent. Roads and buildings outside the pilot remain unchanged.
- Ground uses existing world-aligned paving, baked through the existing static-sector system. No new per-frame ground renderer or texture atlas.
- Inspect the resulting city in gameplay, not only a plan view.

## Non-goals

No citywide regeneration of style, new artwork, landmark relocation, road/traffic redesign, interior gameplay, new roof physics, commit or push.

## Validation

City validation; focused compiler, geometry, presentation and roof tests; affected-test plan and runner; city browser checks; actual walking and rooftop transitions in West Market. Record failures and limitations honestly.

## Delivered — 20 September 2026

- Seven existing buildings reorganized, four small connecting/service volumes added (city total 184 → 188).
- West: paired market frontage, plaza, warehouse edge, service alley and western through-passage.
- East: joined tenement/AFTER HOURS frontage, pedestrian promenade and U-shaped residential court with a western passage.
- Eleven authored pedestrian surfaces use the existing cached pavement atlas and sector renderer. No new image assets or per-frame drawing pass.
- Existing local pedestrian identities remain unchanged: 12 people on three four-point routes. City NPC definitions remain 151.
- Two stairs, ten roof connections, two drops use the existing traversal authority and low-roof layer. Rooftop equipment collision and sloped-roof physics remain outside this change.
- Generic facade entrances respect the authored side. Shared party walls are clipped below the neighbouring volume's height; upper exposed wall sections remain visible.
- Both blocks reserve their public spaces before generic infill. Compiler output is repeatable, and roads / buildings outside the owned pilot set are unchanged.

### Review points

Market square (347,1538), shopfront promenade (818,1524), residential court (840,1640), service alley (234,1690). All street layer 0. Below the hospital, west of the refuge.

### Validation results

- City compiler: PASS, zero errors/warnings; topology regeneration byte-identical on the second run.
- 46 focused native tests pass, including player-sized route clearance, every entrance, roof endpoints, future infill reservation and shared-wall clipping.
- Production browser: five views, no JS errors; actual WASD walking through the market/alley, court passage and shopfront promenade passes.
- Both new stairs and representative arcade/courtyard roof jumps pass with the actual Space traversal input. Harness holds the key for 120 ms and waits for transition completion before repositioning; immediate press/release and testing before the landing tween completed produced false failures in earlier harness attempts.
- Full native suite: 1259/1303 pass, 44 fail. The broad branch already has failing retired UI/campaign, population expectations, traffic and old city-count assertions; this is not a green full-suite delivery.
- City browser group: 9/14 pass. Failures: old CLUB/clearance expectation, entity-streaming readiness timeout, Foundry roof interaction expectation, road geometry version expectation (4 vs current 5), retired campaign territory access. Their reports are retained in task `work/west-market-browser.log`.
- Affected plan reviewed; runner attempted but exits when launching child `npm test` on Windows. Native tests, city validation and city browser group were run directly. Browser suite coverage check passes.
- Broad tests rewrite generated streaming fixtures. Canonical topology/streaming were regenerated after that suite and packaged again; final city asset diff is seven local chunks.
- Production build passes. Initial packed seed remains nine chunks; no new texture source or additional actors. First visual pass ran alongside other checks and is not an isolated FPS benchmark; do not claim a performance improvement or stable 60 FPS.

Screenshots and comparison: `docs/screenshots/west-market-*`. Local test scripts and detailed logs remain in the task's `work/` directory.
