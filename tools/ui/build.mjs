import { build } from "esbuild";
import { mkdir, cp, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

await mkdir("phaser/ui-dist", { recursive: true });
await build({ entryPoints: ["ui/main.jsx"], outfile: "phaser/ui-dist/interface.js", bundle: true,
  format: "esm", target: ["es2022"], minify: true, sourcemap: false,
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, legalComments: "eof" });
if (process.argv.includes("--package")) {
  await rm("dist", {recursive:true,force:true});
  await mkdir("dist", { recursive: true });
  await cp("phaser", "dist/phaser", { recursive: true });
  await cp("index.html", "dist/index.html");
  // Local playtests can use the same pinned engine without a CDN. Only the
  // engine distribution is included, not the development dependency tree.
  await mkdir("dist/node_modules/phaser/dist", {recursive:true});
  await cp("node_modules/phaser/dist/phaser.min.js", "dist/node_modules/phaser/dist/phaser.min.js");
  await cp("node_modules/phaser/LICENSE.md", "dist/node_modules/phaser/LICENSE.md");
  await writeFile("dist/.nojekyll", "");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = Boolean(execFileSync("git", ["status", "--porcelain"], {encoding:"utf8"}).trim());
  const digest = createHash("sha256").update(await readFile("phaser/ui-dist/interface.js")).digest("hex");
  await writeFile("dist/build.json", JSON.stringify({ revision, dirty, interfaceSha256: digest, ui: "react-radix" }, null, 2));
  await writeFile("dist/README.txt", `ViceBlood UI rewrite — review build\n\nServe this folder with: python -m http.server 4173\nThen open http://localhost:4173/\nDo not open index.html as a file: the engine loads modules and streamed city data.\n\nRevision: ${revision}${dirty ? " (uncommitted changes present)" : ""}\nNative and DOM tests are not visual validation.\nThe existing radio policy uses remote tracks on the public Pages host; private\nradio masters are not included in this local package. No gameplay save reset is required.\n\nSuggested review: loading > press any key > main menu > New Night > City.\nCheck landscape, narrow and ultrawide layouts, contact and errand Locate/Go here,\nEsc and M, blood use, a real contact transaction, garage, and death dialogue.\n`);
}
if (process.argv.includes("--package")) {
  const { buildPackedBoot } = await import("../boot/build.mjs");
  await buildPackedBoot();
}
console.log("ViceBlood build complete. Production packs the existing module graph; gameplay retains a single owner.");
