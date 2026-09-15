import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createBootPayload, projectRoot, hash } from './assets.mjs';

export async function buildPackedBoot(outputDirectory = 'dist') {
  const out = resolve(projectRoot, outputDirectory), runtime = resolve(out, 'phaser/runtime-dist');
  await mkdir(runtime, {recursive:true});
  const payload = await createBootPayload();
  const audioName = `samples.${payload.audio.sha256.slice(0, 16)}.bin`;
  await writeFile(resolve(runtime, audioName), payload.audioBytes);
  const plugin = { name:'preserve-module-asset-roots', setup(builder) {
    builder.onLoad({filter:/\.js$/}, async args => {
      const path = relative(projectRoot, args.path).replaceAll('\\', '/');
      if (path === 'phaser/src/boot/BootAssets.js') {
        return {loader:'js', resolveDir:dirname(args.path), contents:
          `export const bootAssets={city:${JSON.stringify(payload.city)},audio:{...${JSON.stringify(payload.audio)},url:new URL(${JSON.stringify(audioName)},import.meta.url).href}};`};
      }
      if (!path.startsWith('phaser/')) return;
      let contents = await readFile(args.path, 'utf8');
      // A module's asset URLs must still be relative to that source module,
      // never accidentally to phaser/runtime-dist after bundling.
      contents = contents.replaceAll('import.meta.url', `new URL(${JSON.stringify(path)},new URL('../../',import.meta.url)).href`);
      // The query serves development cache busting, not runtime code selection.
      contents = contents.replace('import(`./playtest/bootstrap.js?v=${PLAYTEST_ASSET_VERSION}`)', 'import("./playtest/bootstrap.js")');
      return {contents, loader:'js', resolveDir:dirname(args.path)};
    });
  }};
  const result = await build({absWorkingDir:projectRoot, entryPoints:['phaser/src/app-bootstrap.js'],
    bundle:true, write:false, outfile:'phaser/runtime-dist/game.js', format:'esm', target:['es2022'],
    minify:true, sourcemap:false, metafile:true, legalComments:'eof', plugins:[plugin]});
  const output = result.outputFiles.find(file => file.path.endsWith('.js'));
  if (!output) throw new Error('Missing bundled runtime');
  const js = output.contents, jsName = `game.${hash(js).slice(0, 16)}.js`;
  await writeFile(resolve(runtime, jsName), js);
  const paths = [`phaser/runtime-dist/${jsName}`, `phaser/runtime-dist/${audioName}`];
  const hashes = Object.fromEntries([[paths[0], hash(js)], [paths[1], hash(payload.audioBytes)]]);
  for (const path of ['index.html', 'phaser/index.html']) {
    const prefix = path === 'index.html' ? 'phaser/' : '';
    const input = await readFile(resolve(out, path), 'utf8');
    const oldScript = `${prefix}src/app-bootstrap.js`;
    if (!input.includes(`src="${oldScript}"`)) throw new Error(`Missing source entry: ${path}`);
    const hints = `<link rel="preload" href="${prefix === 'phaser/' ? '' : '../'}node_modules/phaser/dist/phaser.min.js" as="script" />\n  <link rel="preload" href="${prefix}runtime-dist/${audioName}" as="fetch" crossorigin="anonymous" />`;
    const html = input.replace(`src="${oldScript}"`, `src="${prefix}runtime-dist/${jsName}"`).replace('</head>', `  ${hints}\n</head>`);
    await writeFile(resolve(out, path), html); paths.push(path); hashes[path] = hash(Buffer.from(html));
  }
  // This small audit file is NOT fetched by the game's critical path.
  const descriptorPath = 'phaser/runtime-dist/boot-data.json';
  const descriptor = Buffer.from(JSON.stringify({city:payload.city, audio:payload.audio, audioPath:paths[1]}));
  await writeFile(resolve(out, descriptorPath), descriptor); paths.push(descriptorPath); hashes[descriptorPath] = hash(descriptor);
  const metrics = { gameplayModules: Object.keys(result.metafile.inputs).filter(x=>x.startsWith('phaser/src/')).length,
    jsRequests:1, initialCityRequests:0, initialCityChunks:Object.keys(payload.city.chunks).length,
    citySeedBytes:Buffer.byteLength(JSON.stringify(payload.city)), citySeedGzipBytes:gzipSync(JSON.stringify(payload.city)).length,
    audioFiles:Object.keys(payload.audio.entries).length, audioRequests:1, audioBytes:payload.audio.byteLength,
    runtimeBytes:js.length, runtimeGzipBytes:gzipSync(js).length };
  const manifest = {version:1, paths, hashes, metrics};
  await writeFile(resolve(out,'boot-assets.json'), JSON.stringify(manifest,null,2));
  const metadata = JSON.parse(await readFile(resolve(out,'build.json'),'utf8'));
  await writeFile(resolve(out,'build.json'),JSON.stringify({...metadata, boot:'packed-v1', runtimeSha256:hash(js)},null,2));
  console.log(JSON.stringify(metrics,null,2)); return manifest;
}
