# Vampire District

**Vampire District** is a Phaser 3 top-down vampire stealth-action vertical slice for the browser. The player crosses rooftops, streets and sewers, manages Hunger and the veil, evades escalating police pressure and silences a journalist before the clan is exposed.

Open `index.html` through a local/static web server, or use the published GitHub Pages build when available. ES modules will not work reliably through every browser's `file://` mode.

## Current playable features

- Responsive Phaser build with selectable internal render quality.
- Street, rooftop and sewer traversal.
- Narrative tutorial with speaker-anchored dialogue.
- Hunger, feeding and vampire powers.
- Civilian and police vision/hearing reactions.
- Wanted escalation, pursuit, arrest and helicopter support.
- Police informant, journalist objective and sire report.
- Action-based gameplay `InputSystem` with tested responsive pointer mapping.

## Current controls

- WASD / arrows: move.
- Hold Space: run in the current build.
- Space near a route: jump, climb, descend or use a sewer entrance.
- E: interact.
- Q: Shadow Dash.
- R: Vampiric Whisper.
- F: Blood Sense.
- M: mission panel.
- H: menu/help.
- Escape: advance dialogue or close the active UI layer.

The target combat scheme adds mouse aim, left-click attacks, right-click draining, wheel weapon selection and traversal-only Space. See [`docs/CONTROL_SCHEME.md`](docs/CONTROL_SCHEME.md).

## Tests

The project uses Node's built-in test runner and has no test dependencies:

```bash
npm test
```

## Documentation

Start with [`docs/README.md`](docs/README.md). The documentation set includes the current project snapshot, functional specification, technical architecture, implemented input system and dependency-ordered roadmap.
