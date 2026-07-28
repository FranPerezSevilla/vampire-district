if 'const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);' not in text:
    text = text.replace('const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));', 'const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));\n    const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);')
    text = text.replace('storedMissions: stored.missions,', 'storedMissions: stored.missions,\n      legacyStored,')
if 'expect(result.legacyStored).toBeNull();' not in text:
    text = text.replace('expect(result.storedMissions.records).toEqual({});', 'expect(result.storedMissions.records).toEqual({});\n  expect(result.legacyStored).toBeNull();')
path.write_text(text, encoding='utf-8')

# Repository-level guard against reintroducing the deleted parallel stack.
write('tests/branding-cleanup.test.js', '''import test from "node:test";
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
  assert.deepEqual(workflows.sort(), ["build-itch-zip.yml", "tests.yml"]);

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
''')

# The naming document is the one deliberate prose record of retired names.
path = root / 'docs/FACTION_NAMING.md'
text = path.read_text(encoding='utf-8')
text = text.replace('The Houses describes independent bloodlines', 'The Houses is used as a presentation label for independent bloodlines')
path.write_text(text, encoding='utf-8')

# Restore the deliberate retired-name history after broad canonical replacements.
write('docs/FACTION_NAMING.md', '# Viceblood faction naming\n\n_Last updated: 2026-07-28_\n\n## Status\n\n**Canonical design naming accepted. Commercial trademark clearance remains pending.**\n\nThe two principal vampire factions are:\n\n```text\nThe First Estate\nThe Gutter Crown\n```\n\nThe retired working names are:\n\n```text\nBlackglass Directorate\nRed Assembly\n```\n\nThey must not be used for new runtime IDs, UI text, missions, documentation or generated content.\n\n## The First Estate\n\n**Systemic role:** old institutional elite.\n\nThe First Estate controls the city through property, inherited influence, hospitals, municipal contracts, private security, compromised officials and quiet ownership. It does not present itself as a fantasy court or visible corporation. Its power feels established, respectable and difficult to separate from the city itself.\n\nCore identity:\n\n- wealth and inherited position;\n- institutional access;\n- controlled violence;\n- secrecy maintained as infrastructure;\n- expensive but dependable resources;\n- strong penalties for uncontrolled public chaos.\n\nNatural language:\n\n```text\nThe Estate owns this district.\nThe First have already bought the building.\nEstate security is watching the hospital.\n```\n\nRecommended technical ID:\n\n```text\nfirst_estate\n```\n\nRecommended short UI label:\n\n```text\nFIRST ESTATE\n```\n\n## The Gutter Crown\n\n**Systemic role:** violent territorial street coalition.\n\nThe Gutter Crown is formed by predatory crews, abandoned fledglings, criminal organizations and ambitious bloodlines. It believes authority is proven by taking territory and remaining there. The name deliberately contrasts inherited power above with earned power below.\n\nCore identity:\n\n- street control and visible presence;\n- force, reputation and contribution;\n- vehicle theft, sabotage and territorial assault;\n- cheaper but irregular resources;\n- tolerance for collateral damage;\n- internal leadership that must continually prove itself.\n\nNatural language:\n\n```text\nThe Crown owns these streets.\nGutter Crown crews took the docks last night.\nThat block carries Crown colours now.\n```\n\nRecommended technical ID:\n\n```text\ngutter_crown\n```\n\nRecommended short UI label:\n\n```text\nGUTTER CROWN\n```\n\n## The Houses\n\n**Status:** provisional umbrella terminology, not a unified faction.\n\nThe Houses is used as a presentation label for independent bloodlines, smugglers, brokers, mercenaries, isolated sires and criminal families that do not maintain permanent allegiance to either major faction.\n\nRules:\n\n- each House or contact keeps an independent relationship;\n- helping one House does not improve every independent relationship;\n- there is no common uniform, leader or universal doctrine;\n- simulation data must use separate IDs and reputations;\n- `houses` may be used only as a presentation category.\n\nProvisional presentation label:\n\n```text\nTHE HOUSES\n```\n\nDo not create one global `houses` reputation value.\n\n## Contrast rule\n\nThe two principal factions must remain immediately distinguishable:\n\n```text\nThe First Estate  → owns the city from above\nThe Gutter Crown  → claims the city from below\n```\n\nThe distinction should affect territory, vehicles, patrols, suppliers, missions, dialogue and visual language. They are not merely two differently coloured enemy teams.\n\n## Naming guardrails\n\n- Prefer names that characters can say naturally in conversation.\n- Prefer names that fit signs, graffiti, vehicle markings and compact HUD labels.\n- Avoid corporate-fantasy compounds such as `Blackglass Directorate`.\n- Avoid generic political-coalition names such as `Red Assembly`.\n- Avoid copied terminology, ranks or faction structures from licensed vampire settings.\n- Keep internal IDs stable once faction state reaches campaign persistence.\n\n## Implementation boundary\n\nMilestone 15.1 should introduce the canonical IDs before any district ownership is persisted:\n\n```text\nfirst_estate\ngutter_crown\n<individual House/contact IDs>\n```\n\nSave migration must never depend on the retired working names.\n')

print('Viceblood branding and legacy cleanup applied.')
