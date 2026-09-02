from pathlib import Path

def replace_once(path, old, new):
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one patch point, found {count}; anchor={old.splitlines()[0]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")

behavior = Path("phaser/src/streaming/TrafficRouteBehaviorPolicy.js")

replace_once(
    behavior,
    '''  YIELD_JUNCTION: "yield-junction",
  STOPPED_TRAFFIC: "stopped-traffic",''',
    '''  YIELD_JUNCTION: "yield-junction",
  PHYSICAL_HOLD: "physical-hold",
  STOPPED_TRAFFIC: "stopped-traffic",'''
)

replace_once(
    behavior,
    '''  let followingDecisions = 0;
  let trafficRecoveryDecisions = 0;''',
    '''  let followingDecisions = 0;
  let physicalHoldDecisions = 0;
  let trafficRecoveryDecisions = 0;'''
)

replace_once(
    behavior,
    '''      if (state.recoveryBlocked && state.recoveryCooldownSeconds <= EPSILON) state.recoveryBlocked = false;

      const decision = decisionFor(agent, state, agentsById, blockedById, settings);''',
    '''      if (state.recoveryBlocked && state.recoveryCooldownSeconds <= EPSILON) state.recoveryBlocked = false;

      const slot = materializer.assignments.get(agent.tokenId);
      const physicalHoldSeconds = Math.max(0, finite(slot?.physicalHoldSeconds));
      if (physicalHoldSeconds > EPSILON) {
        const decision = {
          fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.PHYSICAL_HOLD,
          desiredSpeedFactor: 0,
          reason: slot?.physicalReason === "route-contact-yield"
            ? "physical-contact-yield"
            : slot?.physicalReason === "blocked"
              ? "physical-blocked"
              : "physical-contact-hold",
          gap: 0,
          blockerId: slot?.physicalBlockerId || null,
          blockerKind: "physical"
        };
        transition(state, decision, duration);
        state.desiredSpeedFactor = 0;
        state.speedFactor = 0;
        state.reason = decision.reason;
        state.gap = 0;
        state.blockerId = decision.blockerId;
        state.blockerKind = decision.blockerKind;
        state.stoppedSeconds += duration;
        physicalHoldDecisions++;
        stoppedDecisions++;
        applySlotState(agent, state);
        continue;
      }

      const decision = decisionFor(agent, state, agentsById, blockedById, settings);'''
)

replace_once(
    behavior,
    '''      followingVehicles: stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.FOLLOW] || 0,
      assessingBypassVehicles:''',
    '''      followingVehicles: stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.FOLLOW] || 0,
      physicalHoldingVehicles: stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.PHYSICAL_HOLD] || 0,
      assessingBypassVehicles:'''
)

replace_once(
    behavior,
    '''      followingDecisions,
      trafficRecoveryDecisions,''',
    '''      followingDecisions,
      physicalHoldDecisions,
      trafficRecoveryDecisions,'''
)

runtime = Path("phaser/src/runtime/GameplayRuntime.js")

replace_once(
    runtime,
    '''    this.diagnostics.claim("TrafficMultiAgentRouteRuntimePolicy.update", "TrafficMultiAgentRouteRuntimePolicy");
    this.diagnostics.claim("MacroTrafficPoliceSystem.update", "MacroTrafficPoliceSystem");''',
    '''    this.diagnostics.claim("TrafficMultiAgentRouteRuntimePolicy.update", "TrafficMultiAgentRouteRuntimePolicy");
    this.diagnostics.claim(
      "TrafficPhysicalConsequencesSystem.prepareRouteFrame",
      "TrafficPhysicalConsequencesSystem"
    );
    this.diagnostics.claim("MacroTrafficPoliceSystem.update", "MacroTrafficPoliceSystem");'''
)

replace_once(
    runtime,
    '''    // Civilian route state advances first. Macro traffic then consumes only the
    // conservative route projection for civilian accounting while retaining its
    // independent macro police simulation. Materialization samples the same route
    // state afterwards, so route identity/pose/accounting describe one frame.
    scene.trafficLocalAssignmentPolicy?.multiAgentRoutePolicy?.update?.(dt);''',
    '''    // Gate unresolved route-to-route contacts before advancing compiler-route
    // state. This prevents a car body pinned in a junction from rotating or
    // tunnelling through route stages underneath the physical pile.
    scene.trafficPhysicalConsequencesSystem?.prepareRouteFrame?.(dt);
    // Civilian route state advances after the physical gate. Macro traffic then
    // consumes only the conservative route projection for accounting while
    // retaining its independent macro police simulation.
    scene.trafficLocalAssignmentPolicy?.multiAgentRoutePolicy?.update?.(dt);'''
)
