# Original setting, factions, retainers and ammunition economy

_Status: locked product direction; faction names are working names pending commercial trademark clearance._

## Core decision

Vampire District will use a wholly original vampire setting. It will not ship with names, lore, ranks, terminology, symbols or faction histories taken from another tabletop or videogame property.

The intended structure remains:

- one secretive ruling establishment;
- one violent territorial rival;
- multiple unaffiliated operators and houses;
- enhanced mortal retainers who work for vampires during the day;
- political reputation, safehouses, money, vehicles and limited supplies.

Comparable genre roles are acceptable. The expression, terminology, history, visual identity and mechanics must remain original.

## IP guardrails

Do not use the following as shipped setting terminology:

- Camarilla;
- Sabbat;
- Anarch Movement;
- Independent Clans as a branded faction category;
- Masquerade;
- Ghoul as the name of the retainer system;
- Vitae as a resource name;
- Blood Bond as a progression system;
- Disciplines as the name of vampire abilities;
- copied ranks, clan lists, symbols, mottos, histories or signature doctrines from an existing vampire setting.

Existing generic words such as vampire, sire, hunger, refuge, bloodline, retainer and veil may be used only in original combinations and original expression.

The names below are design working names, not cleared commercial marks. Before a public commercial announcement, perform trademark clearance in the intended territories and product classes, including similar sound, appearance, meaning and commercial impression.

## Faction structure

### The Blackglass Directorate

**Systemic role:** secretive ruling establishment.

The Directorate is not a royal court or religious sect. It is an old administrative machine that treats secrecy as infrastructure. Its members hold property, hospitals, private security, municipal contracts, press influence and compromised police contacts.

Doctrine:

> A city does not remain quiet through fear alone. It remains quiet because every useful institution has already been bought, staffed or buried.

Gameplay identity:

- covert missions;
- evidence removal;
- political leverage;
- controlled violence;
- reliable but expensive suppliers;
- discreet sedans and official vehicles;
- clean refuges and institutional access;
- strong penalties for public chaos.

Internal structure:

- Directors control portfolios rather than hereditary titles;
- portfolios include police, hospitals, property, media, transport and archives;
- local decisions are recorded as sealed directives;
- failure creates debt, demotion or reassignment rather than ritual punishment.

Visual language:

- black glass, smoked chrome and muted violet;
- tailored coats and practical security uniforms;
- unmarked sedans;
- clean modernist interiors hiding old basements;
- geometric insignia based on a fractured black pane.

The journalist mission is a Directorate opening mission: the sire uses a compromised officer and demands that the Veil remain intact.

### The Red Assembly

**Systemic role:** violent territorial rival.

The Assembly is a coalition of predatory crews, abandoned fledglings, radical bloodlines and criminal organizations. It is not united by worship or ancient prophecy. It believes that the Directorate has turned vampires into dependent bureaucrats and that territory belongs to whoever can hold it tonight.

Doctrine:

> Authority that cannot survive the street does not deserve the street.

Gameplay identity:

- territorial assaults;
- vehicle theft and convoy attacks;
- intimidation;
- sabotage;
- cheaper but irregular weapons;
- stolen vans, muscle cars and improvised armour;
- mobile refuges and defended warehouses;
- higher tolerance for collateral damage, but greater police pressure.

Internal structure:

- crews elect temporary Speakers for specific operations;
- no permanent central ruler is universally obeyed;
- captured territory is divided by contribution and force;
- public failure is answered through loss of resources, not copied religious rites.

Visual language:

- oxidized red, industrial orange and dirty steel;
- patched street clothing, workwear and stolen tactical equipment;
- painted vehicles and improvised barricades;
- symbols based on several hands forming one broken circle.

### The Unaligned Houses

**Systemic role:** original equivalent of independent operators, without treating them as one unified sect.

The Unaligned Houses are a category used by the Directorate, not a single faction. It includes old bloodlines, smugglers, information brokers, mercenaries, isolated sires, criminal families and individual vampires who refuse permanent allegiance.

Gameplay identity:

- contract work;
- information trading;
- vehicle fencing;
- neutral markets;
- specialist weapons;
- negotiation and multiple buyers;
- variable prices and unreliable loyalties;
- access to rare services unavailable from either major faction.

Rules:

- reputation is tracked per House or contact;
- helping one operator does not improve every Unaligned relationship;
- some Houses are neutral meeting grounds;
- others sell to both sides or betray either side for sufficient payment;
- the UI may group them as `UNALIGNED`, but simulation data keeps separate reputations.

Visual language varies by House. Their shared identifier is absence of Directorate or Assembly markings, not one universal uniform.

## Reputation model

Do not use one global morality bar.

Recommended structure:

