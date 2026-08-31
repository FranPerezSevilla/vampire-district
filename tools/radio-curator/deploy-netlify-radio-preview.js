#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stageRuntimeAudio } from "./stage-runtime-audio.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_SOURCE = path.join(ROOT, ".private/radio-acquisition");
const DEFAULT_PROJECT = "vampire-district";
const DEFAULT_ALIAS = "radio-78";

function run(command, args, { cwd = ROOT } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}`);
  }
}

function ensureLinked(projectName) {
  const statePath = path.join(ROOT, ".netlify", "state.json");
  if (fs.existsSync(statePath)) return;

  console.log(`Netlify project is not linked locally. Linking to ${projectName}...`);
  run("npx", ["--yes", "netlify-cli@latest", "link", "--name", projectName]);
}

function main() {
  const sourceDirectory = path.resolve(process.argv[2] || DEFAULT_SOURCE);
  const projectName = process.env.VICEBLOOD_NETLIFY_PROJECT || DEFAULT_PROJECT;
  const alias = process.env.VICEBLOOD_NETLIFY_ALIAS || DEFAULT_ALIAS;
  const keepStage = process.env.VICEBLOOD_KEEP_DEPLOY_STAGE === "1";

  if (!fs.existsSync(sourceDirectory)) {
    throw new Error(`Radio source directory does not exist: ${sourceDirectory}`);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "viceblood-radio-netlify-"));
  const siteDirectory = path.join(tempRoot, "site");
  const archivePath = path.join(tempRoot, "site.tar");
  fs.mkdirSync(siteDirectory, { recursive: true });

  try {
    console.log("Creating clean deploy snapshot from current Git HEAD...");
    run("git", ["archive", "--format=tar", "-o", archivePath, "HEAD"]);
    run("tar", ["-xf", archivePath, "-C", siteDirectory]);

    const radioDestination = path.join(siteDirectory, "phaser", "assets", "audio", "radio-private");
    const staged = stageRuntimeAudio({ sourceDirectory, destinationDirectory: radioDestination });
    const stagedBytes = staged.reduce((sum, item) => sum + fs.statSync(item.destinationPath).size, 0);

    console.log(`Staged ${staged.length} radio masters (${(stagedBytes / 1024 / 1024).toFixed(1)} MiB) into deploy snapshot.`);
    console.log("No radio master is added to Git; only this Netlify deploy contains the files.");

    ensureLinked(projectName);

    console.log(`Deploying draft alias ${alias} to Netlify project ${projectName}...`);
    run("npx", [
      "--yes",
      "netlify-cli@latest",
      "deploy",
      `--dir=${siteDirectory}`,
      `--alias=${alias}`,
      `--message=ViceBlood radio runtime preview (${alias})`
    ]);

    console.log(`\nExpected stable draft URL: https://${alias}--${projectName}.netlify.app`);
    console.log("This is a draft deploy; production is not modified.");
  } finally {
    if (keepStage) {
      console.log(`Keeping deploy staging directory: ${tempRoot}`);
    } else {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

main();
