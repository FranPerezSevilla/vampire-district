export const PLAYTEST_STATUS = Object.freeze({
  READY: "ready",
  ACTIVE: "active",
  COMPLETE: "complete",
  FAILED: "failed"
});

export const PLAYTEST_CONFIG = Object.freeze({
  id: "hunt-feed-escape-0.1",
  title: "Hunt, Feed, Escape",
  startHunger: 72,
  targetHunger: 25,
  durationSeconds: 15 * 60,
  safeRadius: 90,
  leaveRadius: 150
});

const OBJECTIVE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "feed",
    label: "Find prey and feed",
    hint: "Follow the prey pulse, press F to read nearby life, then hold right mouse and release at a feeding threshold."
  }),
  Object.freeze({
    id: "hunger",
    label: "Lower Hunger to 25% or less",
    hint: "Follow another prey pulse or continue feeding. Quick Bite is safer; deeper feeding leaves a worse scene."
  }),
  Object.freeze({
    id: "return",
    label: "Escape and return to the refuge",
    hint: "Lose police pursuit, follow the refuge marker and arrive on foot. Rooftops, sewers and vehicles are all valid routes."
  })
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function objectiveState(index, activeIndex, status) {
  if (status === PLAYTEST_STATUS.COMPLETE) return "done";
  if (index < activeIndex) return "done";
  if (index === activeIndex) return status === PLAYTEST_STATUS.FAILED ? "failed" : "active";
  return "todo";
}

function deriveObjectiveIndex(state) {
  if (state.metrics.feedCount < 1) return 0;
  if (state.metrics.finalHunger > state.config.targetHunger) return 1;
  return 2;
}

function withObjectives(state) {
  const activeIndex = state.status === PLAYTEST_STATUS.COMPLETE
    ? OBJECTIVE_DEFINITIONS.length
    : deriveObjectiveIndex(state);
  return {
    ...state,
    objectiveIndex: Math.min(activeIndex, OBJECTIVE_DEFINITIONS.length - 1),
    objectives: OBJECTIVE_DEFINITIONS.map((objective, index) => ({
      ...objective,
      state: objectiveState(index, activeIndex, state.status)
    }))
  };
}

export function createPlaytestSessionState(config = {}) {
  const mergedConfig = Object.freeze({ ...PLAYTEST_CONFIG, ...(config || {}) });
  return withObjectives({
    id: mergedConfig.id,
    title: mergedConfig.title,
    status: PLAYTEST_STATUS.READY,
    config: mergedConfig,
    elapsedSeconds: 0,
    timeRemainingSeconds: mergedConfig.durationSeconds,
    objectiveIndex: 0,
    objectives: [],
    leftRefuge: false,
    failureReason: "",
    metrics: {
      feedCount: 0,
      quickBites: 0,
      fullFeeds: 0,
      drains: 0,
      finalHunger: mergedConfig.startHunger,
      maxHeatLevel: 0,
      maxExposure: 0,
      witnessReports: 0,
      vehicleUsed: false,
      alternateRouteUsed: false
    },
    current: {
      nearRefuge: true,
      distanceFromRefuge: 0,
      heatLevel: 0,
      driving: false,
      layer: 0
    }
  });
}

export function startPlaytestSession(state) {
  if (!state || state.status !== PLAYTEST_STATUS.READY) return state;
  return withObjectives({
    ...state,
    status: PLAYTEST_STATUS.ACTIVE,
    elapsedSeconds: 0,
    timeRemainingSeconds: state.config.durationSeconds,
    failureReason: ""
  });
}

