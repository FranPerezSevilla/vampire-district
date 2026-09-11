# Title scale and preview regression — 2026-09-11

## Authority and scope

GameSceneCore owns layer zoom; MainMenuScene composes that camera and owns the
loading/gesture/handoff sequence. GameScene.update owns the single frame boundary.
responsive-layout owns the canvas CSS rectangle and Phaser input mapping. CSS owns
all DOM typography and reflow. No additional render/input/simulation loop.

Files in scope: those authorities, viewport.css, title-screen.css, interface.css,
and focused native regression tests.

## Acceptance

- Apply the layer/quality zoom before the menu is visible, not after New Night.
- Use Phaser getScroll for a camera center; scroll coordinates are not worldView
  coordinates. A player away from bounds lands at 72% of the visible menu width,
  then 50% after the transition, at every quality preset and cover/crop aspect.
- No traffic, police, hunger or vehicle-radio ticking behind the title. Resident
  city streaming may complete through the existing frame while input is locked.
- Await resident starting chunks as well as title media before the gesture gate.
- DOM sizes reflow in relative typography units; no root transform, no fixed
  430px wordmark ceiling on a large CSS viewport. Respect user font minimum.
- Canvas resizing also synchronizes Phaser pointer bounds and displayScale.
- Preserve title design, New Night camera fade and existing campaign saves.

## Explicit non-goals

No Phaser upgrade, economy/traffic tuning, new city geometry, save migration,
PR merge or browser execution. Native camera tests use the pinned Phaser 3.90
Camera math with device detection isolated; they are not pixel/rendering proof.

Visual acceptance remains pending in the real browser. HTTP publication checks
verify only delivery and file identity, never visual correctness or frame rate.
