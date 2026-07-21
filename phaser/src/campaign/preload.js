import { BOOT_MODES, bootProfile } from "../boot/BootProfile.js";
import {
  CAMPAIGN_ENTRY_MODES,
  CAMPAIGN_ENTRY_SESSION_KEY,
  createCampaignEntry
} from "./CampaignEntry.js";
import { CampaignSystem } from "./CampaignSystem.js";
import { SILENCE_THE_JOURNALIST_ID } from "./missions/silenceTheJournalist.js";

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

function releaseCandidateBypass() {
  try {
    const params = new URLSearchParams(globalThis?.location?.search || "");
    return bootProfile.mode === BOOT_MODES.NORMAL
      && params.has("rcTest")
      && !params.has("campaignEntryTest");
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

function isolatedEntry(campaign) {
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
let campaignEntry = bootProfile.showCampaignEntry
  ? createCampaignEntry(campaign.snapshot(), { autoEnter: consumeAutoEnter() })
  : isolatedEntry(campaign);
if (releaseCandidateBypass()) campaignEntry = prepareReleaseCandidateCampaign(campaign, campaignEntry);

globalThis.NBD_CAMPAIGN_SYSTEM = campaign;
globalThis.NBD_CAMPAIGN_ENTRY = campaignEntry;

export { campaign, campaignEntry };
