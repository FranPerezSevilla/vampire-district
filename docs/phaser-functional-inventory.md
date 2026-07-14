# Night Blood District — Functional Inventory before Phaser migration

This document freezes the current functional design before migrating the prototype from vanilla Canvas to Phaser. It is intentionally gameplay-first: Phaser is an implementation detail, not a reason to change the game.

## 1. Core fantasy

Night Blood District is a top-down 2D vampire sandbox prototype: GTA-like urban crime pressure, but with vampire rules instead of cars and guns.

Player fantasy:

- You are a vampire responsible for a district.
- A journalist is about to expose the clan.
- You must find, isolate, eliminate, and manage evidence.
- The district reacts: witnesses, police, hunters, blood trails, heat, rooftops, sewers.
- The interesting play is not pure stealth; it is committing supernatural crimes and surviving the consequences.

Design pillar:

- Crime-first sandbox, not a stealth puzzle.
- Supernatural power is available, but every public mistake escalates heat.
- Rooftops and sewers are escape networks, not decorative layers.
- The refuge must be a readable physical place, not a hidden state that freezes play.

## 2. Current controls

Current prototype uses keyboard controls:

- WASD / arrows: move directly.
- Shift: sprint.
- E: interact / feed / drag body / hide body / intercept witness / routes.
- Q / Space: Shadow Dash.
- R: Whisper / lure.
- F: Blood Sense.
- H: help.
- P: feedback.

Important decision:

- Movement is direct top-down movement. Do not migrate to classic GTA tank controls.

## 3. Layers and traversal

Current gameplay layers:

- `LAYER.SEWER = -1`
- `LAYER.STREET = 0`
- `LAYER.ROOF_LOW = 1`
- `LAYER.ROOF_HIGH = 2`

Current intended traversal:

- The player starts on a high rooftop refuge.
- Street contains witnesses, police escalation, lights, bodies, dumpsters, alleys.
- Low rooftops connect buildings through fire escapes and jumps.
- High rooftop is mainly the refuge / strategic overview.
- Sewers mirror the two main avenues and provide escape and cleanup.

Current known issue to avoid in Phaser:

- `player.inSafehouse` caused confusion and freezing. In Phaser, the refuge should be a physical rooftop zone detected by position, not a separate movement-disabling state.

## 4. District layout

Current district design:

- Two major avenues crossing.
- Smaller alley network.
- Default world is dark / shadow.
- Light sources carve visible danger zones.
- Police station is an authority spawn anchor.
- Church is hunter spawn / occult pressure anchor.
- Club is the journalist mission anchor.
- Rooftop refuge is the player start and return point.
- Dumpsters in alleys are body hide spots.
- Sewer manholes connect street to sewer routes.

Important desired readability:

- It must be obvious what is street, roof, sewer, light, shadow, refuge, fire escape, jump, and hide spot.
- The refuge should read as a roof base, not as an invisible interior.

## 5. Mission flow

Current mission target:

1. Leave rooftop refuge.
2. Reach the nightclub.
3. Use Blood Sense to identify the journalist.
4. Whisper / lure the journalist.
5. Lead the journalist into shadow.
6. Eliminate the journalist.
7. Hide evidence or break pursuit.
8. Return to rooftop refuge.
9. Accept clan report.
10. Unlock free roam.

Important evolution:

- Hiding the body should improve the report, but should not always hard-block completion.
- Returning to the refuge should mean physically reaching the rooftop refuge zone.

## 6. Hunger and Beast

Current hunger rules:

- Hunger does not increase passively over time.
- Hunger increases through powers.
- Hunger decreases by feeding.
- High hunger makes the Beast stronger and less discreet.

Power costs:

- Dash: +12 hunger.
- Whisper: +8 hunger.
- Blood Sense: +3 hunger.

Feeding relief:

- Journalist / target: large hunger reduction.
- Civilian: medium hunger reduction.
- Rat: small emergency hunger reduction.

Current Beast stages:

- Control.
- Hunger high.
- Beast close.
- Frenzy.

Design intent:

- Powers remain available, but push the player toward risky feeding.
- High hunger should create pressure, not a simple fail state.

## 7. Feeding rules

Feeding should be one of the strongest escalation actions when public.

Current intended rule:

- Feeding in shadow / unseen can be clean.
- Feeding in public creates immediate witness alarm.
- Public feeding should force at least alert level 2.
- Public feeding with multiple witnesses / high hunger can push toward level 3.
- Brutal feeding creates blood, noise, heat, and hunter interest.
- Rats in sewers give low-value food without public exposure.

Migration priority:

- Implement feeding as a stateful action with a progress timer.
- Player movement cancels feeding.
- Completion kills the victim, spawns body/evidence, and changes hunger/exposure.

## 8. Exposure / wanted level

Exposure is the supernatural wanted level.

Levels:

- Level 0: clean.
- Level 1: civilians nervous, not full police chase.
- Level 2: police dispatched.
- Level 3: police pressure rises.
- Level 4: hunters notice.
- Level 5: blood hunt level.

Rules:

- Breaking one streetlight should force level 1.
- Breaking many streetlights quickly should force level 2.
- Public feeding should force level 2 minimum.
- Repeated supernatural mistakes should move toward hunters.

