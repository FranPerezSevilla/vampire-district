import { generateFoundryCandidate } from "./foundry-pilot.js";
import { defineCityBlueprint } from "./model.js";

export const SELECTED_FOUNDRY_SEED = "foundry-pilot-04";

export function selectedFoundryCandidate(options = {}) {
  const candidate = generateFoundryCandidate(SELECTED_FOUNDRY_SEED, options);
  return defineCityBlueprint({
    ...candidate,
    metadata: {
      ...candidate.metadata,
      productionSelection: {
        seed: SELECTED_FOUNDRY_SEED,
        topologyVersion: 2,
        pedestrianRouteId: "foundry:pedestrian-route:works-loop"
      }
    }
  });
}
