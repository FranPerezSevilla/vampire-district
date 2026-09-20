# Gothic city visual pass
## Goal
Bring the playable city closer to the intro's ink-black, bone and muted crimson cut-paper language; remove the rejected power wheel.
## In scope
Existing GameScene building presentation, building palette resolver, street COLORS and shared VehicleView. Remove right-click wheel binding and its dedicated presentation/audio.
## Out of scope
Road topology, generated data, collision footprints, traffic rules and power mechanics.
## Acceptance
City and vehicles use subdued material colors with angular graphic accents. Street readability remains intact. Right click does not pause or open a dial. No new per-frame rendering loop.
## Validation
Focused rendering/input/UI tests, packaged build and local browser visual review.
