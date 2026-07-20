import { CampaignMissionAuthority } from "./CampaignMissionAuthority.js";
import { CampaignSystem } from "./CampaignSystem.js";

function attachCampaignFoundation() {
  const game = window.NBD_PHASER_GAME;
  const scene = game?.scene?.getScene?.("GameScene");
  if (!scene?.missionSystem || !scene?.npcSystem || !scene?.statePublisher || !scene?.tutorialDirector) {
    window.requestAnimationFrame(attachCampaignFoundation);
    return;
  }
  if (scene.campaignSystem) return;

  const campaign = new CampaignSystem({
    storage: window.localStorage,
    autoLoad: true,
    autoSave: true
  });
  scene.campaignSystem = campaign;
  scene.campaignMissionAuthority = new CampaignMissionAuthority(scene, campaign);

  window.NBD_CAMPAIGN = Object.freeze({
    snapshot: () => campaign.snapshot(),
    checkpoint: () => campaign.checkpoints.snapshot(),
    export: () => campaign.export(),
    save: () => campaign.save(),
    reset: () => {
      const result = campaign.reset({ persist: true });
      window.location.reload();
      return result;
    },
    import: serialized => {
      const result = campaign.import(serialized, { persist: true });
      window.location.reload();
      return result;
    }
  });
}

attachCampaignFoundation();