## 9. Local heat

Local heat tracks where trouble happened.

Sources:

- Breaking lights.
- Witness reports.
- Public feeding.
- Blood discovery.
- Police / hunter investigation.

Uses:

- Dynamic patrol route redirection.
- Hot zones visible in UI / Blood Sense.
- Threats should spawn or investigate around high-heat areas.

## 10. Witness system

Witnesses are civilians or targets who see illegal / supernatural actions.

Witness behavior:

- See event.
- Become alarmed.
- Run toward report point.
- Can be intercepted by the player.
- If report succeeds, exposure and local heat rise.

Report points:

- Police station.
- Central crossroad.
- Club crowd.

Important design note:

- Witnesses must be legible. The player should understand who saw what and where they are running.

## 11. Police system

Police are not constantly visible from the start.

Rules:

- Police spawn from the police station once exposure reaches wanted levels.
- Police investigate noises, blood, vandalism, and reports.
- Police chase on level 2+.
- Police do not follow into rooftops / sewers in the current prototype.

Phaser migration:

- Use spawn anchors and stateful AI.
- Do not overbuild pathfinding in phase 1; simple steering is enough.

## 12. Hunter system

Hunters are occult threats.

Rules:

- Hunters are hidden at first.
- They emerge from church / occult anchors or from blood/supernatural evidence.
- They should not respond to normal vandalism too early.
- Hunters become relevant at high exposure, brutal blood, or occult mistakes.
- Hunters can block routes instead of just chasing.

Migration priority:

- Keep hunter as advanced layer after basic police/witness flow works.

## 13. Light and shadow

Important world rule:

- The district is mostly shadow by default.
- Active lamps create visible danger zones.
- Breaking lamps creates new shadow but raises alert.

Current mechanics:

- Lamps have radius.
- Broken lamps create darkness.
- Breaking lamps increases local heat and exposure.
- Repeated breaks trigger police pressure.

Phaser migration:

- Phase 1 can use drawn circles/overlays.
- Later phase can use Phaser lights or custom shaders only if needed.

## 14. Bodies and evidence

Bodies:

- Dead NPCs persist.
- Bodies can be dragged.
- Bodies can be hidden.
- Visible bodies can be discovered by NPCs.

Hide spots:

- Dumpsters in alleys.
- Sewers.
- Rooftops / refuge may count as safe evidence handling only if it reads clearly.

Blood:

- Feeding can create blood stains.
- Brutal feeding creates larger/more stains.
- Blood can be discovered by police/hunters.
- Sewers can clean/dilute evidence.

Important design choice:

- Dragging a body should be visually risky, but should not automatically create noise or blood trails.

## 15. Sewer system

Sewers:

- Separate layer.
- Mirror the top-level avenues and alleys.
- Connect through manholes.
- Let the player break pursuit.
- Clean/dilute blood evidence.
- Spawn rats occasionally.

Rats:

- Sewer-only NPCs.
- Feedable.
- Low hunger reduction.
- Should not be treated like civilians by public witness rules.

## 16. Rooftop system

Current desired rooftop gameplay:

- Rooftops are a real network, not isolated rooms.
- Fire escapes should exist for all major buildings.
- Player can jump between nearby buildings.
- Rooftops provide escape, positioning, and district overview.
- High rooftop refuge is the base.

Migration priority:

- Implement clear graph-based traversal nodes instead of dozens of ad-hoc interactables.
- Each node should specify origin layer, destination layer, coordinates, label, and type: fire escape, jump, drop, ladder, sewer.

## 17. Interaction system

Current issue:

- E tries to auto-decide too much.
- Multiple overlapping interactions become confusing.

Desired system:

- If exactly one clear action is available, E can execute it.
- If multiple actions exist, E opens a paused modal.
- Modal options include action label and risk detail.
- Selection via W/S, arrows, Enter/E, Esc.

In Phaser:

- Implement this as UI Scene or overlay container.
- Gameplay scene should pause or block simulation while menu is open.

## 18. UI and feedback

Current UI:

- HUD hunger.
- HUD exposure.
- Dash/Whisper/Sense cooldowns.
- Layer/status text.
- Mission text.
- Message line.
- Legend line explaining sight/noise/trail/witness/zone.
- Help overlay.
- Feedback form.
- Sound panel.

Migration rule:

- HUD can remain DOM initially while Phaser handles the world.
- Later, convert HUD to Phaser UI scene only if useful.

## 19. Audio

Current rule:

- Only footsteps and sprint steps are approved from asset audio.
- Other generated/procedural sounds were mostly rejected.

Migration rule:

- Carry the audio manifest concept forward.
- Start with footstep and sprint step only.
- Add new sounds manually one by one.

## 20. Non-goals during first Phaser pass

Do not migrate everything at once.

Avoid in phase 1:

- Full asset pipeline.
- Tilemap editor dependency.
- Complex physics.
- Perfect NPC AI.
- Shader lighting.
- Full refactor of every system.
- Recreating every bug-compatible behavior.

First goal:

- A Phaser vertical slice where the player can move around the redesigned district, traverse street/roof/sewer/refuge, and use the interaction modal without freezing.
