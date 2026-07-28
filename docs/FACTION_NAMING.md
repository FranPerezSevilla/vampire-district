# Viceblood faction naming

_Last updated: 2026-07-28_

## Status

**Canonical design naming accepted. Commercial trademark clearance remains pending.**

The two principal vampire factions are:

```text
The First Estate
The Gutter Crown
```

The retired working names are:

```text
Blackglass Directorate
Red Assembly
```

They must not be used for new runtime IDs, UI text, missions, documentation or generated content.

## The First Estate

**Systemic role:** old institutional elite.

The First Estate controls the city through property, inherited influence, hospitals, municipal contracts, private security, compromised officials and quiet ownership. It does not present itself as a fantasy court or visible corporation. Its power feels established, respectable and difficult to separate from the city itself.

Core identity:

- wealth and inherited position;
- institutional access;
- controlled violence;
- secrecy maintained as infrastructure;
- expensive but dependable resources;
- strong penalties for uncontrolled public chaos.

Natural language:

```text
The Estate owns this district.
The First have already bought the building.
Estate security is watching the hospital.
```

Recommended technical ID:

```text
first_estate
```

Recommended short UI label:

```text
FIRST ESTATE
```

## The Gutter Crown

**Systemic role:** violent territorial street coalition.

The Gutter Crown is formed by predatory crews, abandoned fledglings, criminal organizations and ambitious bloodlines. It believes authority is proven by taking territory and remaining there. The name deliberately contrasts inherited power above with earned power below.

Core identity:

- street control and visible presence;
- force, reputation and contribution;
- vehicle theft, sabotage and territorial assault;
- cheaper but irregular resources;
- tolerance for collateral damage;
- internal leadership that must continually prove itself.

Natural language:

```text
The Crown owns these streets.
Gutter Crown crews took the docks last night.
That block carries Crown colours now.
```

Recommended technical ID:

```text
gutter_crown
```

Recommended short UI label:

```text
GUTTER CROWN
```

## The Houses

**Status:** provisional umbrella terminology, not a unified faction.

The Houses describes independent bloodlines, smugglers, brokers, mercenaries, isolated sires and criminal families that do not maintain permanent allegiance to either major faction.

Rules:

- each House or contact keeps an independent relationship;
- helping one House does not improve every independent relationship;
- there is no common uniform, leader or universal doctrine;
- simulation data must use separate IDs and reputations;
- `houses` may be used only as a presentation category.

Provisional presentation label:

```text
THE HOUSES
```

Do not create one global `houses` reputation value.

## Contrast rule

The two principal factions must remain immediately distinguishable:

```text
The First Estate  → owns the city from above
The Gutter Crown  → claims the city from below
```

The distinction should affect territory, vehicles, patrols, suppliers, missions, dialogue and visual language. They are not merely two differently coloured enemy teams.

## Naming guardrails

- Prefer names that characters can say naturally in conversation.
- Prefer names that fit signs, graffiti, vehicle markings and compact HUD labels.
- Avoid corporate-fantasy compounds such as `Blackglass Directorate`.
- Avoid generic political-coalition names such as `Red Assembly`.
- Avoid copied terminology, ranks or faction structures from licensed vampire settings.
- Keep internal IDs stable once faction state reaches campaign persistence.

## Implementation boundary

Milestone 15.1 should introduce the canonical IDs before any district ownership is persisted:

```text
first_estate
gutter_crown
<individual House/contact IDs>
```

Save migration must never depend on the retired working names.
