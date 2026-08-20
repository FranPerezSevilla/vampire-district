# Vehicle roster foundation

## Goal

Make ViceBlood traffic feel like a real vehicle roster instead of three cosmetic traffic archetypes, while preserving the existing vehicle, streaming, damage and police authorities.

## In scope

- System or authority: `phaser/src/data/vehicles.js`, procedural vehicle presentation, civilian traffic materialization and motorized police vehicle selection.
- Expected files or area:
  - `phaser/src/data/vehicles.js`
  - `phaser/src/vehicles/VehicleView.js`
  - `phaser/src/streaming/TrafficMaterializationSystem.js`
  - `phaser/src/police/MotorizedPoliceSystem.js`
  - `tests/vehicle-roster.test.js`
- Required behaviour:
  - expose 15 civilian vehicle archetypes and 4 police archetypes;
  - preserve existing `compact`, `sedan`, `van` and `police` IDs for compatibility;
  - give archetypes distinct speed, acceleration, steering, durability, dimensions and presentation metadata;
  - select civilian traffic deterministically using weighted rarity;
  - keep the selected traffic archetype when the player hijacks that vehicle;
  - render recognisable top-down body styles and deterministic palette variants with the existing procedural renderer;
  - use patrol + interceptor at Heat 2 and allow a third police SUV/roadblock unit at Heat 3.

## Out of scope

- New binary sprite assets or authored texture atlases.
- Replacing the existing road graph, lane following, spawn/despawn authority or police tactic authority.
- Civilian driver personality profiles (calm/impatient/aggressive/panic) beyond the existing traffic behaviour system.
- Applying the new `mass` / `collisionPush` metadata to vehicle-vs-vehicle collision impulses.
- Deploying the unmarked police sedan at Heat 1; the archetype is defined for a later police-response slice.
- Reworking damage stages, audio families, campaign persistence or hunter investigation logic.

## Acceptance criteria

- [x] Behaviour can be demonstrated or asserted.
- [x] Existing authority remains unique.
- [x] Regression coverage exists for the changed behaviour.
- [x] Relevant documentation is updated only if its contract changed.

## Validation

Repository-wide checks are delegated to PR CI because the execution environment cannot clone GitHub over the network.

Focused validation performed before opening the PR:

- `node --check` on the expanded vehicle data module.
- `node --check` on the updated procedural vehicle renderer.
- `node --check` on the updated traffic materializer.
- isolated Node import asserts: 15 civilian + 4 police archetypes, all 15 civilian types reachable by deterministic traffic selection, Heat 2/3 police archetype mapping.
- isolated renderer smoke: all 19 archetypes paint without breaking the `body` / `hood` / `label` visual contract.
- isolated traffic lifecycle smoke based on `traffic-visibility-lifecycle.test.js`: spawn guard and pooled-slot reuse remain intact.

Pending in PR CI:

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Manual browser scenarios after CI:

1. Drive around multiple districts and confirm civilian traffic cycles through visibly different classes without spawning inside the camera guard.
2. Hijack a sports car, SUV and van; confirm each keeps its own driving characteristics.
3. Reach Heat 2 and confirm two motorized units are patrol + interceptor.
4. Reach Heat 3 and confirm the third unit is a heavier police SUV performing the roadblock role.
5. Damage a police unit and a civilian vehicle to confirm the existing `visual.hood` critical-damage contract still works.

## Delivery

- Draft PR with a focused title.
- Summary includes changed behaviour and the explicit non-goals above.
- Local isolated checks recorded here; repository CI remains authoritative.
