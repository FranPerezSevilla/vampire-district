# Control scheme decision

## Decision

Use a modern top-down keyboard-and-mouse layout rather than copying GTA2's keyboard-centric turning and attack controls.

The implemented scheme keeps GTA2-style immediacy and contextual city traversal while using mouse-directed combat, weapon selection, world destruction, dedicated vampire actions and arcade vehicle controls.

## Current bindings

| Input | World action |
|---|---|
| WASD / arrows | Run on foot. While driving: accelerate/brake/reverse and steer. |
| Hold Shift | Move slowly and generate much quieter footsteps. |
| Mouse | Aim and face. |
| Left mouse | Use equipped weapon. During dialogue, advances the bubble instead. |
| Right mouse | Hold on a valid target; release for Quick Bite or Full Feed, or continue to Drain. |
| Wheel | Previous/next owned weapon on foot; previous/next radio station or OFF while driving. |
| Space | On foot: execute one contextual traversal route. In a vehicle: hold the handbrake to initiate or sustain a drift. |
| Enter | Enter/exit a vehicle; near a bus, choose **Subir como pasajero** or **Robar autobús**. While riding, request a safe exit when stopped. |
| E | Talk, collect, inspect and use non-traversal interactions. |
| Q | Shadow Dash. |
| R | Vampiric Whisper. |
| F | Blood Sense. |
| B | Give In to the Beast; voluntary short predator burst with Hunger and evidence risk. |
| M | Mission panel. |
| H | Horn while driving. |
| L | Paused Night Ledger. |
| Escape / Menu | Open pause/help/accessibility, or close the active UI/dialogue. |

## Bus and radio interaction

Bus boarding requires a stopped materialized bus and available passenger capacity. The existing chooser owns selection and confirmation; passenger mode suppresses walking, weapons and powers while the player follows the real bus. Theft uses the existing transient vehicle transfer.

The driving wheel cycles OFF → Vice FM → Night Shift → Pulse 94.6. Entering/re-entering a driven vehicle joins the selected station's current broadcast song/offset. Leaving stops that receiver while the station timeline continues. Nearby civilian cars provide quiet ambient radio from the shared clocks.

## Dialogue priority

- A visible dialogue bubble owns the next left click.
- The click advances exactly one bubble and is discarded as a world action.
- Escape remains a fallback.
- Closing dialogue clears held/pressed world input and restores canvas focus.

## Movement behaviour

### Default run

WASD/arrows use the fast movement baseline without another key. On foot, Space has no speed effect.

### Quiet movement

Holding Shift applies a lower movement multiplier and substantially reduces footstep reactions. Ordinary NPCs only hear running inside the short range and ignore quiet footsteps; police and hunters retain enhanced hearing.

### Facing

- The player faces the cursor's world position.
- The last valid direction is retained inside the aim dead zone.
- Movement direction does not override aim.
- Attacks store their direction at start.

## Vehicle controls

```text
Enter      enter or exit
W          accelerate
S          brake, then reverse
A / D      steer
Space      handbrake / drift
E          inspect a nearby trunk while on foot
```

Rules:

- Enter only selects `vehicleEnter` or `vehicleExit`; it cannot trigger jumps, sewers or fire escapes.
- Space cannot enter or exit a vehicle.
- Low-speed acceleration receives a smooth launch boost which fades near maximum speed.
- The vehicle body heading and actual travel heading are modeled independently.
- Holding Space reduces grip, preserves part of the throttle and increases steering authority, allowing the nose to rotate while lateral momentum continues.
- Releasing Space restores normal grip and progressively aligns the travel direction with the body.
- Normal exit requires low speed.
- A destroyed occupied vehicle stops but does not eject the player automatically.
- Enter remains available inside a destroyed vehicle and exits through the first safe side/rear point.
- Building contact advances to the furthest safe point, then tries long-to-short wall slides before treating the car as fully blocked.
- Fully blocked contact retains a small forward speed rather than producing a reverse bounce.
- Combat, drain, powers and weapon cycling remain disabled while driving.

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

