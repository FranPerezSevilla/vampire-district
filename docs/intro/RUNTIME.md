# Opening film and main-menu music

The title gesture gate owns the opening. Any accepted start key, pointer or touch starts `phaser/assets/video/viceblood-intro.mp4` (approved v27, 68 seconds). Escape or the Skip button stops it and presents the existing menu. Natural completion and media failure reach the same menu boundary. Cancellation removes all film handlers and prevents late playback failures from restarting music.

The existing menu audio owner now loops `phaser/assets/audio/music/after-the-last-light.wav`: an approximately 48-second original ambient piece with sparse piano-like notes, a low drone, distant metallic resonances and quiet traffic. EL remains exclusive to the film. The film and menu never intentionally play audio simultaneously. New Night retains its existing menu fade-out. The reproducible composition is in `tools/audio/create-menu-ambient.py`.

Credits show Andres Rodriguez / anrocomposer, track title, Pixabay Content License and source URL. See `phaser/assets/audio/ATTRIBUTION.md` for the ledger.

## Validation, 2026-09-16

- Six new behavioral tests: completion, Escape, button, media error, play rejection, disposal during pending playback; passed.
- Twelve existing focused title/audio checks; passed.
- Real Chromium playback of production title components with isolated bootstrap: playback, Escape, looping menu audio, credits and natural completion; passed (`node tools/dev/check-intro-browser.mjs --isolated`).
- UI build and browser-suite coverage check passed.
- Full fast suite: 1131 passed / 1134. Three failures in unchanged files: legacy repair workflow presence, CRLF-sensitive workflow expression and world-collision source expression.
- Affected-test wrapper cannot launch its npm subprocess on this Windows setup. Its selected checks were invoked directly. Full boot browser checks hit city-readiness timeouts and pre-existing render sizing assertions; bounded run stopped. Isolated title validation does not imply full-game boot validation.

Changes are local; no deployment or merge performed.
