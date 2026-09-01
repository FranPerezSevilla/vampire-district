import { WORLD } from "../data/balance.js";
import { buildings } from "../data/district.js";
import { stepVehicleKinematics } from "../vehicles/VehicleModel.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

function pointInRect(x, y, rect, margin = 0) {
  const inset = Math.max(0, finite(margin));
  return x >= finite(rect?.x) - inset
    && x <= finite(rect?.x) + finite(rect?.w) + inset
    && y >= finite(rect?.y) - inset
    && y <= finite(rect?.y) + finite(rect?.h) + inset;
}

function neutralDrivingFrame(frame = {}) {
  return {
    ...frame,
    move: { x: 0, y: 0 },
    handbrakeHeld: false
  };
}

function normalized(x, y, fallbackX = 1, fallbackY = 0) {
  const length = Math.hypot(finite(x), finite(y));
  if (length <= 0.0001) return { x: fallbackX, y: fallbackY };
  return { x: finite(x) / length, y: finite(y) / length };
}

function projectedRadius(box, axis) {
  return Math.abs(axis.x * box.forward.x + axis.y * box.forward.y) * box.halfLength
    + Math.abs(axis.x * box.right.x + axis.y * box.right.y) * box.halfWidth;
}

export function trafficVehicleBox(entity, {
  lengthScale = 0.86,
  widthScale = 0.82,
  minimumLength = 18,
  minimumWidth = 9
} = {}) {
  const archetype = entity?.archetype || {};
  const angle = finite(entity?.angle);
  const forward = { x: Math.cos(angle), y: Math.sin(angle) };
  const right = { x: -forward.y, y: forward.x };
  const length = Math.max(minimumLength, finite(archetype.width, 28) * lengthScale);
  const width = Math.max(minimumWidth, finite(archetype.height, 14) * widthScale);
  return {
    x: finite(entity?.x),
    y: finite(entity?.y),
    angle,
    length,
    width,
    halfLength: length * 0.5,
    halfWidth: width * 0.5,
    forward,
    right,
    broadRadius: Math.hypot(length * 0.5, width * 0.5)
  };
}

export function orientedVehicleContact(leftEntity, rightEntity) {
  const left = trafficVehicleBox(leftEntity);
  const right = trafficVehicleBox(rightEntity);
  const delta = { x: right.x - left.x, y: right.y - left.y };
  if (Math.hypot(delta.x, delta.y) > left.broadRadius + right.broadRadius) return null;

  const axes = [left.forward, left.right, right.forward, right.right];
  let minimumOverlap = Infinity;
  let minimumAxis = null;
  for (const sourceAxis of axes) {
    let axis = sourceAxis;
    if (delta.x * axis.x + delta.y * axis.y < 0) axis = { x: -axis.x, y: -axis.y };
    const distance = Math.abs(delta.x * axis.x + delta.y * axis.y);
    const overlap = projectedRadius(left, axis) + projectedRadius(right, axis) - distance;
    if (overlap <= 0) return null;
    if (overlap < minimumOverlap) {
      minimumOverlap = overlap;
      minimumAxis = axis;
    }
  }
  return {
    overlap: minimumOverlap,
    normal: minimumAxis || normalized(delta.x, delta.y),
    left,
    right
  };
}

export function trafficCollisionDamage(relativeSpeed, overlap = 0) {
  const speed = Math.max(0, finite(relativeSpeed));
  const penetration = Math.max(0, finite(overlap));
  if (speed < 22 && penetration < 3) return 0;
  return Math.max(1, Math.min(18, Math.round((Math.max(0, speed - 18) * 0.055 + penetration * 0.22) * 10) / 10));
}

export function softTrafficImpulse(overlap, impactSpeed, {
  minimum = 2,
  maximum = 16,
  speedScale = 0.025
} = {}) {
  return clamp(
    Math.max(0, finite(overlap)) + Math.max(0, finite(impactSpeed)) * Math.max(0, finite(speedScale)),
    Math.max(0, finite(minimum, 2)),
    Math.max(Math.max(0, finite(minimum, 2)), finite(maximum, 16))
  );
}

export function decayTrafficOffset(offsetX, offsetY, amount) {
  const x = finite(offsetX);
  const y = finite(offsetY);
  const distance = Math.hypot(x, y);
  const step = Math.max(0, finite(amount));
  if (distance <= step || distance <= 0.0001) return { x: 0, y: 0 };
  const scale = (distance - step) / distance;
  return { x: x * scale, y: y * scale };
}

