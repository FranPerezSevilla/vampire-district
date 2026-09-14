# Demo sessions start fresh

## Authority and scope
The user requests a new game on every entry, with no saved/cached gameplay progress.
BootProfile and campaign/preload.js own this composition decision; CampaignSystem
remains the only live state/transaction authority. No new persistence owner.
Change those two modules, their native/bootstrap regressions, compiled boot smoke,
the affected free-roam browser contract, and both HTML menu entries. This overrides the earlier demo's
old-save-resume behaviour in FIRST_BUSINESS_DEMO.md and the historical snapshot.

## Acceptance
- Normal, explore, playtest and scenario page boots do not read or write campaign
  browser storage. They create fresh state and disable event/timed autosaves.
- No disabled Continue/resume entry in the title menu; New Night starts the run.
- Never reuse an earlier NBD_CAMPAIGN_SYSTEM at bootstrap. Publish one fresh live
  instance; keep it for the whole run. All gameplay services still share it.
- Money, errands, contacts, businesses, body, inventory, markers, territory,
  heat/evidence and chapter completion return to authored initial values on entry.
- Explicit legacy save calls cannot write to browser or in-memory save storage.
  Diagnostic serialization and framework persistence tests remain available.
- A current session keeps progress through menus, pause, death/recovery and the
  chapter's Keep playing action. Reloading/closing and reopening starts fresh.
- Existing save records are ignored, not migrated, overwritten or indiscriminately
  deleted. No localStorage.clear(): controls, accessibility and graphics settings
  remain independent. Asset HTTP caches, packed audio and city downloads stay fast.

## Non-goals and validation
No economy, demo routes, title/camera/audio, city geometry, hunting, artwork,
title redesign, dependency or save-schema change. No main update or PR merge.
Test old current/legacy saves, stale global instances, unavailable storage,
progress during a run and a second fresh boot; verify both production entry points
using actual packed JS with seeded storage. Run check:fast, affected plan and
focused native/build/package checks. Standing no-browser instruction still applies;
native/VM/jsdom verification does not claim visual or browser performance acceptance.
Publish exact validated source plus CI output to the existing Pages branch.
