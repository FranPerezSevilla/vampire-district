import { blockTemplateById } from "./catalog.js";
import {
  evaluateFoundryCandidate,
  foundryCandidateSummary,
  foundryDistrict,
  generateFoundryCandidate as generateDraftFoundryCandidate,
  rankFoundryCandidates,
  scoreFoundryCandidate
} from "./foundry-generator.js";
import { defineCityBlueprint } from "./model.js";

const PEDESTRIAN_CONNECTOR_ID = "foundry:sidewalk:back-lane-route";

function slug(value) {
  return String(value || "candidate")
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "candidate";
}

function normalizeBuilding(building) {
  if (!String(building?.id || "").startsWith("foundry:")) return building;
  const template = blockTemplateById[building.templateId];
  if (!template) return building;
  return {
    ...building,
    w: Math.max(template.footprint.minWidth, Math.min(template.footprint.maxWidth, building.w)),
    h: Math.max(template.footprint.minHeight, Math.min(template.footprint.maxHeight, building.h))
  };
}

function normalizePlan(plan, buildings) {
  const byId = Object.fromEntries(buildings.map(building => [building.id, building]));
  return {
    ...plan,
    normalized: true,
    blocks: (plan.blocks || []).map(block => {
      const building = byId[block.buildingId];
      return building
        ? { ...block, footprint: { x: building.x, y: building.y, w: building.w, h: building.h } }
        : block;
    })
  };
}

export function normalizeFoundryCandidate(draft) {
  const buildings = draft.runtime.buildings.map(normalizeBuilding);
  const sidewalks = draft.runtime.sidewalks.some(item => item.id === PEDESTRIAN_CONNECTOR_ID)
    ? draft.runtime.sidewalks
    : [
        ...draft.runtime.sidewalks,
        {
          id: PEDESTRIAN_CONNECTOR_ID,
          x: 1904,
          y: 270,
          w: 12,
          h: 128,
          roadId: "harborBackLane",
          generated: true,
          purpose: "continuous Foundry pedestrian loop"
        }
      ];
  const plan = normalizePlan(draft.metadata?.foundryPilot || {}, buildings);
  return defineCityBlueprint({
    ...draft,
    runtime: { ...draft.runtime, buildings, sidewalks },
    metadata: {
      ...draft.metadata,
      foundryPilot: plan,
      normalization: {
        templateFootprints: true,
        pedestrianSurfaceContinuity: true
      }
    }
  });
}

export function generateFoundryCandidate(seed, options = {}) {
  return normalizeFoundryCandidate(generateDraftFoundryCandidate(seed, options));
}

export function generateFoundryCandidates({ seedPrefix = "foundry-pilot", count = 24, baseBlueprint } = {}) {
  const total = Math.max(1, Math.floor(Number(count) || 1));
  return Array.from({ length: total }, (_, index) => {
    const seed = `${slug(seedPrefix)}-${String(index + 1).padStart(2, "0")}`;
    return evaluateFoundryCandidate(generateFoundryCandidate(seed, { baseBlueprint }));
  });
}

export {
  foundryCandidateSummary,
  foundryDistrict,
  rankFoundryCandidates,
  scoreFoundryCandidate
};