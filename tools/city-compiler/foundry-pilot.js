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
const GENERATED_PREFIX = "foundry:";

function slug(value) {
  return String(value || "candidate")
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "candidate";
}

function normalizeBuilding(building) {
  if (!String(building?.id || "").startsWith(GENERATED_PREFIX)) return building;
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

function generated(items = []) {
  return items
    .filter(item => String(item?.id || "").startsWith(GENERATED_PREFIX))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function candidateFeatures(result) {
  const runtime = result.blueprint.runtime;
  const buildings = generated(runtime.buildings);
  const roads = generated(runtime.roads);
  const roofs = generated(Object.values(runtime.roofAreas || {}).flat());
  const vehicle = generated(runtime.vehicles)[0];
  return {
    templates: buildings.map(item => item.templateId || item.family || "unknown"),
    buildings: buildings.map(item => [item.x, item.y, item.w, item.h]),
    roads: roads.map(item => [item.x, item.y, item.w, item.h]),
    roofCount: roofs.length,
    vehicleArchetype: vehicle?.archetypeId || "none"
  };
}

function normalizedGeometryDistance(left = [], right = [], scale = 100) {
  const length = Math.max(left.length, right.length, 1);
  let sum = 0;
  for (let index = 0; index < length; index++) {
    const a = left[index] || [0, 0, 0, 0];
    const b = right[index] || [0, 0, 0, 0];
    for (let axis = 0; axis < 4; axis++) sum += Math.abs((Number(a[axis]) || 0) - (Number(b[axis]) || 0)) / scale;
  }
  return sum / length;
}

export function foundryCandidateDistance(leftResult, rightResult) {
  const left = candidateFeatures(leftResult);
  const right = candidateFeatures(rightResult);
  const templateLength = Math.max(left.templates.length, right.templates.length, 1);
  let templateMismatches = 0;
  for (let index = 0; index < templateLength; index++) {
    if (left.templates[index] !== right.templates[index]) templateMismatches += 1;
  }
  const templateDistance = templateMismatches / templateLength;
  const roofDistance = Math.abs(left.roofCount - right.roofCount) / 2;
  const vehicleDistance = left.vehicleArchetype === right.vehicleArchetype ? 0 : 0.35;
  return templateDistance * 3.2
    + normalizedGeometryDistance(left.buildings, right.buildings, 40) * 1.4
    + normalizedGeometryDistance(left.roads, right.roads, 50) * 1.8
    + roofDistance * 1.5
    + vehicleDistance;
}

export function selectDiverseFoundryCandidates(ranked = [], count = 3, { maxScoreDrop = 4 } = {}) {
  const target = Math.max(0, Math.floor(Number(count) || 0));
  if (!target) return [];
  const accepted = ranked.filter(result => result.foundryScore.accepted);
  if (!accepted.length) return [];
  const bestScore = accepted[0].foundryScore.total;
  const qualityPool = accepted.filter(result => result.foundryScore.total >= bestScore - Math.max(0, Number(maxScoreDrop) || 0));
  const selected = [qualityPool[0]];
  const remaining = qualityPool.slice(1);

  while (selected.length < target && remaining.length) {
    let bestIndex = 0;
    let bestUtility = -Infinity;
    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      const minimumDistance = Math.min(...selected.map(chosen => foundryCandidateDistance(candidate, chosen)));
      const quality = candidate.foundryScore.total / 100;
      const utility = minimumDistance * 10 + quality;
      if (utility > bestUtility + 1e-9) {
        bestUtility = utility;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  if (selected.length < target) {
    for (const candidate of accepted) {
      if (selected.includes(candidate)) continue;
      selected.push(candidate);
      if (selected.length >= target) break;
    }
  }
  return selected.slice(0, target);
}

export {
  foundryCandidateSummary,
  foundryDistrict,
  rankFoundryCandidates,
  scoreFoundryCandidate
};