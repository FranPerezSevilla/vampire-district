import { CAMPAIGN_ENTRY_ACTIONS } from "./CampaignEntry.js";
import { CampaignEntrySystem as CampaignEntrySystemCore } from "./CampaignEntrySystemCore.js";

export class CampaignEntrySystem extends CampaignEntrySystemCore {
  execute(action) {
    if (action !== CAMPAIGN_ENTRY_ACTIONS.EXPLORE) return super.execute(action);
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
}
