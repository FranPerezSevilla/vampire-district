# Control scheme decision

## Decision

Use a modern top-down keyboard-and-mouse layout rather than copying GTA2's keyboard-centric turning and attack controls.

The implemented scheme keeps GTA2-style immediacy and contextual city traversal while using mouse-directed combat, weapon selection, world destruction and a dedicated vampire drain action.

## Current bindings

| Input | World action |
|---|---|
| WASD / arrows | Run at the normal movement speed. |
| Hold Shift | Move slowly and generate much quieter footsteps. |
| Mouse | Aim and face. |
| Left mouse | Use equipped weapon. During dialogue, advances the bubble instead. |
| Right mouse | Hold to drain a valid downed, rear-approached or rat target. |
| Wheel | Previous/next owned weapon. |
| Space | Execute one contextual traversal route. |
| E | Talk, collect, inspect and use non-traversal interactions. |
| Q | Shadow Dash. |
| R | Vampiric Whisper. |
| F | Blood Sense. |
| M | Mission panel. |
| H | Menu/help. |
| Escape | Close UI or act as dialogue keyboard fallback. |

## Dialogue priority

- A visible dialogue bubble owns the next left click in the game frame.
- The click advances exactly one bubble and is discarded as a world action.
- Escape remains a fallback.
- Closing dialogue clears held/pressed world input and restores canvas focus.

## Movement behaviour

### Default run

WASD/arrows use the fast movement baseline without another key. Space has no speed effect.

### Quiet movement

Holding Shift applies a lower movement multiplier and substantially reduces footstep reactions. Ordinary NPCs only hear running inside the short range and ignore quiet footsteps; police and hunters retain enhanced hearing.

### Facing

- The player faces the cursor's world position.
- The last valid direction is retained inside the aim dead zone.
- Movement direction does not override aim.
- Attacks store their direction at start.

## Primary attack

- Left mouse uses the equipped weapon toward the cursor.
- Starting inventory is Unarmed, Iron Pipe and Pistol.
- One press starts one timed attack; holding does not hit every frame.
- Windup, active and recovery phases control commitment.
- One attack cannot damage the same NPC or prop twice.
- Melee weapons share the forward-arc contract.
- The pistol uses one nearest-target hitscan ray across NPCs and props.
- A baseline streetlight breaks after one confirmed attack from any current weapon.
- UI, dialogue, transitions, hit stun and active drain suppress attacks.

## Weapon cycling

The wheel owns a discrete `weaponStep` action.

- Wheel down advances one inventory slot.
- Wheel up moves back one slot.
- Selection wraps at either end.
- Rapid wheel/trackpad input is coalesced to one signed step per simulation frame.
- The opening tutorial blocks weapon cycling until full control is restored.
- Active attacks, draining, hit stun, transitions and menus suppress cycling.
- The HUD displays equipped weapon and ammunition.
- The pistol has eight rounds and no reload action in the current slice.

The browser page does not scroll while the pointer is over the playable canvas because `WeaponSystem` owns wheel capture. Normal browser scrolling remains available outside the canvas.

## Drain rules

Right mouse is the final drain input.

Valid target priority:

1. Downed target in range and aimed toward.
2. Rat in range and aimed toward.
3. Unaware standing target approached from its rear arc.
4. No action.

Standing targets are invalid when alert, chasing, attacking, reacting or reporting. The channel cancels on release, movement, damage, range/layer loss or blocked geometry.

E does not drain.

## Traversal rules

Space selects exactly one valid traversal candidate.

Candidate requirements:

- current layer;
- enabled world/mission state;
- within activation radius;
- valid destination;
- no active transition, combat lock, dialogue or drain.

Selection order:

1. A route within 12 units and inside the forward aim threshold.
2. Shortest world distance.
3. Smallest aim angle.
4. Existing route priority.
5. Stable candidate ID.

The same selection drives the world `SPACE` marker, HUD prompt and actual execution.

Examples:

- Space beside a rooftop gap: jump.
- Space beside a manhole: enter sewer.
- Space at a fire escape: climb or descend.
- Space with no route: no action.

## E interaction rules

E can:

- speak to NPCs;
- collect mission clues;
- inspect/use mission objects;
- manipulate evidence or bodies where supported;
- confirm contextual non-movement interactions.

E does not:

- run;
- jump or climb;
- use sewers;
- attack;
- drain;
- break streetlights;
- change or reload weapons.

## Browser rules

- Right-click context menu is suppressed only over the game canvas.
- Wheel scrolling is suppressed only while the active weapon system owns the canvas wheel.
- Pointer-held actions clear on blur and pointer leave.
- Dialogue clicks never leak into combat or prop damage.
- Space/Shift/wheel state clears across pause, task reveal and focus loss.

## Accessibility and future work

Planned:

- remappable bindings;
- keyboard-only aim fallback;
- optional click-to-toggle drain;
- high-contrast reticle;
- reduced screen shake;
- wheel-direction preference;
- reload/replenishment input and inventory UI;
- gamepad mapping through the same abstract actions.

## Acceptance checklist

Implemented in code, browser validation still pending unless noted:

- [ ] Aim remains accurate after resizing and every camera zoom.
- [ ] Dialogue click advances exactly one bubble and never becomes an attack.
- [ ] Left mouse attacks once per valid cadence.
- [ ] Three punches down a civilian; four down a police officer.
- [ ] One aimed attack breaks a baseline streetlight; a miss does not.
- [ ] E never exposes streetlight destruction.
- [ ] Right-click cannot front-drain an alert standing target.
- [ ] Right-click never opens the browser menu over the game.
- [ ] Space never changes speed or activates Dash.
- [ ] Shift produces slower, quieter movement.
- [ ] E never selects a traversal route.
- [ ] Two nearby traversal points resolve deterministically.
- [ ] Wheel changes one owned weapon step without scrolling the page.
- [ ] Pistol ammo decrements once and never becomes negative.
- [ ] Buildings and nearer entities block farther pistol targets.
