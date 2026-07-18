# Milestone 5 browser regression checklist

Use this checklist before changing Milestone 5 from 🟡 to ✅. Record browser, operating system, viewport, render quality and commit SHA.

## Required configurations

1. Laptop viewport around 1366 × 768 at Low quality.
2. Desktop viewport around 1920 × 1080 at Ultra quality.
3. Narrow viewport at or below 720 CSS pixels at High or Very high quality.
4. Resize during at least one run without reloading.

## Default and quiet movement

- WASD/arrows move at the former fast/run speed without holding another key.
- Holding Space while moving does not alter speed.
- Holding Shift clearly slows movement.
- Releasing Shift immediately restores default run speed.
- Diagonal speed remains normalized.
- Movement remains blocked by walls, rooftops and sewer geometry.
- Arrest/failure movement locks still stop both modes.

## Footstep feedback

- Default running uses the stronger/faster footstep feedback.
- Quiet movement uses the softer feedback.
- The short world noise ring is visibly smaller for quiet movement.
- A nearby NPC outside its vision cone can hear default running and show `WTF`.
- The same NPC at an equivalent medium distance does not hear quiet movement.
- Hearing footsteps alone does not start pursuit or a witness report.
- An NPC already pursuing does not fall back into `WTF` because of footsteps.
- Downed, dead and inactive NPCs do not react.

## Traversal-only Space

Test every route type:

- rooftop jump;
- roof drop;
- fire escape up;
- fire escape down;
- sewer entrance;
- sewer exit;
- private refuge shaft.

For every route:

- a world-space `SPACE` marker appears before activation;
- the HUD names the same route;
- Space activates it;
- E does not activate it;
- left/right mouse do not activate it;
- holding Space away from a route does nothing;
- repeated Space during a transition does not start another transition.

## Multiple nearby routes

- The route already under and in front of the player wins.
- When neither route is committed, the closest route wins.
- Similar-distance candidates follow mouse aim consistently.
- Repeating the same position and aim always selects the same route.
- The displayed route and executed route never disagree.
- A nearby manhole does not randomly steal a ladder, drop or jump selection.

## Tutorial and UI ownership

- The opening movement tip says running is automatic.
- The tip teaches Shift for quiet movement.
- The tip teaches Space only as contextual traversal.
- Dialogue clicks do not activate a route afterward.
- Pause, mission drawer and task reveals do not leak Space or Shift state.
- Tab blur/refocus while holding Shift or Space does not leave a stuck state.
- Interaction menus still use E/Enter and do not accept Space as traversal behind the menu.

## Combat and drain compatibility

- Running/quiet movement does not change mouse aim.
- Player attack windup and hit stun still block movement correctly.
- Moving during right-click drain cancels the channel in both movement modes.
- Space cannot be used to escape during attack recovery, hit stun or active drain.
- Police and hunter attacks still resolve correctly while the player changes movement mode.

## Pass criteria

Milestone 5 may be marked ✅ only when:

- Space never modifies movement speed;
- Shift is the only quiet-movement modifier;
- all traversal types work;
- overlapping route selection is deterministic;
- quiet movement produces measurably less hearing pressure;
- no input remains stuck after UI, blur or transitions;
- the complete mission and refuge finale still work.
