# Milestone 7 browser regression checklist

Use this checklist before changing Milestone 7 from 🟡 to ✅. Record browser, OS, viewport, render quality and commit SHA.

## Required configurations

1. Laptop viewport around 1366 × 768 at Low quality.
2. Desktop viewport around 1920 × 1080 at Ultra quality.
3. Narrow viewport at or below 720 CSS pixels.
4. Resize during at least one run without reloading.
5. Test with a mouse wheel and, when available, a trackpad.

## Tutorial and input ownership

- Opening tutorial begins with Unarmed equipped.
- Wheel input does not change weapons during movement-only, thug-combat or clue tutorial modes.
- After full control is restored, one wheel gesture changes exactly one weapon slot.
- Wheel direction is consistent: down advances, up goes back.
- Cycling wraps Unarmed → Iron Pipe → Pistol → Unarmed.
- Page does not scroll while the pointer is over the active game canvas.
- Page can still scroll when the pointer is outside the game.
- Dialogue, pause, task reveal, result screens, active drain and hit stun suppress weapon changes.
- Losing focus clears wheel/input edges without an unexpected later switch.

## Weapon HUD

- Bottom-left indicator is readable without covering Hunger, mission, prompt or power UI.
- It updates immediately after every wheel step.
- Unarmed and Iron Pipe show unlimited ammo.
- Pistol starts at 8/8.
- Every pistol shot decrements once, including misses.
- Empty pistol displays a warning state and an EMPTY toast.
- HUD remains aligned after resizing and across Low/Ultra render quality.
- Final report includes equipped weapon and ammo.

## Unarmed regression

- Unarmed still uses the existing three/four/five resilience expectations.
- Rooftop thug still requires four valid punches.
- Right-click drain after knockdown still works.
- Unarmed can still break a streetlight with one valid hit.
- Existing attack timing, movement lock and aim behaviour remain unchanged.

## Iron Pipe

- Pipe has visibly longer reach than Unarmed.
- Pipe removes two resilience points on a valid hit.
- A civilian goes down in two pipe hits.
- A police officer goes down in two pipe hits.
- A hunter goes down in three pipe hits.
- One swing cannot damage the same NPC or prop twice.
- Multiple entities inside the same melee arc can each receive one hit.
- Pipe impact creates stronger heard-only reactions than a punch.
- Pipe breaks a streetlight on a valid hit and misses behind/outside the arc.

## Pistol hitscan

- Pistol begins with 8 rounds.
- One click starts one shot; holding does not fire every frame.
- A shot uses the direction captured at attack start.
- Tracer aligns with the cursor direction at every camera zoom.
- A civilian is downed by one shot.
- Police and hunter resilience changes match three damage points.
- The closest valid target on the ray is hit.
- A nearer NPC blocks a farther NPC or streetlight.
- A nearer streetlight blocks a farther NPC when the ray intersects it first.
- Targets behind the player are not hit.
- Clearly off-line targets are not hit.
- Targets beyond pistol range are not hit.
- Buildings block shots.
- Shooting from street, rooftops and sewer never hits entities on another layer.
- A pistol shot can break a streetlight at range.
- Empty pistol clicks do not create a tracer, damage, noise or negative ammo.

## Noise and AI reactions

- A gunshot emits noise even when it misses.
- Police who see the shot begin pursuit and add strong pressure.
- Civilians who see it enter witness behaviour.
- Hunters/thugs who see it become alarmed.
- NPCs who only hear the gunshot turn and show WTF.
- Hearing alone does not start pursuit or reporting.
- Downed, dead, inactive and mission-informant NPCs do not react.
- Visual and auditory responses do not duplicate into multiple stacked alerts from one shot.

## Police violence escalation

- The first confirmed hit against a police officer raises the HUD to at least level 1.
- Downing that officer raises the HUD to level 2.
- Downing a second distinct officer raises the HUD to level 3.
- Level 3 activates the strongest police response and helicopter support.
- Repeated hits on the same already-downed officer do not add another neutralization level.
- Killing or draining through the remaining legacy interaction path uses the same escalation rule.
- Escalation remains stable for more than one frame while standing in a broken-light shadow.
- Local patrols redirect toward the violence and reinforcements spawn for the resulting level.

## Props and darkness

- Unarmed, pipe and pistol all share the same streetlight durability state.
- A streetlight broken by one weapon cannot be damaged again by another.
- Broken light remains dark after cycling weapons, traversing and returning.
- E never exposes a streetlight-break interaction.
- Prop count in the final report remains correct.

## Complete mission regression

- Rooftop tutorial can be completed without switching weapons.
- Police informant, journalist objective and return-to-refuge finale remain functional.
- Journalist can be handled by knockdown/drain, legacy kill interaction or weapon damage followed by the intended handling path.
- Mission does not complete until the player returns to the refuge.
- Sire dialogue still appears before REPORT ACCEPTED.

## Pass criteria

Milestone 7 may be marked ✅ only when:

- all required configurations pass;
- wheel ownership never leaks through UI/tutorial locks;
- melee and hitscan damage are deterministic;
- ray obstruction and nearest-target ordering are correct;
- ammo cannot duplicate or become negative;
- weapon noise preserves sight-versus-hearing rules;
- police violence escalates progressively and does not stick at level 1;
- full mission regression passes;
- failures are fixed or recorded as known limitations.
