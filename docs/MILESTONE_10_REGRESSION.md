# Milestone 10 consolidation regression checklist

Use this checklist before changing Milestone 10 from 🟡 to ✅. Record browser, operating system, viewport, render quality, input device and commit SHA.

## Automated prerequisites

- `npm test` passes.
- `npm run test:browser` passes in Chromium.
- GitHub Actions unit and browser-smoke jobs pass on the same commit.
- `window.NBD_RUNTIME_DIAGNOSTICS.snapshot().conflicts` is empty.
- `GameScene.update` reports `GameplayRuntime` as its owner.
- Source-ownership tests find no loaded legacy runtime stack.

## Required browser configurations

1. Chromium, approximately 1366 × 768, Low quality.
2. Chromium, approximately 1920 × 1080, Ultra quality.
3. Firefox or Safari/WebKit at one desktop viewport.
4. A viewport at or below 720 CSS pixels.
5. Resize from wide to narrow and back during a run.
6. Mouse wheel and trackpad when available.
7. One pass with reduced-motion enabled.
8. One keyboard-only UI pass.

## Boot and runtime ownership

Check both `/` and `/phaser/`:

- One Phaser canvas is created.
- The intro modal is visible and the game world is paused.
- Closing the intro starts the narrative tutorial exactly once.
- No duplicate dialogue, objective arrow, weapon HUD or task reveal appears.
- Browser console has no uncaught exceptions or module 404s.
- Runtime diagnostics contain every expected system once.
- Runtime diagnostics contain no owner conflicts.
- The old `__nbdInputRuntimePatch`, `__nbdMovementRuntimePatch` and `__nbdMilestone8AiPatch` prototype flags are absent.
- Reloading and changing render quality do not create a second game/runtime.

## Input and locks

- WASD/arrows run.
- Shift moves quietly.
- Space only traverses.
- E performs non-traversal interactions.
- Left mouse uses the equipped weapon.
- Right mouse drains valid targets.
- Wheel changes exactly one weapon slot.
- Dialogue click advances exactly one bubble and never becomes an attack.
- Escape advances dialogue, then later closes pause/mission UI normally.
- Pause, task reveal, transitions, hit stun and drain clear pending world input.
- Blur/focus loss does not replay a key, click or wheel event later.
- The published binding snapshot matches default controls.
- A programmatically supplied custom binding is honored by a fresh `InputSystem` instance.

## Narrative tutorial

- Intro zoom keeps the player visible.
- Player speaks before the sire.
- Sire explains the journalist and police-roof informant in short segments.
- Zoom-out remains centred on the player without a final camera snap.
- Only movement/Space is available before the thug encounter.
- Thug says `I won't let you pass` before the sire orders his removal.
- Thug becomes hostile after the first confirmed hit.
- Four unarmed hits down the thug.
- RMB drain is unavailable while the thug stands and valid when down.
- Hunger/veil lesson follows the drain.
- Informant gives only location and description information.
- Final sire advice follows the informant.
- Informant leaves and disappears.
- Full controls and first-use weapon guidance unlock afterward.
- Tutorial state ends as `complete` and cannot restart.

## Task reveals and mission order

- Collecting the informant tip does not interrupt the informant/final-sire sequence with Task 2.
- Task 2 waits until the tutorial is complete.
- Every reveal zooms into the player, remains readable, then returns smoothly.
- Gameplay input is blocked for the reveal and restored afterward.
- Queued reveals play once and in order.
- Handling the journalist changes the objective to return to the refuge.
- The journalist's death/drain does not complete the mission.
- At the refuge, the sire approval bubble appears first.
- `REPORT ACCEPTED` appears only after dismissing that bubble.
- No tutorial/task/weapon guidance remains over the report.

## AI and perception regression

- Police sight overrides a heard-only `WTF` state.
- Hearing alone never starts pursuit or reporting.
- One police officer attacks while others use containment positions.
- Attack leadership changes after the finite turn or attacker loss.
- Downed/draining officers do not count toward active response units.
- Police violence still escalates 1 → 2 → 3.
- Level 3 still deploys the helicopter.
- Civilians/journalist react, flee and report only after visual confirmation.
- Stagger pauses a witness; downing cancels the report.
- Hunter prediction and memory through shadow remain functional.
- Police and hunter recovery timers and restored resilience remain exact.
- Footstep, melee, gunshot, drain, roof-drop and streetlight reactions preserve sight-versus-hearing rules.

## Combat, weapons and props

- Mouse aim remains aligned at every zoom and after resizing.
- High-contrast aim changes presentation only, not hit geometry.
- Unarmed, pipe and pistol damage remain 1, 2 and 3.
- Pistol ammo starts at 8, decrements once per shot and never becomes negative.
- The nearest aligned NPC/prop blocks farther hitscan candidates.
- Buildings block hitscan.
- Streetlights break from one valid hit and remain dark.
- E never exposes streetlight destruction.
- Melee violence does not duplicate witness/exposure reactions.
- Police neutralization cannot count twice for the same officer.

## Spatial and rendering performance

Use browser performance tools and runtime diagnostics:

- Spatial index size matches the active NPC collection after spawns/removals.
- Nearby interactions, drain, footsteps and combat still find edge-of-radius candidates.
- No duplicate candidate appears from multiple spatial buckets.
- NPCs outside the camera margin hide and return correctly.
- Downed/recovery labels hide off-camera and on other layers.
- Surrounding-city graphics are not rebuilt every frame.
- Registry writes and mission/interaction DOM replacements do not increase continuously when the visible state is static.
- Average frame time remains stable during a 60-second level-3 police encounter.
- No progressive memory growth appears after repeated task reveals, dialogue and scene pauses.

## UI and accessibility

- Weapon HUD, powers and contextual prompt remain separated.
- Hunger, wanted and weapon accessible labels update only when their values change.
- Mission and Menu `aria-expanded` values are correct.
- Pause controls remain keyboard focusable.
- High-contrast aim toggle persists across reload when storage is available.
- Reduced-motion removes non-essential UI/tutorial transitions.
- Runtime/performance diagnostics shown in the pause report do not overflow narrow layouts.
- Both playable routes expose current control copy and render-quality terminology.

## Pass criteria

Milestone 10 may be marked ✅ only when:

- automated unit and Chromium smoke suites pass on the target commit;
- both playable routes pass the boot/runtime checks;
- the complete mission passes with the required narrative order;
- no loaded method has competing owners;
- input locks and dialogue clicks do not leak;
- police, witnesses, hunters, weapons, props and recovery match existing rules;
- resize/render-quality combinations pass;
- no significant performance or memory regression is observed;
- keyboard/accessibility checks pass or limitations are explicitly recorded.
