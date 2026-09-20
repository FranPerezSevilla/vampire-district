# Organic character silhouettes and quieter roofs

## Goal / scope

Address the user's voxel-like character feedback and request for a slightly more overhead view. Also reduce excessive tile noise on roofs.

Presentation authorities: CharacterStackRig / CharacterSpriteStack, their authored SVG atlas and the existing roof assets/loaders. Keep CharacterMotion, InputSystem, CombatSystem, AI, collision, city placement and vehicle perspective unchanged.

## Acceptance

- Rounded limb contours and shoulder/head shapes, with no detached feet or angular box highlights; same existing actions.
- Slightly shorter vertical character projection, still consistently upward everywhere in the viewport.
- Quieter roof tile artwork with readable ridges, edges and dormers; no whole-scene blur.
- Reused bounded geometry/atlas, no texture regeneration during play. Record actual draw and atlas budgets.
- Compare game-rendered headings/actions/streets and roof examples; focused tests and affected runner attempt.

No commit/push or publishing requested.

## Follow-up: performance review

User additionally requests a performance pass after the visual changes. Measure production WebGL at representative streets/landmarks, separate frame intervals from CPU update/render submission, record GPU/framebuffer and cold versus settled conditions. Use CPU sampling to identify actionable hotspots before editing. Preserve image resolution, lighting, population and physics; only remove proven redundant work in its existing owner. Re-run comparable samples for any optimization and state hardware/sampling limitations.
