# Milestone 15.1 — faction territory foundation

_Last updated: 2026-07-28_

## Goal

Add one authoritative, migration-safe territory model for Viceblood's fourteen semantic city districts.

This milestone establishes the data and runtime contracts required by later faction missions, patrols, suppliers, safehouses and territory changes. It does not attempt to deliver the complete territory-war loop.

## Canonical factions

```text
first_estate  → The First Estate
gutter_crown  → The Gutter Crown
```

Independent Houses are never represented by one global faction or reputation value. Future Houses and contacts receive individual stable IDs.

## District states

Every City Topology V2 district stores:

```text
ownerId
influence.first_estate
influence.gutter_crown
status
changedAt
changeCount
```

`status` is derived, not independently authored:

```text
controlled   leading faction reaches 60 influence and leads by at least 15
contested    both factions are present but neither has control
independent  neither faction has meaningful influence
```

Influence is clamped to `0–100`. Ownership is recalculated after every accepted influence change.

## Initial map

The initial distribution is designed to make the city readable rather than perfectly balanced:

- The First Estate controls the hospital, civic, cathedral, Glasshouse, university and registry/upper-harbor districts.
- The Gutter Crown controls the market, industrial, canal-west, Foundry, north-harbor and south-harbor districts.
- Old Quarter and Canal East begin contested.

The exact numbers are canonical campaign defaults and are migration-safe.

## Player relationship

Territory presence is derived from the reputation with the current owner:

```text
hostile      reputation <= -61
restricted   reputation <= -31
watched      reputation <= -11
tolerated    reputation <= 35
welcome      reputation >= 36
```

Contested and independent districts do not inherit one faction-wide hostility state.

## Runtime presentation

When the player enters a different district, the HUD publishes a compact notice:

```text
OLD QUARTER · CONTESTED
CIVIC CENTRE · FIRST ESTATE · TOLERATED
BLACKWATER INDUSTRIAL · GUTTER CROWN · HOSTILE
```

The notice must not interrupt controls or create a new modal.

## Events and hooks

The territory service emits:

```text
territory:influence-changed
territory:owner-changed
territory:district-entered
```

Future mission rewards and world actions use these events instead of writing campaign state directly.

## Deliberate limits

- no autonomous territory simulation;
- no faction campaign missions;
- no supplier or safehouse ownership changes;
- no new faction patrol archetypes or art;
- no map-screen territory overlay;
- no raw-coordinate mission bindings.

## Acceptance

- all fourteen accepted district IDs exist exactly once in campaign territory state;
- current saves migrate without losing money, vehicles, reputation or world flags;
- influence changes are clamped, deterministic and idempotent where appropriate;
- ownership changes emit exactly once;
- district-entry feedback uses semantic district names;
- reputation-derived relationship state is stable;
- unit, boot, systems and campaign validation remain green.
