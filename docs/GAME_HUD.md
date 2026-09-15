# ViceBlood in-game HUD

## Intent
The street HUD should feel like the same 1990s gothic-punk world as the Black Book without turning play into a dashboard. Persistent information is deliberately sparse; warnings and prompts appear only when they matter.

## Hierarchy
- **Top left:** current district and stage, treated as a small clipped street card.
- **Top center:** current Tonight destination only when one exists, with bearing and distance.
- **Top right:** Police and Veil warnings only when non-zero.
- **Bottom left:** hunger, vitality, cash and carried blood. Hunger is visually dominant because it drives the vampire survival loop.
- **Bottom center:** contextual interaction prompt. Powers stay quieter underneath it.
- **Bottom right:** current weapon or vehicle telemetry, never both.
- **Transient note:** tutorial/action feedback uses a taped-paper treatment and disappears through the existing UIScene notice lifetime.

## Visual language
Coal/black backgrounds, aged-cream type, wine-red danger and dirty ochre warning. Thin rules, clipped corners, photocopy grain and small uppercase labels echo the Black Book without copying its full-page paper layout. No external fonts, images or runtime assets are introduced.

## Behaviour
The HUD owns no gameplay state, input loop or timer. `GameUiProjection` remains the read model and `UIScene` remains the command boundary. Existing commands and selectors are retained: Black Book, City, pause, carried blood, objective, prompt and notice.

Vehicle UI replaces the weapon panel while driving. Police/Veil modules collapse when quiet. Frenzy adds only a low-cost CSS vignette; reduced-motion disables its animation.

## Responsive contract
All primary placement uses viewport-relative clamps plus safe-area insets. At narrow or short viewports the design progressively removes secondary labels before reducing primary numbers/prompts. The contextual prompt and survival values remain readable. Forced-colours mode gets explicit borders and Canvas colours.

## Non-goals
No Black Book redesign, economy change, gameplay rule change, save change, camera/audio change, new dependency, font, image or asset fetch. This pass does not add a minimap or duplicate City.
