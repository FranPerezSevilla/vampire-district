import { installTrafficAgentPhysicalAuthorityPolicy } from "./TrafficAgentPhysicalAuthorityPolicy.js";
import { installTrafficRigidBodyCollisionPolicy } from "./TrafficRigidBodyCollisionPolicy.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

export function vehicleCollisionMass(archetype) {
  return Math.max(0.35, finite(archetype?.mass, 1));
}

export function vehicleCollisionPush(archetype) {
  return Math.max(0.35, finite(archetype?.collisionPush, 1));
}

export function trafficMassResponse(movingArchetype, targetArchetype) {
  const movingMass = vehicleCollisionMass(movingArchetype);
  const targetMass = vehicleCollisionMass(targetArchetype);
  const ratio = movingMass / targetMass;
  const pushBias = vehicleCollisionPush(movingArchetype) / vehicleCollisionPush(targetArchetype);
  const impulseScale = clamp(Math.sqrt(ratio * pushBias), 0.62, 1.62);
  const retentionScale = clamp(1 + (ratio - 1) * 0.13, 0.78, 1.14);
  return Object.freeze({
    movingMass,
    targetMass,
    massRatio: ratio,
    impulseScale,
    retentionScale
  });
}

export function installTrafficMassCollisionPolicy(physicalSystem) {
  if (!physicalSystem?.pushContact || !physicalSystem?.dampDrivenVehicle) {
    throw new TypeError("Traffic mass collision policy requires TrafficPhysicalConsequencesSystem.");
  }
  if (physicalSystem.__nbdMassCollisionPolicy) return physicalSystem.__nbdMassCollisionPolicy;

  const rigidBodyPolicy = installTrafficRigidBodyCollisionPolicy(physicalSystem);
  const agentPhysicalAuthority = installTrafficAgentPhysicalAuthorityPolicy(physicalSystem);
  const junctionFlowController = () => physicalSystem.materializer?.__nbdTrafficJunctionFlowController || null;
  junctionFlowController()?.installPhysicalGuard?.(physicalSystem);
  const originalPushContact = physicalSystem.pushContact;
  const originalDampDrivenVehicle = physicalSystem.dampDrivenVehicle;
  let lastResponse = null;
  let weightedContacts = 0;

  function massAwarePushContact(vehicle, candidate, contact) {
    const response = trafficMassResponse(vehicle?.archetype, contact?.slot?.archetype);
    lastResponse = {
      vehicleId: vehicle?.id || null,
      tokenId: contact?.slot?.tokenId || null,
      ...response
    };
    weightedContacts++;

    const realImpactSpeed = Math.abs(finite(candidate?.speed, vehicle?.speed));
    const weightedCandidate = {
      ...candidate,
      speed: realImpactSpeed * response.impulseScale
    };
    const weightedContact = {
      ...contact,
      overlap: Math.max(0, finite(contact?.overlap)) * response.impulseScale
    };
    const pushed = originalPushContact.call(this, vehicle, weightedCandidate, weightedContact);
    const state = contact?.slot?.tokenId ? this.states?.get?.(contact.slot.tokenId) : null;
    if (state) state.lastImpactSpeed = realImpactSpeed;
    return pushed;
  }

  function massAwareDampDrivenVehicle(vehicle, retention = this.playerSpeedRetention) {
    const tokenId = this.lastContact?.tokenId || null;
    const slot = tokenId
      ? (this.materializer?.pool || []).find(candidate => candidate.tokenId === tokenId)
      : null;
    const response = trafficMassResponse(vehicle?.archetype, slot?.archetype);
    const weightedRetention = clamp(finite(retention, this.playerSpeedRetention) * response.retentionScale, 0.48, 0.92);
    return originalDampDrivenVehicle.call(this, vehicle, weightedRetention);
  }

  physicalSystem.pushContact = massAwarePushContact;
  physicalSystem.dampDrivenVehicle = massAwareDampDrivenVehicle;

  const policy = Object.freeze({
    snapshot() {
      return {
        weightedContacts,
        lastResponse: lastResponse ? { ...lastResponse } : null,
        rigidBody: rigidBodyPolicy.snapshot(),
        agentPhysicalAuthority: agentPhysicalAuthority.snapshot(),
        junctionFlow: junctionFlowController()?.snapshot?.() || null
      };
    },
    destroy() {
      if (physicalSystem.pushContact === massAwarePushContact) physicalSystem.pushContact = originalPushContact;
      if (physicalSystem.dampDrivenVehicle === massAwareDampDrivenVehicle) {
        physicalSystem.dampDrivenVehicle = originalDampDrivenVehicle;
      }
      agentPhysicalAuthority.destroy();
      rigidBodyPolicy.destroy();
      if (physicalSystem.__nbdMassCollisionPolicy === policy) delete physicalSystem.__nbdMassCollisionPolicy;
    }
  });
  physicalSystem.__nbdMassCollisionPolicy = policy;
  return policy;
}
