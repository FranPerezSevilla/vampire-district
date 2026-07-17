# Vampire District

A top-down vampire stealth-action prototype built with Phaser 3 for the browser.

## Current vertical slice

You are a young vampire sent by your sire to stop a journalist from exposing the clan. The playable mission crosses rooftops, streets and sewers while teaching traversal, feeding, Hunger, witnesses, police pressure and the veil.

Implemented systems include:

- responsive Phaser world and DOM-backed HUD;
- rooftop, street and sewer traversal;
- narrative tutorial and speaker-anchored dialogue;
- police informant and journalist mission flow;
- Hunger, feeding and vampire powers;
- NPC vision and hearing reactions;
- police pursuit, arrest and helicopter escalation;
- responsive render-quality presets;
- extended city scenery around the playable district.

## Current controls

These are the bindings in the current playable build. The planned combat-control replacement is documented separately.

- WASD / arrow keys: move.
- Space: run and contextual traversal.
- E: interact.
- Q: Shadow Dash.
- R: Vampiric Whisper.
- F: Blood Sense.
- M: mission panel.
- H: menu.
- Escape: advance dialogue / close UI.

## Planned combat direction

The next major milestone introduces mouse-directed combat:

- mouse to aim;
- left mouse to attack/fire;
- right mouse to drain valid targets;
- mouse wheel to cycle weapons;
- default running;
- Space reserved exclusively for traversal;
- NPC resilience, knockdown and damage increasing player Hunger.

## Documentation

- [Documentation index](docs/README.md)
- [Project snapshot](docs/PROJECT_SNAPSHOT.md)
- [Functional specification](docs/FUNCTIONAL_SPEC.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Control scheme](docs/CONTROL_SCHEME.md)
- [Roadmap](docs/ROADMAP.md)

## Development principle

Keep the browser build immediately playable, but do not add new major systems through overlapping runtime patches. New combat work should begin with the input and architecture stabilization milestone described in the roadmap.
