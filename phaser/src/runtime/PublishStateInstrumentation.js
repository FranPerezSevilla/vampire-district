const PHASE_PREPARE = "PublishState.Prepare";
const PHASE_SUMMARIES = "PublishState.Summaries";
const PHASE_INTERACTION_MENU = "PublishState.InteractionMenu";
const PHASE_PAYLOAD_TAIL = "PublishState.PayloadTail";
const PHASE_REGISTRY_COMMIT = "PublishState.RegistryCommit";

const SUMMARY_MISSION_ACTORS_MISSION = "PublishState.Summary.MissionActors.Mission";
const SUMMARY_MISSION_ACTORS_NPC = "PublishState.Summary.MissionActors.Npc";
const SUMMARY_MISSION_ACTORS_NEEDS_POWERS = "PublishState.Summary.MissionActors.NeedsPowers";
const SUMMARY_PRESSURE_EVIDENCE_PRESSURE = "PublishState.Summary.PressureEvidence.Pressure";
const SUMMARY_PRESSURE_EVIDENCE_WITNESS_EVIDENCE = "PublishState.Summary.PressureEvidence.WitnessEvidence";
const SUMMARY_RESPONSE_AI_SECURITY = "PublishState.Summary.ResponseAI.Security";
const SUMMARY_RESPONSE_AI_WORLD = "PublishState.Summary.ResponseAI.WorldAI";
const SUMMARY_TAIL = "PublishState.Summary.Tail";

function profileBoundary(owner, method, { before = null, after = null } = {}, isActive, restorers) {
  if (!owner || typeof owner[method] !== "function") return;
  const original = owner[method];
  const wrapped = function profiledPublishStateBoundary(...args) {
    const active = isActive();
    if (active) before?.();
    try {
      return original.apply(this, args);
    } finally {
      if (active) after?.();
    }
  };
  owner[method] = wrapped;
  restorers.push(() => {
    if (owner[method] === wrapped) owner[method] = original;
  });
}

