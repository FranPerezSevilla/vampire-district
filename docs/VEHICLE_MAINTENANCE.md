# Vehicle maintenance — Milestone 12.1

_Last updated: 2026-07-22_

## Status

**Accepted and implemented.**

Milestone 12.1 closes the persistent vehicle-damage loop by adding a costed refuge garage for owned vehicles. Damaged vehicles can be repaired when parked at the garage; disabled vehicles can be recovered by tow from anywhere in the district.

Ambient traffic proxies remain outside the system.

## Goals

- make persistent hull damage reversible through an explicit campaign cost;
- reuse the existing cash wallet, immutable ledger and vehicle-condition authority;
- prevent a debit from being saved without the corresponding repair/recovery;
- prevent repeated button activation from charging twice;
- recover owned wrecks without soft-locking campaign mobility;
- synchronize campaign condition and the live Phaser vehicle immediately;
- block service while the player is driving, away from the garage or wanted;
- avoid a save-schema change.

## Player flow

The refuge garage is on the street beside the starting owned compact.

```text
walk to garage
→ press E
→ inspect owned vehicles and current cash
→ repair a damaged parked vehicle
   or recover a destroyed vehicle by tow
→ campaign condition and live vehicle update immediately
```

The dialog pauses the world, supports Escape, traps keyboard focus and exposes disabled reasons for unavailable actions.

## Service location

```text
id                 rooftop_refuge_garage
layer              street
position           304, 326
interaction radius 58
repair radius      96
```

Recovery uses deterministic parking slots around the refuge garage so future owned vehicles do not all return to the same point.

## Ownership boundary

Eligible:

- authored vehicles whose campaign status is `owned`.

Not eligible:

- parked vehicles owned by civilians;
- faction vehicles;
- police vehicles;
- stolen-but-not-owned vehicles;
- pooled ambient traffic proxies.

Ownership is validated before returning a no-op, so an intact non-owned vehicle cannot be queried as though it were a player service target.

## Repair rules

Full repair requires:

- owned vehicle;
- hull above zero but below maximum;
- `parked: true`;
- vehicle position inside the refuge-garage service radius;
- sufficient campaign cash.

Repair restores the vehicle to full archetype hull without moving it.

Default pricing:

```text
minimum repair charge    $25
compact                   $3 per missing hull point
sedan                     $4 per missing hull point
van                       $5 per missing hull point
police cruiser            $6 per missing hull point
```

The higher rates are data-driven even though only owned vehicles can currently use the service.

## Recovery rules

Recovery requires:

- owned vehicle;
- hull at zero / disabled state;
- sufficient campaign cash;
- player physically using the refuge garage;
- no active wanted level.

The wreck may be anywhere in the district. Recovery:

- relocates it to its deterministic refuge parking slot;
- resets body and travel angle;
- clears velocity, drift and handbrake state;
- restores `35%` of maximum hull, rounded upward;
- clears the disabled visual/runtime state;
- leaves the vehicle parked.

Default recovery prices:

```text
compact            $120
sedan              $150
van                 $190
police cruiser      $220
```

For the starting compact, recovery restores `26 / 72` hull. A later full repair remains a separate paid operation.

## Atomic campaign transaction

Authority chain:

```text
VehicleMaintenanceService
  → WalletSystem silent debit
  → CampaignVehicleSystem silent condition update
  → vehicle:maintenance-completed
  → CampaignSystem wildcard touch/save
```

`WalletSystem` and `CampaignVehicleSystem` retain their normal emitting behaviour by default. Milestone 12.1 adds an explicit silent option used only by the maintenance transaction.

Before mutation, the service snapshots:

- cash;
- ledger;
- transaction/event sequences;
- vehicle world flags;
- event log;
- campaign revision/timestamp.

If the condition update or final event fails, those values are restored and the rollback is persisted. This prevents a saved debit without a corresponding vehicle result.

A successful operation writes one ledger debit with:

```text
source       vehicle-maintenance
reason       repair | recover
referenceId  action:vehicleId:healthBefore
metadata     vehicle, garage, health before/after, maximum hull
```

The final campaign event contains the transaction ID, cost, balances and resulting hull.

## Idempotence

Repeated operations are explicit no-ops:

```text
repair full vehicle       VEHICLE_REPAIR_NOT_NEEDED
recover drivable vehicle  VEHICLE_RECOVERY_NOT_NEEDED
```