export class TrafficPhysicalConsequencesSystem {
  constructor(scene, options = {}) {
    if (!scene?.trafficMaterializationSystem || !scene?.trafficLocalBehaviorSystem || !scene?.vehicleSystem) {
      throw new TypeError("TrafficPhysicalConsequencesSystem requires materialization, traffic behavior and vehicle systems.");
    }
    this.scene = scene;
    this.materializer = scene.trafficMaterializationSystem;
    this.behavior = scene.trafficLocalBehaviorSystem;
    this.vehicleSystem = scene.vehicleSystem;
    this.options = { ...options };
    this.states = new Map();
    this.healthByToken = new Map();
    this.contactCooldowns = new Map();
    this.maxPushStep = 16;
    this.maxOffset = 44;
    this.offsetRecoveryRate = 24;
    this.pushHoldSeconds = 0.16;
    this.blockedHoldSeconds = 0.55;
    this.playerSpeedRetention = 0.78;
    this.collisionPadding = 1;
    this.contactDamageCooldown = 0.65;
    this.totalContacts = 0;
    this.totalPushes = 0;
    this.totalBlocks = 0;
    this.totalTrafficContacts = 0;
    this.totalTrafficDamage = 0;
    this.totalBulletDamage = 0;
    this.lastContact = null;
    this.lastTrafficContact = null;
    this.destroyed = false;
    this.ready = false;
    this.lastPublishedKey = "";
    this.originalUpdateDriving = null;
    this.physicalUpdateDriving = null;
    this.originalDecisionFor = null;
    this.physicalDecisionFor = null;
    this.onTrafficBulletHit = payload => this.damageTrafficToken(payload?.tokenId, 1, "gunfire");
    this.onProjectileFired = payload => {
      // TrafficRouteBehaviorPolicy historically listened to weapon:fired while the
      // real combat authority emits combat:projectile-fired. Keep the bridge at
      // the traffic boundary so gunfire reaches the FSM without changing combat.
      this.scene.events?.emit?.("weapon:fired", payload || {});
    };
    this.installHooks();
    this.scene.events?.on?.("traffic:bullet-hit", this.onTrafficBulletHit);
    this.scene.events?.on?.("combat:projectile-fired", this.onProjectileFired);
    this.installBrowserApi();
    this.initialization = Promise.resolve(this.behavior.initialization)
      .then(() => {
        this.configure();
        this.ready = true;
        this.update(0, { force: true });
        return this;
      });
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  configure() {
    const config = this.materializer.lanes?.physics || {};
    const option = (key, fallback) => finite(this.options[key], finite(config[key], fallback));
    this.maxPushStep = Math.max(2, option("maxPushStep", 16));
    this.maxOffset = Math.max(this.maxPushStep, option("maxOffset", 44));
    this.offsetRecoveryRate = Math.max(1, option("offsetRecoveryRate", 24));
    this.pushHoldSeconds = clamp(option("pushHoldSeconds", 0.16), 0.04, 0.5);
    this.blockedHoldSeconds = clamp(option("blockedHoldSeconds", 0.55), this.pushHoldSeconds, 1.5);
    this.playerSpeedRetention = clamp(option("playerSpeedRetention", 0.78), 0.35, 0.95);
    this.collisionPadding = Math.max(0, option("collisionPadding", 1));
    this.contactDamageCooldown = Math.max(0.25, option("contactDamageCooldown", 0.65));
  }

  installHooks() {
    const consequences = this;
    this.originalUpdateDriving = this.vehicleSystem.updateDriving;
    this.physicalUpdateDriving = function trafficPhysicalUpdateDriving(dt, frame) {
      return consequences.updateDrivenVehicle(this, dt, frame);
    };
    this.vehicleSystem.updateDriving = this.physicalUpdateDriving;

    this.originalDecisionFor = this.behavior.decisionFor;
    this.physicalDecisionFor = function physicalTrafficDecision(slot, state, token, active) {
      const base = consequences.originalDecisionFor.call(this, slot, state, token, active);
      const constraint = consequences.behaviorConstraintFor(slot);
      if (!constraint) return base;
      return {
        ...base,
        desiredSpeedFactor: 0,
        reason: constraint.reason,
        gap: 0,
        blockerId: constraint.blockerId,
        junctionId: null
      };
    };
    this.behavior.decisionFor = this.physicalDecisionFor;
  }

  healthStateFor(slot) {
    if (!slot?.tokenId) return null;
    let health = this.healthByToken.get(slot.tokenId);
    const maxHealth = Math.max(1, finite(slot.archetype?.maxHealth, 80));
    if (!health) {
      health = { tokenId: slot.tokenId, health: maxHealth, maxHealth, disabled: false, damageTaken: 0 };
      this.healthByToken.set(slot.tokenId, health);
    } else if (health.maxHealth !== maxHealth) {
      const ratio = health.maxHealth > 0 ? health.health / health.maxHealth : 1;
      health.maxHealth = maxHealth;
      health.health = clamp(maxHealth * ratio, 0, maxHealth);
    }
    slot.trafficHealth = health.health;
    slot.trafficMaxHealth = health.maxHealth;
    slot.trafficDisabled = health.disabled;
    return health;
  }

  damageTrafficToken(tokenId, amount, reason = "collision") {
    if (!tokenId) return false;
    const slot = this.materializer.assignments?.get?.(String(tokenId))
      || (this.materializer.pool || []).find(candidate => candidate.tokenId === String(tokenId));
    if (!slot) return false;
    const health = this.healthStateFor(slot);
    const damage = Math.max(0, finite(amount));
    if (!health || !damage || health.disabled) return false;
    health.health = Math.max(0, health.health - damage);
    health.damageTaken += damage;
    if (reason === "gunfire") this.totalBulletDamage += damage;
    else this.totalTrafficDamage += damage;
    if (health.health <= 0) {
      health.disabled = true;
      slot.container?.setAlpha?.(0.52);
      slot.visual?.hood?.setFillStyle?.(0x3f2027, 0.92);
    }
    slot.trafficHealth = health.health;
    slot.trafficDisabled = health.disabled;
    return true;
  }

  routeBaseFor(slot) {
    const priorOffsetX = finite(slot?.physicalOffsetX);
    const priorOffsetY = finite(slot?.physicalOffsetY);
    return {
      x: Number.isFinite(Number(slot?.routeBaseX)) ? finite(slot.routeBaseX) : finite(slot?.x) - priorOffsetX,
      y: Number.isFinite(Number(slot?.routeBaseY)) ? finite(slot.routeBaseY) : finite(slot?.y) - priorOffsetY
    };
  }

  stateFor(slot) {
    if (!slot?.tokenId) return null;
    let state = this.states.get(slot.tokenId);
    const routeBase = this.routeBaseFor(slot);
    if (!state) {
      state = {
        tokenId: slot.tokenId,
        slotIndex: slot.slotIndex,
        offsetX: finite(slot.physicalOffsetX),
        offsetY: finite(slot.physicalOffsetY),
        holdSeconds: 0,
        baseX: routeBase.x,
        baseY: routeBase.y,
        lastImpactSpeed: 0,
        lastVehicleId: null,
        lastReason: "none",
        pushes: 0,
        blocks: 0
      };
      this.states.set(slot.tokenId, state);
    }
    state.slotIndex = slot.slotIndex;
    state.baseX = routeBase.x;
    state.baseY = routeBase.y;
    this.healthStateFor(slot);
    return state;
  }

  behaviorConstraintFor(slot) {
    const health = slot?.tokenId ? this.healthByToken.get(slot.tokenId) : null;
    if (health?.disabled) return { reason: "physical-disabled", blockerId: slot.tokenId };
    const state = slot?.tokenId ? this.states.get(slot.tokenId) : null;
    if (!state || state.holdSeconds <= 0) return null;
    return {
      reason: state.lastReason === "blocked" ? "physical-blocked" : "physical-contact",
      blockerId: state.lastVehicleId || "traffic-contact"
    };
  }

  activeSlots() {
    return (this.materializer.pool || []).filter(slot => slot.tokenId && slot.container?.active !== false);
  }

  nearbyBuildings(x, y, radius) {
    const bounds = { x: finite(x) - radius, y: finite(y) - radius, w: radius * 2, h: radius * 2 };
    return this.scene.cityStreamSystem?.query?.("buildings", bounds) || buildings;
  }

  proxyWorldSafe(slot, x, y, { ignoreSlots = [], movingVehicle = null } = {}) {
    const proxy = { ...slot, x, y };
    const box = trafficVehicleBox(proxy);
    const radius = box.broadRadius;
    if (x - radius < 5 || y - radius < 5 || x + radius > WORLD.width - 5 || y + radius > WORLD.height - 5) return false;
    for (const building of this.nearbyBuildings(x, y, radius + 2)) {
      if (pointInRect(x, y, building, Math.max(box.halfWidth, 5))) return false;
    }
    for (const vehicle of this.vehicleSystem.vehicles || []) {
      if (movingVehicle?.id === vehicle.id) continue;
      if (orientedVehicleContact(proxy, vehicle)) return false;
    }
    const ignored = new Set(ignoreSlots);
    for (const other of this.activeSlots()) {
      if (other === slot || ignored.has(other)) continue;
      if (orientedVehicleContact(proxy, other)) return false;
    }
    return true;
  }

  applyStateOffset(slot, state) {
    const x = finite(state.baseX) + finite(state.offsetX);
    const y = finite(state.baseY) + finite(state.offsetY);
    slot.x = x;
    slot.y = y;
    slot.physicalOffsetX = state.offsetX;
    slot.physicalOffsetY = state.offsetY;
    slot.physicalHoldSeconds = state.holdSeconds;
    slot.physicalReason = state.lastReason;
    slot.container?.setPosition?.(x, y);
    return slot;
  }

  trafficContacts(candidate, vehicle) {
    return this.activeSlots()
      .map(slot => ({ slot, contact: orientedVehicleContact({ ...candidate, archetype: vehicle?.archetype }, slot) }))
      .filter(item => item.contact)
      .sort((left, right) => right.contact.overlap - left.contact.overlap || left.slot.slotIndex - right.slot.slotIndex);
  }

  pushContact(vehicle, candidate, item) {
    const slot = item.slot;
    const state = this.stateFor(slot);
    const impactSpeed = Math.abs(finite(candidate?.speed, vehicle?.speed));
    const normal = item.contact.normal;
    const impulse = softTrafficImpulse(item.contact.overlap, impactSpeed, { maximum: this.maxPushStep });
    const nextOffsetX = finite(state.offsetX) + normal.x * impulse;
    const nextOffsetY = finite(state.offsetY) + normal.y * impulse;
    if (Math.hypot(nextOffsetX, nextOffsetY) > this.maxOffset) return false;
    const nextX = finite(state.baseX) + nextOffsetX;
    const nextY = finite(state.baseY) + nextOffsetY;
    if (!this.proxyWorldSafe(slot, nextX, nextY, { movingVehicle: vehicle })) return false;
    state.offsetX = nextOffsetX;
    state.offsetY = nextOffsetY;
    state.holdSeconds = Math.max(state.holdSeconds, this.pushHoldSeconds);
    state.lastImpactSpeed = impactSpeed;
    state.lastVehicleId = vehicle.id;
    state.lastReason = "pushed";
    state.pushes++;
    this.totalPushes++;
    this.applyStateOffset(slot, state);
    return true;
  }

  markBlocked(vehicle, item, impactSpeed) {
    const state = this.stateFor(item.slot);
    state.holdSeconds = Math.max(state.holdSeconds, this.blockedHoldSeconds);
    state.lastImpactSpeed = Math.abs(finite(impactSpeed));
    state.lastVehicleId = vehicle.id;
    state.lastReason = "blocked";
    state.blocks++;
    this.totalBlocks++;
    this.applyStateOffset(item.slot, state);
  }

  worldAllowsCandidate(vehicleSystem, vehicle, candidate) {
    const original = this.materializer.originalVehicleCanOccupy;
    return typeof original === "function" ? original.call(vehicleSystem, vehicle, candidate.x, candidate.y, candidate.angle) : true;
  }

  dampDrivenVehicle(vehicle, retention = this.playerSpeedRetention) {
    const factor = clamp(retention, 0, 1);
    vehicle.speed = finite(vehicle.speed) * factor;
    vehicle.velocityX = Math.cos(finite(vehicle.travelAngle, vehicle.angle)) * vehicle.speed;
    vehicle.velocityY = Math.sin(finite(vehicle.travelAngle, vehicle.angle)) * vehicle.speed;
    vehicle.driftAngle = finite(vehicle.driftAngle) * factor;
    return vehicle;
  }

  stopDrivenVehicle(vehicle) {
    vehicle.speed = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.driftAngle = 0;
    vehicle.handbrake = false;
    return vehicle;
  }

  updateDrivenVehicle(vehicleSystem, dt, frame) {
    const vehicle = vehicleSystem.currentVehicle?.();
    if (!vehicle || this.destroyed || !this.ready) return this.originalUpdateDriving.call(vehicleSystem, dt, frame);
    const predicted = stepVehicleKinematics(vehicle, frame, dt, vehicle.archetype);
    const contacts = this.trafficContacts(predicted, vehicle);
    if (!contacts.length || !this.worldAllowsCandidate(vehicleSystem, vehicle, predicted)) {
      return this.originalUpdateDriving.call(vehicleSystem, dt, frame);
    }
    this.totalContacts++;
    const item = contacts[0];
    const impactSpeed = Math.abs(finite(predicted.speed, vehicle.speed));
    const pushed = this.pushContact(vehicle, predicted, item);
    this.lastContact = {
      tokenId: item.slot.tokenId,
      vehicleId: vehicle.id,
      impactSpeed,
      pushed: Boolean(pushed),
      blocked: Boolean(!pushed)
    };
    const damage = trafficCollisionDamage(impactSpeed, item.contact.overlap);
    if (damage > 0) {
      this.damageTrafficToken(item.slot.tokenId, damage, "player-vehicle-impact");
      // TrafficImpactConsequencesSystem owns driven-vehicle damage, tiering and
      // cooldown/suppression. Physical contact only damages the ambient traffic token here.
    }
    if (!pushed) {
      this.markBlocked(vehicle, item, impactSpeed);
      this.stopDrivenVehicle(vehicle);
      this.scene.lastActionText = "Traffic contact · both vehicles are blocked.";
      const result = this.originalUpdateDriving.call(vehicleSystem, 0, neutralDrivingFrame(frame));
      this.publish(true);
      return result;
    }
    const result = this.originalUpdateDriving.call(vehicleSystem, dt, frame);
    this.dampDrivenVehicle(vehicle);
    this.scene.lastActionText = "Traffic contact · the ambient car is pushed aside.";
    this.publish(true);
    return result;
  }

  slotVelocity(slot) {
    const speed = Math.max(0, finite(slot?.engineSpeed, 112 * finite(slot?.speedFactor, 1)));
    return { x: Math.cos(finite(slot?.angle)) * speed, y: Math.sin(finite(slot?.angle)) * speed, speed };
  }

  pairKey(left, right) {
    return [String(left?.tokenId || ""), String(right?.tokenId || "")].sort().join("|");
  }

  resolveTrafficPair(left, right, contact) {
    const leftState = this.stateFor(left);
    const rightState = this.stateFor(right);
    if (!leftState || !rightState) return false;
    const leftHealth = this.healthStateFor(left);
    const rightHealth = this.healthStateFor(right);
    const leftMass = Math.max(0.25, finite(left.archetype?.mass, 1));
    const rightMass = Math.max(0.25, finite(right.archetype?.mass, 1));
    const totalMass = leftMass + rightMass;
    const separation = Math.min(this.maxPushStep, Math.max(0.8, contact.overlap + this.collisionPadding));
    const leftShare = rightMass / totalMass;
    const rightShare = leftMass / totalMass;
    const leftNext = {
      x: leftState.offsetX - contact.normal.x * separation * leftShare,
      y: leftState.offsetY - contact.normal.y * separation * leftShare
    };
    const rightNext = {
      x: rightState.offsetX + contact.normal.x * separation * rightShare,
      y: rightState.offsetY + contact.normal.y * separation * rightShare
    };
    const leftDistance = Math.hypot(leftNext.x, leftNext.y);
    const rightDistance = Math.hypot(rightNext.x, rightNext.y);
    if (leftDistance > this.maxOffset || rightDistance > this.maxOffset) return false;
    const leftX = leftState.baseX + leftNext.x;
    const leftY = leftState.baseY + leftNext.y;
    const rightX = rightState.baseX + rightNext.x;
    const rightY = rightState.baseY + rightNext.y;
    if (!this.proxyWorldSafe(left, leftX, leftY, { ignoreSlots: [right] })) return false;
    if (!this.proxyWorldSafe(right, rightX, rightY, { ignoreSlots: [left] })) return false;

    leftState.offsetX = leftNext.x;
    leftState.offsetY = leftNext.y;
    rightState.offsetX = rightNext.x;
    rightState.offsetY = rightNext.y;
    leftState.holdSeconds = Math.max(leftState.holdSeconds, this.pushHoldSeconds);
    rightState.holdSeconds = Math.max(rightState.holdSeconds, this.pushHoldSeconds);
    leftState.lastVehicleId = right.tokenId;
    rightState.lastVehicleId = left.tokenId;
    leftState.lastReason = "traffic-collision";
    rightState.lastReason = "traffic-collision";
    leftState.pushes++;
    rightState.pushes++;
    this.totalPushes += 2;
    this.applyStateOffset(left, leftState);
    this.applyStateOffset(right, rightState);

    const leftVelocity = this.slotVelocity(left);
    const rightVelocity = this.slotVelocity(right);
    const relativeSpeed = Math.hypot(leftVelocity.x - rightVelocity.x, leftVelocity.y - rightVelocity.y);
    const key = this.pairKey(left, right);
    const cooldown = finite(this.contactCooldowns.get(key));
    let damage = 0;
    if (cooldown <= 0) {
      damage = trafficCollisionDamage(relativeSpeed, contact.overlap);
      if (damage > 0) {
        const leftDamage = damage * clamp(rightMass / leftMass, 0.55, 1.65);
        const rightDamage = damage * clamp(leftMass / rightMass, 0.55, 1.65);
        this.damageTrafficToken(left.tokenId, leftDamage, "traffic-collision");
        this.damageTrafficToken(right.tokenId, rightDamage, "traffic-collision");
        this.contactCooldowns.set(key, this.contactDamageCooldown);
      }
    }
    this.totalTrafficContacts++;
    this.lastTrafficContact = {
      leftTokenId: left.tokenId,
      rightTokenId: right.tokenId,
      overlap: round(contact.overlap),
      relativeSpeed: round(relativeSpeed),
      damage: round(damage),
      leftHealth: round(leftHealth?.health),
      rightHealth: round(rightHealth?.health)
    };
    return true;
  }

  resolveTrafficContacts() {
    const slots = this.activeSlots();
    let resolved = 0;
    for (let leftIndex = 0; leftIndex < slots.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < slots.length; rightIndex++) {
        const left = slots[leftIndex];
        const right = slots[rightIndex];
        const contact = orientedVehicleContact(left, right);
        if (!contact) continue;
        if (this.resolveTrafficPair(left, right, contact)) resolved++;
      }
    }
    return resolved;
  }

