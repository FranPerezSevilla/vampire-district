# Browser integration test families

ViceBlood keeps real Chromium/Playwright integration coverage, but CI groups browser specs by the subsystem whose contract they primarily validate. The goal is triage: a failing GitHub Actions job should say `browser-traffic`, `browser-police`, and so on instead of only identifying an arbitrary shard.

## Canonical ownership

`tests/browser/suites.json` is the ownership manifest for browser specs. Every `tests/browser/*.spec.js` file must belong to exactly one canonical suite. `npm run check:browser:suites` verifies that:

- every browser spec is owned;
- no spec has two canonical owners;
- every manifest entry exists;
- every canonical npm script exists; and
- the manifest and the explicit spec list in that npm script match.

The generic `test:browser` command is intentionally not a canonical owner. `test:browser:golden` remains a compatibility alias for the campaign baseline and is also not a second owner. Special suites such as boot, campaign, and building review are represented explicitly in the manifest rather than hidden in an exclusion list.

CI runs the ownership guard with the unit job so a newly-created orphan spec fails before the browser jobs start.

## Suite responsibilities

| Suite | Responsibility | Local command |
| --- | --- | --- |
| Unit | Fast isolated logic/data contracts without a real browser. | `npm run test:unit` |
| Browser boot | Startup, presentation, accessibility and entry/slice smoke coverage. It answers “can the playable runtime boot and present its basic surface?”. | `npm run test:browser:boot` |
| Browser world | City/topology/streaming/entity/resource/territory integration and world acceptance. | `npm run test:browser:world` |
| Browser traffic | Vehicle lifecycle, routing, junction behavior, physics, impacts, hijacking and visibility/retention. | `npm run test:browser:traffic` |
| Browser police | Police pursuit/stress/recovery plus heat, exposure and evidence integrations whose primary failure signal is policing/attention. | `npm run test:browser:police` |
| Browser gameplay | Player-facing systemic mechanics such as input locks, feeding, hunting law, ledger, predator powers and weapon-cycle feedback. | `npm run test:browser:gameplay` |
| Browser performance | Explicit runtime performance sampling and capture. It remains separate because it emits performance evidence in addition to pass/fail assertions. | `npm run test:browser:performance` |
| Browser campaign | Longer free-roam/campaign-state baseline. It is intentionally separate from subsystem integration loops. | `npm run test:browser:campaign` |
| Browser building review | Special visual-review workflow for the dedicated building-review use case. Do not fold it into the normal integration matrix. | `npm run test:browser:building-review` |

`npm run test:rc` runs unit coverage, the ownership guard, boot, all subsystem families, performance, and campaign in sequence.

## How to classify a new spec

Choose the family that best describes the **primary contract and first triage destination when the test fails**, not every system touched by the scenario. Integration tests are allowed to cross subsystem boundaries.

Examples of deliberate choices:

- `expanded-district.spec.js` is `browser-world`: it touches population, evidence and a vehicle impact, but its contract is acceptance of the expanded district as a coherent world slice.
- `city-streaming-macro.spec.js` is `browser-world`: it observes abstract traffic and dormant police while validating macro streaming behavior.
- `perception-recovery.spec.js` is `browser-police`: its generic perception pieces support the police recovery contract.
- `heat-exposure-evidence.spec.js` is `browser-police`: the mechanics cross gameplay/ledger boundaries, but their primary integration result is attention/police pressure.
- `territory-runtime.spec.js` is `browser-world`: persistent territorial authority and district entry are world-state contracts.

If no existing family describes the primary contract, do not create a catch-all bucket. Decide whether a genuinely new durable family is warranted and update this document, the manifest, package scripts and CI together.

## Current mapping

### browser-world

- `road-graph-geometry.spec.js` — road graph geometry and pedestrian surfaces.
- `city-topology-v2.spec.js` — topology/district bounds and road corridors.
- `expanded-district.spec.js` — cross-system district acceptance.
- `foundry-runtime.spec.js` — Foundry street/roof/sewer world integration.
- `building-sidewalk-clearance.spec.js` — building footprint versus sidewalk clearance.
- `territory-runtime.spec.js` — persistent territory/district world state.
- `city-streaming.spec.js` — chunk activation, prefetch and deltas.
- `city-streaming-resources.spec.js` — streamed resource packs and dormant resource behavior.
- `city-streaming-macro.spec.js` — macro/dormant world streaming.
- `entity-streaming.spec.js` — active/dormant entity streaming.

### browser-traffic

- `vehicle-core.spec.js`
- `vehicle-maintenance.spec.js`
- `city-streaming-traffic.spec.js`
- `city-streaming-traffic-behavior.spec.js`
- `city-streaming-traffic-physics.spec.js`
- `city-streaming-traffic-impact.spec.js`
- `traffic-hijack.spec.js`
- `traffic-visibility-retention.spec.js`
- `vehicle-collision-softening.spec.js`

Traffic consumes compiler-owned topology. Its npm command runs `npm run city:topology` before Playwright so local reproduction and CI use the same prerequisite preparation.

### browser-police

- `motorized-police.spec.js`
- `perception-recovery.spec.js`
- `police-stress.spec.js`
- `heat-exposure-evidence.spec.js`

### browser-gameplay

- `input-locks.spec.js`
- `hunting-law-runtime.spec.js`
- `night-ledger.spec.js`
- `feeding-depths.spec.js`
- `predator-powers.spec.js`
- `weapon-cycle-feedback.spec.js`

`weapon-cycle-feedback.spec.js` existed before this split but was not referenced by any explicit CI browser suite. It is now deliberately owned by gameplay; the ownership guard prevents that class of omission from recurring.

### browser-performance

- `runtime-performance-capture.spec.js`

Before the split this spec was both inside `browser-systems` and exposed through `test:browser:performance`. It now has one canonical owner and one CI execution path.

## Adding a browser spec

1. Add `tests/browser/<name>.spec.js` normally; keep real Playwright/Chromium integration coverage when that is what the behavior requires.
2. Choose one canonical family using the primary-contract rule above.
3. Add the spec path to that family in `tests/browser/suites.json`.
4. Add the same explicit path to the matching `test:browser:<family>` npm script.
5. Run `npm run check:browser:suites`.
6. Run the chosen family locally. If the change can affect startup or long-lived campaign state, also run boot/campaign as appropriate.

A missing step 3 or 4 is a CI failure rather than a silently untested browser spec.

## CI layout and diagnostics

The normal subsystem jobs use one semantic matrix with `world`, `traffic`, `police`, and `gameplay`. Performance stays separate because it always publishes `.artifacts/performance/runtime-performance-capture.json`. Boot and campaign remain separate jobs. The building-review job keeps its dedicated purpose and trigger.

The semantic families are currently small enough that they are not sharded. If a family grows enough for sharding to materially help wall-clock time, shard **inside that family** (for example `browser-traffic (shard 1/2)`) rather than recreating a cross-domain bucket.

On failure each family uploads a family-named diagnostics artifact containing its captured log plus `playwright-report/` and `test-results/` when present. Playwright's configured traces, screenshots and retained failure videos remain inside its normal result/report outputs. Performance capture is uploaded independently even when the performance job fails.
