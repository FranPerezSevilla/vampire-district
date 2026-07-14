# Night Blood District — Incremental Phaser Migration Roadmap

This is the migration plan from the current vanilla Canvas prototype to Phaser. The rule is simple: migrate one playable slice at a time. The current `index.html` + `js/game.js` remains the fallback until the Phaser version is clearly better.

## Migration philosophy

Do not do a rewrite for its own sake.

The objective is not “use Phaser”. The objective is:

- stop accumulating fragile patch code in one huge `game.js`;
- separate data from systems;
- make traversal, interaction, UI, and AI easier to reason about;
- preserve the current functional identity of the game;
- get a stable playable build after every step.

Phaser is valuable here because it gives us a scene model, loader, camera, input system, animation support, audio integration, and game loop structure. We will use it where it helps, not blindly.

## Proposed repository structure

Keep legacy prototype intact:

```txt
index.html
js/game.js
css/styles.css
```

Add Phaser prototype in parallel:

```txt
phaser/
  index.html
  src/
    main.js
    scenes/
      BootScene.js
      GameScene.js
      UIScene.js
    data/
      district.js
      traversal.js
      npcs.js
      balance.js
    systems/
      PlayerController.js
      InteractionSystem.js
      TraversalSystem.js
      VisibilitySystem.js
      ExposureSystem.js
      MissionSystem.js
      NpcSystem.js
      EvidenceSystem.js
      AudioSystem.js
    objects/
      Player.js
      Npc.js
      Body.js
      LightPost.js
      BloodStain.js
```

Initial `phaser/index.html` can load Phaser from CDN for simplicity. Later, if the project grows, move to npm/Vite.

## Version choice

Use Phaser 3 or Phaser 4 deliberately, not by accident.

Recommendation for this prototype:

- Start with Phaser 3.90 or stable Phaser 4 only after checking examples/API stability.
- If using CDN, lock the version explicitly.
- Do not use `latest` in production-like builds.

Reasoning:

- Phaser 3 is mature and heavily documented.
- Phaser 4 is newer and promising, but for a migration our priority is stability and available examples.

Decision point before coding scaffold:

- Use Phaser 3.90 for the first migration pass unless there is a strong reason to use Phaser 4.

## Phase 0 — Freeze current design

Status: started.

Deliverables:

- `docs/phaser-functional-inventory.md`
- `docs/phaser-migration-roadmap.md`

Exit criteria:

- We agree what must survive the migration.
- We agree that the old prototype remains playable while the Phaser version is built.

## Phase 1 — Phaser shell, no gameplay rewrite

Goal:

Create a parallel Phaser entrypoint without touching the legacy build.

Deliverables:

```txt
phaser/index.html
phaser/src/main.js
phaser/src/scenes/BootScene.js
phaser/src/scenes/GameScene.js
phaser/src/scenes/UIScene.js
phaser/src/data/balance.js
phaser/src/data/district.js
```

Game content:

- Render world background.
- Render two avenues and alleys.
- Render buildings.
- Render roof rectangles.
- Render sewer rectangles.
- Render player as placeholder rectangle/sprite.
- Move player with WASD/arrows.
- Camera follows player.

No NPCs yet.
No feeding yet.
No mission yet.
No exposure yet.

Exit criteria:

- `phaser/index.html` runs on GitHub Pages.
- Player can move around a Phaser-rendered district.
- Legacy prototype still works.

## Phase 2 — Physical layers and refuge done correctly

Goal:

Solve the thing that is currently messy: refuge, roofs, street, sewer.

Rules:

- No `player.inSafehouse` freeze-state.
- Refuge is a physical high-roof zone.
- Standing in the refuge affects detection and mission, but does not disable movement.
- Street, low roof, high roof, and sewer are clear layers.

Deliverables:

```txt
phaser/src/systems/TraversalSystem.js
phaser/src/data/traversal.js
```

Gameplay:

- Manhole street ↔ sewer.
- Private sewer shaft → rooftop refuge.
- Fire escape street ↔ roof.
- Refuge high roof ↔ lower refuge roof.
- Drops from roof to street.
- Basic jump nodes between roofs.

Exit criteria:

- Player cannot become trapped in the refuge.
- Player can move from refuge to street and back through at least two routes.
- Every traversal action is explicit and readable.

## Phase 3 — Interaction modal

Goal:

Build the interaction model before adding systems that depend on it.

Deliverables:

```txt
phaser/src/systems/InteractionSystem.js
phaser/src/scenes/UIScene.js
```