```text
Faction reputation
Contact reputation
Territory pressure
Outstanding debt
Known betrayal flags
```

Relationship states:

```text
Hostile
Watched
Distrusted
Neutral
Useful
Favoured
Trusted
```

Consequences may include:

- mission access;
- supplier access;
- ammunition price;
- safehouse access;
- vehicle availability;
- police corruption services;
- retainer recruitment;
- ambush probability;
- territory hostility;
- alternate mission buyers and endings.

A mission can raise one relationship and damage another. Unaligned contacts are evaluated individually.

## Retainers: the original ghoul-equivalent system

The neutral mechanical term is **Retainer**.

A Retainer is a named mortal who receives controlled doses of altered vampire blood. The process improves recovery, stamina and resistance to illness, but creates dependency and can produce one weak behavioural or physical echo associated with the donor.

This is not an automatic magical loyalty ladder. Retainers remain people with motives and can lie, resent, bargain, panic, betray or leave.

Faction terminology:

| Group | Preferred term | Cultural meaning |
|---|---|---|
| Blackglass Directorate | Proxy | A deniable daytime institutional asset. |
| Red Assembly | Marked | A mortal visibly claimed by a crew. |
| Unaligned Houses | Hand | A practical operator trusted to act during daylight. |
| System/UI | Retainer | Neutral mechanical category. |

### Retainer attributes

```text
Role
Loyalty
Dependence
Exposure
Condition
Competence
Cash upkeep
Dose due
Assigned refuge
Assigned vehicle
Current task
```

#### Loyalty

Personal commitment to the player. It changes through treatment, pay, mission outcomes, promises and faction pressure.

#### Dependence

Physical and psychological need for the next dose. High dependence can increase obedience in the short term but creates instability, desperation and risk.

#### Exposure

How visible the Retainer is to police, rivals, employers and their former life. A highly exposed Retainer can lead enemies to a refuge.

#### Dose due

A Retainer requires periodic blood maintenance. The cost is paid from a stored blood reserve or directly through player Hunger, depending on the final blood-economy design.

#### Cash upkeep

Retainers still need housing, vehicles, equipment, medical treatment, bribes and cover identities. Loyalty does not remove material costs.

### Initial Retainer roles

Start with strategic services rather than a universal combat companion:

| Role | Function |
|---|---|
| Quartermaster | Buys and manages ammunition stock. |
| Driver | Delivers or extracts a vehicle. |
| Cleaner | Removes bodies, blood and evidence for a fee. |
| Mechanic | Repairs vehicles and expands garage capacity. |
| Fixer | Pays bribes and reduces local police pressure. |
| Scout | Reveals patrols, routes, cameras and target schedules. |
| Guard | Protects one refuge or stored asset. |
| Medic | Sources blood bags and treats injured Retainers. |

Later field roles:

- armed passenger;
- getaway driver;
- body transporter;
- lookout;
- temporary companion;
- convoy escort;
- captured Retainer rescue target.

### Retainer failure and loss

- Captured Retainers can reveal a refuge or become rescue missions.
- Injured Retainers become unavailable until treated.
- Unpaid or neglected Retainers lose Loyalty.
- Excessive Dependence can trigger reckless behaviour.
- Dead named Retainers do not respawn for free.
- A Retainer can defect to a rival faction if Loyalty collapses and leverage exists.

## Player weapon capacity

Unarmed combat is always available. Carried weapons use hard slots:

```text
1 melee slot
1 sidearm slot
1 long-gun or special slot
```

Example loadout:

```text
Unarmed
Iron Pipe
Pistol
Shotgun
```

Picking up or acquiring an incompatible weapon requires replacing the occupied slot. The final UI should show the comparison and preserve the rejected weapon in a refuge stash when the exchange occurs there.

## Ammunition policy

### Locked rules

- No floating street ammunition pickups.
- Refuges and safehouses are the main resupply points.
- Ammunition is purchased with cash.
- Player carry capacity is limited by ammunition type.
- Refuge stock is finite.
- Stored ammunition and carried ammunition are separate inventories.
- Resupply is not automatically free at the player's own refuge.
- A supplier or Quartermaster can improve price, stock and restock speed.
- Mission caches may contain authored supplies, but they are physical mission rewards rather than endlessly respawning pickups.

### Initial carry-capacity baselines

| Ammunition | Carried maximum |
|---|---:|
| Pistol | 48 |
| Submachine gun | 150 |
| Shotgun | 24 |
| Special bolts/stakes | 12 |
| Heavy ammunition | 4–6 |

These are tuning baselines, not final balance.

### Two inventory layers

#### Carried loadout

What the player has immediately available. It is limited and can be partially lost after detention, vehicle destruction or a failed mission depending on difficulty rules.

#### Refuge stash

Persistent storage containing:

