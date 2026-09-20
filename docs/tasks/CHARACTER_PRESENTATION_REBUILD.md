# Connected character presentation

## Goal

Player, civilians and police have connected limbs and coherent animation. Walking faces movement; the player's pointer only controls facing during an accepted attack. The mouse reticle fades when idle.

## Authority and scope

- InputSystem remains the sole input reader, exposes pointer activity in its frame.
- CombatSystem retains aim, attack acceptance, damage and timing; only its reticle changes.
- ModularCharacterView owns presentation, using a shared presentation controller and an articulated CharacterStackRig. GameScene/NpcSystem provide movement and accepted actions.
- Shared authored SVG parts, fixed geometry buffers, existing visibility/Y sorting and WebGL batch.
- Files: those authorities, character atlas, focused character/input/combat tests and browser review.

## Non-goals

No changes to AI decisions, collision, damage, movement speed, city geometry, vehicle art, saves or publishing. No second update loop or new input listeners outside InputSystem.

## Acceptance

- [x] Moving/idle mouse does not turn the protagonist; WASD does. Accepted attacks retain exact combat direction.
- [x] Torso and legs cannot rotate into opposing orientations. Gait starts/stops continuously and attached joints remain connected.
- [x] Shared player/NPC rig supports walking, running, shooting, melee, jumping, gestures and falls.
- [x] Reticle follows the actual cursor, fades on inactivity, disappears outside gameplay and preserves high contrast.
- [x] Buffers/atlas are shared or reused, offscreen culling remains, no per-frame texture generation.
- [x] Focused native tests, packaged browser checks and affected plan/run recorded.

## Implementation

- `CharacterMotion`: accumulated stride clock, eased locomotion/running, shortest-path turns, bounded 0.45-radian hip twist during accepted combat. Screen-pointer motion does not own player orientation. NPC facing still follows AI-provided direction/accepted attacks.
- `CharacterStackRig`: tapered continuous surfaces joining hip/knee/ankle and shoulder/elbow/wrist, rounded torso/head sections. The ankle/knee and elbow surface edges are numerically identical across adjoining bones. Feet now center on the pelvis, with relative directional strides while aiming.
- Character vertical projection cannot cross zero: -0.80 to -0.48; modest lateral projection is bounded to ±0.22. This fixes apparent head/feet reversal at the bottom of the viewport. Buildings, cars and prop perspective are unchanged.
- Authored shared SVG surfaces replace blurred mood overlays on faces/clothes. 64 records per civilian/player, 65 for police; 36–38 visible quads in the eight-direction review. Canvas fallback retains its existing simpler artwork with the same new orientation controller.
- Pistol lowered when not attacking; actual accepted attack direction owns the muzzle, including when the pointer moves during recovery. Empty clicks do not rotate the character. Existing melee timing, jump path, smoking/radio gestures and death/reaction state remain authoritative.
- Reticle at actual cursor location, constant screen size, 650 ms hold + 200 ms fade. Screen-coordinate activity only; camera movement cannot wake it. UI locks clear frozen reticle graphics/frame and restore the native cursor immediately.

## Validation — 20 September 2026

- Packaged build succeeds; **64 focused native tests pass** (62 motion, connected bones, reticle, input, character art/gestures, combat, weapons, player damage; 2 control-reference checks).
- Private Chromium production review: WASD facing, idle/moving mouse, fade, real melee and pistol attacks, empty pistol, pause cursor/blocked clicks, eight headings for all three roles, eight action poses. **No JS errors or missing visual assets**. Private radio 404s are excluded as before.
- Evidence: `docs/screenshots/characters-review.json`, `characters-street.png`, `characters-turnaround.png`, `characters-actions.png`. Those galleries are game-rendered diagnostic poses, not concepts.
- Shared human atlas remains **512×1024**, approximately **2.67 MiB including mipmaps**; texture count stays 102 during the sampled gameplay segment. 120 rAF intervals: median 16.7 ms, p95 16.8 ms, max 33.3 ms. This short, local stationary sample is **not** a city-wide 60 FPS guarantee or a controlled before/after benchmark.
- Affected selector inspected and attempted; its Windows `npm` child exits 1 before running checks. Direct full native run completed: **1,274 pass / 1,319 total, 45 fail** in wider UI, city, traffic, source-contract and boot fixtures. They are not declared green or fixed by this character task. The additional reticle test passes in the final focused run.
- Preview served on **4174**, process **24296** at handoff. No commit or push.