Rules:

- E collects all available actions.
- If one action, execute it.
- If multiple actions, open paused choice menu.
- UI shows label and risk detail.
- Esc cancels.

Possible interaction action shape:

```js
{
  id: 'jump_roof_market',
  label: 'Jump to market roof',
  detail: 'route',
  priority: 30,
  run: () => traversal.jump(...)
}
```

Exit criteria:

- Modal cannot freeze the player permanently.
- Modal works for overlapping fire escape / jump / drop nodes.
- Menu input does not leak into player movement.

## Phase 4 — Mission skeleton

Goal:

Recreate the mission flow without combat systems.

Gameplay:

- Start at rooftop refuge.
- Objective points update.
- Reach club.
- Return to rooftop refuge.

No feeding yet; use placeholder “complete objective” interaction for the journalist.

Exit criteria:

- Mission can be completed in Phaser from start to report using placeholder interactions.
- Mission text and status are readable.

## Phase 5 — NPC basics

Goal:

Add NPCs without advanced AI.

NPC types:

- civilian;
- journalist/target;
- police placeholder;
- hunter placeholder;
- rat.

Features:

- Spawn positions from data.
- Basic idle/wander.
- Layer awareness.
- Simple collision/avoidance only if needed.

Exit criteria:

- NPCs appear on correct layers.
- Player can approach target.
- Rats appear in sewer.

## Phase 6 — Feeding and hunger

Goal:

Add the core vampire loop.

Systems:

- Hunger meter.
- Feeding progress state.
- Movement cancels feeding.
- Target/civilian/rat hunger relief.
- Corpses created on completion.

Exit criteria:

- Player can feed on journalist, civilian, and rat.
- Hunger changes correctly.
- Body is created after feeding.

## Phase 7 — Witness and exposure

Goal:

Add public consequence.

Systems:

- Visibility checks.
- Witness alarm.
- Witness fleeing to report point.
- Intercept witness.
- Exposure levels.
- Public feeding forces level 2.
- Many witnesses/high hunger can push level 3.

Exit criteria:

- Feeding in public feels meaningfully dangerous.
- Feeding unseen stays viable.
- Witness behavior is visually readable.

## Phase 8 — Evidence: bodies, dumpsters, blood

Goal:

Add the cleanup loop.

Features:

- Drag body.
- Drop body.
- Hide body in dumpster/sewer/roof/refuge.
- Blood stains.
- Blood discovery.
- Sewer cleanup.

Exit criteria:

- Player can hide evidence.
- Visible bodies are discovered.
- Blood matters but does not overwhelm play.

## Phase 9 — Police and local heat

Goal:

Add GTA-like escalation.

Features:

- Local heat zones.
- Police spawn from station.
- Police investigate noise, reports, blood.
- Police chase on level 2+.

Exit criteria:

- Police response starts from station and feels spatially grounded.
- Player can escape using rooftops/sewers.

## Phase 10 — Hunters

Goal:

Add supernatural counter-pressure.

Features:

- Hunters spawn/emerge from church anchor.
- Hunters react to high exposure, brutal blood, supernatural mistakes.
- Hunters can block routes.

Exit criteria:

- Hunters feel different from police.
- They appear later and more ominously.

## Phase 11 — Blood Sense, powers, polish

Features:

- Blood Sense overlay.
- Shadow Dash.
- Whisper/lure.
- Better labels.
- Audio port.
- Feedback integration.

Exit criteria:

- Phaser build reaches feature parity with the legacy prototype.
- Legacy build can be archived or removed.

## Migration safety rules

1. Never delete legacy until Phaser build is clearly better.
2. Every phase must have a playable build.
3. Prefer data files over hardcoded coordinates inside systems.
4. No major AI before traversal and interaction are stable.
5. No asset polish before rules are stable.
6. Keep the visual style placeholder-friendly.
7. If a Phaser feature adds complexity, do it manually first.

## First coding task after this document

Create the Phaser shell in parallel:

```txt
phaser/index.html
phaser/src/main.js
phaser/src/scenes/BootScene.js
phaser/src/scenes/GameScene.js
phaser/src/scenes/UIScene.js
phaser/src/data/balance.js
phaser/src/data/district.js
```

Scope of first coding task:

- Load Phaser.
- Create a game instance.
- Draw roads/buildings/roofs/sewers from data.
- Draw a player rectangle.
- Move player.
- Camera follows.
- No gameplay systems yet.

This is the right first step because it validates the new architecture without risking current gameplay.
