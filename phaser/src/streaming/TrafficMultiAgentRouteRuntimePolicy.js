import { advanceTrafficRouteAgent } from "./TrafficRouteCursor.js";
import { createTrafficJunctionReservationRegistry } from "./TrafficJunctionReservationRegistry.js";
import {
  projectTrafficRouteAgentsToMacroCompatibility,
  validateTrafficRouteMacroProjection
} from "./TrafficRouteCompatibilityProjection.js";
import { createTrafficRouteBehaviorController } from "./TrafficRouteBehaviorPolicy.js";
import { trafficRouteAgentMaterializationToken } from "./TrafficRouteMaterializationPolicy.js";
import { seedTrafficRouteAgentsFromMacroPopulation } from "./TrafficRoutePopulationSeed.js";

const EPSILON = 0.000001;

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function cloneAgent(agent) {
  return {
    ...agent,
    trafficMetadata: agent?.trafficMetadata && typeof agent.trafficMetadata === "object"
      ? structuredClone(agent.trafficMetadata)
      : null
  };
}

function macroPopulation(trafficFlows) {
  if (!(trafficFlows instanceof Map)) return 0;
  let total = 0;
  for (const flow of trafficFlows.values()) {
    total += Math.max(0, Math.floor(finite(flow?.tokenCount, flow?.phases?.length || 0)));
  }
  return total;
}

function connectorJunctionId(topology, agent) {
  if (agent?.stage !== "connector" || !agent.connectorId) return null;
  const connector = topology?.junctionConnectors?.connectors?.[agent.connectorId];
  return connector?.nodeId || null;
}

