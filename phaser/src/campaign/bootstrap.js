import { installCampaignBrowserApi } from "./CampaignBrowserApi.js";
import { CampaignCheckpointSystem } from "./CampaignCheckpointSystem.js";
import { campaign } from "./preload.js";

function publishCampaign(scene, checkpoints) {
  const snapshot = campaign.snapshot();
  const values = {
    campaignState: snapshot.state,
    campaignMission: snapshot.activeMission,
    cashText: `Cash $${snapshot.wallet.balance.toFixed(0)}`,
    campaignText: campaign.summary(),
    checkpointText: checkpoints.summary(),
    factionReputation: snapshot.reputation.factions,
    contactReputation: snapshot.reputation.contacts
  };
  scene.statePublisher?.setMany?.(values);
  if (!scene.statePublisher) {
    for (const [key, value] of Object.entries(values)) scene.registry?.set?.(key, value);
  }
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
  const publish = () => publishCampaign(scene, checkpoints);
  const disposePublish = campaign.events.on("*", publish);
  const uninstallApi = installCampaignBrowserApi(scene, campaign, checkpoints);
  publish();

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, updateCheckpoint);
    disposePublish?.();
    uninstallApi?.();
  });
}

attachCampaignRuntime();
