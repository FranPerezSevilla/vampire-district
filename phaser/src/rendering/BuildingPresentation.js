// Stable public facade for the building presentation system. Game code should
// import from this module; catalog, planner and renderer may evolve internally.
export {
  BUILDING_ARCHETYPES,
  BUILDING_PRESENTATION_VERSION,
  DETAIL_LEVELS,
  FRONTAGE_KINDS,
  LAYOUT_RECIPES,
  MODULE_KINDS,
  ROOFTOP_PROP_KINDS,
  buildingPresentationLabelColor,
  classifyBuildingPresentation,
  getBuildingArchetype,
  getBuildingLayoutRecipe,
  resolveBuildingPalette,
  resolveBuildingPresentationDefinition
} from "./buildings/BuildingPresentationCatalog.js";

export {
  buildingPresentationSeed,
  createBuildingPresentationPlan,
  moduleFitsBuildingFootprint
} from "./buildings/BuildingPresentationPlanner.js";

export {
  clearBuildingPresentationCache,
  drawBuildingPresentation,
  renderBuildingPresentation
} from "./buildings/BuildingPresentationRenderer.js";
