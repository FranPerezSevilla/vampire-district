export function installCampaignBrowserApi(scene, campaign, checkpoints = scene?.campaignCheckpointSystem) {
  if (typeof window === "undefined" || !scene || !campaign) return () => {};

  const reload = () => window.location.reload();
  const api = Object.freeze({
    snapshot: () => campaign.snapshot(),
    export: () => campaign.export(),
    checkpoint: () => campaign.checkpoint(),
    startMission: (id, options = {}) => campaign.startMission(id, options),
    save: () => campaign.save(),
    reloadCheckpoint: () => reload(),
    discardCheckpoint: () => {
      campaign.clearCheckpoint();
      reload();
    },
    reset: () => {
      campaign.reset({ persist: true });
      reload();
    },
    import: serialized => {
      campaign.import(serialized, { persist: true });
      reload();
    },
    safety: () => ({
      pending: checkpoints?.pending ? { ...checkpoints.pending } : null,
      state: checkpoints?.safetySnapshot?.() || null,
      summary: checkpoints?.summary?.() || "Checkpoint system unavailable"
    })
  });

  window.NBD_CAMPAIGN = api;
  window.NBD_CAMPAIGN_READY = true;
  return () => {
    if (window.NBD_CAMPAIGN === api) delete window.NBD_CAMPAIGN;
    window.NBD_CAMPAIGN_READY = false;
  };
}