export function createTrafficMultiAgentRouteRuntime({
  trafficFlows,
  macroGraph,
  topology,
  speed = 168,
  reservationRegistry = null,
  reservationStaleAfterSeconds = 3,
  tokenIdFor = ({ edgeId, tokenIndex }) => `${edgeId}#${tokenIndex}`
} = {}) {
  const seeded = seedTrafficRouteAgentsFromMacroPopulation(
    trafficFlows,
    macroGraph,
    topology,
    {
      tokenIdFor,
      provenance: "m8-multi-agent-runtime-seed"
    }
  );
  const reservations = reservationRegistry || createTrafficJunctionReservationRegistry({
    staleAfterSeconds: reservationStaleAfterSeconds
  });
  const ownsReservationRegistry = !reservationRegistry;
  const unitsPerSecond = Math.max(1, finite(speed, 168));
  let agents = seeded.agents.map(cloneAgent);
  let clockSeconds = 0;
  let ticks = 0;
  let totalStageTransitions = 0;
  let totalJunctionDecisions = 0;
  let totalYieldCount = 0;
  let blocked = [];
  let destroyed = false;

  function releaseTokenReservations(tokenId, reason) {
    return reservations.releaseByToken(tokenId, reason);
  }

  function refreshConnectorOwnership(agent) {
    if (agent?.stage !== "connector" || !agent.connectorId) return true;
    const connector = topology?.junctionConnectors?.connectors?.[agent.connectorId];
    const junctionId = connectorJunctionId(topology, agent);
    if (!connector || !junctionId) return false;
    const ownership = reservations.request({
      junctionId,
      tokenId: agent.tokenId,
      connectorId: connector.id,
      nowSeconds: clockSeconds
    });
    return ownership.granted;
  }

  function reservationHooks() {
    return {
      beforeConnectorEntry({ tokenId, transition, connector }) {
        const junctionId = transition?.nodeId || connector?.nodeId || null;
        if (!junctionId) {
          return { allowed: false, reason: "missing-junction-reservation-authority" };
        }
        const request = reservations.request({
          junctionId,
          tokenId,
          connectorId: connector.id,
          nowSeconds: clockSeconds
        });
        if (!request.granted) {
          totalYieldCount++;
          return {
            allowed: false,
            reason: "junction-yield",
            ownerTokenId: request.ownerTokenId || request.reservation?.tokenId || null
          };
        }
        return { allowed: true };
      },
      afterConnectorExit({ tokenId }) {
        releaseTokenReservations(tokenId, "connector-exit");
      }
    };
  }

  function step(seconds = 0.05, { speedFactorFor = null } = {}) {
    if (destroyed) throw new Error("Traffic multi-agent route runtime is destroyed.");
    const duration = Math.max(0, finite(seconds, 0.05));
    if (duration <= EPSILON) return snapshot();
    clockSeconds += duration;

    const connectorAgents = agents
      .filter(agent => agent.stage === "connector")
      .sort((left, right) => left.tokenId.localeCompare(right.tokenId));
    for (const agent of connectorAgents) refreshConnectorOwnership(agent);
    reservations.cleanup(clockSeconds);

    const nextAgents = [];
    const nextBlocked = [];
    const hooks = reservationHooks();
    for (const current of [...agents].sort((left, right) => left.tokenId.localeCompare(right.tokenId))) {
      const stableTokenId = current.tokenId;
      const requestedFactor = current.stage === "connector"
        ? 1
        : typeof speedFactorFor === "function"
          ? speedFactorFor(current)
          : 1;
      const speedFactor = clamp(requestedFactor, 0, 1.5);
      const result = speedFactor <= EPSILON
        ? {
            agent: cloneAgent(current),
            stageTransitions: 0,
            junctionDecisions: 0,
            remainingSeconds: duration,
            blockedReason: null
          }
        : advanceTrafficRouteAgent(current, duration, topology, {
            speed: unitsPerSecond * speedFactor,
            maxStageTransitions: 16,
            ...hooks
          });
      if (result.agent.tokenId !== stableTokenId) {
        throw new Error(`Multi-agent route runtime changed stable identity ${stableTokenId}.`);
      }
      nextAgents.push(result.agent);
      totalStageTransitions += result.stageTransitions;
      totalJunctionDecisions += result.junctionDecisions;
      if (result.blockedReason) {
        nextBlocked.push({
          tokenId: stableTokenId,
          reason: result.blockedReason,
          laneId: result.agent.currentLaneId,
          stage: result.agent.stage,
          stageProgress: result.agent.stageProgress
        });
      }
    }
    agents = nextAgents.sort((left, right) => left.tokenId.localeCompare(right.tokenId));
    blocked = nextBlocked.sort((left, right) => left.tokenId.localeCompare(right.tokenId));
    ticks++;
    return snapshot();
  }

  function materializationTokens() {
    return agents.map(agent => trafficRouteAgentMaterializationToken(topology, agent));
  }

  function snapshot() {
    const projection = projectTrafficRouteAgentsToMacroCompatibility(agents, topology, macroGraph);
    const projectionValidation = validateTrafficRouteMacroProjection(projection, macroGraph);
    const reservationSnapshot = reservations.snapshot();
    const stageCounts = { lane: 0, connector: 0, other: 0 };
    for (const agent of agents) {
      if (agent.stage === "lane") stageCounts.lane++;
      else if (agent.stage === "connector") stageCounts.connector++;
      else stageCounts.other++;
    }
    const districtPopulationCount = Object.values(projection.districtCounts || {})
      .reduce((sum, value) => sum + Math.max(0, Math.floor(finite(value))), 0);
    return {
      ready: !destroyed,
      mode: "multi-agent-route-runtime",
      movementAuthority: "compiler-local-topology",
      macroMutationAuthority: false,
      macroCoordinateAuthority: false,
      speed: unitsPerSecond,
      clockSeconds,
      ticks,
      macroPopulation: macroPopulation(trafficFlows),
      seededAgentCount: agents.length,
      unseededAgentCount: seeded.unseeded.length,
      totalMacroTokens: seeded.totalMacroTokens,
      populationConserved: agents.length + seeded.unseeded.length === seeded.totalMacroTokens,
      unseeded: seeded.unseeded.map(item => ({ ...item })),
      stageCounts,
      totalStageTransitions,
      totalJunctionDecisions,
      blockedAgentCount: blocked.length,
      blocked: blocked.map(item => ({ ...item })),
      totalYieldCount,
      routeReservationCount: reservationSnapshot.activeReservationCount,
      routeReservationGrants: reservationSnapshot.grants,
      routeReservationRefreshes: reservationSnapshot.refreshes,
      routeReservationDenials: reservationSnapshot.denials,
      routeReservationReleases: reservationSnapshot.releases,
      routeReservationStaleReleases: reservationSnapshot.staleReleases,
      routeReservations: reservationSnapshot.reservations,
      materializationTokenCount: agents.length,
      projectionValid: projectionValidation.valid,
      projectionErrors: [...projectionValidation.errors],
      projectedAgentCount: projection.projectedAgentCount,
      ambiguousAgentCount: projection.ambiguousAgentCount,
      unmatchedAgentCount: projection.unmatchedAgentCount,
      districtPopulationCount,
      districtPopulationConserved: districtPopulationCount === agents.length,
      districtCounts: { ...projection.districtCounts },
      edgeCounts: { ...projection.edgeCounts }
    };
  }

  function destroy(reason = "runtime-destroy") {
    if (destroyed) return;
    for (const agent of agents) releaseTokenReservations(agent.tokenId, reason);
    if (ownsReservationRegistry) reservations.clear(reason);
    agents = [];
    blocked = [];
    destroyed = true;
  }

  return Object.freeze({
    step,
    snapshot,
    materializationTokens,
    reservationRegistry: reservations,
    agents() {
      return agents.map(cloneAgent);
    },
    destroy
  });
}

