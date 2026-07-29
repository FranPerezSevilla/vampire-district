# Milestone 15.2 — hunting rights and poaching

_Last updated: 2026-07-29_

## Goal

Connect feeding to the authoritative district territory model so that taking blood has political meaning even when the Veil remains intact.

Every completed feeding action must produce one immutable hunting assessment containing:

```text
districtId
ownerId
territoryStatus
territoryRelationship
victimId
victimProtection
permissionSource
classification
discoveryState
evidence
```

## Classifications

```text
legal       explicit hunting right, donor access or faction permission
tolerated   no explicit right, but current owner/pressure policy tolerates it
poaching    feeding without permission in controlled territory
protected   victim is marked as protected by a faction/contact/site
unclaimed   contested or independent territory with no authority enforcing rights
```

`protected` takes precedence over every other classification. A protected victim remains politically protected even when the player has general hunting rights in the district.

## Faction distinction

### The First Estate

- grants narrow rights tied to donors, hospitals, clubs or selected victim categories;
- protects institutional staff, contacts and registered donors;
- tolerates discreet feeding only while the district remains calm;
- treats bodies, public scandal and attacks on protected people as political violations.

### The Gutter Crown

- grants broader territorial hunting rights in exchange for loyalty or tribute;
- protects local residents, crews, informants and community contacts;
- tolerates low-profile feeding until police pressure or repeated predation threatens the district;
- treats poaching, repeated hunting and imported police attention as territorial violations.

## Discovery boundary

The territory owner is not omniscient. A hunting violation begins as `undiscovered` unless one or more discovery sources exist:

- direct witness or report;
- protected/marked victim;
- body or unconscious victim recovered;
- visible bite/blood evidence;
- informant or faction observer;
- repeated matching pattern in the same district.

This milestone records discovery inputs and immediate known violations. Long-running investigations and district hunting pressure are follow-on work.

## Runtime contract

A new campaign hunting-law service owns classification and persistence. Feeding code submits facts; it must not directly alter faction reputation or territory state.

Expected events:

```text
hunting:assessed
hunting:violation-discovered
hunting:protected-victim-harmed
```

Expected diagnostics:

```text
window.NBD_HUNTING_LAW.snapshot()
window.NBD_HUNTING_LAW.lastAssessment()
```

## Player-facing result

After feeding, a compact non-blocking notice explains the political result when relevant:

```text
FEEDING TOLERATED · OLD QUARTER
POACHING · FIRST ESTATE TERRITORY
PROTECTED PREY · GUTTER CROWN
```

Ordinary legal/unclaimed feeding may remain silent unless diagnostics or accessibility settings request full feedback.

## Night Ledger

Political and police consequences remain available through a dedicated paused panel instead of relying only on transient toasts.

The `L` key or the Ledger HUD button opens a modal overlay and pauses `GameScene`. The panel contains:

- First Estate and Gutter Crown reputation tiers and values;
- controlled districts and active hunting rights per faction;
- hidden and discovered political violations;
- independent House/contact count without inventing one global third faction;
- separate Police/Heat and Veil/Evidence panels, plus officers, cruisers, witnesses, reports and physical scene state;
- a recent incident stream combining hunting, territory, reputation and active police pressure.

The Ledger button exposes a compact badge. Yellow indicates hidden violations or a police search; red indicates discovered political violations or active pursuit/air support. Opening the panel never advances simulation. It closes through its button, backdrop, `L`, or `Escape`, then resumes the same frame state and restores focus to the HUD button.

## Deliberate limits

- Quick Bite / Full Feed / Drain are now delivered by Milestone 15.5;
- no autonomous district hunting-pressure simulation;
- no faction retaliation squads or mission chain;
- no camera network implementation yet;
- no favour/debt spending;
- no new permanent resource bar;
- no emotion or resonance system.

## Acceptance

- every completed drain creates one assessment using semantic district and territory IDs;
- protected victims override district permission;
- controlled territory distinguishes legal/tolerated/poaching outcomes;
- contested/independent territory is not falsely attributed to one faction;
- discovery is based on explicit evidence inputs rather than omniscience;
- assessments survive save/load without storing Phaser or DOM objects;
- Night Ledger opens by button or `L`, pauses gameplay, exposes faction/police state and resumes cleanly;
- Night Ledger closes by button, backdrop, `L`, or `Escape`;
- feeding remains fully playable when no faction permission data exists;
- unit, boot, campaign and systems suites remain green.