export function advancePlaytestSession(state, observation = {}) {
  if (!state || state.status !== PLAYTEST_STATUS.ACTIVE) return state;

  const dt = clamp(observation.dt, 0, 1);
  const elapsedSeconds = Math.min(state.config.durationSeconds, state.elapsedSeconds + dt);
  const distanceFromRefuge = Math.max(0, Number(observation.distanceFromRefuge) || 0);
  const nearRefuge = Boolean(observation.nearRefuge);
  const heatLevel = clamp(observation.heatLevel, 0, 3);
  const finalHunger = clamp(observation.hunger, 0, 100);
  const feedCount = Math.max(0, Number(observation.feedCount) || 0);
  const leftRefuge = state.leftRefuge || distanceFromRefuge >= state.config.leaveRadius;

  const metrics = {
    feedCount,
    quickBites: Math.max(0, Number(observation.quickBites) || 0),
    fullFeeds: Math.max(0, Number(observation.fullFeeds) || 0),
    drains: Math.max(0, Number(observation.drains) || 0),
    finalHunger,
    maxHeatLevel: Math.max(state.metrics.maxHeatLevel, heatLevel),
    maxExposure: Math.max(state.metrics.maxExposure, Math.max(0, Number(observation.exposure) || 0)),
    witnessReports: Math.max(state.metrics.witnessReports, Math.max(0, Number(observation.witnessReports) || 0)),
    vehicleUsed: state.metrics.vehicleUsed || Boolean(observation.driving) || Boolean(observation.vehicleUsed),
    alternateRouteUsed: state.metrics.alternateRouteUsed || Number(observation.layer) !== 0
  };

  let status = state.status;
  let failureReason = state.failureReason;
  const completed = leftRefuge
    && metrics.feedCount > 0
    && metrics.finalHunger <= state.config.targetHunger
    && nearRefuge
    && heatLevel === 0
    && !Boolean(observation.driving);

  if (completed) status = PLAYTEST_STATUS.COMPLETE;
  else if (elapsedSeconds >= state.config.durationSeconds) {
    status = PLAYTEST_STATUS.FAILED;
    failureReason = "The fifteen-minute playtest window ended before you returned safely.";
  }

  return withObjectives({
    ...state,
    status,
    elapsedSeconds,
    timeRemainingSeconds: Math.max(0, state.config.durationSeconds - elapsedSeconds),
    leftRefuge,
    failureReason,
    metrics,
    current: {
      nearRefuge,
      distanceFromRefuge,
      heatLevel,
      driving: Boolean(observation.driving),
      layer: Number(observation.layer) || 0
    }
  });
}

export function playtestObjectiveText(state) {
  if (!state) return "Playtest unavailable.";
  if (state.status === PLAYTEST_STATUS.READY) return "PLAYTEST READY · Hunt, feed and return safely.";
  if (state.status === PLAYTEST_STATUS.COMPLETE) return "NIGHT SURVIVED · Run complete.";
  if (state.status === PLAYTEST_STATUS.FAILED) return `NIGHT LOST · ${state.failureReason || "The run is over."}`;

  if (state.objectiveIndex === 0) return "1/3 HUNT · Find prey and complete a feeding action.";
  if (state.objectiveIndex === 1) {
    return `2/3 FEED · Lower Hunger to ${state.config.targetHunger}% or less. Current: ${Math.round(state.metrics.finalHunger)}%.`;
  }
  if (state.current.heatLevel > 0) return "3/3 ESCAPE · Lose police pursuit before returning to the refuge.";
  if (!state.current.nearRefuge) return "3/3 RETURN · Follow the refuge marker and get back safely.";
  if (state.current.driving) return "3/3 RETURN · Exit the vehicle inside the refuge zone.";
  return "3/3 RETURN · Reach the refuge on foot.";
}

export function formatPlaytestDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function playtestResult(state) {
  if (!state || ![PLAYTEST_STATUS.COMPLETE, PLAYTEST_STATUS.FAILED].includes(state.status)) return null;
  const success = state.status === PLAYTEST_STATUS.COMPLETE;
  const metrics = state.metrics;
  return {
    kind: "playtest",
    status: success ? "complete" : "failed",
    title: success ? "NIGHT SURVIVED" : "NIGHT LOST",
    subtitle: success
      ? "You fed, escaped the response and made it back to safety."
      : state.failureReason || "The run ended before you returned safely.",
    reportHeading: "Playtest report",
    actionLabel: "Play again · Enter",
    stats: {
      time: formatPlaytestDuration(state.elapsedSeconds),
      hunger: Math.round(metrics.finalHunger),
      feedCount: metrics.feedCount,
      quickBites: metrics.quickBites,
      fullFeeds: metrics.fullFeeds,
      drains: metrics.drains,
      maxHeatLevel: metrics.maxHeatLevel,
      maxExposure: Math.round(metrics.maxExposure),
      witnessReports: metrics.witnessReports,
      vehicleUsed: metrics.vehicleUsed,
      alternateRouteUsed: metrics.alternateRouteUsed
    }
  };
}
