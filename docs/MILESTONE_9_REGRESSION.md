# Milestone 9 browser regression checklist

Use this checklist before changing Milestone 9 from 🟡 to ✅. Record browser, operating system, input device, viewport, render quality and commit SHA.

## Required configurations

1. Laptop viewport near 1366 × 768 at Low quality.
2. Desktop viewport near 1920 × 1080 at Ultra quality.
3. Narrow viewport at or below 720 CSS pixels.
4. Resize during a run without reloading.
5. Mouse wheel and, when available, trackpad.
6. Keyboard-only navigation through the pause modal.
7. Operating-system reduced-motion preference enabled for one pass.

## First-use weapon guidance

- No weapon-cycle strip appears during the opening dialogue.
- No strip appears during rooftop movement-only control.
- No strip appears while fighting or draining the rooftop thug.
- No strip appears during the police-informant conversation.
- After the informant leaves and the task reveal closes, `WHEEL` guidance appears.
- The guidance does not pause movement, attacks, powers, traversal or interactions.
- The weapon HUD pulses without overlapping the power dock.
- One wheel gesture changes one slot and removes the persistent teaching state.
- A brief `LMB` confirmation names the newly equipped weapon.
- Cycling immediately after full control, before the strip visibly opens, still completes the teaching step.
- Pause, dialogue, interaction menu and task reveal hide the strip rather than drawing over them.
- Focus loss does not cause a delayed weapon change or stale tutorial completion.

## Weapon HUD layout

- Weapon HUD is lower-right.
- Power dock remains lower-left.
- Contextual prompt remains readable at bottom centre.
- All three remain separated at wide, narrow and resized viewports.
- Weapon name and ammunition are readable at Low and Ultra quality.
- Empty-pistol state remains visually distinct.
- The first-use attention pulse stops permanently after a successful weapon change.

## Recovery guidance

- Downing a civilian creates no recovery timer.
- Downing the journalist creates no recovery timer.
- Downing the rooftop thug creates no recovery timer.
- Downing a police officer shows `POLICE RISES 18s` with a decreasing whole-second countdown.
- Downing a hunter shows `HUNTER RISES 24s`.
- The first recoverable knockdown shows the compact recovery explanation once.
- The final four seconds use the urgent treatment.
- Starting a drain hides the countdown and prevents recovery during the channel.
- Cancelling the drain allows the countdown/recovery rule to resume.
- Completing a drain removes the label permanently.
- Killing the target removes the label permanently.
- A recovered police officer returns with 2/4 resilience and a short stagger.
- A recovered hunter returns with 3/5 resilience and a short stagger.
- Recovery produces one compact warning and no duplicate labels.
- Labels hide when changing to another world layer and return only on the correct layer.
- Pause and task reveals hide labels.
- Several downed police do not produce unreadable duplicate text at the exact same coordinate.

## High-contrast aim

- Pause menu exposes `High-contrast aim: Off` by default on a clean profile.
- The button can be reached with Tab.
- Enter or Space toggles it.
- Pointer activation toggles it without closing the pause menu.
- `aria-pressed` matches the visible On/Off state.
- Enabling adds a black outline, white core, larger ring and cross mark.
- The reticle is readable over bright roads, dark rooftops, neon club light and broken-light shadow.
- Aim direction and hit resolution remain unchanged.
- Resizing and every camera zoom keep the high-contrast reticle aligned.
- The preference survives reload when local storage is available.
- Storage denial does not break the pause menu or aiming.

## Accessible HUD semantics

Inspect with browser accessibility tools:

- Hunger exposes role `progressbar`, minimum 0, maximum 100 and current value.
- Police alert exposes level plus `CLEAR`, `SEARCH`, `PURSUIT` or `AIR SUPPORT` text.
- Weapon status exposes name, ammunition and inventory slot.
- Mission and Menu buttons expose correct `aria-expanded` state.
- Prompt, toast and weapon status do not announce continuously when their text is unchanged.
- Focus outlines are clearly visible on HUD buttons, the accessibility toggle and render-quality selector.
- Pause-modal controls remain stable enough for keyboard navigation and do not recreate every frame.

## Reduced motion

With `prefers-reduced-motion: reduce`:

- guidance appears without entrance animation;
- weapon attention does not pulse;
- HUD toast transition is removed;
- task-reveal and dialogue transitions are removed;
- gameplay remains functional;
- camera shake may still occur and should be recorded as the documented limitation.

## Copy sweep

Check both `/` and `/phaser/`:

- visible title is `Vampire District`;
- selector is labelled `Render quality`;
- options are Low, High, Very high and Ultra;
- no visible copy says Shift sprints;
- no visible copy says Space runs or activates Dash;
- no visible copy says E traverses, drains or breaks lamps;
- current mouse-wheel, right-click and Space controls are represented accurately;
- gameplay dialogue remains in English.

## Complete mission regression

- Opening narrative and dialogue advance still work.
- Rooftop traversal, thug fight and drain still work without weapon cycling.
- Police informant and last sire advice still complete the tutorial.
- First-use weapon guidance begins only after that sequence.
- Journalist can be handled normally.
- Return-to-refuge objective remains mandatory.
- Final sire dialogue still precedes `REPORT ACCEPTED`.
- Guidance and recovery labels do not remain over the final report.

## Pass criteria

Milestone 9 may be marked ✅ only when:

- all required configurations pass;
- tutorial guidance appears at the correct progression point;
- HUD components do not overlap;
- recovery labels match AI timers and cannot change gameplay state;
- high-contrast aim remains aligned and keyboard operable;
- assistive labels update meaningfully without excessive announcements;
- current controls/copy match both playable routes;
- the complete mission passes without regression;
- failures are fixed or recorded as known limitations.
