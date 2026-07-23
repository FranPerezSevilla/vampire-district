import { bootProfile } from "../boot/BootProfile.js";
import {
  CAMPAIGN_ENTRY_SESSION_KEY,
  createCampaignEntry
} from "./CampaignEntry.js";
import { CampaignSystem } from "./CampaignSystem.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); }
  };
}

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

const existing = globalThis.NBD_CAMPAIGN_SYSTEM;
const campaign = existing instanceof CampaignSystem
  ? existing
  : new CampaignSystem({
      storage: bootProfile.persistentCampaign ? globalThis?.localStorage : memoryStorage(),
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
