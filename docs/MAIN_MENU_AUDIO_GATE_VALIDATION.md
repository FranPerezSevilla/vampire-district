# Main menu audio gate validation

The main-menu music integration now explicitly handles browser autoplay restrictions.

Validation target:
- open the PR #55 Netlify deploy preview;
- if autoplay is blocked, `PRESS ANY KEY TO START` must appear over the menu;
- press a normal key, click, or tap;
- the gate must disappear only after audio playback successfully starts;
- the Satie menu theme must continue looping;
- selecting `NEW NIGHT` must fade the theme out over 430 ms;
- leaving the menu must not leave the theme playing in gameplay.

The feature code is in `phaser/src/main.js`; focused structural regression coverage is in `tests/main-menu-music.test.js`.
