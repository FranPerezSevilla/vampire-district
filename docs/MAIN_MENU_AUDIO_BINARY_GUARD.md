# Main menu audio binary guard

The title flow is intentionally gated on a real user gesture while the splash remains visible.

Acceptance invariants:
- `PRESS ANY KEY TO START` remains on the splash after loading completes.
- A key, click or touch is the user gesture that starts the title music.
- The splash does not reveal the main menu until `HTMLMediaElement.play()` has succeeded.
- Runtime uses `phaser/assets/audio/music/main-menu-theme-01.mp3`, not the earlier truncated M4A transport.
- The browser MP3 must be larger than 100 KB and the validated OGG source must be exactly 122,360 bytes with SHA-256 `0dabd4d991b4ef579f53c32489d992dd689612693035192af981f3ead1fcbd24`.
- `NEW NIGHT` fades/stops the title music before gameplay.

`tests/main-menu-audio-binary.test.js` fails closed if the binary is absent/truncated or if the splash no longer owns the audio gate.
