import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BOOT_SPECS = [
  "tests/browser/runtime-smoke.spec.js",
  "tests/browser/render-quality.spec.js",
  "tests/browser/ui-accessibility.spec.js"
];

const SYSTEM_GROUPS = [
  {
    id: "input",
    matches: (file) => file.includes("/input/") || file.includes("input-system"),
    specs: ["tests/browser/input-locks.spec.js"]
  },
  {
    id: "city",
    matches: (file) =>
      file.startsWith("tools/city-compiler/") ||
      file.includes("city-topology") ||
      file.includes("city-road-graph") ||
      file.includes("/chunks/") ||
      file.includes("road-graph") ||
      file.includes("sidewalk") ||
      file.includes("building"),
    validateCity: true,
    specs: [
      "tests/browser/road-graph-geometry.spec.js",
      "tests/browser/city-topology-v2.spec.js",
      "tests/browser/foundry-runtime.spec.js",
      "tests/browser/building-sidewalk-clearance.spec.js",
      "tests/browser/expanded-district.spec.js"
    ]
  },
  {
    id: "streaming",
    matches: (file) =>
      file.includes("stream") ||
      file.includes("chunk") ||
      file.includes("districtpack") ||
      file.includes("district-pack") ||
      file.includes("distant-simulation"),
    specs: [
      "tests/browser/city-streaming.spec.js",
      "tests/browser/city-streaming-resources.spec.js",
      "tests/browser/city-streaming-macro.spec.js",
      "tests/browser/entity-streaming.spec.js"
    ]
  },
  {
    id: "traffic",
    matches: (file) => file.includes("traffic"),
    specs: [
      "tests/browser/city-streaming-traffic.spec.js",
      "tests/browser/city-streaming-traffic-behavior.spec.js",
      "tests/browser/city-streaming-traffic-physics.spec.js",
      "tests/browser/city-streaming-traffic-impact.spec.js",
      "tests/browser/traffic-hijack.spec.js",
      "tests/browser/traffic-visibility-retention.spec.js"
    ]
  },
  {
    id: "vehicles",
    matches: (file) =>
      file.includes("vehicle") ||
      file.includes("garage") ||
      file.includes("maintenance"),
    specs: [
      "tests/browser/vehicle-core.spec.js",
      "tests/browser/vehicle-maintenance.spec.js",
      "tests/browser/vehicle-collision-softening.spec.js"
    ]
  },
  {
    id: "police",
    matches: (file) =>
      file.includes("police") ||
      file.includes("witness") ||
      file.includes("perception") ||
      file.includes("heat") ||
      file.includes("exposure") ||
      file.includes("evidence") ||
      file.includes("hunter"),
    specs: [
      "tests/browser/motorized-police.spec.js",
      "tests/browser/perception-recovery.spec.js",
      "tests/browser/police-stress.spec.js",
      "tests/browser/heat-exposure-evidence.spec.js"
    ]
  },
  {
    id: "campaign",
    matches: (file) =>
      file.includes("campaign") ||
      file.includes("mission") ||
      file.includes("checkpoint") ||
      file.includes("wallet") ||
      file.includes("reputation"),
    specs: ["tests/browser/free-roam-baseline.spec.js"]
  },
  {
    id: "vampire-state",
    matches: (file) =>
      file.includes("territory") ||
      file.includes("hunting") ||
      file.includes("feeding") ||
      file.includes("drain") ||
      file.includes("power") ||
      file.includes("hunger") ||
      file.includes("ledger"),
    specs: [
      "tests/browser/territory-runtime.spec.js",
      "tests/browser/hunting-law-runtime.spec.js",
      "tests/browser/night-ledger.spec.js",
      "tests/browser/feeding-depths.spec.js",
      "tests/browser/predator-powers.spec.js"
    ]
  }
];

const FULL_RC_FILES = new Set([
  "package.json",
  "playwright.config.js"
]);

function normalizeFiles(files) {
  return [...new Set(files.map((file) => file.trim().replaceAll("\\", "/")).filter(Boolean))].sort();
}

function isDocumentationOnly(file) {
  return (
    file.endsWith(".md") ||
    file.startsWith("docs/") ||
    file === ".github/pull_request_template.md"
  );
}

function needsBootCoverage(file) {
  return (
    file === "index.html" ||
    file.endsWith(".css") ||
    file.startsWith("phaser/assets/") ||
    file.includes("/ui/") ||
    file.includes("render") ||
    file.includes("hud") ||
    file.includes("accessibility") ||
    file.includes("app-bootstrap") ||
    file.includes("game-scene") ||
    file.includes("gamescene")
  );
}

