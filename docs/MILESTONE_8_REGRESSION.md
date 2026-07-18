# Milestone 8 browser regression checklist

Use this checklist before changing Milestone 8 from 🟡 to ✅. Record browser, operating system, viewport, render quality and commit SHA.

## Required configurations

1. Laptop viewport around 1366 × 768 at Low quality.
2. Desktop viewport around 1920 × 1080 at Ultra quality.
3. Narrow viewport at or below 720 CSS pixels.
4. Resize during one active police chase.
5. Complete one full mission after the AI changes.

## State priority

- A heard-only NPC shows `WTF` and turns without pursuing or reporting.
- Confirmed visual violence immediately removes the heard-only marker.
- A staggered NPC does not move, attack or report.
- A downed NPC cannot patrol, chase, attack or report.
- A target being drained cannot simultaneously attack or flee.
- Dead, hidden and intercepted NPCs never regain lower-priority behaviour.
- No NPC displays contradictory `WTF`, witness, chase and attack feedback at the same time.

## Civilians and journalist

- A civilian who sees violence reacts briefly, then runs toward a report point.
- A civilian who only hears violence does not report.
- Hitting a fleeing civilian stops them for the stagger duration.
- A staggered witness resumes the same report afterward.
- Downing a witness cancels the report permanently.
- A downed witness never reaches a report point through residual velocity.
- The journalist follows the same rules before being handled.
- Journalist mission progression remains correct after weapon knockdown and drain.

## Police roles

- At wanted level 1, one visible officer closes to attack while others avoid stacking directly on the player.
- Only the designated attacker begins a baton telegraph.
- Containment officers move to different sides of the player.
- Soft separation prevents overlapping police cones/bodies during pursuit.
- Downing the attacker hands the role to another ready officer.
- An officer in attack recovery does not rapidly steal and lose leadership every frame.
- Officers that lose sight return to search rather than remaining frozen in chase.
- Heard-only police investigate without immediately attacking.
- Level 2 and 3 reinforcements still spawn and organize around the player.
- Three-sided containment can still trigger the established arrest rule.
- Level 3 helicopter behaviour remains functional.

## Rooftop thug tutorial

- The thug does not attack during his dialogue or the sire's instruction.
- The first confirmed player hit makes him hostile.
- His attack telegraph is visibly slower than a police baton attack.
- A confirmed thug hit raises Hunger by exactly 8.
- Invulnerability prevents several thug hits from stacking instantly.
- Four unarmed hits still knock him down.
- Pipe/pistol damage follows their configured resilience values.
- Once downed, the thug never recovers.
- Right-click drain and tutorial progression remain functional.

## Hunters

- A hunter who sees the player begins aggressive pursuit.
- The hunter aims ahead of a moving player rather than only following the current coordinate.
- Entering shadow does not cancel the chase immediately.
- The hunter continues to the last-known point for roughly 6.2 seconds.
- Reaching an empty last-known point shortens the remaining search.
- After memory expires, blood tracking, route blocking and church patrol resume.
- A hunter can attack in shadow only while valid pursuit memory remains.
- Hunter attack telegraph, Hunger +20 and invulnerability behaviour remain correct.

## Downed recovery

- Civilians remain down indefinitely.
- The journalist remains down until drained/killed or mission handling resolves it.
- The rooftop thug remains down indefinitely.
- A police officer rises after approximately 18 seconds if left unresolved.
- A recovered police officer returns with 2/4 resilience and a short stagger.
- A hunter rises after approximately 24 seconds if left unresolved.
- A recovered hunter returns with 3/5 resilience and hunt memory.
- Beginning a drain before recovery prevents the NPC from rising mid-channel.
- Completing a drain or kill prevents all later recovery.
- A recovered NPC is not duplicated and does not retain the flattened `DOWN` presentation.

## Weapons, props and perception regression

- Unarmed, pipe and pistol still damage the correct NPC/prop target.
- Gunshot sight creates the appropriate visual reaction.
- Gunshot hearing alone still creates only `WTF`.
- Streetlight break sight/hearing rules remain unchanged.
- Breaking a light during a chase does not demote chasing police to `WTF`.
- Wheel cycling, ammo and HUD remain functional during ordinary AI simulation.

## Mission regression

- Opening tutorial, informant, journalist objective and return-to-refuge finale all work.
- Handling the journalist still requires returning to the refuge.
- The final sire bubble still appears before `REPORT ACCEPTED`.
- Police recovery and reinforcements do not block the final report after mission success.

## Pass criteria

Milestone 8 may be marked ✅ only when:

- priority conflicts are absent throughout the complete mission;
- civilian reporting can be interrupted deterministically;
- one police attacker and containment roles are readable;
- hunter memory behaves consistently in and out of shadow;
- recovery timings and resilience values are exact;
- supported viewport/quality configurations pass;
- failures are fixed or explicitly recorded as known limitations.
