import { MissionBoardSystem } from "./MissionBoardSystem.js";
import { campaign } from "./preload.js";

function attachMissionBoard() {
  const game = window.NBD_PHASER_GAME;
  const scene = game?.scene?.getScene?.("GameScene");
  const uiScene = game?.scene?.getScene?.("UIScene");
  if (!scene?.campaignEntrySystem
    || !scene?.campaignCheckpointSystem
    || !scene?.missionSystem
    || !scene?.inputSystem
    || !uiScene?.dom?.root) {
    window.requestAnimationFrame(attachMissionBoard);
    return;
  }
  if (scene.missionBoardSystem) return;

  const board = new MissionBoardSystem(scene, uiScene, campaign);
  scene.missionBoardSystem = board;
  window.NBD_MISSION_BOARD = Object.freeze({
    snapshot: () => board.snapshot(),
    open: () => board.open(),
    close: () => board.close(),
    accept: missionId => board.acceptMission(missionId)
  });
  window.NBD_MISSION_BOARD_READY = true;
  window.dispatchEvent(new CustomEvent("nbd:mission-board-ready", {
    detail: board.snapshot()
  }));
}

window.NBD_MISSION_BOARD_READY = false;
attachMissionBoard();
