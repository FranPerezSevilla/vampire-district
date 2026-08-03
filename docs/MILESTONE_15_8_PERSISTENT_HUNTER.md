# Milestone 15.8 — Persistent hunter investigation

_Last updated: 2026-07-29_

**Status: 🔵 Active in PR #47.**

## Goal

Introduce one named, persistent hunter whose investigation develops from concrete evidence and repeated player habits rather than generic combat waves or omniscient tracking.

The hunter must know only what the case has actually established.

```text
scene evidence + testimony + repeated habits
→ leads
→ case confidence
→ traceable investigative action
```

## Case authority

The campaign owns one migration-safe hunter case containing:

- collected testimony;
- examined bodies and supernatural evidence;
- recognised vehicles and plates;
- repeated districts and feeding sites;
- recurring escape routes;
- suspected faction protection, contacts and refuges;
- confidence in the player's identity;
- confidence in specific habits;
- active surveillance, traps and investigative tasks;
- neutralisation outcome and history.

Every lead records its source, discovery time, district, subject/reference and current validity. Destroying physical evidence may prevent a new lead, but cannot silently erase knowledge already retained by the investigator.

## Escalation

The initial investigation progresses through readable stages:

1. **Dormant** — no credible supernatural case.
2. **Reviewing scenes** — the hunter examines reported evidence after police activity.
3. **Building a pattern** — repeated districts, feeding sites, vehicles or escape routes become hypotheses.
4. **Surveillance** — selected sites, routes or vehicles receive explicit observation hooks.
5. **Interception** — the hunter acts on a sufficiently strong hypothesis through one authored trap, tail or route block.
6. **Refuge pressure** — only a high-confidence case may threaten a suspected refuge.

Escalation is evidence-driven, not time-driven. The game must be able to explain why each action became available.

## Counterplay

The player may reduce, redirect or exploit the case by:

- intercepting testimony before it is reported;
- cleaning or relocating latent evidence;
- abandoning a repeated hunting ground;
- changing vehicles or plates;
- using different escape routes;
- planting a mundane explanation or false supernatural lead;
- invoking faction influence or a specialised service;
- compromising a source;
- framing another actor;
- killing, discrediting or politically neutralising the hunter.

The final outcomes are distinct persistent states rather than one generic `hunter defeated` flag.

## Runtime integration

Planned authority surface:

```js
window.NBD_HUNTER_CASE.snapshot()
window.NBD_HUNTER_CASE.activeLeads()
window.NBD_HUNTER_CASE.confidence()
window.NBD_HUNTER_CASE.explainNextAction()
```

Expected events:

```text
hunter-case:lead-added
hunter-case:lead-invalidated
hunter-case:confidence-changed
hunter-case:stage-changed
hunter-case:action-planned
hunter-case:action-resolved
hunter-case:neutralised
```

## Player-facing feedback

The Night Ledger will expose only information the player can reasonably know:

- current broad investigation pressure;
- confirmed or suspected case activity learned in play;
- compromised evidence and known surveillance;
- recently triggered hunter actions;
- counterplay opportunities already discovered.

It will not reveal the hunter's entire internal case, exact hidden confidence or undiscovered traps.

## Deliberate limits

- one named hunter before any population simulation;
- no endless combat waves;
- no random unavoidable ambushes;
- no omniscient player tracking;
- no full forensic transport/morgue pipeline;
- no general camera network beyond explicit case hooks;
- no emotion, mood or blood-resonance mechanics;
- no full authored campaign finale in this slice.

## Acceptance

- the hunter's case survives save/load and checkpoints;
- every retained lead has an explicit source;
- repeated player habits measurably improve the case;
- changing habits and destroying latent evidence reduce or redirect future investigation;
- hunter actions are gated by case confidence and explainable evidence;
- the Night Ledger does not leak hidden investigator knowledge;
- killing, discrediting and political neutralisation are distinct outcomes;
- unit, compiler, boot, campaign and systems regression remain green.
