import { coefficientOfVariation, pointInRect, rectArea } from "./geometry.js";
import { validateCityBlueprint } from "./validate.js";

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function districtAt(blueprint, point) {
  return blueprint.districts.find(district => pointInRect(point, district.bounds, 0.01)) || null;
}

function countByDistrict(blueprint, items, pointOf) {
  const counts = Object.fromEntries(blueprint.districts.map(district => [district.id, 0]));
  for (const item of items || []) {
    const district = districtAt(blueprint, pointOf(item));
    if (district) counts[district.id] += 1;
  }
  return counts;
}

function scoreRoadConnectivity(validation) {
  if (!validation.metrics.roadNodes) return 0;
  if (validation.metrics.roadComponents !== 1) return clampScore(35 / validation.metrics.roadComponents);
  const cycleTarget = Math.max(2, Math.round(validation.metrics.roadNodes * 0.22));
  const redundancy = Math.min(1, validation.metrics.roadCycleSurplus / cycleTarget);
  return clampScore(72 + redundancy * 28);
}

function scoreDistrictIdentity(blueprint) {
  const recipeIds = blueprint.districts.map(district => district.recipeId);
  const unique = new Set(recipeIds).size;
  const ratio = unique / Math.max(1, blueprint.districts.length);
  const tagSets = blueprint.districts.map(district => {
    const recipe = blueprint.recipes.find(candidate => candidate.id === district.recipeId);
    return new Set(recipe?.tags || []);
  });
  let distinctPairs = 0;
  let pairs = 0;
  for (let left = 0; left < tagSets.length; left++) {
    for (let right = left + 1; right < tagSets.length; right++) {
      pairs += 1;
      const overlap = [...tagSets[left]].filter(tag => tagSets[right].has(tag)).length;
      if (overlap === 0) distinctPairs += 1;
    }
  }
  const pairRatio = pairs ? distinctPairs / pairs : 1;
  return clampScore(ratio * 55 + pairRatio * 45);
}

function scoreSystemDistribution(blueprint) {
  const runtime = blueprint.runtime;
  const lightCounts = countByDistrict(blueprint, runtime.lights, item => ({ x: item.x, y: item.y }));
  const dumpsterCounts = countByDistrict(blueprint, runtime.dumpsters, item => ({ x: item.x, y: item.y }));
  const vehicleCounts = countByDistrict(blueprint, runtime.vehicles, item => ({ x: item.x, y: item.y }));
  const normalizedLights = blueprint.districts.map(district => lightCounts[district.id] / Math.max(1, rectArea(district.bounds) / 100000));
  const normalizedDumpsters = blueprint.districts.map(district => dumpsterCounts[district.id] / Math.max(1, rectArea(district.bounds) / 100000));
  const coverage = blueprint.districts.filter(district => lightCounts[district.id] + dumpsterCounts[district.id] + vehicleCounts[district.id] > 0).length / Math.max(1, blueprint.districts.length);
  const imbalance = Math.min(1, (coefficientOfVariation(normalizedLights) + coefficientOfVariation(normalizedDumpsters)) / 3);
  return {
    score: clampScore(coverage * 70 + (1 - imbalance) * 30),
    lightCounts,
    dumpsterCounts,
    vehicleCounts
  };
}

function scorePedestrianCoverage(blueprint) {
  const represented = new Set();
  for (const route of blueprint.runtime.pedestrianRoutes || []) {
    for (const point of route.points || []) {
      const district = districtAt(blueprint, point);
      if (district) represented.add(district.id);
    }
  }
  const ratio = represented.size / Math.max(1, blueprint.districts.length);
  const routeDensity = Math.min(1, (blueprint.runtime.pedestrianRoutes?.length || 0) / Math.max(1, blueprint.districts.length));
  return clampScore(ratio * 72 + routeDensity * 28);
}

function scoreVerticalAndUnderground(blueprint) {
  const roofs = Object.values(blueprint.runtime.roofAreas || {}).flat();
  const roofDistricts = new Set(roofs.map(roof => districtAt(blueprint, { x: roof.x + roof.w / 2, y: roof.y + roof.h / 2 })?.id).filter(Boolean));
  const sewerDistricts = new Set((blueprint.runtime.sewerAccesses || []).map(access => districtAt(blueprint, access.street || access.sewer)?.id).filter(Boolean));
  const roofRatio = roofDistricts.size / Math.max(1, blueprint.districts.length);
  const sewerRatio = sewerDistricts.size / Math.max(1, blueprint.districts.length);
  return clampScore(roofRatio * 55 + sewerRatio * 45);
}

export function scoreCityBlueprint(blueprint, validation = validateCityBlueprint(blueprint)) {
  const distribution = scoreSystemDistribution(blueprint);
  const components = {
    roadConnectivity: scoreRoadConnectivity(validation),
    districtIdentity: scoreDistrictIdentity(blueprint),
    systemicDistribution: distribution.score,
    pedestrianCoverage: scorePedestrianCoverage(blueprint),
    verticalAndUnderground: scoreVerticalAndUnderground(blueprint),
    hardValidity: validation.valid ? 100 : 0
  };
  const weights = {
    roadConnectivity: 0.24,
    districtIdentity: 0.18,
    systemicDistribution: 0.18,
    pedestrianCoverage: 0.15,
    verticalAndUnderground: 0.15,
    hardValidity: 0.10
  };
  const total = Object.entries(components).reduce((sum, [key, value]) => sum + value * weights[key], 0);
  return {
    total: Math.round(total * 10) / 10,
    grade: total >= 85 ? "A" : total >= 75 ? "B" : total >= 65 ? "C" : total >= 50 ? "D" : "E",
    components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Math.round(value * 10) / 10])),
    weights,
    diagnostics: {
      lightsByDistrict: distribution.lightCounts,
      dumpstersByDistrict: distribution.dumpsterCounts,
      vehiclesByDistrict: distribution.vehicleCounts,
      warnings: validation.warnings.map(item => item.code)
    }
  };
}