export function buildTestPlan(inputFiles) {
  const files = normalizeFiles(inputFiles);
  const runtimeFiles = files.filter((file) => !isDocumentationOnly(file));

  if (files.length === 0) {
    return { files, groups: [], commands: [], summary: "No changed files detected." };
  }

  if (runtimeFiles.length === 0) {
    return {
      files,
      groups: ["documentation"],
      commands: [],
      summary: "Documentation-only change: no automated runtime check selected."
    };
  }

  if (runtimeFiles.some((file) => FULL_RC_FILES.has(file))) {
    return {
      files,
      groups: ["release-candidate"],
      commands: [
        {
          id: "release-candidate",
          command: "npm",
          args: ["run", "test:rc"],
          reason: "Test infrastructure or dependency configuration changed."
        }
      ],
      summary: "Release-candidate validation selected."
    };
  }

  const groups = new Set();
  const browserSpecs = new Set();
  let validateCity = false;

  for (const file of runtimeFiles) {
    if (file.startsWith("tests/browser/") && file.endsWith(".spec.js")) {
      browserSpecs.add(file);
      groups.add("direct-browser-test");
    }

    if (needsBootCoverage(file)) {
      BOOT_SPECS.forEach((spec) => browserSpecs.add(spec));
      groups.add("boot");
    }

    let matchedSystem = false;
    for (const group of SYSTEM_GROUPS) {
      if (!group.matches(file.toLowerCase())) continue;
      matchedSystem = true;
      groups.add(group.id);
      group.specs.forEach((spec) => browserSpecs.add(spec));
      validateCity ||= Boolean(group.validateCity);
    }

    if (
      !matchedSystem &&
      (file.startsWith("phaser/src/") || file.startsWith("phaser/data/"))
    ) {
      BOOT_SPECS.forEach((spec) => browserSpecs.add(spec));
      groups.add("boot-fallback");
    }
  }

  const commands = [
    {
      id: "unit",
      command: "npm",
      args: ["test"],
      reason: "All runtime changes receive the fast unit safety net."
    }
  ];

  if (validateCity) {
    commands.push({
      id: "city-validation",
      command: "npm",
      args: ["run", "city:validate"],
      reason: "City authority or generated topology changed."
    });
  }

  if (browserSpecs.size > 0) {
    commands.push({
      id: "browser",
      command: "npx",
      args: ["--no-install", "playwright", "test", ...[...browserSpecs].sort()],
      reason: "Focused Chromium coverage for the affected systems."
    });
  }

  return {
    files,
    groups: [...groups].sort(),
    commands,
    summary: `${commands.length} validation command(s) selected for ${runtimeFiles.length} runtime file(s).`
  };
}

function runGit(args, allowFailure = false) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.status === 0 ? result.stdout.trim() : "";
}

function isValidBase(base) {
  return /^[A-Za-z0-9._/-]+$/.test(base);
}

function resolveBase(requestedBase) {
  const candidates = [
    requestedBase,
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null,
    "origin/main",
    "main"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!isValidBase(candidate)) {
      throw new Error(`Unsafe base ref: ${candidate}`);
    }
    if (runGit(["rev-parse", "--verify", `${candidate}^{commit}`], true)) return candidate;
  }
  return null;
}

function collectChangedFiles(base) {
  const files = new Set();
  const addOutput = (output) => {
    output.split(/\r?\n/).filter(Boolean).forEach((file) => files.add(file));
  };

  if (base) {
    addOutput(runGit(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]));
  }
  addOutput(runGit(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]));
  addOutput(runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "HEAD"]));
  addOutput(runGit(["ls-files", "--others", "--exclude-standard"]));
  return [...files];
}

function parseArguments(argv) {
  const options = { run: false, base: null, files: [] };
  for (const argument of argv) {
    if (argument === "--run") options.run = true;
    else if (argument.startsWith("--base=")) options.base = argument.slice("--base=".length);
    else if (argument.startsWith("--files=")) {
      options.files.push(...argument.slice("--files=".length).split(","));
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function printable(command) {
  const quote = (value) => (/^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : JSON.stringify(value));
  return [command.command, ...command.args].map(quote).join(" ");
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const base = options.files.length > 0 ? null : resolveBase(options.base);
  const files = options.files.length > 0 ? options.files : collectChangedFiles(base);
  const plan = buildTestPlan(files);

  console.log(`Affected-test plan${base ? ` against ${base}` : ""}`);
  console.log(plan.summary);
  if (plan.groups.length > 0) console.log(`Groups: ${plan.groups.join(", ")}`);
  for (const command of plan.commands) {
    console.log(`- ${printable(command)}\n  ${command.reason}`);
  }

  if (!options.run || plan.commands.length === 0) return;

  for (const command of plan.commands) {
    console.log(`\n> ${printable(command)}`);
    const result = spawnSync(command.command, command.args, { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

const isEntryPoint =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  try {
    main();
  } catch (error) {
    console.error(`affected-test-plan: ${error.message}`);
    process.exit(1);
  }
}
