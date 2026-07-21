# City Compiler 2 — Foundry Ward pilot

_Last updated: 2026-07-21_

## Status

**🟡 Candidate generation and ranking are implemented. The playable city remains unchanged until a candidate is selected and integrated in a later PR.**

The Foundry pilot proves that the City Compiler can produce several deterministic, hard-valid alternatives for one district while preserving the rest of the authored city.

## Command

```bash
npm run city:foundry
```

Custom generation:

```bash
npm run city:foundry -- \
  --seed-prefix=foundry-review \
  --count=24 \
  --top=3 \
  --output-dir=.city-compiler/foundry-pilot
```

## Output

```text
.city-compiler/foundry-pilot/
  foundry-summary.json
  foundry-comparison.svg
  candidate-01-<seed>/
    city-blueprint.json
    city-report.json
    city-debug.svg
    foundry-plan.json
  candidate-02-<seed>/
  candidate-03-<seed>/
```

CI publishes the same directory as the `city-compiler-foundry-pilot` artifact.

## Isolation boundary

Generation starts from the current city blueprint and changes only Foundry-owned structures in the candidate data.

Preserved:

- every district outside Foundry;
- the Old Quarter and opening mission geometry;
- all global arterial roads;
- campaign landmarks;
- `harborRegistry`, because it is a protected narrative landmark on the Foundry/Harbor edge;
- existing save-facing runtime data, because no candidate is loaded by the game yet.

Replaced or added inside the candidate:

- Foundry buildings;
- local service alleys;
- local sidewalks and crossings;
- Foundry streetlights and dumpsters;
- a parked utility vehicle socket;
- a pedestrian works loop;
- a rooftop network;
- two sewer accesses;
- dark service routes.

## Deterministic grammar

A seed controls bounded choices rather than arbitrary noise:

- position and width of the north industrial yard;
- position of the east service link;
- compact machine-shop and loading-bay dimensions;
- block-template combinations;
- whether the lower west roof joins the main network;
- utility vehicle archetype and orientation.

Semantic IDs remain identical across seeds:

```text
foundry:road:north-yard
foundry:block-02:west-works
foundry:roof-route:west-east
foundry:sewer-access:central
foundry:vehicle:utility
```

Selecting another seed therefore changes layout without inventing a different persistence vocabulary.

## Generated road loops

Every candidate contains two explicit vehicle loops.

### West yard loop

```text
Foundry Avenue
→ North Service Lane
→ Harbor Back Lane
→ generated north drop
→ generated north yard
→ Foundry Avenue
```

This is the tighter industrial-yard pursuit loop.

### East service loop

```text
Harbor Back Lane
→ generated east service link
→ Harbor Avenue
→ Saint Orison Boulevard
→ Harbor Back Lane
```

This is the faster and wider pursuit loop.

The loops use existing arterial roads as stable anchors and generate only the local connectors needed to close them.

## Generated block language

The pilot adds two compact templates to the catalog:

```text
machine-shop-row-a
loading-bay-a
```

They exist because the current Foundry strip is too narrow for the original large warehouse and factory templates.

Every candidate places five stable blocks:

```text
north machine shop
west works
 east loading
west yard
 east works
```

Template family and dimensions may vary within hard footprint bounds.

## Vertical and underground traversal

Every accepted candidate requires:

- at least three roof areas;
- at least two rooftop jumps;
- two independent fire-escape endpoints;
- two sewer entrances connected to the existing Foundry sewer spine.

This directly targets the current city's weakest baseline component: vertical and underground integration.

## Systemic requirements

Every accepted candidate requires:

```text
2 vehicle chase loops
3+ roof areas
2+ rooftop routes
2 fire escapes
2 sewer entrances
3+ dark routes
4 dumpsters / hiding sockets
8 streetlights
1 parked utility vehicle
```

All generated buildings must fit their selected template footprint. New building/road overlaps remain hard failures.

## Ranking

Each candidate receives the normal global city score plus a Foundry-specific score.

Foundry components:

```text
hard validity
road-loop quality
block-family diversity
roof/sewer traversal
systemic sockets
buildable coverage
complete-city score
```

Accepted candidates must also equal or exceed the current complete-city baseline score of `82.7`.

Ranking order:

1. accepted candidates;
2. hard-valid candidates;
3. Foundry score;
4. complete-city score;
5. fewer warnings;
6. stable seed order.

## Review policy

The generator does not automatically choose the production map.

The top three candidates are shown side by side in `foundry-comparison.svg`. Human review should consider:

- whether both driving loops read clearly;
- whether the industrial yards feel different from Glasshouse and Harbor;
- whether the roof route has understandable entry and exit points;
- whether buildings form useful alleys rather than decorative gaps;
- whether the layout leaves enough room for future traffic;
- whether the preserved Harbor Registry feels naturally embedded at the eastern edge.

## Known constraint exposed by the pilot

The current `foundry` district occupies a relatively narrow strip between major vertical roads. This makes the original warehouse and factory templates too large for several parcels.

The compact templates are a deliberate response, but the comparison may show that the district boundary itself should expand or that Foundry and Harbor need to be repartitioned. That decision belongs after reviewing the generated candidates, not inside the generator.

## Next step

After selecting a candidate:

1. export its runtime arrays into a generated district module;
2. add a development-only preview boot profile for that candidate;
3. test driving, pedestrians, rooftops and sewers manually;
4. migrate stable IDs and any affected save flags;
5. replace the authored Foundry data only after acceptance.
