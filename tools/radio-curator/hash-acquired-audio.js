#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LEDGER_PATH = fileURLToPath(new URL("../../docs/audio/radio-acquisition-ledger.json", import.meta.url));

export function loadLedger(ledgerPath = LEDGER_PATH) {
  return JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function inspectAcquisitionFolder(inputDirectory, ledger = loadLedger()) {
  const directory = path.resolve(inputDirectory);
  const entries = ledger.tracks.map((track) => {
    const filePath = path.join(directory, track.expectedMasterFilename);
    if (!fs.existsSync(filePath)) {
      return {
        id: track.id,
        stationId: track.stationId,
        expectedMasterFilename: track.expectedMasterFilename,
        status: "missing"
      };
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return {
        id: track.id,
        stationId: track.stationId,
        expectedMasterFilename: track.expectedMasterFilename,
        status: "not-a-file"
      };
    }

    return {
      id: track.id,
      stationId: track.stationId,
      expectedMasterFilename: track.expectedMasterFilename,
      status: "present",
      sizeBytes: stat.size,
      sha256: sha256File(filePath)
    };
  });

  return {
    checkedAt: new Date().toISOString(),
    inputDirectory: directory,
    expectedCount: ledger.tracks.length,
    presentCount: entries.filter((entry) => entry.status === "present").length,
    missingCount: entries.filter((entry) => entry.status === "missing").length,
    invalidCount: entries.filter((entry) => entry.status === "not-a-file").length,
    entries
  };
}

function printUsage() {
  console.error("Usage: npm run radio:acquisition-hash -- <private-master-directory> [--report <output.json>]");
  console.error("Expected filenames are defined in docs/audio/radio-acquisition-ledger.json.");
}

function runCli() {
  const args = process.argv.slice(2);
  if (!args[0] || args[0].startsWith("--")) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const inputDirectory = args[0];
  const reportIndex = args.indexOf("--report");
  const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : null;
  if (reportIndex >= 0 && !reportPath) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const report = inspectAcquisitionFolder(inputDirectory);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (reportPath) {
    fs.writeFileSync(path.resolve(reportPath), json, "utf8");
  }
  process.stdout.write(json);

  if (report.missingCount > 0 || report.invalidCount > 0) {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runCli();
