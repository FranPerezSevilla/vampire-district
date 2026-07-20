import {
  CAMPAIGN_ENTRY_MODES,
  CAMPAIGN_ENTRY_SESSION_KEY,
  createCampaignEntry
} from "./CampaignEntry.js";
import { CampaignSystem } from "./CampaignSystem.js";
import { SILENCE_THE_JOURNALIST_ID } from "./missions/silenceTheJournalist.js";

function consumeAutoEnter() {
  try {
    const requested = globalThis?.sessionStorage?.getItem?.(CAMPAIGN_ENTRY_SESSION_KEY) === "enter";
    globalThis?.sessionStorage?.removeItem?.(CAMPAIGN_ENTRY_SESSION_KEY);
    return requested;
  } catch {
    return false;
  }
}

function releaseCandidateBypass() {
  try {
    const params = new URLSearchParams(globalThis?.location?.search || "");
    return params.has("rcTest") && !params.has("campaignEntryTest");
  } catch {
    return false;
  }
}

function prepareReleaseCandidateCampaign(campaign, entry) {
  if (entry.mode === CAMPAIGN_ENTRY_MODES.NEW_GAME) {
    campaign.startMission(SILENCE_THE_JOURNALIST_ID, {
      metadata: {
        integration: "release_candidate_harness",
        rooftopJumps: 0
      }
    });
  } else if ([CAMPAIGN_ENTRY_MODES.RETRY_CHECKPOINT, CAMPAIGN_ENTRY_MODES.RETRY_MISSION].includes(entry.mode)) {
    campaign.startMission(entry.missionId || SILENCE_THE_JOURNALIST_ID, {
      replay: true,
      metadata: {
        integration: "release_candidate_harness",
        retryMode: entry.mode
      }
    });
  }

  const prepared = createCampaignEntry(campaign.snapshot(), { autoEnter: true });
  return Object.freeze({
    ...prepared,
    autoEnter: true,
    show: false,
    preserveNativeIntro: true
  });
}

const existing = globalThis.NBD_CAMPAIGN_SYSTEM;
const campaign = existing instanceof CampaignSystem
  ? existing
  : new CampaignSystem({
      storage: globalThis?.localStorage,
      autoLoad: true,
      autoSave: true
    });
let campaignEntry = createCampaignEntry(campaign.snapshot(), {
  autoEnter: consumeAutoEnter()
});
if (releaseCandidateBypass()) campaignEntry = prepareReleaseCandidateCampaign(campaign, campaignEntry);

globalThis.NBD_CAMPAIGN_SYSTEM = campaign;
globalThis.NBD_CAMPAIGN_ENTRY = campaignEntry;

export { campaign, campaignEntry };