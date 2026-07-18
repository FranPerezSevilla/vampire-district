# Functional specification

## 1. Experience goals

The game should feel immediate, readable and systemic:

- crossing a block should be enjoyable rather than administrative;
- mouse aim should make attacks and draining understandable;
- traversal should be one contextual action without a route menu;
- feeding should be powerful, risky and tactically useful;
- vision and hearing should create different reactions;
- movement, stealth, violence, weapon choice, feeding and route choice should solve situations.

## 2. Core gameplay loop

1. Receive an order from the sire.
2. Navigate streets, rooftops and sewers.
3. Read NPC vision, hearing and alert state.
4. Avoid, distract, strike, shoot, knock down or drain targets.
5. Use darkness and routes to control encounters.
6. Control Hunger and protect the veil.
7. Manage evidence and police pressure.
8. Complete the objective and return to report.

## 3. Current control scheme

| Action | Input | Behaviour |
|---|---|---|
| Move | WASD / arrows | Run by default. |
| Quiet movement | Hold Shift | Slower movement and much smaller footstep hearing radius. |
| Aim / face | Mouse | Player faces the cursor's world position. |
| Primary attack | Left mouse | Use equipped weapon in the aimed direction. |
| Weapon selection | Mouse wheel | Previous/next owned weapon. |
| Drain | Hold right mouse | Drain a valid aimed target while the channel remains valid. |
| Traverse | Space | Jump, climb, descend or enter/exit a sewer. No speed effect. |
| Interact | E | Talk, collect, inspect and use non-traversal objects. |
| Dash | Q | Shadow Dash. |
| Whisper | R | Vampiric Whisper. |
| Blood Sense | F | Reveal relevant supernatural/perception information. |
| Mission | M | Toggle mission information. |
| Menu | H | Toggle menu/help. |
| Dialogue | Left click / Escape | Advance one dialogue bubble. |

The tutorial control modes suppress weapon cycling until full gameplay control is restored.

## 4. Movement and stealth

### Default run

Normal WASD movement uses the fast traversal speed. Space is never a sprint modifier.

### Quiet movement

Holding Shift lowers speed and footstep pressure. Quiet movement should allow deliberate approaches without making every nearby NPC react.

Current baselines:

| Mode | Speed multiplier | Base hearing radius |
|---|---:|---:|
| Run | 1.55 | 120 |
| Quiet | 0.72 | 42 |

Ordinary NPCs only react to running inside the short 42-unit range and ignore quiet footsteps. Police and hunters retain enhanced hearing.

Footsteps only create `WTF`/orientation when heard without a confirmed sighting. Hearing alone does not start pursuit or reporting.

## 5. Traversal

Space is exclusively physical movement between navigation layers.

Supported actions:

- rooftop jump;
- roof drop;
- fire escape up/down;
- street-to-sewer entrance;
- sewer-to-street exit;
- private shaft to the refuge.

Selection order:

1. a route already close and in the aimed direction;
2. closest valid route;
3. smallest aim angle;
4. route priority;
5. stable ID.

The highlighted route and executed route must always be the same. Space with no valid route does nothing. E never activates traversal.

## 6. Aiming and primary attacks

- Cursor coordinates are projected through the active camera.
- The last valid aim direction is retained near the player.
- A weapon-coloured indicator shows facing.
- Aim must remain correct after resizing, CSS scaling, zoom and quality changes.
- Attack direction and equipped weapon config are stored at attack start.
- One press starts one attack; holding does not damage every frame.
- UI, dialogue, transitions, hit stun and draining suppress attacks.

## 7. Weapon inventory

Starting inventory:

1. Unarmed.
2. Iron Pipe.
3. Pistol.

Mouse wheel changes exactly one owned slot per normalized step and wraps at either end. The weapon HUD always shows current name and ammunition.

### Unarmed

- melee forward arc;
- one resilience damage;
- 32-unit range;
- fast commitment;
- low sound pressure;
- unlimited use.

### Iron Pipe

- melee forward arc;
- two resilience damage;
- 42-unit range;
- slower windup/recovery;
- stronger stagger and sound;
- unlimited use.

### Pistol

- hitscan;
- three resilience damage;
- 260-unit range;
- eight rounds;
- ammunition consumed on every valid shot, including misses;
- no reload/replenishment in the current slice;
- empty attacks produce feedback but no shot, damage or noise.

## 8. Melee and hitscan rules

### Melee

- uses weapon range and half-angle;
- every NPC/prop inside the arc can be hit once;
- one shared per-attack hit set prevents duplicate damage;
- pipe and unarmed use the same target/state infrastructure.