  update(dt = 0, { force = false } = {}) {
    if (this.destroyed || !this.ready || this.scene.registry?.get?.("uiPaused")) return false;
    const seconds = Math.max(0, finite(dt));
    for (const [key, remaining] of this.contactCooldowns) {
      const next = Math.max(0, finite(remaining) - seconds);
      if (next <= 0) this.contactCooldowns.delete(key);
      else this.contactCooldowns.set(key, next);
    }

    const activeIds = new Set();
    let changed = false;
    for (const slot of this.activeSlots()) {
      const state = this.stateFor(slot);
      activeIds.add(slot.tokenId);
      state.holdSeconds = Math.max(0, state.holdSeconds - seconds);
      if (state.holdSeconds <= 0 && Math.hypot(state.offsetX, state.offsetY) > 0.001) {
        const decayed = decayTrafficOffset(state.offsetX, state.offsetY, this.offsetRecoveryRate * seconds);
        const candidateX = state.baseX + decayed.x;
        const candidateY = state.baseY + decayed.y;
        if (this.proxyWorldSafe(slot, candidateX, candidateY)) {
          changed = changed || decayed.x !== state.offsetX || decayed.y !== state.offsetY;
          state.offsetX = decayed.x;
          state.offsetY = decayed.y;
          if (Math.hypot(state.offsetX, state.offsetY) <= 0.001) state.lastReason = "recovered";
        }
      }
      this.applyStateOffset(slot, state);
    }
    const resolved = this.resolveTrafficContacts();
    if (resolved) changed = true;

    for (const tokenId of this.states.keys()) {
      if (!activeIds.has(tokenId)) this.states.delete(tokenId);
    }
    this.publish(force || changed);
    return activeIds.size > 0;
  }

