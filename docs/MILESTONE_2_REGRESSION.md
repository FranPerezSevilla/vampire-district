# Milestone 2 browser regression checklist

Use this checklist before changing Milestone 2 from 🟡 to ✅. Record browser, operating system, viewport, render quality and commit SHA.

## Required configurations

1. Laptop viewport around 1366 × 768 at **Low** quality.
2. Desktop viewport around 1920 × 1080 at **Ultra** quality.
3. Narrow viewport at or below 720 CSS pixels at **High** or **Very high** quality.
4. Resize the browser during at least one run without reloading.

## Aim and facing

- Moving the cursor rotates the player toward the pointer.
- The short aim line points at the same world location as the cursor direction.
- Cursor movement near the player does not make facing flicker or collapse.
- Moving the cursor out of the canvas preserves a stable last direction but does not leave a held attack.
- Aim remains correct after resizing.
- Aim remains correct on street, low roof, high roof and sewer camera zooms.
- Aim remains correct after task-reveal zooms and dialogue camera movement.

## Attack lifecycle

- One left click starts one punch.
- Holding left mouse does not create repeated automatic hits.
- The attack shows windup, active and recovery feedback.
- Movement pauses briefly during windup/active and returns during recovery/end.
- Space and E do not execute while the attack is recovering.
- Clicking during pause, dialogue or task reveal does not queue an attack.
- The click used to advance the last dialogue bubble is not reused as a punch.

## Hit geometry

- A target directly in front and within range is hit.
- A target behind the player is not hit.
- A target clearly outside the arc is not hit.
- A target beyond range is not hit.
- Moving the cursor after attack start does not bend the active punch.
- One attack cannot remove more than one resilience point from the same NPC.
- Two NPCs inside the same arc may each receive one hit.

## Resilience counts

- Civilian goes down after exactly 3 valid punches.
- Journalist goes down after exactly 3 valid punches.
- Police officer goes down after exactly 4 valid punches.
- Rooftop thug goes down after exactly 4 valid punches.
- Hunter goes down after exactly 5 valid punches when active.
- Missed attacks do not reduce resilience.

## Stagger and downed behaviour

- A hit briefly stops or reacts the standing NPC.
- Remaining resilience appears only briefly rather than permanently.
- At zero resilience the NPC is visibly flattened and labelled `DOWN`.
- The legacy `STUNNED` marker does not appear on a downed NPC.
- A downed NPC does not patrol, flee, pursue or report.
- A downed police officer does not contribute to surrounding/arrest logic.
- A downed NPC cannot be punched for additional resilience damage.
- Draining or killing a downed NPC replaces the downed presentation with the normal corpse state.

## Rooftop tutorial

- Thug speaks before the sire instruction.
- Tutorial text instructs mouse aim and left click.
- Right-click drain is unavailable while the thug is standing.
- Four punches knock the thug down.
- After knockdown, the tip changes to `RMB` drain.
- Aiming at the thug and holding right mouse starts the drain channel.
- E does not drain the thug.
- Completing the drain advances to the Hunger lesson.
- The police-roof jump opens while the thug is down and remains open after drain.

## Witness and police compatibility

- Punching a civilian creates the expected ordinary-violence response.
- A standing civilian victim can flee/report.
- A downed civilian victim cannot report.
- Punching police raises police pressure.
- Downing police does not leave that officer actively pursuing.
- Other witnesses/police react once rather than receiving duplicate stacked alerts from one hit.

## Journalist and mission finale

- Killing or draining the journalist changes the active objective to returning to the rooftop refuge.
- Handling the journalist does not immediately open the mission-complete report.
- Reaching the refuge starts a sire dialogue bubble before mission completion is published.
- The sire says: `Well done. You silenced the journalist and returned as ordered. The veil holds. You have served me well tonight.`
- The world remains locked while the sire bubble is visible.
- Dismissing that bubble opens the final `REPORT ACCEPTED` modal.
- The report modal does not repeat the same sire speech; it shows the outcome summary and night statistics.
- The success report cannot appear before the return-to-refuge objective is reached.

## UI and browser ownership

- Left-click advances dialogue while a bubble is open.
- Left-click attacks only when world input is enabled.
- Right-click drains only when world input is enabled and a valid target exists.
- Right-click does not open the browser context menu over the canvas.
- Menus, mission drawer and result screens retain input ownership.
- Losing window focus clears held mouse and keyboard state.

## Pass criteria

Milestone 2 may be marked ✅ only when:

- all required configurations pass;
- hit counts and geometry are consistent;
- no attack leaks through a UI/dialogue lock;
- the full rooftop tutorial can be completed;
- downed NPCs are excluded from active AI behaviour;
- the journalist objective requires a real return to the refuge;
- the finale always appears in the order sire dialogue → final report;
- failures are fixed or recorded as known limitations.
