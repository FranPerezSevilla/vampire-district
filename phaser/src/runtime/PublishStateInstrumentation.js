const METHOD_TARGETS = Object.freeze([
  [scene => scene, "describeCurrentZone", "PublishState.Zone"],
  [scene => scene, "visibilityText", "PublishState.Visibility"],
  [scene => scene.missionSystem, "objectiveText", "PublishState.Mission"],
  [scene => scene.npcSystem, "summary", "PublishState.Npc"],
  [scene => scene.feedingSystem, "summary", "PublishState.Hunger"],
  [scene => scene.powersSystem, "summary", "PublishState.Powers"],
  [scene => scene.exposureSystem, "summary", "PublishState.Exposure"],
  [scene => scene.heatSystem, "summary", "PublishState.Heat"],
  [scene => scene.heatSystem, "level", "PublishState.WantedLevel"],
  [scene => scene.witnessSystem, "summary", "PublishState.Witness"],
  [scene => scene.evidenceSystem, "summary", "PublishState.Evidence"],
  [scene => scene.policeSystem, "summary", "PublishState.Police"],
  [scene => scene.hunterSystem, "summary", "PublishState.Hunter"],
  [scene => scene.propDamageSystem, "summary", "PublishState.Props"],
  [scene => scene.aiStateSystem, "summary", "PublishState.Ai"],
  [scene => scene.interactionSystem, "snapshot", "PublishState.InteractionMenu"],
  [scene => scene.statePublisher, "setMany", "PublishState.RegistryCommit"]
]);

function profileMethod(owner, method, label, diagnostics, isActive, restorers) {
  if (!owner || typeof owner[method] !== "function") return;
  const original = owner[method];
  const wrapped = function profiledPublishStateMethod(...args) {
    if (!isActive()) return original.apply(this, args);
    const mark = diagnostics?.beginSystem?.(label) ?? null;
    try {
      return original.apply(this, args);
    } finally {
      diagnostics?.endSystem?.(label, mark);
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
  const originalPublishState = scene.publishState;
  const wrappedPublishState = function profiledPublishState(...args) {
    activeDepth += 1;
    try {
      return originalPublishState.apply(this, args);
    } finally {
      activeDepth = Math.max(0, activeDepth - 1);
    }
  };
  scene.publishState = wrappedPublishState;
  restorers.push(() => {
    if (scene.publishState === wrappedPublishState) scene.publishState = originalPublishState;
  });

  const isActive = () => activeDepth > 0;
  for (const [resolveOwner, method, label] of METHOD_TARGETS) {
    profileMethod(resolveOwner(scene), method, label, diagnostics, isActive, restorers);
  }

  const cleanup = () => {
    for (let index = restorers.length - 1; index >= 0; index -= 1) restorers[index]();
    if (scene.__nbdPublishStateInstrumentationCleanup === cleanup) {
      delete scene.__nbdPublishStateInstrumentationCleanup;
    }
  };
  scene.__nbdPublishStateInstrumentationCleanup = cleanup;
  return cleanup;
}
