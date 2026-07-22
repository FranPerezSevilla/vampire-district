import { REFUGE_GARAGE, VEHICLE_MAINTENANCE_RULES } from "../data/vehicle-maintenance.js";
import {
  VEHICLE_OWNERSHIP,
  vehicleArchetype,
  vehicleDefinitions
} from "../data/vehicles.js";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round(Math.max(0, finite(value)) * 100) / 100;
}

function maintenanceError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

export class VehicleMaintenanceService {
  constructor(state, {
    wallet,
    vehicles,
    definitions = vehicleDefinitions,
    events = null,
    now = () => Date.now(),
    onDirty = null,
    garage = REFUGE_GARAGE,
    rules = VEHICLE_MAINTENANCE_RULES
  } = {}) {
    if (!state?.player || !state?.world?.flags || !Array.isArray(state.ledger)) {
      throw new TypeError("VehicleMaintenanceService requires campaign state.");
    }
    if (!wallet?.debit || !wallet?.balance || !vehicles?.condition || !vehicles?.updateCondition) {
      throw new TypeError("VehicleMaintenanceService requires wallet and campaign vehicle services.");
    }
    this.state = state;
    this.wallet = wallet;
    this.vehicles = vehicles;
    this.definitions = [...definitions];
    this.events = events;
    this.now = now;
    this.onDirty = onDirty;
    this.garage = garage;
    this.rules = rules;
    this.lastOperation = null;
  }

  definition(vehicleId) {
    const id = String(vehicleId || "").trim();
    const definition = this.definitions.find(candidate => candidate.id === id);
    if (!definition) throw maintenanceError("VEHICLE_NOT_FOUND", `Unknown vehicle: ${id || "missing id"}.`, { vehicleId: id });
    return definition;
  }

  recoverySlot(vehicleId) {
    const index = Math.max(0, this.definitions.findIndex(definition => definition.id === vehicleId));
    const slots = this.garage.recoverySlots || [{ x: this.garage.x, y: this.garage.y, angle: 0 }];
    return { ...slots[index % slots.length] };
  }

  quote(vehicleId) {
    const definition = this.definition(vehicleId);
    const archetype = vehicleArchetype(definition.archetypeId);
    if (!archetype) throw maintenanceError("VEHICLE_ARCHETYPE_MISSING", `Unknown vehicle archetype: ${definition.archetypeId}.`);
    const condition = this.vehicles.condition(definition);
    const status = this.vehicles.status(definition);
    const owned = status === VEHICLE_OWNERSHIP.OWNED;
    const maximum = Math.max(1, finite(archetype.maxHealth, 1));
    const health = Math.max(0, Math.min(maximum, finite(condition.health, maximum)));
    const missingHealth = Math.max(0, maximum - health);
    const disabled = health <= 0;
    const distanceToGarage = Math.hypot(
      finite(condition.x) - finite(this.garage.x),
      finite(condition.y) - finite(this.garage.y)
    );
    const atGarage = distanceToGarage <= Math.max(1, finite(this.garage.serviceRadius, 96));
    const repairRate = Math.max(0.01, finite(this.rules.repairRateByArchetype?.[archetype.id], 4));
    const repairCost = missingHealth > 0
      ? Math.max(
          Math.max(1, finite(this.rules.minimumRepairCost, 25)),
          Math.ceil(missingHealth * repairRate)
        )
      : 0;
    const recoveryCost = Math.max(1, Math.ceil(finite(
      this.rules.recoveryCostByArchetype?.[archetype.id],
      150
    )));
    const action = disabled ? "recover" : missingHealth > 0 ? "repair" : "none";
    const cost = action === "recover" ? recoveryCost : action === "repair" ? repairCost : 0;

    let eligible = true;
    let reason = "Service available.";
    if (!owned) {
      eligible = false;
      reason = "Only owned vehicles can use the refuge garage.";
    } else if (action === "none") {
      eligible = false;
      reason = "Hull condition is already full.";
    } else if (action === "repair" && !condition.parked) {
      eligible = false;
      reason = "Park the vehicle before requesting repairs.";
    } else if (action === "repair" && !atGarage) {
      eligible = false;
      reason = "Bring the vehicle to the refuge garage for repairs.";
    }

    const balance = roundMoney(this.wallet.balance());
    const canAfford = cost <= balance;
    if (eligible && !canAfford) reason = `Insufficient cash: need $${cost}, have $${balance}.`;

    return {
      vehicleId: definition.id,
      name: definition.name,
      archetypeId: definition.archetypeId,
      archetypeLabel: archetype.label,
      status,
      owned,
      action,
      eligible,
      canAfford,
      available: eligible && canAfford,
      reason,
      health,
      maxHealth: maximum,
      healthPercent: Math.round(health / maximum * 100),
      missingHealth,
      disabled,
      parked: Boolean(condition.parked),
      x: condition.x,
      y: condition.y,
      angle: condition.angle,
      atGarage,
      distanceToGarage: Math.round(distanceToGarage * 10) / 10,
      cost,
      repairCost,
      recoveryCost,
      balance,
      recoveryHealth: Math.max(1, Math.ceil(maximum * finite(this.rules.recoveryHealthFraction, 0.35))),
      garageId: this.garage.id
    };
  }

