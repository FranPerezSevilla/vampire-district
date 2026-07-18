# Milestone 4 browser regression checklist

Use this checklist before changing Milestone 4 from 🟡 to ✅. Record browser, operating system, viewport, render quality and commit SHA.

## Required configurations

1. Laptop viewport around 1366 × 768 at **Low** quality.
2. Desktop viewport around 1920 × 1080 at **Ultra** quality.
3. Narrow viewport at or below 720 CSS pixels at **High** or **Very high** quality.
4. Resize during at least one drain attempt without reloading.

## Right-button ownership

- Right-click inside the game does not open the browser menu.
- Right-click outside the game retains normal browser behaviour.
- A right click during dialogue, pause, task reveal or result UI does not queue a drain.
- Releasing the button before completion cancels the drain.
- Holding the button after completion does not immediately start a second drain.
- Losing window focus or leaving the canvas cancels held drain input.

## Downed targets

- A civilian becomes drainable after exactly three punches.
- A police officer becomes drainable after exactly four punches.
- The rooftop thug becomes drainable after exactly four punches.
- A downed target can be drained from its front, side or rear.
- The player must still aim toward the target.
- A target outside start range is not selected.
- Moving beyond break range cancels the channel.
- A wall or invalid route boundary prevents or cancels the drain.

## Standing rear drain

- An unaware civilian is drainable from behind.
- The journalist is drainable from behind before being punched when unaware.
- A patrolling police officer is drainable from behind when they have not seen the player.
- The same target is not drainable from the front.
- An alarmed civilian is not drainable from behind.
- A chasing police officer is not drainable.
- A police officer during an attack windup is not drainable.
- An active hunter in hunt mode is not standing-drainable.

## Target selection

- A valid target receives a compact `RMB · DRAIN` marker.
- A downed target is preferred over a standing target when both are valid.
- Within the same category, the closer and better-aligned target is selected.
- A target clearly outside the aim direction is not selected.
- An invalid right click briefly shows `NO VALID DRAIN` and does nothing else.

## Channel and interruption

- `HOLD RMB` remains visible during the channel.
- Feeding progress advances only while the channel remains valid.
- Movement cancels immediately and movement resumes normally.
- A police or hunter hit cancels the drain and adds Hunger.
- A cancelled drain does not kill the victim or lower Hunger.
- A completed drain lowers Hunger once and creates the normal body/evidence state.
- The victim cannot move, attack or report during the channel.

## Vision and hearing

- A civilian or journalist who sees the drain enters veil-witness behaviour.
- A police officer who sees it raises police pressure.
- An NPC who only hears the struggle turns toward it and shows `WTF`.
- Hearing alone does not start pursuit or reporting.
- The victim never counts as a witness to their own drain.
- A completed public drain still follows the established veil-failure rules if a witness reports it.

## Rooftop tutorial

- Tutorial copy says left-click to knock down and hold right mouse to drain.
- The standing thug is not right-click drainable before knockdown.
- After four punches, the prompt changes to `RMB`.
- Holding right mouse completes the drain.
- E does not drain the thug.
- Completing the drain advances to the Hunger lesson.
- The police-roof jump remains open after the drain.

## Mission flow

- Draining the journalist changes the objective to returning to the refuge.
- The mission does not complete at the journalist.
- Returning to the refuge shows the sire bubble first.
- Closing the bubble opens the final report second.
- Draining rather than killing produces only one mission-resolution transition.

## Pass criteria

Milestone 4 may be marked ✅ only when:

- all required configurations pass;
- front/alert drains are consistently rejected;
- downed and rear drains work reliably;
- cancellation never grants Hunger relief or resolves the target;
- no right-click input leaks through UI or dialogue;
- visual and heard-only reactions remain distinct;
- the complete tutorial and journalist mission can be completed with the new control.
