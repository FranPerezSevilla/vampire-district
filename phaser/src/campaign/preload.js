import { CampaignSystem } from "./CampaignSystem.js";

const existing = globalThis.NBD_CAMPAIGN_SYSTEM;
const campaign = existing instanceof CampaignSystem
  ? existing
  : new CampaignSystem({
      storage: globalThis?.localStorage,
      autoLoad: true,
      autoSave: true
    });

globalThis.NBD_CAMPAIGN_SYSTEM = campaign;

export { campaign };