  snapshot() {
    const contacts = [...this.states.values()]
      .map(state => {
        const health = this.healthByToken.get(state.tokenId);
        return {
          tokenId: state.tokenId,
          slotIndex: state.slotIndex,
          offsetX: round(state.offsetX),
          offsetY: round(state.offsetY),
          offsetDistance: round(Math.hypot(state.offsetX, state.offsetY)),
          holdSeconds: round(state.holdSeconds, 3),
          lastImpactSpeed: round(state.lastImpactSpeed),
          lastVehicleId: state.lastVehicleId,
          reason: state.lastReason,
          pushes: state.pushes,
          blocks: state.blocks,
          health: round(health?.health),
          maxHealth: round(health?.maxHealth),
          disabled: Boolean(health?.disabled)
        };
      })
      .sort((left, right) => left.slotIndex - right.slotIndex);
    return {
      ready: this.ready,
      collisionShape: "oriented-box",
      colliderLengthScale: 0.86,
      colliderWidthScale: 0.82,
      activeContacts: contacts.filter(item => item.holdSeconds > 0 || item.offsetDistance > 0).length,
      pushedVehicles: contacts.filter(item => item.offsetDistance > 0).length,
      blockedVehicles: contacts.filter(item => item.reason === "blocked" && item.holdSeconds > 0).length,
      disabledVehicles: contacts.filter(item => item.disabled).length,
      totalContacts: this.totalContacts,
      totalPushes: this.totalPushes,
      totalBlocks: this.totalBlocks,
      totalTrafficContacts: this.totalTrafficContacts,
      totalTrafficDamage: round(this.totalTrafficDamage),
      totalBulletDamage: round(this.totalBulletDamage),
      maxPushStep: round(this.maxPushStep),
      maxOffset: round(this.maxOffset),
      offsetRecoveryRate: round(this.offsetRecoveryRate),
      lastContact: this.lastContact ? { ...this.lastContact, impactSpeed: round(this.lastContact.impactSpeed) } : null,
      lastTrafficContact: this.lastTrafficContact ? { ...this.lastTrafficContact } : null,
      contacts
    };
  }