  assertOperation(quote, action) {
    if (!quote.owned) {
      throw maintenanceError("VEHICLE_NOT_OWNED", quote.reason, { vehicleId: quote.vehicleId });
    }
    if (quote.action !== action) {
      const code = action === "repair"
        ? quote.action === "none" ? "VEHICLE_REPAIR_NOT_NEEDED" : "VEHICLE_REQUIRES_RECOVERY"
        : quote.action === "none" ? "VEHICLE_RECOVERY_NOT_NEEDED" : "VEHICLE_NOT_DISABLED";
      throw maintenanceError(code, quote.reason, { vehicleId: quote.vehicleId, requiredAction: quote.action });
    }
    if (!quote.eligible) {
      throw maintenanceError("VEHICLE_SERVICE_UNAVAILABLE", quote.reason, { vehicleId: quote.vehicleId });
    }
    if (!quote.canAfford) {
      throw maintenanceError("INSUFFICIENT_CASH", quote.reason, {
        vehicleId: quote.vehicleId,
        required: quote.cost,
        balance: quote.balance
      });
    }
  }

  transactionSnapshot() {
    return {
      cash: this.state.player.cash,
      ledger: clone(this.state.ledger),
      worldFlags: clone(this.state.world.flags),
      eventLog: clone(this.state.eventLog),
      sequences: clone(this.state.sequences),
      revision: this.state.revision,
      updatedAt: this.state.updatedAt
    };
  }

  rollback(snapshot) {
    this.state.player.cash = snapshot.cash;
    this.state.ledger.splice(0, this.state.ledger.length, ...snapshot.ledger);
    this.state.world.flags = snapshot.worldFlags;
    this.state.eventLog.splice(0, this.state.eventLog.length, ...snapshot.eventLog);
    this.state.sequences = snapshot.sequences;
    this.state.revision = snapshot.revision;
    this.state.updatedAt = snapshot.updatedAt;
    this.onDirty?.();
  }

  transact(quote, action, condition) {
    const before = this.transactionSnapshot();
    try {
      const transaction = this.wallet.debit(quote.cost, {
        source: "vehicle-maintenance",
        reason: action,
        referenceId: `${action}:${quote.vehicleId}:${quote.health}`,
        metadata: {
          vehicleId: quote.vehicleId,
          action,
          garageId: this.garage.id,
          healthBefore: quote.health,
          healthAfter: condition.health,
          maxHealth: quote.maxHealth
        }
      }, { emit: false });
      const changed = this.vehicles.updateCondition(quote.vehicleId, condition, {
        emit: false,
        dirty: false
      });
      if (!changed) throw maintenanceError("VEHICLE_MAINTENANCE_NO_CHANGE", "Vehicle maintenance produced no condition change.");

      const result = {
        changed: true,
        code: action === "repair" ? "VEHICLE_REPAIRED" : "VEHICLE_RECOVERED",
        action,
        vehicleId: quote.vehicleId,
        cost: quote.cost,
        healthBefore: quote.health,
        healthAfter: condition.health,
        maxHealth: quote.maxHealth,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        transactionId: transaction.id,
        garageId: this.garage.id,
        timestamp: Math.max(0, Math.trunc(finite(this.now())))
      };
      this.events?.emit?.("vehicle:maintenance-completed", result);
      if (!this.events?.emit) this.onDirty?.();
      this.lastOperation = { ...result };
      return result;
    } catch (error) {
      this.rollback(before);
      throw error;
    }
  }

  repair(vehicleId) {
    const quote = this.quote(vehicleId);
    if (!quote.owned) this.assertOperation(quote, "repair");
    if (quote.action === "none") {
      return {
        changed: false,
        code: "VEHICLE_REPAIR_NOT_NEEDED",
        action: "repair",
        vehicleId: quote.vehicleId,
        cost: 0,
        healthBefore: quote.health,
        healthAfter: quote.health,
        balanceAfter: quote.balance
      };
    }
    this.assertOperation(quote, "repair");
    return this.transact(quote, "repair", {
      x: quote.x,
      y: quote.y,
      angle: quote.angle,
      health: quote.maxHealth,
      parked: true
    });
  }

  recover(vehicleId) {
    const quote = this.quote(vehicleId);
    if (!quote.owned) this.assertOperation(quote, "recover");
    if (!quote.disabled) {
      return {
        changed: false,
        code: "VEHICLE_RECOVERY_NOT_NEEDED",
        action: "recover",
        vehicleId: quote.vehicleId,
        cost: 0,
        healthBefore: quote.health,
        healthAfter: quote.health,
        balanceAfter: quote.balance
      };
    }
    this.assertOperation(quote, "recover");
    const slot = this.recoverySlot(quote.vehicleId);
    return this.transact(quote, "recover", {
      x: slot.x,
      y: slot.y,
      angle: slot.angle,
      health: quote.recoveryHealth,
      parked: true
    });
  }

  snapshot() {
    return {
      garage: {
        id: this.garage.id,
        label: this.garage.label,
        refugeId: this.garage.refugeId,
        layer: this.garage.layer,
        x: this.garage.x,
        y: this.garage.y,
        interactionRadius: this.garage.interactionRadius,
        serviceRadius: this.garage.serviceRadius
      },
      balance: roundMoney(this.wallet.balance()),
      rules: {
        minimumRepairCost: this.rules.minimumRepairCost,
        recoveryHealthFraction: this.rules.recoveryHealthFraction,
        repairRateByArchetype: { ...this.rules.repairRateByArchetype },
        recoveryCostByArchetype: { ...this.rules.recoveryCostByArchetype }
      },
      vehicles: this.definitions
        .map(definition => this.quote(definition.id))
        .filter(quote => quote.owned),
      lastOperation: this.lastOperation ? { ...this.lastOperation } : null
    };
  }
}
