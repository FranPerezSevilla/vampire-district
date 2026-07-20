# Runtime consolidation

_Status: Milestone 10 runtime consolidation and physical patch cleanup complete; final manual release-candidate acceptance remains pending._

## Purpose

Milestones 1–9 were implemented rapidly through a mixture of first-class systems and prototype adapters. That approach supported iteration, but it allowed several files to replace the same scene or system methods depending on import order.

The playable build now uses explicit composition:

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

The old combat, movement, AI, perception, tutorial, objective, weapon-UI and task-camera patch stacks have been physically removed from the repository's active source tree.

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
- `phaser/src/app-bootstrap.js` — deterministic Phaser, layout, tutorial and RC-test bootstrap.

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

The browser exposes:

```js
window.NBD_RUNTIME_DIAGNOSTICS.snapshot()
```

The snapshot contains owners, registered systems, conflicts and recent frame-timing statistics.

## Input remapping groundwork

`phaser/src/input/bindings.js` defines the keyboard-binding contract and local-storage format:

```text
nbd-input-bindings-v1
```

`InputSystem` consumes normalized bindings at construction and publishes its binding snapshot. Pure helpers support:

- normalization;
- readable labels;
- conflict detection;
- save/load/reset;
- custom movement, quiet, traversal, interaction and power keys.

Mouse buttons and wheel remain fixed actions in the current slice. A full player-facing rebinding screen is deferred.

## Spatial and rendering performance

### NPC spatial hash

`NpcSystem` rebuilds one layer-aware `SpatialHash` after world movement. Radius and rectangle queries reduce repeated full-list scans in:

- melee and hitscan candidate gathering;
- drain targeting and drain-hearing reactions;
- footsteps;
- weapon-impact and gunshot hearing;
- witness visibility candidate selection;
- police separation and surrounding checks;
- nearby interactions.

Exact distance checks still run after bucket lookup, so the index changes candidate cost rather than gameplay rules.

### Camera culling

NPC containers and high-frequency combat/perception markers hide outside a camera margin. The surrounding-city backdrop remains one cached graphics object rather than being rebuilt each frame.

### Change-aware registry and DOM

`RegistryPublisher` skips registry writes whose primitive or JSON-stable value has not changed. `UIScene` avoids replacing mission and interaction markup when generated HTML is unchanged.

This reduces data-change events, DOM work and assistive-technology announcements without changing visible state.

## First-class feature ownership

### Narrative tutorial

`TutorialDirector` owns:

- introduction zoom and dialogue;
- speaker-anchored click/Escape bubbles;
- tutorial control modes;
- rooftop-thug encounter;
- Hunger/Veil lesson;
- police-informant conversation and departure;
- final sire advice;
- tutorial-only action filtering.

The mission owns objective progression. The tutorial calls public mission and system methods rather than replacing them.

### Task reveals

`TaskRevealSystem` listens to `mission:step-changed`. If the informant/tutorial sequence remains active, Task 2 waits until full control returns. This preserves narrative order without patching `MissionSystem.setStep`.

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
→ report dismissed
→ armed free roam resumes
```

### Objective arrow and outskirts

`ObjectiveMarkerSystem` owns the player-origin directional arrow until the informant tip is collected. `OutskirtsSystem` owns the extended city backdrop, cinematic camera bounds and the sire warning when the player pushes against the district boundary.

## Automated browser coverage

The Playwright Chromium release-candidate suite covers both `/` and `/phaser/`:

- Phaser boot and canvas visibility;
- one runtime with no owner conflicts;
- required first-class system composition;
- spatial index and published binding snapshot;
- intro release and click-driven dialogue ownership;
- stable intro camera zoom-in/dialogue/zoom-out order;
- killed and drained journalist golden paths;
- sire dialogue before `REPORT ACCEPTED`;
- post-report weapon cycling, drain availability and unarmed impacts;
- police alert 1 → 2 → 3, helicopter and duplicate-neutralization protection;
- police recovery;
- visual witness versus heard-only response;
- input locks during pause, dialogue and task reveals;
- Low and Ultra render-quality presets;
- wide, narrow and resized viewports;
- high-contrast aim and semantic HUD state;
- sustained level-three structural/performance smoke;
- uncaught browser errors.

GitHub Actions runs unit tests first and then the browser suite. Playwright reports and traces are retained on browser failure. Unit failures retain `unit-test.log` for seven days.

## Source ownership and physical cleanup

`tests/source-ownership.test.js` prevents accidental reintroduction of the prototype stack. It verifies that:

- all retired patch and compatibility files are absent;
- `main.js` does not replace scene prototypes;
- `GameScene` delegates one update loop to `GameplayRuntime`;
- task reveal, sensory awareness, objective marker and outskirts are first-class runtime systems;
- both playable routes use one pinned `app-bootstrap.js` path;
- `app-bootstrap.js` imports the active responsive layout directly.

The cleanup removed the former:

- input runtime and movement/tutorial adapters;
- Milestone 5 and 6 runtime patches;
- combat compatibility and police-alert patches;
- Milestone 8 AI runtime and guards;
- Milestone 7 weapon UI and Milestone 9 UX runtime;
- tutorial-flow, tutorial-copy and dialogue-order patch files;
- old final-report and mission-finale wrappers;
- old objective-marker, district-outskirts and sensory-awareness files;
- no-op compatibility bootstraps.

Tests that existed only to exercise deleted wrappers were removed or rewritten against the first-class systems.

## Validation state

The physical cleanup passed together on GitHub Actions source `7e311aa1119603c5b7cdca5040ee8a90699dd0a5`:

```text
unit-tests    ✅
browser-smoke ✅
```

Manual release-candidate acceptance still covers physical mouse/trackpad behaviour, normal-timing runs on both routes, a longer level-three memory inspection and one screen-reader/browser combination.

## Known limitations

- The spatial hash is rebuilt once per simulation frame rather than incrementally updated.
- Hitscan world obstruction still uses the navigation line-clear query.
- The current rebinding work is storage/API groundwork, not a complete player-facing remapping screen.
- Dense downed-enemy labels can still overlap.
- Performance timing in `RuntimeDiagnostics` is an in-browser sample, not a full profiler.
- Physical-device and assistive-technology validation remains manual.