No new ledger row, debit or campaign event is produced.

Insufficient funds, wrong ownership, remote repair and unparked repair fail before the transaction begins.

## Live runtime synchronization

`VehicleSystem` listens for `vehicle:maintenance-completed` and runs `syncFromCampaign(vehicleId)`.

The live vehicle receives:

- campaign position and angle;
- health and disabled state;
- parked state;
- zero velocity/speed/drift;
- restored normal alpha and hood colour after repair/recovery;
- refreshed label rotation, visibility, HUD and browser snapshot;
- refreshed `lastPersisted` condition so the next normal persist does not overwrite the maintenance result.

The maintenance UI never operates while the player is inside a vehicle.

## Checkpoint compatibility

Campaign checkpoints do not own authored vehicle condition. They restore mission, player, loadout, NPC, evidence and threat state while vehicle condition remains in campaign world flags.

Therefore an older safe checkpoint cannot revert a paid repair or recovery. The existing campaign save persists the maintenance transaction and vehicle condition together without a schema migration.

## Player-facing safety

The garage refuses service when:

- the player is driving;
- the player is not at the refuge garage;
- the current layer is not street;
- wanted level is above zero;
- campaign entry UI is still unresolved;
- another maintenance operation is in progress.

A wanted block does not debit cash or change the wreck.

## Diagnostics

```js
window.NBD_VEHICLE_MAINTENANCE.snapshot()
window.NBD_VEHICLE_MAINTENANCE.open()
window.NBD_VEHICLE_MAINTENANCE.close()
window.NBD_VEHICLE_MAINTENANCE.repair(vehicleId)
window.NBD_VEHICLE_MAINTENANCE.recover(vehicleId)
window.NBD_VEHICLE_MAINTENANCE_READY
```

The snapshot exposes:

- garage geometry;
- current cash;
- pricing rules;
- owned vehicle quotes;
- action eligibility and disabled reason;
- current UI/safety state;
- last completed operation.

Campaign snapshots also include the pure maintenance-service snapshot.

## Automated coverage

Unit coverage verifies:

- archetype/missing-hull quote calculation;
- one debit and one maintenance event;
- full hull restoration;
- repeated repair/recovery no-op behaviour;
- insufficient funds without mutation;
- parked/garage requirements;
- non-owned rejection;
- deterministic tow recovery and 35% hull;
- rollback after a synthetic condition failure.

Chromium coverage verifies:

- world interaction and dialog bootstrap;
- live repair and campaign synchronization;
- exact debit and ledger growth;
- no second charge on repeated repair;
- wanted-level recovery block;
- remote wreck tow to the garage;
- restored wreck visuals/runtime state;
- stable browser execution with no page errors.

## Deliberately deferred

- partial-repair slider;
- repair animations or elapsed service time;
- insurance or impound fees;
- garage interiors;
- mobile roadside repair;
- faction/stolen vehicle laundering;
- Mechanic Retainer discounts or remote service;
- multiple safehouse garage ownership;
- repairable ambient traffic;
- replacement vehicle purchasing.

## Acceptance criteria

- owned damaged vehicle at the garage can be repaired to full hull;
- repair cost comes from the campaign wallet and appears once in the ledger;
- repeated repair cannot charge again;
- insufficient funds leave wallet and vehicle unchanged;
- non-owned vehicles cannot use the service;
- owned wreck can be recovered from a remote position;
- recovered vehicle becomes drivable with 35% hull at the refuge garage;
- wanted level blocks service without mutation;
- live and campaign vehicle condition agree immediately;
- an older checkpoint cannot undo maintenance;
- ambient traffic remains excluded;
- no campaign schema change;
- unit, boot, systems and campaign CI domains remain green.

## Acceptance record

Milestone 12.1 was accepted on 2026-07-22 through PR #30.

Validated on implementation head `978a611417659eeca62850a939b59112435b225b`:

```text
unit-tests         success
browser-boot       success
browser-systems    success
browser-campaign   success
```

The accepted browser loop repairs the owned compact from `50 / 72` to full hull for `$66`, proves that a repeated repair creates no second debit, blocks recovery during an active wanted level, and then recovers the same remote wreck to the refuge garage with `26 / 72` hull for `$120`.