### Hitscan

The pistol creates one ordered ray across NPC and prop candidates.

A candidate must:

- be in front of the captured direction;
- be within range;
- intersect shot width plus entity radius;
- be on the current layer;
- have clear world geometry.

The closest valid candidate along the ray wins. A nearby NPC can block a farther lamp, a lamp can block a farther NPC and buildings block both.

## 9. NPC resilience and states

| NPC type | Resilience |
|---|---:|
| Civilian | 3 |
| Journalist | 3 |
| Police | 4 |
| Rooftop thug | 4 |
| Hunter | 5 |

State flow:

```text
active → staggered → downed → drained / killed
```

Downed NPCs cannot move, pursue, attack or report. Recovery is not implemented yet.

## 10. Contextual drain

### Downed drain

- target is downed;
- within range;
- aimed toward;
- clear geometry;
- approach angle does not matter.

### Rear stealth drain

- target is standing and unaware;
- player is behind its facing direction;
- within range and aimed toward;
- target is not alarmed, chasing, attacking, reacting or reporting.

### Channel

- right mouse must remain held;
- movement cancels;
- taking damage cancels;
- release cancels;
- range/layer/geometry loss cancels;
- witnesses and hearing continue evaluating.

Completion lowers Hunger and resolves the target as drained.

## 11. Player damage and Hunger

The player has no conventional health bar in the current slice.

- police melee: Hunger +12;
- hunter heavy strike: Hunger +20;
- hit stun: 260 ms;
- invulnerability: 720 ms;
- critical feedback: 85 Hunger;
- frenzy failure: 100 Hunger.

Invulnerability prevents overlapping enemies from instantly filling Hunger. Feeding functions as recovery.

## 12. World props

Streetlights are damageable props rather than E interactions.

- durability: one point;
- unarmed and pipe use the same melee arc as NPC combat;
- pistol uses the same ordered hitscan ray as NPC targets;
- misses do nothing;
- broken state removes light and creates a persistent shadow patch;
- glass feedback and prop/noise events fire once;
- E never exposes destruction.

## 13. Perception

### Vision

Confirmed sight uses facing, cone, range and layer. It promotes the appropriate response:

- police pursue/escalate;
- civilians and the journalist react/report;
- hunters/thugs become hostile or alarmed.

### Hearing

Sound uses event-specific ranges.

- heard-only NPCs stop and turn toward the source;
- `WTF` or investigate feedback appears;
- hearing alone does not pursue or report;
- later confirmed sight can promote the response.

Current sound hierarchy:

```text
quiet footsteps < punch < pipe impact < broken streetlight < gunshot
```

A gunshot emits even when it misses. Melee impact noise requires a confirmed hit.

## 14. Mission completion

Handling the journalist is not mission completion.

```text
journalist handled
  → objective becomes return to refuge
  → player reaches refuge
  → sire approval dialogue
  → player dismisses dialogue
  → mission marked complete
  → final report opens
```

The report never appears before the return objective and never precedes the sire's final dialogue.

## 15. UI and browser behaviour

- dialogue click owns input before combat;
- world-space `SPACE` marker shows selected traversal;
- target resilience appears briefly rather than permanently;
- downed state is visually obvious;
- weapon HUD shows equipped name and ammunition;
- wheel changes show an `EQUIPPED` toast;
- empty pistol uses warning feedback;
- right-click context menu is suppressed only over the game;
- wheel scrolling is suppressed only over the active game canvas while WeaponSystem owns it;
- normal scrolling remains outside the canvas;
- blur/pause/task reveal clear held and pending input;
- perception feedback should not permanently overcrowd the screen.

## 16. Acceptance criteria for the current combat-movement-weapon slice

- Aim remains accurate across supported sizes and zooms.
- Left mouse uses the equipped weapon in the aimed direction.
- Resilience counts and weapon damage are exact.
- One wheel gesture changes one slot and cannot leak through tutorial/UI locks.
- Pistol ammo decrements once and never becomes negative.
- Hitscan nearest-target and obstruction rules are deterministic.
- Overlapping enemy attacks respect invulnerability.
- Right mouse drains downed targets and unaware rear targets only.
- Taking damage raises Hunger.
- WASD runs without a modifier.
- Shift is measurably slower and quieter.
- Space performs traversal only.
- E never performs traversal, draining or streetlight destruction.
- Nearby traversal conflicts resolve deterministically.
- Hearing alone never automatically pursues or reports.
- Handling the journalist still requires returning to the refuge.