export function installPublishStateInstrumentation(scene, diagnostics) {
  if (!scene || typeof scene.publishState !== "function") return () => {};
  if (scene.__nbdPublishStateInstrumentationCleanup) return scene.__nbdPublishStateInstrumentationCleanup;

  const restorers = [];
  let activeDepth = 0;
  let activePhase = null;
  let activeSummaryPhase = null;

  const endActivePhase = () => {
    if (!activePhase) return;
    diagnostics?.endSystem?.(activePhase.label, activePhase.mark);
    activePhase = null;
  };

  const transitionPhase = label => {
    if (activeDepth <= 0) return;
    endActivePhase();
    if (!label) return;
    activePhase = {
      label,
      mark: diagnostics?.beginSystem?.(label) ?? null
    };
  };

  const endActiveSummaryPhase = () => {
    if (!activeSummaryPhase) return;
    diagnostics?.endSystem?.(activeSummaryPhase.label, activeSummaryPhase.mark);
    activeSummaryPhase = null;
  };

  const transitionSummaryPhase = label => {
    if (activeDepth <= 0) return;
    endActiveSummaryPhase();
    if (!label) return;
    activeSummaryPhase = {
      label,
      mark: diagnostics?.beginSystem?.(label) ?? null
    };
  };

  const originalPublishState = scene.publishState;
  const wrappedPublishState = function profiledPublishState(...args) {
    const outermost = activeDepth === 0;
    activeDepth += 1;
    if (outermost) transitionPhase(PHASE_PREPARE);
    try {
      return originalPublishState.apply(this, args);
    } finally {
      if (outermost) {
        endActiveSummaryPhase();
        endActivePhase();
      }
      activeDepth = Math.max(0, activeDepth - 1);
    }
  };
  scene.publishState = wrappedPublishState;
  restorers.push(() => {
    if (scene.publishState === wrappedPublishState) scene.publishState = originalPublishState;
  });

  const isActive = () => activeDepth > 0;

  // Keep the top-level drill-down deliberately coarse. These boundaries cover the
  // existing publishState body with only three wrapped methods while preserving order.
  profileBoundary(
    scene,
    "visibilityText",
    {
      after: () => {
        transitionPhase(PHASE_SUMMARIES);
        transitionSummaryPhase(SUMMARY_MISSION_ACTORS_MISSION);
      }
    },
    isActive,
    restorers
  );

  // The durable MissionActors split selected MissionNpc 24/24 across all three
  // phases. Deepen only that selected pair with one additional existing-method
  // boundary: objectiveText remains the Mission phase, and NpcSystem.summary()
  // starts the Npc phase. The sibling NeedsPowers phase is left unchanged.
  profileBoundary(
    scene.npcSystem,
    "summary",
    { before: () => transitionSummaryPhase(SUMMARY_MISSION_ACTORS_NPC) },
    isActive,
    restorers
  );
  profileBoundary(
    scene.feedingSystem,
    "summary",
    { before: () => transitionSummaryPhase(SUMMARY_MISSION_ACTORS_NEEDS_POWERS) },
    isActive,
    restorers
  );

  // The unchanged repeat selected PressureEvidence 24/24 at the current summary
  // resolution, but the measured group is only ~0.074 ms mean. Split it once, using
  // WitnessSystem.summary() as the only new boundary: Exposure + Heat/Wanted remain
  // the Pressure phase, while Witness + Evidence become WitnessEvidence. Avoid a
  // four-leaf wrapper set whose timer overhead would be comparable to the work.
  profileBoundary(
    scene.exposureSystem,
    "summary",
    { before: () => transitionSummaryPhase(SUMMARY_PRESSURE_EVIDENCE_PRESSURE) },
    isActive,
    restorers
  );
  profileBoundary(
    scene.witnessSystem,
    "summary",
    { before: () => transitionSummaryPhase(SUMMARY_PRESSURE_EVIDENCE_WITNESS_EVIDENCE) },
    isActive,
    restorers
  );

  // Other selected summary groups remain at their previous low-overhead boundaries.
  profileBoundary(
    scene.policeSystem,
    "summary",
    { before: () => transitionSummaryPhase(SUMMARY_RESPONSE_AI_SECURITY) },
    isActive,
    restorers
  );
  profileBoundary(
    scene.propDamageSystem,
    "summary",
    { before: () => transitionSummaryPhase(SUMMARY_RESPONSE_AI_WORLD) },
    isActive,
    restorers
  );
  profileBoundary(
    scene.aiStateSystem,
    "summary",
    { after: () => transitionSummaryPhase(SUMMARY_TAIL) },
    isActive,
    restorers
  );

  profileBoundary(
    scene.interactionSystem,
    "snapshot",
    {
      before: () => {
        endActiveSummaryPhase();
        transitionPhase(PHASE_INTERACTION_MENU);
      },
      after: () => transitionPhase(PHASE_PAYLOAD_TAIL)
    },
    isActive,
    restorers
  );
  profileBoundary(
    scene.statePublisher,
    "setMany",
    {
      before: () => {
        transitionPhase(null);
        const mark = diagnostics?.beginSystem?.(PHASE_REGISTRY_COMMIT) ?? null;
        activePhase = { label: PHASE_REGISTRY_COMMIT, mark };
      },
      after: () => endActivePhase()
    },
    isActive,
    restorers
  );

  const cleanup = () => {
    endActiveSummaryPhase();
    endActivePhase();
    activeDepth = 0;
    for (let index = restorers.length - 1; index >= 0; index -= 1) restorers[index]();
    if (scene.__nbdPublishStateInstrumentationCleanup === cleanup) {
      delete scene.__nbdPublishStateInstrumentationCleanup;
    }
  };
  scene.__nbdPublishStateInstrumentationCleanup = cleanup;
  return cleanup;
}