```text
Weapons
Ammunition
Cash reserve
Blood bags
Mission items
Vehicle keys
Retainer equipment
```

The stash is only accessible at an owned or permitted refuge, safehouse, armoury locker or vehicle trunk.

### Safehouse armoury flow

```text
Enter safehouse
→ interact with armoury/Quartermaster
→ inspect stock and prices
→ buy ammunition with cash
→ move purchased stock into stash
→ choose carried quantity up to capacity
→ confirm loadout
```

Buying ammunition by bundles is preferable to a universal `refill` button.

Initial bundle examples:

| Bundle | Baseline price |
|---|---:|
| 12 pistol rounds | $90 |
| 30 SMG rounds | $210 |
| 6 shotgun shells | $180 |
| 3 special bolts | $260 |

Prices vary by supplier, reputation, district pressure, scarcity and mission state.

### Faction supply identities

#### Blackglass Directorate

- expensive;
- dependable stock;
- discreet weapons and concealment equipment;
- higher reputation requirements;
- access to clean police or security ammunition.

#### Red Assembly

- cheaper bulk ammunition;
- irregular availability;
- more automatic and heavy weapons;
- increased chance of supplier heat or compromised goods.

#### Unaligned Houses

- variable prices;
- rare and specialist equipment;
- negotiation and debt;
- suppliers may sell to enemies as well as the player.

## Money economy

Income sources:

- mission payments;
- optional objectives;
- vehicle fencing;
- contraband delivery;
- theft and extortion;
- information sale;
- faction contracts;
- valuable physical loot;
- named bounties.

Major expenses:

- weapons and ammunition;
- vehicle repair and recovery;
- safehouse rent and upgrades;
- garage capacity;
- police bribes;
- evidence cleaning;
- Retainer upkeep and treatment;
- blood bags;
- forged documents and plates;
- supplier debt.

The economy should force preparation choices rather than exist as an accumulating score. A useful target decision is:

> Buy shotgun ammunition, repair the getaway car, or pay the Cleaner to remove evidence from the previous job.

## Vehicles and mobile storage

A vehicle trunk can carry:

- one additional long gun;
- limited ammunition;
- blood bags;
- a mission package;
- Retainer equipment;
- one body where the vehicle supports it.

Access requires stopping, leaving the vehicle, standing near the trunk and using E. The full stash is never available magically during a pursuit.

Consequences:

- abandoning the vehicle abandons its cargo;
- police impound can temporarily remove the cargo;
- a Driver or Mechanic Retainer can recover the vehicle for money;
- vehicle destruction can destroy part of the cargo;
- faction vehicles affect reputation and police attention when stolen.

## Technical data direction

### Faction definition

```js
{
  id,
  name,
  type: "establishment" | "territorial" | "unaligned-house",
  standing,
  territories,
  suppliers,
  vehicles,
  missionPool,
  hostilityRules,
  visualIdentity
}
```

### Retainer definition

```js
{
  id,
  name,
  role,
  loyalty,
  dependence,
  exposure,
  condition,
  competence,
  cashUpkeep,
  doseDueAt,
  refugeId,
  vehicleId,
  task,
  status
}
```

### Inventory definition

```js
{
  cash,
  carried: {
    meleeWeaponId,
    sidearmWeaponId,
    longWeaponId,
    ammoByType
  },
  stashByRefuge: {
    [refugeId]: {
      weaponIds,
      ammoByType,
      bloodBags,
      missionItems,
      retainerEquipment
    }
  }
}
```

### Supplier definition

```js
{
  id,
  factionId,
  refugeId,
  stockByItem,
  basePriceByItem,
  restockRule,
  standingRequirement,
  heatRisk,
  debtAllowed
}
```

## Roadmap dependency

```text
10.1 Release Candidate stabilization
→ 11 Campaign foundation: mission framework, money, reputation, save/load
→ 12 Vehicle core
→ 13 Traffic and motorized police
→ 14 Original factions and territory
→ 15 Safehouses, stash and ammunition economy
→ 16 Retainers
→ 17 Expanded arsenal and vehicle combat
→ 18 District campaign
```

The mission framework, money and persistent inventory must exist before faction suppliers, ammunition scarcity or Retainer upkeep can produce meaningful consequences.

## Acceptance principles

- No shipped faction uses protected setting names or copied lore expression.
- The three political roles feel mechanically distinct rather than being simple colour swaps.
- Unaligned Houses are simulated separately, not as one monolithic faction.
- Retainers are named people with agency, upkeep and risk.
- Ammunition cannot be replenished infinitely or for free.
- Refuge stock and carried capacity are separate.
- Cash has competing uses.
- Vehicles connect to storage, suppliers, missions and Retainers.
- Every major system has data definitions suitable for save/load and testing.
