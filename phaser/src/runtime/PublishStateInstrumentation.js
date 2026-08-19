const PHASE_PREPARE = "PublishState.Prepare";
const PHASE_SUMMARIES = "PublishState.Summaries";
const PHASE_INTERACTION_MENU = "PublishState.InteractionMenu";
const PHASE_PAYLOAD_TAIL = "PublishState.PayloadTail";
const PHASE_REGISTRY_COMMIT = "PublishState.RegistryCommit";

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

  const originalPublishState = scene.publishState;
  const wrappedPublishState = function profiledPublishState(...args) {
    const outermost = activeDepth === 0;
    activeDepth += 1;
    if (outermost) transitionPhase(PHASE_PREPARE);
    try {
      return originalPublishState.apply(this, args);
    } finally {
      if (outermost) endActivePhase();
      activeDepth = Math.max(0, activeDepth - 1);
    }
  };
  scene.publishState = wrappedPublishState;
  restorers.push(() => {
    if (scene.publishState === wrappedPublishState) scene.publishState = originalPublishState;
  });

  const isActive = () => activeDepth > 0;

  // Keep this drill-down deliberately coarse. The previous leaf-method profiler
  // wrapped seventeen calls and its own Map/rest-argument overhead became material
  // relative to the tiny per-summary timings. These boundaries cover the existing
  // publishState body with only three wrapped methods while preserving its order.
  profileBoundary(
    scene,
    "visibilityText",
    { after: () => transitionPhase(PHASE_SUMMARIES) },
    isActive,
    restorers
  );
  profileBoundary(
    scene.interactionSystem,
    "snapshot",
    {
      before: () => transitionPhase(PHASE_INTERACTION_MENU),
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
