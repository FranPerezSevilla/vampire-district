import path from "node:path";
import process from "node:process";

import { currentCityBlueprint } from "./current-city.js";
import { buildCityChunkFileSet, writeCityChunkFileSet } from "./chunk-files.js";

function argumentValue(prefix) {
  const argument = process.argv.slice(2).find(item => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

const outputDir = path.resolve(argumentValue("--output-dir=") || "phaser/assets/city/current");
const fileSet = buildCityChunkFileSet({
  id: "bloodnight-current-city-chunks",
  world: currentCityBlueprint.world,
  runtime: currentCityBlueprint.runtime
});
await writeCityChunkFileSet(fileSet, outputDir);

console.log(`City Streaming compiler · ${fileSet.manifest.id}`);
console.log(`Grid ${fileSet.manifest.columns}×${fileSet.manifest.rows} · ${fileSet.manifest.chunkIds.length} chunk files`);
console.log(`Output ${outputDir}`);
