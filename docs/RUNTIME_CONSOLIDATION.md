# Runtime consolidation

_Status: Milestone 10 core implementation complete; full browser and mission regression remain pending._

## Purpose

Milestones 1–9 were implemented quickly through a mixture of first-class systems and prototype adapters. That approach was useful for iteration, but it allowed several files to replace the same scene/system methods depending on import order.

Milestone 10 moves the playable build to explicit composition:

```text
GameScene.create()
  → specialist world systems
  → GameplayRuntime
      → InputSystem
      → WeaponSystem
      → CombatSystem
      → PlayerDamageSystem
      → DrainSystem
      → MovementNoiseSystem
      → PropDamageSystem
      → SensoryAwarenessSystem
      → AiStateSystem
      → PoliceViolenceSystem
      → TaskRevealSystem
      → OutskirtsSystem
      → ObjectiveMarkerSystem
      → UxGuidanceSystem

GameScene.update()
  → GameplayRuntime.update()
```

The HTML routes no longer load the previous combat, movement, AI, perception, weapon-UI or task-camera patch stacks.

## Authoritative files

- `phaser/src/runtime/GameplayRuntime.js` — one gameplay-frame owner and update order.
- `phaser/src/runtime/RuntimeDiagnostics.js` — runtime owner claims, system inventory and frame samples.
- `phaser/src/runtime/RegistryPublisher.js` — change-aware registry publication.
- `phaser/src/utils/SpatialHash.js` — layer-aware spatial indexing for NPC queries.
- `phaser/src/scenes/GameScene.js` — direct system construction and world methods.
- `phaser/src/scenes/UIScene.js` — direct HUD, weapon UI, result report and accessibility rendering.
- `phaser/src/tutorial/TutorialDirector.js` — first-class narrative tutorial and informant sequence.
- `phaser/src/tutorial/bootstrap.js` — tutorial attachment after both scenes are ready.
- `phaser/src/systems/TaskRevealSystem.js` — objective camera reveal.
- `phaser/src/systems/ObjectiveMarkerSystem.js` — tutorial-only GTA-style directional arrow.
- `phaser/src/systems/OutskirtsSystem.js` — surrounding city and sire boundary warning.
- `phaser/src/systems/SensoryAwarenessSystem.js` — break-light and roof-drop visual/heard-only reactions.
- `phaser/src/systems/PoliceViolenceSystem.js` — progressive police-violence wanted escalation.

## Single-owner update loop

`GameplayRuntime.update()` is the sole gameplay-frame coordinator.

Frame order:

```text
InputSystem.beginFrame
→ player hit-stun filtering
→ AI pre-resolution
→ weapon selection
→ powers / player attack / drain
→ deterministic traversal and E interaction dispatch
→ player movement
→ NPC and witness simulation
→ evidence / exposure / police / hunter simulation
→ AI post-resolution
→ enemy attack and player damage
→ mission and tutorial progression
→ movement noise and compact UX guidance
→ camera / outskirts / objective marker / prompts
→ changed-state publication
```

Early exits for world locks, transitions and interaction menus still run the systems that must clear held state or visual feedback, but they do not advance the world simulation.

## Runtime ownership diagnostics

`RuntimeDiagnostics` records the expected owner of important methods. A second different owner throws immediately rather than silently replacing behaviour.

Current claims include:

- `GameScene.update` → `GameplayRuntime`
- `GameScene.updatePlayerMovement` → `GameScene`
- `InteractionSystem.sortOptions` → `InteractionSystem`
- `PowersSystem.update` → `PowersSystem`
- `NpcSystem.updateNpc` → `NpcSystem`
- `WitnessSystem.drawMarkers` → `WitnessSystem`
- `PoliceSystem.updatePolice` → `PoliceSystem`
- `HunterSystem.updateHunters` → `HunterSystem`
- `CombatSystem.notifyViolence` → `CombatSystem`
- `TaskRevealSystem.play` → `TaskRevealSystem`
- `ObjectiveMarkerSystem.update` → `ObjectiveMarkerSystem`
- `OutskirtsSystem.updatePresentation` → `OutskirtsSystem`
- `TutorialDirector.filterActions` → `TutorialDirector`

The current browser exposes:

```js
window.NBD_RUNTIME_DIAGNOSTICS.snapshot()
```

The snapshot contains owners, registered systems, conflicts and recent frame timing statistics.

## Input remapping groundwork

`phaser/src/input/bindings.js` defines the keyboard binding contract and local-storage format:

```text
nbd-input-bindings-v1
```

`InputSystem` consumes the normalized bindings at construction and publishes its binding snapshot. The current UI still presents the default bindings; a complete in-game rebinding screen is intentionally deferred. Pure helpers already support:

- normalization;
- readable labels;
- conflict detection;
- save/load/reset;
- custom movement, quiet, traversal, interaction and power keys.

Mouse buttons and wheel remain fixed actions in the current slice.

## Spatial and rendering performance

### NPC spatial hash

`NpcSystem` rebuilds one layer-aware `SpatialHash` after world movement. Radius and rectangle queries replace repeated full-list scans in:

- melee and hitscan candidate gathering;
- drain targeting and drain-hearing reactions;
- footsteps;
- weapon impact and gunshot hearing;
- witness visibility candidate selection;
- police separation and surrounding checks;
- nearby interactions.

The implementation keeps exact distance checks after bucket lookup, so the index changes candidate cost rather than gameplay rules.

### Camera culling

NPC containers and high-frequency combat/perception markers are hidden outside a camera margin. The surrounding-city backdrop remains one cached graphics object rather than being rebuilt each frame.

### Change-aware registry and DOM

`RegistryPublisher` skips registry writes whose primitive or JSON-stable value has not changed. `UIScene` similarly avoids replacing mission and interaction markup when the generated HTML is unchanged.

This reduces data-change events, DOM work and assistive-technology announcements without changing visible state.

## First-class feature ownership

### Narrative tutorial

`TutorialDirector` owns:

- introduction zoom and dialogue;
- speaker-anchored click/Escape bubbles;
- tutorial control modes;
- rooftop thug encounter;
- Hunger/veil lesson;
- police informant conversation and departure;
- final sire advice;
- tutorial-only action filtering.

The mission still owns objective progression. The tutorial calls public mission/system methods rather than replacing them.

### Task reveals

`TaskRevealSystem` listens to `mission:step-changed`. If the informant/tutorial sequence is still active, Task 2 waits until full control returns. This preserves the required narrative order without patching `MissionSystem.setStep`.

### Mission finale

`MissionSystem` directly owns the refuge finale:

```text
journalist handled
→ return objective
→ player reaches refuge
→ sire dialogue
→ dialogue dismissed
→ mission complete
→ REPORT ACCEPTED
```

### Objective arrow and outskirts

`ObjectiveMarkerSystem` owns the player-origin directional arrow until the informant tip is collected. `OutskirtsSystem` owns the extended city backdrop and the sire warning when the player pushes against the district boundary.

## Browser smoke tests

Playwright Chromium tests cover both `/` and `/phaser/`:

- Phaser boot and canvas visibility;
- one runtime with no owner conflicts;
- required system composition;
- absence of the old runtime prototype markers;
- spatial index and published binding snapshot;
- responsive canvas resize;
- intro release and click-driven dialogue ownership;
- uncaught browser errors.

The GitHub Actions workflow runs unit tests first, then installs Chromium and runs browser smoke tests. Failure artifacts retain the Playwright report for seven days.

## Automated source ownership guards

`tests/source-ownership.test.js` prevents accidental reintroduction of the old bootstrap paths. It verifies that:

- the legacy movement entry does not import core adapters;
- `main.js` does not replace scene prototypes;
- `GameScene` delegates one update loop to `GameplayRuntime`;
- task reveal, sensory awareness, objective marker and outskirts are runtime systems;
- both playable HTML routes load the first-class tutorial bootstrap rather than the old tutorial stack.

## Compatibility and removed ownership

The playable HTML no longer loads:

- `input/input-runtime.js`
- `input/movement-input-adapter.js`
- `movement/milestone5-runtime.js`
- `world/milestone6-runtime.js`
- `combat/combat-compatibility.js`
- `combat/police-alert-runtime.js`
- `ai/milestone8-runtime.js`
- `ai/police-turn-guard.js`
- `ai/sensory-priority-guard.js`
- `weapons/milestone7-ui.js`
- `ux/milestone9-runtime.js`
- the old sensory/objective/outskirts feature patches
- the old tutorial-flow and task-reveal timing patches

Some retired files may remain in repository history or as temporarily unloaded source until the cleanup commit is verified by CI. They have no ownership in the playable runtime.

## Known limitations

- Full end-to-end mission automation is not yet implemented; the current browser suite is a smoke layer.
- The spatial hash is rebuilt once per simulation frame rather than incrementally updated.
- Hitscan world obstruction still uses the navigation line-clear query.
- The current rebinding work is storage/API groundwork, not a complete player-facing remapping screen.
- Dense downed-enemy labels can still overlap.
- Performance timing in `RuntimeDiagnostics` is an in-browser sample, not a full profiler.
- Manual validation is still required for all viewport/render-quality combinations, assistive technology and the complete mission.
