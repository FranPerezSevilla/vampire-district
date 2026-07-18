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

| Movement | Base sound radius | Ordinary NPC reaction | Police / hunter reaction |
|---|---:|---|---|
| Default run | 120 units | `WTF` only inside the short 42-unit range | Enhanced hearing across the wider run radius |
| Quiet movement | 42 units | No footstep reaction | May hear at close range with type multiplier |

Ordinary NPCs here means civilians, the journalist and the rooftop thug. They do not use the full run radius. Running only makes them turn and display `WTF` when the player is inside the short sound range. Quiet movement does not trigger their footstep reaction.

Police and hunters retain enhanced hearing. A footstep only creates a heard-only response when the NPC is inside its effective hearing range but outside its current vision cone.

Heard-only footstep response:

- NPC turns toward the player position;
- movement stops briefly;
- `WTF` appears;
- pursuit/reporting does not begin automatically.

NPCs already alarmed, chasing, attacking, downed or otherwise inactive ignore this heard-only path.

Each emitted step publishes a plain-data `movement:footstep` event containing mode, position, layer, base hearing radius and heard-only count.

## Presentation

- Run steps use the stronger existing footstep sound.
- Quiet steps use the softer existing step sound.
- A short world ring communicates relative noise without adding another permanent HUD element.
- The selected traversal point has a world-space `SPACE` label plus the existing contextual HUD prompt.

## Automated coverage

`tests/movement.test.js` covers:

- default run being faster than quiet movement;
- quiet base hearing radius being substantially smaller;
- ordinary NPCs only hearing running inside the short range;
- ordinary NPCs ignoring quiet footsteps;
- police and hunters retaining enhanced hearing;
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
- Hearing radii and speed values are initial tuning baselines.
- The temporary movement-input and runtime adapters remain prototype integration debt.
- Browser validation is still required across camera layers, viewport sizes and render-quality presets.
