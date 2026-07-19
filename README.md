# Vampire District

**Vampire District** is a Phaser 3 top-down urban vampire action and stealth game for the browser. The current vertical slice crosses rooftops, streets and sewers, manages Hunger and the Veil, fights through escalating police pressure and silences a journalist before the story escapes the district.

The long-term structure is intentionally GTA2-like: compact districts, vehicles, traffic, weapons, factions, short missions and systemic police chaos. The original vampire setting adds Hunger, feeding, rooftops, sewers, retainers, safehouses and political consequences.

Open `index.html` through a local/static web server, or use the published GitHub Pages build when available. ES modules will not work reliably through every browser's `file://` mode.

## Original setting direction

The project will not use factions, terminology, ranks, lore or symbols from an existing licensed vampire property.

Current working structure:

- **Blackglass Directorate** — secretive institutional establishment.
- **Red Assembly** — violent territorial coalition.
- **Unaligned Houses** — separate independent operators rather than one unified faction.
- **Retainers** — named enhanced mortals with Loyalty, Dependence, Exposure, upkeep and failure states.

These are working names pending commercial trademark clearance. See [`docs/ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md`](docs/ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md).

## Current playable features

- Responsive Phaser build with selectable internal render quality.
- Street, rooftop and sewer traversal.
- Narrative tutorial with speaker-anchored dialogue.
- Hunger, feeding and vampire powers.
- Separate NPC vision and hearing reactions.
- Wanted escalation, pursuit, arrest and helicopter support.
- Police informant, journalist objective, refuge-gated completion and sire report.
- Consolidated `GameplayRuntime` and first-class input/combat/AI/tutorial systems.
- Mouse-directed combat with resilience, stagger and knockdown.
- Prototype three-weapon inventory: Unarmed, Iron Pipe and Pistol.
- Mouse-wheel cycling, weapon HUD and finite pistol ammunition.
- Shared melee/hitscan damage across NPCs and streetlights.
- Player hit stun, invulnerability and incoming damage converted into Hunger.
- Contextual right-click draining for downed and unaware rear targets.
- Default running, optional quiet movement and deterministic traversal-only Space.
- Damageable streetlights that create darkness and sight/hearing reactions.
- Explicit NPC AI priority, police containment, witness flight and hunter memory.
- Timed police/hunter recovery.
- First-use guidance, recovery countdowns and optional high-contrast aim.
- Runtime ownership diagnostics, spatial NPC queries and Playwright smoke-test infrastructure.

## Current controls

- WASD / arrows: run by default.
- Hold Shift: move slowly and make substantially less footstep noise.
- Mouse: aim and face.
- Left mouse: use the equipped weapon.
- Mouse wheel: previous/next owned weapon.
- Right mouse: aim at a valid target and hold to drain.
- Space: contextual traversal only — jump, climb, descend or use a sewer entrance.
- E: non-traversal interactions; it does not drain or break streetlights.
- Q: Shadow Dash.
- R: Vampiric Whisper.
- F: Blood Sense.
- M: mission panel.
- H: pause/help and accessibility settings.
- Left click: advance an open dialogue bubble.
- Escape: dialogue/UI keyboard fallback.

The opening tutorial remains Unarmed and suppresses wheel cycling until full gameplay control returns. The current all-owned weapon inventory is a vertical-slice convenience. Campaign progression will use one melee, one sidearm and one long/special slot, with paid ammunition, carried limits and refuge storage.

## Next production sequence

```text
10.1 Release Candidate stabilization
→ 11 Mission framework, cash, reputation, save/load
→ 12 Vehicle core
→ 13 Traffic and motorized police
→ 14 Original factions and territory
→ 15 Safehouses, stash and ammunition economy
→ 16 Retainers
→ 17 Expanded arsenal and vehicle combat
→ 18 District campaign
```

See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Tests

Unit tests:

```bash
npm test
```

Chromium browser smoke tests:

```bash
npm install
npx playwright install chromium
npm run test:browser
```

## Documentation

Start with [`docs/README.md`](docs/README.md). The documentation set covers the current snapshot, original setting, functional rules, runtime architecture, implemented systems, regression matrices and dependency-ordered roadmap.
