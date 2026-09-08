# Civilian drivers with destinations

## Goal

Replace the production civilian rail cursor with drivers that follow planned journeys using the player's vehicle kinematics. This supersedes the route-offset recovery contract in the September 7 task at the user's explicit request.

## In scope

- Authority: one civilian driver runtime in the existing GameplayRuntime traffic update. Compiler lanes describe navigation; VehicleModel owns locomotion.
- Files: new journey planner and driver runtime/controller under `phaser/src/streaming`; composition in TrafficMultiAgentRouteRuntimePolicy and TrafficLocalAssignmentPolicy; physical consequence/mass integration; route metadata; focused unit/network/browser traffic tests and the traffic progress documents.
- Each car selects a reachable distant destination and commits a simple itinerary before departure. Completing a journey selects a new destination; passing an intersection does not roll a random turn.
- Acceleration, braking, steering and reverse use `stepVehicleKinematics`, with swept body clearance. Obstacles may cause a committed emergency manoeuvre through available pavement, followed by driving back toward the itinerary.
- Preserve stable token/slot identity, population accounting, native impact/damage and hijacking. Physical impacts change the driver's starting pose; no lateral easing back to an ideal line.

## Out of scope

Generated city changes, player handling changes, campaign/police ownership, new input readers or gameplay loops, merging the PR, and Netlify deployments.

## Acceptance criteria

- [x] A planned journey has a destination and no repeated directed lanes.
- [x] Unforced displacement is produced by the same kinematics as the player; stationary cars cannot translate sideways or rotate in place to recover.
- [x] Ordinary following and intersection yielding preserve clearance; an available emergency bypass/reverse manoeuvre returns to the intended journey without teleporting or replacing the car.
- [x] Native impacts are adopted as actual poses, with no automatic return-to-rail offset decay.
- [x] Sustained tests use the production driver on the generated network, including real archetype sizes; browser checks assert the new authority and native contact behaviour.

## Validation

Run focused driver/planner/network tests, `npm run check:fast`, `npm run check:affected:plan -- --base=origin/main`, and `npm run check:affected -- --base=origin/main`. Local Playwright is unavailable after an automatic dependency-installation rejection; browser coverage must run in GitHub Actions. The previous head bb832e2 failed the native soft-push browser assertion at line 157; inspect and cover this boundary as part of the rebuild.

## Delivery

Update draft PR 73 and its Pages preview; report the exact checks and any pending validation. Do not merge.
