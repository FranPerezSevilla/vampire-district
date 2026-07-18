# Movement and traversal system

_Status: Milestone 5 implementation complete; browser regression and tuning remain pending._

## Player-facing rules

- WASD / arrows move at the normal run speed.
- Holding Shift switches to quiet movement.
- Space never changes speed and is reserved for contextual traversal.
- E never executes a traversal route.
- A visible `SPACE` marker identifies the route that will be used before activation.

## Movement speeds

Movement is derived from `playerSpeed` rather than hard-coded world velocity:

| Mode | Multiplier |
|---|---:|
| Default run | 1.55 |
| Quiet movement | 0.72 |

The arrest/failure systems can still set `playerSpeed` to zero, and both modes respect that value.

Authoritative pure rules live in `phaser/src/data/movement.js`. `movementSpeed()` is used by the runtime instead of the former Space-held sprint branch.

## Central input contract

`InputSystem` continues to own raw keyboard collection. Milestone 5 adds `quietHeld` to the frame contract and forces the old `sprintHeld` compatibility field to `false`.

```js
{
  move,
  hasMovementIntent,
  quietHeld,
  sprintHeld: false,
  traversePressed
}
```

`phaser/src/input/movement-input-adapter.js` currently performs this migration without creating a second raw keyboard listener:

- Shift becomes `quietHeld`;
- Space still emits only the one-frame `traversePressed` edge;
- Space held state is not exposed as sprint.

The adapter is documented technical debt to be folded into `InputSystem` directly during Milestone 10.

## Deterministic traversal selection

Movement options are still collected by the existing world systems, but selection no longer depends only on legacy interaction priority.

`phaser/src/data/traversal.js` evaluates each valid candidate using this order:

1. A route within 12 world units and inside the forward aim threshold wins the committed-route band.
2. Otherwise, the closest route wins.
3. Aim angle breaks nearby conflicts.
4. Existing route priority breaks near-identical candidates.
5. Candidate ID is the final stable tie-breaker.

The same selector determines both:

- the route highlighted by the world/HUD prompt;
- the route executed by Space.

This prevents the prompt from advertising one route while Space activates another.

## Traversal ownership

Traversal types remain:

- rooftop jump;
- roof drop;
- fire escape up/down;
- sewer entrance/exit;
- private refuge shaft.

`InteractionSystem.sortOptions()` is adapted only when every supplied option is a traversal option. Normal E interactions retain their existing priority-and-distance ordering and menus.

## Footstep audio and hearing

`MovementNoiseSystem` owns movement audio and perception. The older raw-key footstep timer is disabled once the playable scene is created, so sound follows actual world movement rather than keyboard state.

| Mode | Step distance | Base hearing radius | Reaction |
|---|---:|---:|---:|
| Default run | 22 units | 120 units | 0.85 s |
| Quiet movement | 18 units | 42 units | 0.38 s |

Police and hunters receive modest hearing multipliers. A footstep only creates a heard-only response when the NPC is inside hearing range but outside its current vision cone.

Heard-only footstep response:

- NPC turns toward the player position;
- movement stops briefly;
- `WTF` appears;
- pursuit/reporting does not begin automatically.

NPCs already alarmed, chasing, attacking, downed or otherwise inactive ignore this heard-only path.

Each emitted step publishes a plain-data `movement:footstep` event containing mode, position, layer, hearing radius and heard-only count.

## Presentation

- Run steps use the stronger existing footstep sound.
- Quiet steps use the softer existing step sound.
- A short world ring communicates relative noise without adding another permanent HUD element.
- The selected traversal point has a world-space `SPACE` label plus the existing contextual HUD prompt.

## Automated coverage

`tests/movement.test.js` covers:

- default run being faster than quiet movement;
- quiet hearing radius being substantially smaller;
- committed aligned traversal priority;
- distance fallback;
- aim tie-breaking;
- stable ID tie-breaking.

Input tests also verify that:

- Shift produces `quietHeld`;
- Space still produces `traversePressed`;
- holding Space never produces sprint state;
- movement locks clear quiet movement correctly.

## Known limitations

- Footstep sight checks use the established cone geometry but not a consolidated obstacle/occlusion service.
- Hearing multipliers and speed values are initial tuning baselines.
- The temporary movement-input and runtime adapters remain prototype integration debt.
- Browser validation is still required across camera layers, viewport sizes and render-quality presets.
