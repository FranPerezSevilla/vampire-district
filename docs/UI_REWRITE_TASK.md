# Complete interface replacement

## Goal
Replace all normal in-game presentation with a viewport-native React/Radix UI, preserving the main-menu design and all gameplay/save authorities.

## Scope / authority
`ui/`, `phaser/src/ui`, UIScene, vampire presentation/navigation, viewport composition and the UI build. GameScene retains the sole gameplay loop; campaign services retain persistence and transactions; UIScene coordinates presentation and existing input locks. No additional world keyboard reader.

## Acceptance
HUD anchored to the actual viewport. City map with independent ownership, relationship and hunting-right layers. Contacts, herd, resources, errands, power, interactions, garage and pause have consistent visual/keyboard behavior. Locate only inspects; Go here sets the existing destination and returns to play. Do not render React-owned nodes from legacy DOM code.

## Non-goals
No Phaser upgrade, city regeneration, traffic/physics changes, faction rebalance or save migration. PR #83 stays open; public Pages is not modified before the rewrite has been reviewed.

## Validation
Run check:fast, inspect check:affected:plan and execute permitted native validation. Existing no-browser policy remains in force. DOM behavior tests are not CSS/layout/camera proof. Visual acceptance is pending until the integrated build is reviewed at desktop and narrow viewport sizes.
