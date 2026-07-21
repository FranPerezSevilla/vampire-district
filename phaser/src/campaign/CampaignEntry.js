import { checkpointCanResume } from "./CampaignCheckpoint.js";
import { MISSION_STATUS } from "./constants.js";
import { SILENCE_THE_JOURNALIST_ID } from "./missions/silenceTheJournalist.js";

export const CAMPAIGN_ENTRY_VERSION = 1;
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

function definitionTitle(snapshot, missionId) {
  const definition = (Array.isArray(snapshot?.definitions) ? snapshot.definitions : [])
    .find(item => item?.id === missionId);
  return definition?.title || titleCaseId(missionId) || "Campaign contract";
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
  return { action: CAMPAIGN_ENTRY_ACTIONS.EXPLORE, label: "Explore district" };
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

  if (activeRecord?.status === MISSION_STATUS.ACTIVE) {
    const missionTitle = snapshot.activeMission?.title || definitionTitle(snapshot, activeMissionId);
    const objectiveLabel = activeObjectiveLabel(snapshot, activeRecord);
    const mayAutoEnter = Boolean(autoEnter);
    return baseEntry({
      mode: CAMPAIGN_ENTRY_MODES.CONTINUE,
      autoEnter: mayAutoEnter,
      blocksAutomaticOpeningStart: false,
      missionId: activeMissionId,
      missionTitle,
      checkpointId: checkpoint?.missionId === activeMissionId ? checkpoint.id : null,
      checkpointObjectiveId: checkpoint?.missionId === activeMissionId ? checkpoint.objectiveId : null,
      eyebrow: "CAMPAIGN SAVE",
      title: "Continue the night",
      body: [
        `${missionTitle} is still active.`,
        `Resume at: ${objectiveLabel}.`
      ],
      primary: { action: CAMPAIGN_ENTRY_ACTIONS.CONTINUE, label: "Continue" },
      secondary: [
        { action: CAMPAIGN_ENTRY_ACTIONS.NEW_GAME, label: "Start new game" },
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
  if (failedMissionId) {
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
        { action: CAMPAIGN_ENTRY_ACTIONS.NEW_GAME, label: "Start new game" },
        exploreAction()
      ],
      details: [
        { label: "Contract", value: missionTitle },
        { label: "Cash", value: `$${cash.toFixed(0)}` },
        ...(resumable ? [{ label: "Safe point", value: checkpointLabel }] : [])
      ]
    });
  }

  const openingRecord = records[SILENCE_THE_JOURNALIST_ID];
  const openingComplete = openingRecord?.status === MISSION_STATUS.COMPLETED
    || (Array.isArray(missions.completed) && missions.completed.includes(SILENCE_THE_JOURNALIST_ID));
  if (openingComplete) {
    const missionTitle = definitionTitle(snapshot, SILENCE_THE_JOURNALIST_ID);
    return baseEntry({
      mode: CAMPAIGN_ENTRY_MODES.FREE_ROAM,
      missionId: SILENCE_THE_JOURNALIST_ID,
      missionTitle,
      checkpointId: checkpoint?.id || null,
      checkpointObjectiveId: checkpoint?.objectiveId || null,
      eyebrow: "NIGHT COMPLETE",
      title: "The district remembers",
      body: [
        `${missionTitle} is complete and its rewards are already recorded.`,
        "Continue in free roam, explore without campaign state, or erase the campaign and begin again."
      ],
      primary: { action: CAMPAIGN_ENTRY_ACTIONS.CONTINUE, label: "Continue free roam" },
      secondary: [
        { action: CAMPAIGN_ENTRY_ACTIONS.NEW_GAME, label: "Start new game" },
        exploreAction()
      ],
      details: [
        { label: "Cash", value: `$${cash.toFixed(0)}` },
        { label: "Completed", value: missionTitle }
      ]
    });
  }

  const openingTitle = definitionTitle(snapshot, SILENCE_THE_JOURNALIST_ID);
  return baseEntry({
    mode: CAMPAIGN_ENTRY_MODES.NEW_GAME,
    missionId: SILENCE_THE_JOURNALIST_ID,
    missionTitle: openingTitle,
    eyebrow: "NEW CAMPAIGN",
    title: "Vampire District",
    body: [
      "You were turned several decades ago. Among vampires, you are still little more than a clumsy fledgling with much to learn.",
      "Begin the campaign, or enter a non-persistent exploration session to test the district without tutorial or missions."
    ],
    primary: { action: CAMPAIGN_ENTRY_ACTIONS.NEW_GAME, label: "Begin the night" },
    secondary: [exploreAction()],
    details: [
      { label: "Opening contract", value: openingTitle },
      { label: "Campaign cash", value: `$${cash.toFixed(0)}` }
    ]
  });
}
