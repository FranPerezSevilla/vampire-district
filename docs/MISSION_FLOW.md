# Journalist mission flow

_Status: implemented in the current vertical slice._

## Functional completion rule

Neutralizing the journalist is not mission completion. Killing or draining the journalist completes the target-handling objective and advances the mission to the return phase.

The mission is complete only after the player reaches the rooftop refuge.

## Final sequence

The required presentation order is:

1. Journalist is killed or drained.
2. Active objective becomes `Return to the rooftop refuge and report`.
3. The player travels back to the high-rooftop refuge.
4. Entering the refuge locks world input.
5. The sire speaks in a player-anchored thought bubble:

   > Well done. You silenced the journalist and returned as ordered. The veil holds. You have served me well tonight.

6. The player dismisses the bubble with left click or the Escape fallback.
7. Only then does `MissionSystem` set `completed = true` and publish the success result.
8. `UIScene` opens `REPORT ACCEPTED` with the outcome summary and night statistics.

The final report does not repeat the sire's complete speech; the approval belongs to the in-world dialogue layer, while the modal is a report and statistics layer.

## Technical ownership

- `MissionSystem.resolveJournalistPlaceholder()` advances the mission from target handling to return step 3.
- `MissionSystem.marker()` exposes the high-rooftop `REPORT` objective during step 3.
- `phaser/src/mission-return-finale.js` intercepts the step-3 refuge arrival before the legacy immediate-completion branch can run.
- The finale module uses `TutorialDirector` dialogue, control modes and world freezing so input cannot leak into the report transition.
- Success is published only after `showDialogue()` resolves.
- `phaser/src/final-report-sire.js` owns the report modal presentation after the dialogue.

## Invariants

- Journalist death away from the refuge never publishes `missionResult: complete`.
- Merely entering the refuge before handling the journalist does nothing.
- The finale cannot run twice.
- Failure state prevents the success finale.
- The report modal cannot appear beneath or before the sire bubble.
- The click used to dismiss the sire bubble cannot become an attack.

## Regression checks

- Kill the journalist and remain near the nightclub: mission stays active at step 4/4.
- Drain the journalist and remain near the nightclub: mission stays active at step 4/4.
- Return by street/fire escape and verify the sire bubble appears at the refuge.
- Return by sewer/private shaft and verify the same sequence.
- Dismiss the bubble and verify `REPORT ACCEPTED` appears immediately afterward.
- Verify the report includes the final stats captured after the return journey.