The historical mission tutorial showed a compact `WHEEL` prompt after the police informant left; that authored tutorial is disabled in normal production. That historical prompt consumed the existing `weapon:changed` event and showed a brief `LMB` confirmation; it is not a normal-production teaching gate.

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

Space selects exactly one valid on-foot traversal candidate.

Candidate requirements:

- current layer;
- enabled world/mission state;
- within activation radius;
- valid destination;
- no active transition, combat lock, dialogue or drain;
- player is not occupying a vehicle.

Selection order:

1. A route within 12 units and inside the forward aim threshold.
2. Shortest world distance.
3. Smallest aim angle.
4. Existing route priority.
5. Stable candidate ID.

The same selection drives the world `SPACE` marker, HUD prompt and actual execution. Vehicle prompts use `ENTER` instead.

Examples:

- Space beside a rooftop gap: jump.
- Space beside a manhole: enter sewer.
- Space at a fire escape: climb or descend.
- Space beside a parked car: no vehicle action.
- Enter beside a parked car: enter it.
- Space with no route: no action.

## E interaction rules

E can:

- speak to NPCs;
- collect mission clues;
- inspect/use mission objects;
- inspect a nearby vehicle trunk;
- manipulate evidence or bodies where supported;
- confirm contextual non-movement interactions.

E does not:

- run;
- jump or climb;
- use sewers;
- enter or exit vehicles;
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
- Enter remains a UI confirmation key while a modal owns focus; vehicle handling only applies to the enabled world.

## Accessibility

Implemented:

- remappable gameplay bindings through the existing pause UI and `input/bindings.js`, persisted locally;
- Pause Menu button for `High-contrast aim: On / Off`.
- The high-contrast reticle uses black outline, white core, larger ring and cross mark rather than weapon colour alone.
- The preference is stored locally under `nbd-aim-high-contrast`.
- Hunger exposes progress values; wanted, weapon and vehicle HUDs expose textual live state.
- Mission/Menu expose `aria-expanded`; the aim toggle exposes `aria-pressed`.
- Visible keyboard focus outlines.
- Reduced-motion preference removes non-essential HUD/tutorial animation.

Planned or deferred:

- keyboard-only aim fallback;
- optional click-to-toggle drain;
- reduced camera shake;
- wheel-direction preference;
- reload/replenishment input and inventory UI;
- gamepad mapping through the same abstract actions.

## Acceptance checklist

Implemented in code, browser validation still pending unless noted:

- [ ] Aim remains accurate after resizing and every camera zoom.
- [ ] Dialogue click advances exactly one bubble and never becomes an attack.
- [ ] Left mouse attacks once per valid cadence.
- [ ] Three punches down a civilian; four down a police officer.
- [ ] Retired streetlight damage/stealth does not become a gameplay action.
- [ ] E never exposes streetlight destruction.
- [ ] Right-click cannot front-drain an alert standing target.
- [ ] Right-click never opens the browser menu over the game.
- [ ] Space never activates vehicle entry or exit.
- [ ] Enter never selects an on-foot traversal route.
- [ ] Space handbrake creates sustained lateral slip while preserving useful speed.
- [ ] Releasing Space progressively restores grip.
- [ ] A destroyed occupied vehicle retains its occupant until Enter.
- [ ] Oblique wall collisions permit long-to-short sliding.
- [ ] Head-on contact does not force a reverse bounce.
- [ ] Shift produces slower, quieter movement.
- [ ] E never selects a traversal route.
- [ ] Two nearby traversal points resolve deterministically.
- [ ] Wheel changes one owned weapon step without scrolling the page.
- [ ] Driving wheel input changes radio without cycling weapons; on-foot wheel input changes weapons.
- [ ] Pistol ammo decrements once and never becomes negative.
- [ ] Buildings and nearer entities block farther pistol targets.
- [ ] High-contrast aim remains aligned and keyboard-operable.