import { MISSION_STATUS } from "./constants.js";
import { CLEAN_THE_SCENE_ID } from "./missions/cleanTheScene.js";
import { SILENCE_THE_JOURNALIST_ID } from "./missions/silenceTheJournalist.js";

export const MISSION_BOARD_MARKER = Object.freeze({
  x: 150,
  y: 146,
  layer: 2,
  radius: 48,
  label: "BOARD"
});

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function missionRecord(state, id) {
  return plainObject(plainObject(state?.missions).records)[id] || null;
}

function missionComplete(state, id) {
  const missions = plainObject(state?.missions);
  return missionRecord(state, id)?.status === MISSION_STATUS.COMPLETED
    || (Array.isArray(missions.completed) && missions.completed.includes(id));
}

function freezeCard(card) {
  card.rewards = Object.freeze({
    cash: Number(card.rewards?.cash) || 0,
    reputation: Object.freeze({ ...(card.rewards?.reputation || {}) }),
    contacts: Object.freeze({ ...(card.rewards?.contacts || {}) }),
    flags: Object.freeze({ ...(card.rewards?.flags || {}) }),
    items: Object.freeze([...(card.rewards?.items || [])])
  });
  return Object.freeze(card);
}

export function createMissionBoardModel(snapshotCandidate) {
  const snapshot = plainObject(snapshotCandidate);
  const state = plainObject(snapshot.state || snapshotCandidate);
  const missions = plainObject(state.missions);
  const activeMissionId = missions.activeMissionId == null ? null : String(missions.activeMissionId);
  const openingComplete = missionComplete(state, SILENCE_THE_JOURNALIST_ID);
  const unresolvedFailure = Object.values(plainObject(missions.records))
    .some(record => record?.status === MISSION_STATUS.FAILED);
  const boardAvailable = openingComplete && !activeMissionId && !unresolvedFailure;

  const definitions = Array.isArray(snapshot.definitions) ? snapshot.definitions : [];
  const cards = definitions
    .filter(definition => definition?.id === CLEAN_THE_SCENE_ID || definition?.metadata?.missionBoard)
    .sort((left, right) => (
      (Number(left?.metadata?.missionBoard?.order) || 100)
      - (Number(right?.metadata?.missionBoard?.order) || 100)
    ))
    .map(definition => {
      const record = missionRecord(state, definition.id);
      const completed = record?.status === MISSION_STATUS.COMPLETED;
      const completionCount = Math.max(0, Number(record?.completionCount) || 0);
      const replayable = Boolean(definition.replayable);
      const available = boardAvailable && (!completed || replayable);
      return freezeCard({
        id: String(definition.id),
        title: String(definition.title || definition.id),
        description: String(definition.description || ""),
        contactId: definition.contactId == null ? null : String(definition.contactId),
        contactLabel: String(definition.metadata?.missionBoard?.contactLabel || "Blackglass Directorate"),
        replayable,
        status: record?.status || MISSION_STATUS.INACTIVE,
        completionCount,
        available,
        actionLabel: completed && replayable ? "Run contract again" : "Accept contract",
        rewards: definition.rewards || {}
      });
    });

  return Object.freeze({
    version: 1,
    available: boardAvailable,
    openingComplete,
    activeMissionId,
    unresolvedFailure,
    marker: Object.freeze({ ...MISSION_BOARD_MARKER }),
    cards: Object.freeze(cards)
  });
}
