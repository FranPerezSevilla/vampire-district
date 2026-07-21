import { generateFoundryCandidate } from "./foundry-pilot.js";

export const SELECTED_FOUNDRY_SEED = "foundry-pilot-04";

export function selectedFoundryCandidate(options = {}) {
  return generateFoundryCandidate(SELECTED_FOUNDRY_SEED, options);
}
