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
  const junctionFlowController = () => physicalSystem.materializer?.__nbdTrafficJunctionFlowController || null;
  junctionFlowController()?.installPhysicalGuard?.(physicalSystem);
  const originalPushContact = physicalSystem.pushContact;
  const originalDampDrivenVehicle = physicalSystem.dampDrivenVehicle;
  let agentPhysicalAuthority = null;
  let agentPhysicalAuthorityError = null;
  let agentPhysicalAuthorityInstallation = null;
  let lastResponse = null;
  let weightedContacts = 0;
  let destroyed = false;

  function authorityPendingSnapshot() {
    const materializer = physicalSystem.materializer;
    return {
      active: false,
      pending: Boolean(materializer && !materializer.ready && !agentPhysicalAuthorityError),
      architecture: "per-agent-physical-pose-authority",
      routeProgressAuthority: "physical-clearance-gated",
      junctionAuthority: "permission-only",
      error: agentPhysicalAuthorityError?.message || null
    };
  }

  function tryInstallAgentPhysicalAuthority() {
    if (destroyed || agentPhysicalAuthority) return agentPhysicalAuthority;
    const materializer = physicalSystem.materializer;
    // TrafficMaterializationSystem owns asynchronous lane loading. Installing
    // before that promise resolves would reject a healthy normal boot because
    // materializer.lanes is intentionally null during construction.
    if (!materializer?.assignments || !materializer?.pool || !materializer?.lanes) return null;
    try {
      agentPhysicalAuthority = installTrafficAgentPhysicalAuthorityPolicy(physicalSystem);
      agentPhysicalAuthorityError = null;
      return agentPhysicalAuthority;
    } catch (error) {
      agentPhysicalAuthorityError = error instanceof Error ? error : new Error(String(error));
      if (typeof window !== "undefined") {
        window.NBD_TRAFFIC_AGENT_AUTHORITY_READY = false;
        window.NBD_TRAFFIC_AGENT_AUTHORITY_ERROR = agentPhysicalAuthorityError.message;
      }
      physicalSystem.scene?.statePublisher?.setMany?.({
        trafficAgentAuthorityText: `Traffic agents · unavailable: ${agentPhysicalAuthorityError.message}`,
        trafficAgentAuthorityState: authorityPendingSnapshot()
      });
      return null;
    }
  }

  // Unit-level collision policies may intentionally omit a materializer. In a
  // real gameplay runtime, install the per-agent authority only after compiler
  // lane data has finished loading, then keep it available for the whole scene.
  tryInstallAgentPhysicalAuthority();
  const materializerInitialization = physicalSystem.materializer?.initialization;
  if (!agentPhysicalAuthority && materializerInitialization?.then) {
    agentPhysicalAuthorityInstallation = Promise.resolve(materializerInitialization)
      .then(() => tryInstallAgentPhysicalAuthority())
      .catch(error => {
        // Materialization publishes and rethrows its own initialization error.
        // Keep this dependent installation from producing a second unhandled
        // rejection while preserving diagnostics for the traffic authority.
        agentPhysicalAuthorityError = error instanceof Error ? error : new Error(String(error));
        return null;
      });
  }

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
      // Retry lazily as a safeguard for non-standard runtimes whose lane loader
      // resolves without exposing an initialization promise.
      tryInstallAgentPhysicalAuthority();
      return {
        weightedContacts,
        lastResponse: lastResponse ? { ...lastResponse } : null,
        rigidBody: rigidBodyPolicy.snapshot(),
        agentPhysicalAuthority: agentPhysicalAuthority?.snapshot?.() || authorityPendingSnapshot(),
        agentPhysicalAuthorityInstallationPending: Boolean(
          agentPhysicalAuthorityInstallation && !agentPhysicalAuthority && !agentPhysicalAuthorityError
        ),
        junctionFlow: junctionFlowController()?.snapshot?.() || null
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (physicalSystem.pushContact === massAwarePushContact) physicalSystem.pushContact = originalPushContact;
      if (physicalSystem.dampDrivenVehicle === massAwareDampDrivenVehicle) {
        physicalSystem.dampDrivenVehicle = originalDampDrivenVehicle;
      }
      agentPhysicalAuthority?.destroy?.();
      agentPhysicalAuthority = null;
      rigidBodyPolicy.destroy();
      if (typeof window !== "undefined") delete window.NBD_TRAFFIC_AGENT_AUTHORITY_ERROR;
      if (physicalSystem.__nbdMassCollisionPolicy === policy) delete physicalSystem.__nbdMassCollisionPolicy;
    }
  });
  physicalSystem.__nbdMassCollisionPolicy = policy;
  return policy;
}
