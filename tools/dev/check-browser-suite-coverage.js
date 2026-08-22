import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const packagePath = path.join(repoRoot, 'package.json');
const manifestPath = path.join(repoRoot, 'tests/browser/suites.json');
const browserDir = path.join(repoRoot, 'tests/browser');

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const canonicalSuites = manifest.canonicalSuites ?? {};
const errors = [];
const owners = new Map();

const normalize = (value) => value.split(path.sep).join('/');
const actualSpecs = fs
  .readdirSync(browserDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.js'))
  .map((entry) => `tests/browser/${entry.name}`)
  .sort();

const extractBrowserSpecs = (command = '') =>
  [...command.matchAll(/tests\/browser\/[A-Za-z0-9._/-]+\.spec\.js/g)]
    .map((match) => normalize(match[0]))
    .sort();

for (const [scriptName, specs] of Object.entries(canonicalSuites)) {
  const command = pkg.scripts?.[scriptName];
  if (!command) {
    errors.push(`Manifest suite ${scriptName} has no matching package.json script.`);
    continue;
  }

  const expected = specs.map(normalize).sort();
  const referenced = extractBrowserSpecs(command);
  if (JSON.stringify(expected) !== JSON.stringify(referenced)) {
    errors.push(
      `${scriptName} differs between tests/browser/suites.json and package.json.\n` +
        `  manifest: ${expected.join(', ')}\n` +
        `  script:   ${referenced.join(', ')}`,
    );
  }

  for (const spec of expected) {
    const fullPath = path.join(repoRoot, spec);
    if (!fs.existsSync(fullPath)) {
      errors.push(`${scriptName} references missing spec ${spec}.`);
      continue;
    }
    const specOwners = owners.get(spec) ?? [];
    specOwners.push(scriptName);
    owners.set(spec, specOwners);
  }
}

for (const spec of actualSpecs) {
  const specOwners = owners.get(spec) ?? [];
  if (specOwners.length === 0) {
    errors.push(`Orphan browser spec: ${spec} is not owned by a canonical suite.`);
  } else if (specOwners.length > 1) {
    errors.push(`Duplicate browser spec ownership: ${spec} -> ${specOwners.join(', ')}`);
  }
}

for (const spec of owners.keys()) {
  if (!actualSpecs.includes(spec)) {
    errors.push(`Manifest owns ${spec}, but it is not present in tests/browser/.`);
  }
}

if (errors.length > 0) {
  console.error('Browser suite coverage check failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Browser suite coverage OK: ${actualSpecs.length} specs across ${Object.keys(canonicalSuites).length} canonical suites.`,
  );
}
