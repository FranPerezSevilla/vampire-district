# Vampire District

**Vampire District** is a Phaser 3 top-down vampire stealth-action vertical slice for the browser. The player crosses rooftops, streets and sewers, manages Hunger and the veil, fights through escalating police pressure and silences a journalist before the clan is exposed.

Open `index.html` through a local/static web server, or use the published GitHub Pages build when available. ES modules will not work reliably through every browser's `file://` mode.

## Current playable features

- Responsive Phaser build with selectable internal render quality.
- Street, rooftop and sewer traversal.
- Narrative tutorial with speaker-anchored dialogue.
- Hunger, feeding and vampire powers.
- Civilian and police vision/hearing reactions.
- Wanted escalation, pursuit, arrest and helicopter support.
- Police informant, journalist objective, refuge-gated completion and sire report.
- Action-based gameplay `InputSystem` with tested responsive pointer mapping.
- Mouse-directed combat with resilience, stagger and knockdown.
- Three-weapon inventory: Unarmed, Iron Pipe and Pistol.
- Mouse-wheel weapon cycling, equipped-weapon HUD and finite pistol ammunition.
- Shared melee/hitscan damage across NPCs and streetlights.
- Police and hunter melee telegraphs.
- Player hit stun, invulnerability and incoming damage converted into Hunger.
- Contextual right-click draining for downed targets and unaware targets approached from behind.
- Default running, optional quiet movement and deterministic contextual traversal.
- Damageable streetlights that create darkness and trigger sight/hearing reactions.
- Critical Hunger feedback and frenzy failure at the Hunger limit.

## Current controls

- WASD / arrows: run by default.
- Hold Shift: move slowly and make substantially less footstep noise.
- Mouse: aim and face.
- Left mouse: use the equipped weapon.
- Mouse wheel: previous/next owned weapon.
- Right mouse: aim at a valid target and hold to drain.
- Space: contextual traversal only — jump, climb, descend or use a sewer entrance.
- E: non-traversal interactions; it no longer drains or breaks streetlights.
- Q: Shadow Dash.
- R: Vampiric Whisper.
- F: Blood Sense.
- M: mission panel.
- H: menu/help.
- Left click: advance an open dialogue bubble.
- Escape: keyboard fallback for dialogue / close UI.

The opening tutorial remains Unarmed and suppresses wheel cycling until full gameplay control is restored. The Pistol starts with eight rounds and has no reload action in the current vertical slice. See [`docs/CONTROL_SCHEME.md`](docs/CONTROL_SCHEME.md) and [`docs/WEAPON_SYSTEM.md`](docs/WEAPON_SYSTEM.md).

## Tests

The project uses Node's built-in test runner and has no test dependencies:

```bash
npm test
```

## Documentation

Start with [`docs/README.md`](docs/README.md). The documentation set includes the current project snapshot, functional specification, technical architecture, implemented input/combat/drain/movement/prop/weapon systems and the dependency-ordered roadmap.
