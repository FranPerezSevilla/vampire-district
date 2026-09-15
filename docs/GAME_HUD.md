# ViceBlood in-game HUD

## Intent
The street HUD should feel like the same 1990s gothic-punk world as the Black Book without turning play into a dashboard. Persistent information is deliberately sparse; warnings and prompts appear only when they matter.

## Approved proof of concept
The visual target is the approved mockup with oversized cream paper strips, black survival slabs, wine-red hunger accents, hard typography and irregular photocopied edges. The gameplay image in the mockup is not a target; only its HUD language is.

## Sprint 1 — implemented for review
Sprint 1 intentionally changes only the three elements that most affect moment-to-moment readability:

1. **Objective banner:** a large torn-paper `TONIGHT` headline at the top centre. The current tracked destination is the dominant line, with distance and a separate bearing arrow beneath the paper.
2. **Context prompt:** an oversized cream paper strip at the bottom centre with a strong keycap and all-caps action text. It should be readable without searching the screen.
3. **Survival slab:** one compact black panel at bottom left for Hunger, Vitality, Blood Bags and Cash. Hunger and Vitality use horizontal bars; Blood and Cash share one simple secondary row. Decorative fang artwork was removed after the first in-game review because it consumed too much space and weakened scanability.

Weapon/vehicle, powers, Police/Veil warnings and transient notes are deliberately retained and visually subordinated in Sprint 1 rather than redesigned again. They are candidates for later sprints after the three primary elements are accepted in real gameplay.

## Hierarchy
- **Top left:** current district and stage, treated as a secondary clipped street card.
- **Top center:** current Tonight destination when one exists, with bearing and distance. This is the largest top-screen element.
- **Top right:** Police and Veil warnings only when non-zero.
- **Bottom left:** the compact survival slab: Hunger, Vitality, Cash and carried Blood.
- **Bottom center:** the largest interaction affordance: contextual prompt. Powers stay quieter underneath it.
- **Bottom right:** current weapon or vehicle telemetry, never both.
- **Transient note:** tutorial/action feedback uses a taped-paper treatment and disappears through the existing UIScene notice lifetime.

## Visual language
Coal/black backgrounds, aged-cream paper, wine-red danger and dirty ochre warning. Hard condensed typography, clipped/torn silhouettes, subtle photocopy grain and imperfect rules echo the Black Book and mockup without importing external art. Ornament must not compete with status readability. No external fonts, images or runtime assets are introduced.

## Behaviour
The HUD owns no gameplay state, input loop or timer. `GameUiProjection` remains the read model and `UIScene` remains the command boundary. Existing commands and selectors are retained: Black Book, City, pause, carried blood, objective, prompt and notice.

Vehicle UI replaces the weapon panel while driving. Police/Veil modules collapse when quiet. Frenzy adds only a low-cost CSS vignette; reduced-motion disables its animation.

## Responsive contract
Primary placement uses viewport-relative clamps plus safe-area insets. Desktop/landscape preserves the proof-of-concept character but keeps the survival slab deliberately smaller than the objective and prompt. At narrow or short viewports the design reduces ornament and secondary copy before shrinking the objective, prompt or survival values. Forced-colours mode gets explicit borders and Canvas colours.

## Non-goals
No Black Book redesign, economy change, gameplay rule change, save change, camera/audio change, new dependency, font, image or asset fetch. This pass does not add a minimap or duplicate City.
