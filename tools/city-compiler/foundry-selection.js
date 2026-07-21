import { generateFoundryCandidate } from "./foundry-pilot.js";
import { defineCityBlueprint } from "./model.js";

export const SELECTED_FOUNDRY_SEED = "foundry-pilot-04";

const SELECTED_PEDESTRIAN_ROUTE = Object.freeze([
  Object.freeze({ x: 1754, y: 270 }),
  Object.freeze({ x: 1830, y: 270 }),
  Object.freeze({ x: 1908, y: 270 }),
  Object.freeze({ x: 1908, y: 334 }),
  Object.freeze({ x: 1908, y: 398 }),
  Object.freeze({ x: 1830, y: 398 }),
  Object.freeze({ x: 1754, y: 398 }),
  Object.freeze({ x: 1754, y: 334 })
]);

function normalizeSelectedCandidate(candidate) {
  const pedestrianRoutes = candidate.runtime.pedestrianRoutes.map(route => (
    route.id === "foundry:pedestrian-route:works-loop"
      ? { ...route, points: SELECTED_PEDESTRIAN_ROUTE }
      : route
  ));
  return defineCityBlueprint({
    ...candidate,
    runtime: { ...candidate.runtime, pedestrianRoutes },
    metadata: {
      ...candidate.metadata,
      productionSelection: {
        seed: SELECTED_FOUNDRY_SEED,
        pedestrianRouteNodes: SELECTED_PEDESTRIAN_ROUTE.length
      }
    }
  });
}

export function selectedFoundryCandidate(options = {}) {
  return normalizeSelectedCandidate(generateFoundryCandidate(SELECTED_FOUNDRY_SEED, options));
}