  publish(force = false) {
    const snapshot = this.snapshot();
    const key = JSON.stringify([
      snapshot.ready,
      snapshot.activeContacts,
      snapshot.totalContacts,
      snapshot.totalTrafficContacts,
      snapshot.totalTrafficDamage,
      snapshot.totalBulletDamage,
      snapshot.lastContact,
      snapshot.lastTrafficContact
    ]);
    if (!force && key === this.lastPublishedKey) return snapshot;
    this.lastPublishedKey = key;
    this.scene.statePublisher?.setMany?.({
      trafficPhysicsText: `Traffic contact · ${snapshot.pushedVehicles} pushed · ${snapshot.disabledVehicles} disabled`,
      trafficPhysicsState: snapshot
    });
    if (typeof window !== "undefined") window.NBD_TRAFFIC_PHYSICS_READY = snapshot.ready;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_TRAFFIC_PHYSICS = Object.freeze({
      snapshot: () => this.snapshot(),
      step: (seconds = 0.1) => {
        let remaining = Math.max(0, finite(seconds, 0.1));
        while (remaining > 0.0001) {
          const dt = Math.min(0.05, remaining);
          this.update(dt, { force: true });
          remaining -= dt;
        }
        return this.snapshot();
      },
      damage: (tokenId, amount = 1) => {
        this.damageTrafficToken(tokenId, amount, "debug");
        return this.snapshot();
      }
    });
    window.NBD_TRAFFIC_PHYSICS_READY = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.vehicleSystem.updateDriving === this.physicalUpdateDriving) this.vehicleSystem.updateDriving = this.originalUpdateDriving;
    if (this.behavior.decisionFor === this.physicalDecisionFor) this.behavior.decisionFor = this.originalDecisionFor;
    this.scene.events?.off?.("traffic:bullet-hit", this.onTrafficBulletHit);
    this.scene.events?.off?.("combat:projectile-fired", this.onProjectileFired);
    this.states.clear();
    this.healthByToken.clear();
    this.contactCooldowns.clear();
    this.ready = false;
    if (typeof window !== "undefined") {
      delete window.NBD_TRAFFIC_PHYSICS;
      window.NBD_TRAFFIC_PHYSICS_READY = false;
    }
  }
}