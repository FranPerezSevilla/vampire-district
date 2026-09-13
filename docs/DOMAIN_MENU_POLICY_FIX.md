# Domain menu metadata regression — 2026-09-12

Authority: InteractionSystem owns menu identity/options; PlaytestSurfacePolicy
filters unavailable traversal; UIScene routes the resulting view to React.

Scope: forward presentation arguments in the installed interaction filter, use
the actual production InteractionSystem subclass in the UI harness and add a
DOM/navigation regression suite with the real surface policy installed.

The policy wrapped open(options) but dropped its second argument, including
view: vampire-domain. Consequently the actual seven-option domain launcher was
rendered as a generic interaction; selecting a section reopened the same list.
Tests using InteractionSystemCore never passed through that installed wrapper.

Acceptance: preserve title/detail/view and return values while still excluding
hidden traversal; HUD City/Errand and pause-to-city route to the real domain;
all six tabs and digits change actual content without advancing the paused
world; Locate/Go here and contact-to-errand transitions retain their semantics;
Escape closes once and restores focus/input. Run with production subclass and
installed policy, not a mocked domain flag. Prove tests fail before the fix.

Non-goals: boot/loading, title handoff, audio, CSS, campaign/save format, city
data, hidden-feature policy and gameplay guards. No PR merge or main change.
Native/jsdom checks are not pixel, WebGL or FPS acceptance; no browser execution.
