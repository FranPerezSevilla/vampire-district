import { installCampaignBrowserApi } from "./CampaignBrowserApi.js";
import { CampaignCheckpointSystem } from "./CampaignCheckpointSystem.js";
import { campaign } from "./preload.js";

function releaseRestoredIntro(game, checkpoints) {
  if (!checkpoints.restored) return;
  const uiScene = game.scene?.getScene?.("UIScene");
  if (!uiScene?.dom) {
    window.requestAnimationFrame(() => releaseRestoredIntro(game, checkpoints));
    return;
  }
  if (uiScene.introOpen) uiScene.closeIntro?.();
}

function attachCampaignRuntime() {
  const game = window.NBD_PHASER_GAME;
  const scene = game?.scene?.getScene?.("GameScene");
  if (!scene?.missionSystem
    || !scene?.npcSystem
    || !scene?.weaponSystem
    || !scene?.propDamageSystem
    || !scene?.evidenceSystem
    || !scene?.statePublisher) {
    window.requestAnimationFrame(attachCampaignRuntime);
    return;
  }
  if (scene.campaignCheckpointSystem) return;

  scene.campaignSystem = campaign;
  const checkpoints = new CampaignCheckpointSystem(scene, campaign);
  scene.campaignCheckpointSystem = checkpoints;
  const updateCheckpoint = () => checkpoints.update();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, updateCheckpoint);
  const uninstallApi = installCampaignBrowserApi(scene, campaign, checkpoints);
  releaseRestoredIntro(game, checkpoints);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, updateCheckpoint);
    uninstallApi?.();
  });
}

attachCampaignRuntime();
