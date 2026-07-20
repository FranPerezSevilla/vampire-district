import { CampaignEntrySystem } from "./CampaignEntrySystem.js";
import { campaign, campaignEntry } from "./preload.js";

function attachCampaignEntry() {
  const game = window.NBD_PHASER_GAME;
  const scene = game?.scene?.getScene?.("GameScene");
  const uiScene = game?.scene?.getScene?.("UIScene");
  if (!scene?.campaignCheckpointSystem
    || !scene?.tutorialDirector
    || !scene?.inputSystem
    || !uiScene?.dom?.root) {
    window.requestAnimationFrame(attachCampaignEntry);
    return;
  }
  if (scene.campaignEntrySystem) return;

  scene.campaignEntrySystem = new CampaignEntrySystem(scene, uiScene, campaign, campaignEntry);
  window.NBD_CAMPAIGN_ENTRY_READY = true;
  window.dispatchEvent(new CustomEvent("nbd:campaign-entry-ready", {
    detail: {
      mode: campaignEntry.mode,
      autoEnter: campaignEntry.autoEnter
    }
  }));
}

attachCampaignEntry();
