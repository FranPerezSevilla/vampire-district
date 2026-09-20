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

## Local readability pass

The objective now uses a narrower paper headline with a single distance/bearing row. Explicit typography isolates it from retired HUD selectors. Survival values and power shortcuts use readable sizes; equipment shares the same condensed heading hierarchy. Context prompts sit above the bottom HUD instead of overlapping powers. On narrow screens the objective moves below navigation. Gameplay and input ownership are unchanged.

## Notebook and compass iteration
The objective is a small ruled-paper note at the left. A single arrow follows an invisible ring around the player, using the existing UI projection and camera transform; the HUD shows no objective distance. Top-right navigation contains only the cloth-bound Black Book button. City remains available inside the book and Escape pauses. Survival uses a dark notebook fragment.

## Sparse HUD and controls
Hunger, Vitality and the clock occupy the upper left; Police/Veil alerts use the upper right; equipment remains at the lower right. The clock starts at 22:00 and derives from persisted vampire elapsed gameplay time: 300 seconds per hour. Tonight notices expire after six seconds and do not restart merely by reopening menus.
B toggles the Black Book; Escape opens pause/settings/credits/manual Save/Load/key editing. Right mouse opens a paused power dial via InputSystem; selection resumes through UIScene's existing queued gameplay action. G held feeds; Give In's optional keyboard shortcut is V. The simplified playtest still exposes only enabled powers (Whisper and Give In). Rebinding uses the existing settings storage and applies after reload. Manual save preserves campaign/vampire progress, not an arbitrary street simulation snapshot; loading starts at the refuge.

## World annotations removed
Actor and vehicle names, witness/recovery/combat text, interaction rings and reaction markers are no longer created or drawn. AI, witness reporting, feeding and combat remain authoritative. The HUD compass, aiming reticle, projectile effects and in-menu names remain. No FPS improvement has been measured.

The compass DOM transform now follows the existing engine postrender event so camera and player motion update every rendered frame; the main React snapshot stays at 10 Hz. Generic body concealment in shadows/rooftops and floating HIDE markers are removed; intact nearby dumpsters and sewers remain valid.

Tonight is reserved for objective identity/label and mission-stage changes, never generic action, alert or combat feedback. Interaction hints are a small text line with bracketed keys; vehicle entry/exit uses the actual confirm binding (Enter displayed as INTRO).


The experimental radial power wheel was removed after visual review. Right click no longer opens it; the existing keyboard powers remain available.
