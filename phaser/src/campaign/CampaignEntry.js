import { checkpointCanResume } from "./CampaignCheckpoint.js";
import { MISSION_STATUS } from "./constants.js";

export const CAMPAIGN_ENTRY_VERSION = 2;
export const CAMPAIGN_ENTRY_SESSION_KEY = "vampire-district-campaign-entry-once-v1";

export const CAMPAIGN_ENTRY_MODES = Object.freeze({
  NEW_GAME: "new-game",
  CONTINUE: "continue",
  RETRY_CHECKPOINT: "retry-checkpoint",
  RETRY_MISSION: "retry-mission",
  FREE_ROAM: "free-roam"
});

export const CAMPAIGN_ENTRY_ACTIONS = Object.freeze({
  CONTINUE: "continue",
  NEW_GAME: "new-game",
  RETRY_CHECKPOINT: "retry-checkpoint",
  RETRY_MISSION: "retry-mission",
  EXPLORE: "explore"
});

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function titleCaseId(value) {
  return String(value || "")
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function definitions(snapshot) {
  return Array.isArray(snapshot?.definitions) ? snapshot.definitions : [];
}

function definition(snapshot, missionId) {
  return definitions(snapshot).find(item => item?.id === missionId) || null;
}

function definitionTitle(snapshot, missionId) {
  return definition(snapshot, missionId)?.title || titleCaseId(missionId) || "Campaign contract";
}

function openingDefinition(snapshot) {
  return definitions(snapshot).find(item => item?.metadata?.openingMission)
    || definitions(snapshot)[0]
    || null;
}

function latestFailedMissionId(state) {
  const missions = plainObject(state?.missions);
  const records = plainObject(missions.records);
  const candidates = new Set(Array.isArray(missions.failed) ? missions.failed : []);
  for (const [id, record] of Object.entries(records)) {
    if (record?.status === MISSION_STATUS.FAILED) candidates.add(id);
  }
  return [...candidates]
    .filter(id => records[id]?.status === MISSION_STATUS.FAILED)
    .sort((left, right) => (Number(records[right]?.failedAt) || 0) - (Number(records[left]?.failedAt) || 0))[0] || null;
}

function latestCompletedMissionId(state) {
  const missions = plainObject(state?.missions);
  const records = plainObject(missions.records);
  const candidates = new Set(Array.isArray(missions.completed) ? missions.completed : []);
  for (const [id, record] of Object.entries(records)) {
    if (record?.status === MISSION_STATUS.COMPLETED) candidates.add(id);
  }
  return [...candidates]
    .filter(id => records[id]?.status === MISSION_STATUS.COMPLETED || missions.completed?.includes?.(id))
    .sort((left, right) => (Number(records[right]?.completedAt) || 0) - (Number(records[left]?.completedAt) || 0))[0] || null;
}

function campaignBalance(snapshot, state) {
  const fromSnapshot = Number(snapshot?.wallet?.balance);
  if (Number.isFinite(fromSnapshot)) return Math.max(0, fromSnapshot);
  return Math.max(0, Number(state?.player?.cash) || 0);
}

function activeObjectiveLabel(snapshot, record) {
  const label = snapshot?.activeMission?.currentObjective?.label;
  if (label) return String(label);
  const objectiveId = Object.values(plainObject(record?.objectives))
    .find(objective => objective?.status === "active")?.id;
  return titleCaseId(objectiveId) || "Current objective";
}

function exploreAction() {
  return { action: CAMPAIGN_ENTRY_ACTIONS.EXPLORE, label: "Open isolated exploration" };
}

function freezeEntry(entry) {
  entry.body = Object.freeze([...(entry.body || [])]);
  entry.primary = Object.freeze({ ...entry.primary });
  entry.secondary = Object.freeze((entry.secondary || []).map(action => Object.freeze({ ...action })));
  entry.details = Object.freeze((entry.details || []).map(detail => Object.freeze({ ...detail })));
  return Object.freeze(entry);
}

function baseEntry({ mode, autoEnter = false, ...entry }) {
  return freezeEntry({
    version: CAMPAIGN_ENTRY_VERSION,
    mode,
    autoEnter: Boolean(autoEnter),
    show: !autoEnter,
    blocksAutomaticOpeningStart: mode !== CAMPAIGN_ENTRY_MODES.CONTINUE,
    deferCheckpointRestore: mode === CAMPAIGN_ENTRY_MODES.RETRY_CHECKPOINT,
    missionId: null,
    missionTitle: null,
    checkpointId: null,
    checkpointObjectiveId: null,
    body: [],
    primary: { action: CAMPAIGN_ENTRY_ACTIONS.CONTINUE, label: "Continue" },
    secondary: [],
    details: [],
    ...entry
  });
}

export function createCampaignEntry(snapshotCandidate, { autoEnter = false } = {}) {
  const snapshot = plainObject(snapshotCandidate);
  const state = plainObject(snapshot.state || snapshotCandidate);
  const missions = plainObject(state.missions);
  const records = plainObject(missions.records);
  const checkpoint = snapshot.checkpoint || state.checkpoints?.latest || null;
  const cash = campaignBalance(snapshot, state);
  const activeMissionId = String(missions.activeMissionId || "");
  const activeRecord = activeMissionId ? records[activeMissionId] : null;

  if (activeRecord?.status === MISSION_STATUS.ACTIVE && definition(snapshot, activeMissionId)) {
    const missionTitle = snapshot.activeMission?.title || definitionTitle(snapshot, activeMissionId);
    const objectiveLabel = activeObjectiveLabel(snapshot, activeRecord);
    return baseEntry({
      mode: CAMPAIGN_ENTRY_MODES.CONTINUE,
      autoEnter,
      blocksAutomaticOpeningStart: false,
      missionId: activeMissionId,
      missionTitle,
      checkpointId: checkpoint?.missionId === activeMissionId ? checkpoint.id : null,
      checkpointObjectiveId: checkpoint?.missionId === activeMissionId ? checkpoint.objectiveId : null,
      eyebrow: "CAMPAIGN SAVE",
      title: "Continue the night",
      body: [`${missionTitle} is still active.`, `Resume at: ${objectiveLabel}.`],
      primary: { action: CAMPAIGN_ENTRY_ACTIONS.CONTINUE, label: "Continue" },
      secondary: [
        { action: CAMPAIGN_ENTRY_ACTIONS.NEW_GAME, label: "Reset campaign" },
        exploreAction()
      ],
      details: [
        { label: "Cash", value: `$${cash.toFixed(0)}` },
        { label: "Contract", value: missionTitle },
        { label: "Objective", value: objectiveLabel }
      ]
    });
  }

  const failedMissionId = latestFailedMissionId(state);
  if (failedMissionId && definition(snapshot, failedMissionId)) {
    const record = records[failedMissionId];
    const missionTitle = definitionTitle(snapshot, failedMissionId);
    const resumable = Boolean(
      checkpoint
      && checkpoint.missionId === failedMissionId
      && checkpointCanResume(checkpoint, state)
    );
    const checkpointLabel = titleCaseId(checkpoint?.objectiveId) || "the last safe objective";
    return baseEntry({
      mode: resumable ? CAMPAIGN_ENTRY_MODES.RETRY_CHECKPOINT : CAMPAIGN_ENTRY_MODES.RETRY_MISSION,
      missionId: failedMissionId,
      missionTitle,
      checkpointId: resumable ? checkpoint.id : null,
      checkpointObjectiveId: resumable ? checkpoint.objectiveId : null,
      eyebrow: "FAILED RUN",
      title: resumable ? "Return to the last safe point" : "Restart the contract",
      body: [
        record.failureReason || `${missionTitle} ended in failure.`,
        resumable
          ? `The district can be restored at ${checkpointLabel}.`
          : "No safe world checkpoint is available, so the contract will restart from its opening objective."
      ],
      primary: {
        action: resumable ? CAMPAIGN_ENTRY_ACTIONS.RETRY_CHECKPOINT : CAMPAIGN_ENTRY_ACTIONS.RETRY_MISSION,
        label: resumable ? "Retry from checkpoint" : "Retry mission"
      },
      secondary: [
        { action: CAMPAIGN_ENTRY_ACTIONS.NEW_GAME, label: "Reset campaign" },
        exploreAction()
      ],
      details: [
        { label: "Contract", value: missionTitle },
        { label: "Cash", value: `$${cash.toFixed(0)}` },
        ...(resumable ? [{ label: "Safe point", value: checkpointLabel }] : [])
      ]
    });
  }

  const completedMissionId = latestCompletedMissionId(state);
  if (completedMissionId && definition(snapshot, completedMissionId)) {
    const missionTitle = definitionTitle(snapshot, completedMissionId);
    return baseEntry({
      mode: CAMPAIGN_ENTRY_MODES.FREE_ROAM,
      autoEnter,
      missionId: completedMissionId,
      missionTitle,
      checkpointId: checkpoint?.id || null,
      checkpointObjectiveId: checkpoint?.objectiveId || null,
      eyebrow: "NIGHT COMPLETE",
      title: "The district remembers",
      body: [
        `${missionTitle} is complete and its rewards are already recorded.`,
        "Continue in persistent free roam or reset campaign state."
      ],
      primary: { action: CAMPAIGN_ENTRY_ACTIONS.CONTINUE, label: "Continue free roam" },
      secondary: [
        { action: CAMPAIGN_ENTRY_ACTIONS.NEW_GAME, label: "Reset campaign" },
        exploreAction()
      ],
      details: [
        { label: "Cash", value: `$${cash.toFixed(0)}` },
        { label: "Completed", value: missionTitle }
      ]
    });
  }

  const opening = openingDefinition(snapshot);
  if (opening) {
    return baseEntry({
      mode: CAMPAIGN_ENTRY_MODES.NEW_GAME,
      autoEnter,
      missionId: opening.id,
      missionTitle: opening.title,
      eyebrow: "NEW CAMPAIGN",
      title: "Vampire District",
      body: [
        "Begin the campaign from its first registered contract, or open an isolated exploration session."
      ],
      primary: { action: CAMPAIGN_ENTRY_ACTIONS.NEW_GAME, label: "Begin the night" },
      secondary: [exploreAction()],
      details: [
        { label: "Opening contract", value: opening.title },
        { label: "Campaign cash", value: `$${cash.toFixed(0)}` }
      ]
    });
  }

  return baseEntry({
    mode: CAMPAIGN_ENTRY_MODES.FREE_ROAM,
    autoEnter,
    blocksAutomaticOpeningStart: true,
    eyebrow: "CITY SANDBOX",
    title: "Vampire District",
    body: [
      "There are no registered campaign contracts in this build.",
      "Enter persistent free roam while the city topology and landmark sites are redesigned."
    ],
    primary: { action: CAMPAIGN_ENTRY_ACTIONS.CONTINUE, label: "Enter city" },
    secondary: [
      { action: CAMPAIGN_ENTRY_ACTIONS.NEW_GAME, label: "Reset persistent state" },
      exploreAction()
    ],
    details: [
      { label: "Cash", value: `$${cash.toFixed(0)}` },
      { label: "Contracts", value: "0 registered" }
    ]
  });
}
