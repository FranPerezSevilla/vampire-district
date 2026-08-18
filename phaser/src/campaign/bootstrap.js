import { installCampaignBrowserApi } from "./CampaignBrowserApi.js";
import { CampaignCheckpointSystem } from "./CampaignCheckpointSystem.js";
import { campaign, campaignEntry } from "./preload.js";

function publishCampaign(scene, checkpoints) {
  const snapshot = campaign.snapshot();
  const values = {
    campaignState: snapshot.state,
    campaignMission: snapshot.activeMission,
    campaignEntry,
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

function titleMenuOwnsSession(game) {
  return !window.NBD_RC_TEST_MODE
    && Boolean(game?.scene?.isActive?.("MainMenuScene"));
}

function restoreCampaignAttention(scene, game) {
  if (titleMenuOwnsSession(game)) {
    // The title screen is the beginning of a new playable session. Heat/Wanted is
    // moment-to-moment police response state, so never resurrect the previous
    // browser session's pursuit into the live menu city. HeatSystem.clear also
    // writes the neutral state back to campaign storage, preventing a later reload
    // from reviving the same pursuit.
    scene.heatSystem?.clear?.("Main menu starts a fresh police-response session.");
  } else {
    // Direct gameplay/test harness boots intentionally keep the saved Heat contract.
    scene.heatSystem?.restoreState?.(campaign.state.heat);
  }

  // Exposure/evidence is long-lived campaign consequence, not active pursuit state.
  // Preserve it across title loads along with wallet, reputation, territory, etc.
  scene.exposureSystem?.restoreState?.(campaign.state.exposure);
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
    window.setTimeout(attachCampaignRuntime, 16);
    return;
  }
  if (scene.campaignCheckpointSystem) return;

  scene.campaignSystem = campaign;
  restoreCampaignAttention(scene, game);
  const deferredCheckpoint = campaignEntry.deferCheckpointRestore
    ? campaign.state.checkpoints.latest
    : null;
  if (deferredCheckpoint) campaign.state.checkpoints.latest = null;

  let checkpoints;
  try {
    checkpoints = new CampaignCheckpointSystem(scene, campaign);
  } finally {
    if (deferredCheckpoint) campaign.state.checkpoints.latest = deferredCheckpoint;
  }

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