export function installTrafficMultiAgentRouteRuntimePolicy(materializer, {
  speed = 168,
  reservationStaleAfterSeconds = 3,
  defaultEnabled = true
} = {}) {
  if (!materializer?.trafficTokens || !materializer?.reconcile || !materializer?.pool || !materializer?.assignments) {
    throw new TypeError("Traffic multi-agent route runtime policy requires TrafficMaterializationSystem.");
  }
  if (materializer.__nbdTrafficMultiAgentRouteRuntimePolicy) {
    return materializer.__nbdTrafficMultiAgentRouteRuntimePolicy;
  }

  const originalTrafficTokens = materializer.trafficTokens;
  let enabled = false;
  let runtime = null;
  let routeBehavior = null;
  let activationPoolSize = null;
  let activationAttempts = 0;
  let activationBlockedReason = null;
  let manualPause = false;
  let macroAccountingProvider = null;
  let behavior = null;
  let originalBehaviorApplyDecision = null;
  let routeGuardedApplyDecision = null;
  let steering = null;
  let originalSteeringApplyPresentation = null;
  let routeGuardedApplyPresentation = null;

  function topology() {
    return materializer.lanes?.localTopology || null;
  }

  function ready() {
    return Boolean(
      topology()?.lanes
      && materializer.macro?.graph?.edges
      && materializer.macro?.trafficFlows instanceof Map
    );
  }

  function presentationReady() {
    const scene = materializer.scene;
    return Boolean(
      scene?.trafficLocalBehaviorSystem?.applyDecision
      && scene?.trafficSteeringPresentationSystem?.applyPresentation
    );
  }

  function defaultActivationReady() {
    return ready();
  }

  function ensurePresentationGuards() {
    const scene = materializer.scene;
    if (!behavior && scene?.trafficLocalBehaviorSystem?.applyDecision) {
      behavior = scene.trafficLocalBehaviorSystem;
      originalBehaviorApplyDecision = behavior.applyDecision;
      routeGuardedApplyDecision = function multiAgentRouteBehaviorGuard(targetSlot, ...args) {
        if (targetSlot?.routeActive) {
          targetSlot.behaviorReason = targetSlot.behaviorReason || "route-cruise";
          targetSlot.behaviorLag = 0;
          return targetSlot;
        }
        return originalBehaviorApplyDecision.call(this, targetSlot, ...args);
      };
      behavior.applyDecision = routeGuardedApplyDecision;
    }
    if (!steering && scene?.trafficSteeringPresentationSystem?.applyPresentation) {
      steering = scene.trafficSteeringPresentationSystem;
      originalSteeringApplyPresentation = steering.applyPresentation;
      routeGuardedApplyPresentation = function multiAgentRouteSteeringGuard(targetSlot, ...args) {
        if (targetSlot?.routeActive) {
          targetSlot.steeringOffset = 0;
          targetSlot.steeringAngle = 0;
          targetSlot.steeringReason = targetSlot.behaviorReason === "junction-yield"
            ? "junction-yield"
            : targetSlot.behaviorBlockerId
              ? "route-braking-no-lateral"
              : "route-multi-agent";
          return targetSlot;
        }
        return originalSteeringApplyPresentation.call(this, targetSlot, ...args);
      };
      steering.applyPresentation = routeGuardedApplyPresentation;
    }
  }

  function restorePresentationGuards() {
    if (behavior && behavior.applyDecision === routeGuardedApplyDecision) {
      behavior.applyDecision = originalBehaviorApplyDecision;
    }
    if (steering && steering.applyPresentation === routeGuardedApplyPresentation) {
      steering.applyPresentation = originalSteeringApplyPresentation;
    }
    behavior = null;
    originalBehaviorApplyDecision = null;
    routeGuardedApplyDecision = null;
    steering = null;
    originalSteeringApplyPresentation = null;
    routeGuardedApplyPresentation = null;
  }

  function buildRuntime() {
    if (!ready()) return null;
    return createTrafficMultiAgentRouteRuntime({
      trafficFlows: materializer.macro.trafficFlows,
      macroGraph: materializer.macro.graph,
      topology: topology(),
      speed,
      reservationStaleAfterSeconds
    });
  }

  function candidateFailure(candidate) {
    if (!candidate) return "runtime-not-ready";
    const state = candidate.snapshot();
    if (!state.populationConserved) return "population-not-conserved";
    if (state.unseededAgentCount !== 0) return `unseeded-production-tokens:${state.unseededAgentCount}`;
    if (!state.projectionValid) return `invalid-compatibility-projection:${state.projectionErrors.join("|")}`;
    if (!state.districtPopulationConserved) {
      return `district-population-not-conserved:${state.districtPopulationCount}/${state.seededAgentCount}`;
    }
    return null;
  }

  function attachMacroAccounting() {
    if (macroAccountingProvider) return true;
    if (typeof materializer.macro?.setCivilianRouteAccountingProvider !== "function") return false;
    macroAccountingProvider = () => runtime?.snapshot?.() || null;
    materializer.macro.setCivilianRouteAccountingProvider(macroAccountingProvider);
    return true;
  }

  function detachMacroAccounting() {
    if (!macroAccountingProvider) return;
    materializer.macro?.clearCivilianRouteAccountingProvider?.(macroAccountingProvider);
    macroAccountingProvider = null;
  }

  function activate({ automatic = false, reconcile = false, throwOnFailure = false } = {}) {
    if (enabled) return true;
    if (materializer.__nbdTrafficControlledRouteActivationPolicy?.snapshot?.().enabled) {
      const reason = "controlled-route-activation-active";
      activationBlockedReason = reason;
      if (throwOnFailure) throw new Error(`Cannot start multi-agent route runtime: ${reason}.`);
      return false;
    }
    if (automatic && !defaultActivationReady()) return false;

    activationAttempts++;
    const candidate = buildRuntime();
    const failure = candidateFailure(candidate);
    if (failure) {
      candidate?.destroy?.("activation-rejected");
      activationBlockedReason = failure;
      if (throwOnFailure) throw new Error(`Cannot start multi-agent route runtime: ${failure}.`);
      return false;
    }

    runtime?.destroy?.("runtime-restart");
    routeBehavior?.clear?.();
    runtime = candidate;
    routeBehavior = createTrafficRouteBehaviorController(materializer, {
      topology: topology(),
      baseSpeed: speed
    });
    activationPoolSize = materializer.pool.length;
    enabled = true;
    manualPause = false;
    activationBlockedReason = null;
    ensurePresentationGuards();

    if (defaultEnabled && !attachMacroAccounting()) {
      enabled = false;
      routeBehavior.clear();
      routeBehavior = null;
      runtime.destroy("missing-macro-accounting-provider");
      runtime = null;
      restorePresentationGuards();
      activationBlockedReason = "macro-route-accounting-provider-unavailable";
      if (throwOnFailure) {
        throw new Error("Cannot start multi-agent route runtime: macro-route-accounting-provider-unavailable.");
      }
      return false;
    }

    if (reconcile) materializer.reconcile(true);
    return true;
  }

  function routedTrafficTokens() {
    if (!enabled && defaultEnabled && !manualPause && defaultActivationReady()) {
      activate({ automatic: true, reconcile: false });
    }
    if (!enabled || !runtime) return originalTrafficTokens.call(materializer);
    return runtime.materializationTokens();
  }

  function advanceRoute(seconds) {
    ensurePresentationGuards();
    routeBehavior?.update?.(runtime, seconds);
    runtime.step(seconds, {
      speedFactorFor: agent => routeBehavior?.speedFactor?.(agent.tokenId, agent.stage) ?? 1
    });
    return snapshot();
  }

  function start() {
    manualPause = false;
    activate({ reconcile: true, throwOnFailure: true });
    return snapshot();
  }

  function update(seconds = 0.05) {
    if (!enabled && defaultEnabled && !manualPause) {
      activate({ automatic: true, reconcile: false });
    }
    if (!enabled || !runtime) return snapshot();
    return advanceRoute(seconds);
  }

  function step(seconds = 0.05) {
    if (!enabled) start();
    if (!runtime) return snapshot();
    advanceRoute(seconds);
    materializer.reconcile(true);
    return snapshot();
  }

  function stop() {
    const wasEnabled = enabled;
    manualPause = true;
    enabled = false;
    detachMacroAccounting();
    routeBehavior?.clear?.();
    routeBehavior = null;
    runtime?.destroy?.("runtime-stop");
    runtime = null;
    restorePresentationGuards();
    materializer.reconcile(true);
    return {
      enabled: false,
      wasEnabled,
      manualPause,
      poolSize: materializer.pool.length,
      fixedPoolPreserved: activationPoolSize === null || materializer.pool.length === activationPoolSize
    };
  }

  function snapshot() {
    const route = runtime?.snapshot?.() || null;
    return {
      ready: ready(),
      enabled,
      defaultEnabled: Boolean(defaultEnabled),
      defaultActivationReady: defaultActivationReady(),
      presentationReady: presentationReady(),
      movementAuthority: enabled ? "multi-agent-compiler-route" : "authored-local-lanes",
      defaultTrafficAuthority: defaultEnabled ? "multi-agent-compiler-route" : "authored-local-lanes",
      macroMutationAuthority: false,
      macroCoordinateAuthority: false,
      macroAccountingInstalled: Boolean(macroAccountingProvider),
      manualPause,
      activationAttempts,
      activationBlockedReason,
      poolSize: materializer.pool.length,
      initialPoolSize: activationPoolSize ?? materializer.pool.length,
      fixedPoolPreserved: activationPoolSize === null || materializer.pool.length === activationPoolSize,
      behaviorGuardInstalled: Boolean(behavior && behavior.applyDecision === routeGuardedApplyDecision),
      steeringGuardInstalled: Boolean(steering && steering.applyPresentation === routeGuardedApplyPresentation),
      routeBehavior: routeBehavior?.snapshot?.() || {
        active: false,
        movementAuthority: false,
        geometryAuthority: "compiler-local-topology",
        lateralSteeringAuthority: false,
        activeVehicles: 0,
        brakingVehicles: 0,
        stoppedVehicles: 0,
        playerReactiveVehicles: 0,
        followingVehicles: 0,
        vehicles: []
      },
      ...(route || {
        seededAgentCount: 0,
        unseededAgentCount: 0,
        totalMacroTokens: 0,
        populationConserved: true,
        projectionValid: true,
        projectionErrors: [],
        projectedAgentCount: 0,
        ambiguousAgentCount: 0,
        unmatchedAgentCount: 0,
        districtPopulationCount: 0,
        districtPopulationConserved: true,
        districtCounts: {},
        edgeCounts: {},
        routeReservationCount: 0,
        materializationTokenCount: 0,
        blockedAgentCount: 0,
        totalYieldCount: 0
      })
    };
  }

  materializer.trafficTokens = routedTrafficTokens;

  const policy = {
    active: true,
    start,
    update,
    step,
    stop,
    snapshot,
    runtime() {
      return runtime;
    },
    routeBehavior() {
      return routeBehavior;
    },
    destroy() {
      const wasEnabled = enabled;
      enabled = false;
      detachMacroAccounting();
      routeBehavior?.clear?.();
      routeBehavior = null;
      runtime?.destroy?.("policy-destroy");
      runtime = null;
      restorePresentationGuards();
      if (wasEnabled) materializer.reconcile(true);
      if (materializer.trafficTokens === routedTrafficTokens) materializer.trafficTokens = originalTrafficTokens;
      if (typeof window !== "undefined" && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT?.__policy === policy) {
        delete window.NBD_TRAFFIC_ROUTE_MULTI_AGENT;
      }
      if (materializer.__nbdTrafficMultiAgentRouteRuntimePolicy === policy) {
        delete materializer.__nbdTrafficMultiAgentRouteRuntimePolicy;
      }
    }
  };

  materializer.__nbdTrafficMultiAgentRouteRuntimePolicy = policy;
  if (typeof window !== "undefined") {
    window.NBD_TRAFFIC_ROUTE_MULTI_AGENT = Object.freeze({
      __policy: policy,
      start,
      step,
      stop,
      snapshot
    });
  }
  return policy;
}
