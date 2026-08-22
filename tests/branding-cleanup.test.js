import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_URL = new URL("../", import.meta.url);
const ROOT = fileURLToPath(ROOT_URL);

const REMOVED_LEGACY_PATHS = Object.freeze([
  "css",
  "js",
  "legacy",
  "docs/phaser-functional-inventory.md",
  "docs/phaser-migration-roadmap.md",
  "docs/google-sheets-feedback.md",
  "docs/masquerade-systems-plan.md",
  "docs/playtest-checklist.md",
  "TODO.md",
  "MILESTONE_10.md",
  "docs/INDEX_M10.md",
  "audio_raw"
]);

const ALLOWED_HISTORICAL_TERM_FILES = new Set([
  "docs/FACTION_NAMING.md",
  "phaser/src/campaign/constants.js",
  "tests/campaign-system.test.js",
  "tests/branding-cleanup.test.js"
]);

async function fileExists(path) {
  try {
    await access(new URL(path, ROOT_URL));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function trackedTextFiles(directory = ROOT) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "test-results", "playwright-report"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await trackedTextFiles(path));
    else if ([".js", ".mjs", ".json", ".md", ".html", ".css", ".svg", ".yml", ".yaml"].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

test("the retired canvas prototype and one-off patch infrastructure are physically absent", async () => {
  for (const path of REMOVED_LEGACY_PATHS) {
    assert.equal(await fileExists(path), false, `${path} must remain removed`);
  }

  const workflows = await readdir(new URL("../.github/workflows/", import.meta.url));
  assert.deepEqual(workflows.sort(), [
    "build-itch-zip.yml",
    "city-atmosphere-review.yml",
    "materialize-audio-assets.yml",
    "tests.yml"
  ]);

  const rootTools = (await readdir(new URL("../tools/", import.meta.url), { withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => entry.name);
  assert.deepEqual(rootTools, []);
});

test("active product surfaces use Viceblood and expose no legacy-prototype link", async () => {
  for (const path of ["index.html", "phaser/index.html"]) {
    const html = await readFile(new URL(path, ROOT_URL), "utf8");
    assert.match(html, /<title>Viceblood<\/title>/);
    assert.match(html, /<h1>Viceblood<\/h1>/);
    assert.doesNotMatch(html, /Vampire District|Night Blood District|Bloodnight District/i);
    assert.doesNotMatch(html, /legacy prototype|href=["'][^"']*legacy\//i);
  }
});

test("retired product and faction names survive only in explicit compatibility records", async () => {
  const violations = [];
  for (const file of await trackedTextFiles()) {
    const path = relative(ROOT, file).split(String.fromCharCode(92)).join("/");
    if (ALLOWED_HISTORICAL_TERM_FILES.has(path)) continue;
    const content = await readFile(file, "utf8");
    if (/Vampire District|Night Blood District|Bloodnight District|bloodnight-|Blackglass Directorate|Red Assembly/i.test(content)) {
      violations.push(path);
    }
  }
  assert.deepEqual(violations, []);
});