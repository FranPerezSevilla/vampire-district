import { CAMPAIGN_ENTRY_ACTIONS } from "./CampaignEntry.js";
import { CampaignEntrySystem as CampaignEntrySystemCore } from "./CampaignEntrySystemCore.js";

export class CampaignEntrySystem extends CampaignEntrySystemCore {
  execute(action) {
    if (action === CAMPAIGN_ENTRY_ACTIONS.EXPLORE) {
      if (this.busy) return false;
      this.setBusy(true);
      this.setStatus("Opening a non-persistent exploration session…");
      const url = new URL(window.location.href);
      url.searchParams.set("mode", "explore");
      url.searchParams.delete("testScenario");
      url.searchParams.delete("campaignEntryTest");
      url.searchParams.delete("rcTest");
      window.location.assign(url.href);
      return true;
    }

    if (action !== CAMPAIGN_ENTRY_ACTIONS.NEW_GAME) return super.execute(action);
    if (this.busy) return false;

    this.setBusy(true);
    try {
      this.campaign.reset({ persist: false });
      const missionId = this.entry.missionId
        || this.campaign.definitions?.[0]?.id
        || null;
      if (missionId && this.campaign.missions.definition(missionId)) {
        this.campaign.startMission(missionId, {
          metadata: { integration: "campaign_entry" }
        });
      }
      this.campaign.save();
      this.reloadIntoCampaign(missionId
        ? "Starting a new campaign…"
        : "Resetting persistent free roam…");
      return true;
    } catch (error) {
      this.setBusy(false);
      this.setStatus(error?.message || "The campaign could not be reset.");
      return false;
    }
  }
}
