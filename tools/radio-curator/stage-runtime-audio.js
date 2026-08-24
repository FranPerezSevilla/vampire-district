#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SEED_PATH = path.join(ROOT, "docs/audio/radio-runtime-seed-set.json");
const LEDGER_PATH = path.join(ROOT, "docs/audio/radio-acquisition-ledger.json");
const DEFAULT_SOURCE = path.join(ROOT, ".private/radio-acquisition");
const DEFAULT_DESTINATION = path.join(ROOT, "phaser/assets/audio/radio-private");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function buildRuntimeStagePlan({
  seed = readJson(SEED_PATH),
  ledger = readJson(LEDGER_PATH),
  sourceDirectory = DEFAULT_SOURCE,
  destinationDirectory = DEFAULT_DESTINATION
} = {}) {
  const ledgerById = new Map(ledger.tracks.map(track => [track.id, track]));
  return seed.tracks.map(seedTrack => {
    const record = ledgerById.get(seedTrack.id);
    const originalFilename = record?.downloadedFilename || record?.expectedMasterFilename || null;
    return {
      id: seedTrack.id,
      stationId: seedTrack.stationId,
      originalFilename,
      runtimeFilename: seedTrack.runtimeFilename,
      sourcePath: originalFilename ? path.join(sourceDirectory, originalFilename) : null,
      destinationPath: path.join(destinationDirectory, seedTrack.runtimeFilename),
      acquired: record?.acquisitionStatus === "acquired"
    };
  });
}

export function stageRuntimeAudio(options = {}) {
  const plan = buildRuntimeStagePlan(options);
  const missing = plan.filter(item => !item.acquired || !item.sourcePath || !fs.existsSync(item.sourcePath));
  if (missing.length) {
    const names = missing.map(item => `${item.id}${item.originalFilename ? ` (${item.originalFilename})` : ""}`).join(", ");
    throw new Error(`Missing acquired radio masters: ${names}`);
  }

  const destinationDirectory = path.dirname(plan[0]?.destinationPath || DEFAULT_DESTINATION);
  fs.mkdirSync(destinationDirectory, { recursive: true });
  for (const item of plan) fs.copyFileSync(item.sourcePath, item.destinationPath);
  return plan;
}

function main() {
  const args = process.argv.slice(2);
  const sourceDirectory = path.resolve(args[0] || DEFAULT_SOURCE);
  const destinationDirectory = path.resolve(args[1] || DEFAULT_DESTINATION);
  const plan = stageRuntimeAudio({ sourceDirectory, destinationDirectory });
  for (const item of plan) {
    console.log(`${item.stationId}\t${item.runtimeFilename}`);
  }
  console.log(`Staged ${plan.length} private radio masters into ${destinationDirectory}`);
  console.log("The destination is gitignored; do not force-add these masters to public Git.");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) main();
