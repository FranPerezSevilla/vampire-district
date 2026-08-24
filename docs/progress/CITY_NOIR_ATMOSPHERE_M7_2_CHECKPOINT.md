# City Noir Atmosphere — M7.2 checkpoint

Date: 2026-08-24  
Branch: `agent/city-noir-atmosphere`  
PR: #72  
Milestone slice: **M7.2 — steam/smoke service effects**

## Result

M7.2 is complete. ViceBlood now has a sparse, presentation-only steam/smoke layer anchored to the service-strip semantics already established by M5.

The implementation deliberately does **not** introduce a generic particle framework, global fog layer, new authored world markers, gameplay state, collision, AI, Heat, traffic, police or mission logic.

## Runtime authority

`phaser/src/policies/CityServiceSteamPresentationPolicy.js`

The policy:

- derives candidates from existing M5 `service-strip` grime descriptors;
- limits eligible profiles to industrial/warehouse service contexts;
- selects a stable deterministic global source set before camera culling;
- uses local render bounds only to hide distant selected sources;
- renders through one lightweight Phaser `Graphics` object;
- animates deterministic puff geometry from time without spawning particle emitters.

### Hard presentation bounds

- maximum sources: **3**;
- maximum puffs per source: **3**;
- maximum simultaneous puff budget: **9**;
- maximum alpha: **0.18**;
- lifetime: **2800 ms**;
- plume distance: **34 px**;
- drift distance: **7 px**.

The current representative warehouse source uses the lighter steam variant (`maxAlpha = 0.14`); industrial sources may use the darker smoke variant (`maxAlpha = 0.10`).

## Tests and evidence

Focused test:

- `tests/city-service-steam-presentation.test.js`

Gameplay-scale browser evidence remains inside the existing grime review so M7.2 does not add another complete browser boot:

- `tests/browser/city-grime-review.spec.js`

Final validated runtime head:

- `f9c1c78a86c3e34c7b733ecff5a66ea0c3b8dde6`

Final CI:

- `Tests` run **32705536855** — success;
- `City atmosphere review` run **32705536822** — success;
- atmosphere artifact **9512382899**.

Evidence captures:

- `m7-service-steam-a.png` — sampled at 900 ms;
- `m7-service-steam-b.png` — sampled at 1600 ms;
- `m7-steam-dark-control.png` — distant control.

Manifest observations for the representative frame:

- target: `blackwater:block:01`, warehouse service steam;
- visible selected sources at the target: **1**;
- visible puffs: **3**;
- the two sampled frames have different puff positions/radii/alpha;
- dark control: **0 sources / 0 puffs**.

## Review failure and correction

The first M7.2 atmosphere run failed at:

`expect(steamA.visiblePuffCount).toBeGreaterThan(0)`

The runtime was already drawing the steam correctly; the failure screenshot visibly contained the plume. The evidence harness read `camera.worldView` immediately after `camera.centerOn()`, before Phaser's next `preRender` refreshed that cached rectangle, so it compared the puffs against the previous camera view.

Commit `f9c1c78a86c3e34c7b733ecff5a66ea0c3b8dde6` fixes only the review harness: visibility is now calculated from the known capture center plus camera dimensions/zoom. No production M7.2 behavior changed.

## Visual assessment

Accepted for M7.2.

The effect is deliberately small: a few soft puffs close to a service frontage are visible at normal gameplay scale, the animation changes between frames, and unrelated/dark areas remain clean. It reads as local building exhaust rather than a city-wide smoke or fog system and does not compete with characters, vehicles, road readability or M3 lighting accents.

## Next bounded task

**M7.3 — contextual micro-scenes** is next, but it is **awaiting user direction**.

Do not begin M7.3 automatically and do not combine it with M8 district colour/material identity.
