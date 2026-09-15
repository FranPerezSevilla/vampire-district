import { bootProfile } from "../boot/BootProfile.js";
import {
  CAMPAIGN_ENTRY_SESSION_KEY,
  createCampaignEntry
} from "./CampaignEntry.js";
import { CampaignSystem } from "./CampaignSystem.js";

function consumeAutoEnter() {
  try {
    const requested = globalThis?.sessionStorage?.getItem?.(CAMPAIGN_ENTRY_SESSION_KEY) === "enter";
    globalThis?.sessionStorage?.removeItem?.(CAMPAIGN_ENTRY_SESSION_KEY);
    return requested;
  } catch {
    return false;
  }
}

function hiddenFreeRoamEntry(campaign) {
  const entry = createCampaignEntry(campaign.snapshot(), { autoEnter: true });
  return Object.freeze({
    ...entry,
    autoEnter: true,
    show: false,
    blocksAutomaticOpeningStart: true,
    deferCheckpointRestore: false,
    preserveNativeIntro: false,
    bootMode: bootProfile.mode,
    scenarioId: bootProfile.scenarioId
  });
}

// A bootstrap starts a new run, never resumes a cached campaign singleton.
// Other modules import this live instance for the remainder of the session.
const existing = globalThis.NBD_CAMPAIGN_SYSTEM;
if (existing instanceof CampaignSystem) existing.destroy();
const campaign = new CampaignSystem({
  // Null deliberately prevents even explicit legacy save() calls from storing
  // progress. Do not access/clear localStorage: asset caches and settings remain.
  storage: null,
  autoLoad: bootProfile.autoLoadCampaign,
  autoSave: bootProfile.autoSaveCampaign
});

// The entry descriptor remains available to checkpoint/bootstrap code, but no
// production mission is selected or started. Explicit future definitions can
// still be supplied to CampaignSystem by tests or later content modules.
const campaignEntry = bootProfile.showCampaignEntry
  ? createCampaignEntry(campaign.snapshot(), { autoEnter: consumeAutoEnter() })
  : hiddenFreeRoamEntry(campaign);

globalThis.NBD_CAMPAIGN_SYSTEM = campaign;
globalThis.NBD_CAMPAIGN_ENTRY = campaignEntry;

export { campaign, campaignEntry };
