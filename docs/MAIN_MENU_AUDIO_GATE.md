# Main menu audio gate

Implemented on 2026-08-19 for PR #55.

Browser autoplay can reject the initial main-menu theme playback before any user gesture. The menu now treats that rejection as an explicit start gate rather than silently continuing without music.

Behavior:
- the theme first attempts normal playback;
- if autoplay is blocked, a full-canvas `PRESS ANY KEY TO START` gate appears;
- keyboard, pointer and touch interactions unlock the audio;
- modifier-only/repeated key presses do not consume the gate;
- after successful playback starts, the gate removes itself;
- `NEW NIGHT` still fades the theme out over 430 ms;
- scene shutdown removes the gate and stops the theme;
- the Satie attribution remains visible in Credits and in `phaser/assets/audio/ATTRIBUTION.md`.

Focused regression coverage lives in `tests/main-menu-music.test.js`.
