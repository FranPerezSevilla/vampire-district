# New Night handoff — 2026-09-12

Authority: Phaser owns Scene injection and CREATE; UIScene owns the in-game
DOM/command boundary; MainMenuScene owns the title-to-game handoff; the title
owns its single media element. InputSystem remains the only world input reader.

Scope: UIScene, MainMenuScene, initial React mount, title audio playback/gate,
UI harness and focused handoff/audio/compiled-scene regressions.

Reproduction: inject `game` using pinned Phaser PluginManager.addToScene. The
old UIScene.game() helper is replaced by Phaser's Game instance, so refresh()
throws `this.game is not a function`. Prior native fixtures omitted that global
injection and the compiled-module smoke stopped before scene creation.

Acceptance: keep engine-owned properties intact; boot UI before hiding title;
handle queued CREATE, duplicate start, setup failure and shutdown; reveal HUD,
release only the title's input lock, restore canvas focus and stop title audio
at completion even if its animation callback never runs. Preserve fast packed
loading, camera composition, real gameplay guards, campaign and saved games.

Validation uses actual pinned injection and SceneManager CREATE with native
DOM/media/scene-plugin fixtures. It is not a WebGL/FPS or browser visual test.
Browser execution remains excluded. Do not merge PRs or change main.
