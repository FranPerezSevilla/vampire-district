import path from "node:path";
import process from "node:process";

import { currentCityBlueprint } from "./current-city.js";
import { cityRoadGraph } from "./city-road-graph-v1.js";
import { buildCityChunkFileSet, writeCityChunkFileSet } from "./chunk-files.js";
import {
  buildDistrictStreamingFileSet,
  validateDistrictStreamingFileSet,
  writeDistrictStreamingFileSet
} from "./district-streaming.js";

function argumentValue(prefix) {
  const argument = process.argv.slice(2).find(item => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

const outputDir = path.resolve(argumentValue("--output-dir=") || "phaser/assets/city/current");
const packsDir = path.resolve(argumentValue("--packs-dir=") || "phaser/assets/city/packs");
const fileSet = buildCityChunkFileSet({
  id: "bloodnight-current-city-chunks",
  world: currentCityBlueprint.world,
  runtime: currentCityBlueprint.runtime
});
const districtStreaming = buildDistrictStreamingFileSet({
  blueprint: currentCityBlueprint,
  roadGraph: cityRoadGraph,
  chunkSize: fileSet.manifest.chunkSize
});
const districtValidation = validateDistrictStreamingFileSet(districtStreaming);
if (!districtValidation.valid) {
  for (const error of districtValidation.errors) console.error(`[DISTRICT_STREAMING] ${error}`);
  process.exitCode = 1;
} else {
  await Promise.all([
    writeCityChunkFileSet(fileSet, outputDir),
    writeDistrictStreamingFileSet(districtStreaming, packsDir)
  ]);
}

console.log(`City Streaming compiler · ${fileSet.manifest.id}`);
console.log(`Grid ${fileSet.manifest.columns}×${fileSet.manifest.rows} · ${fileSet.manifest.chunkIds.length} chunk files`);
console.log(`District packs ${districtValidation.metrics.districtPacks} · macro edges ${districtValidation.metrics.macroEdges} · traffic lanes ${districtValidation.metrics.trafficLaneEdges}`);
console.log(`Output ${outputDir}`);
console.log(`Packs ${packsDir}`);
