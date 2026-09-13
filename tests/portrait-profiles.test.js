import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { PORTRAIT_PROFILES, portraitProfile } from '../ui/portrait-profiles.js';

await mkdir('.artifacts',{recursive:true});
await build({entryPoints:['ui/artwork.jsx'],outfile:'.artifacts/portrait-test.mjs',bundle:true,format:'esm',platform:'node',jsx:'automatic',packages:'external'});
const {ContactPrint}=await import('../.artifacts/portrait-test.mjs');
const render=(id,small=false)=>renderToStaticMarkup(React.createElement(ContactPrint,{id,small}));

test('ten authored prints differ by geometry and dress, not just colour',()=>{
  assert.equal(PORTRAIT_PROFILES.length,10);
  assert.equal(new Set(PORTRAIT_PROFILES.map(p=>p.id)).size,10);
  assert.equal(new Set(PORTRAIT_PROFILES.map(p=>[p.face,p.hair,p.nose,p.eyes,p.wear,p.mark,p.accessory].join('/'))).size,10);
  for(const [field,minimum] of [['face',8],['hair',10],['nose',6],['wear',7],['skin',6],['mark',6]]) assert.ok(new Set(PORTRAIT_PROFILES.map(p=>p[field])).size>=minimum,field);
  const current=['sire','vesper','rook','mara','donor_iris','donor_eli'];
  assert.equal(new Set(current.map(id=>portraitProfile(id).face)).size,6);
  assert.equal(new Set(current.map(id=>portraitProfile(id).hair)).size,6);
});
test('all known subjects preserve their identity under contact/donor route prefixes',()=>{
  for(const p of PORTRAIT_PROFILES) assert.equal(portraitProfile(p.id),p);
  for(const id of ['sire','vesper','rook','mara']) assert.equal(portraitProfile(`contact:${id}`),portraitProfile(id));
  for(const id of ['donor_iris','donor_eli']) assert.equal(portraitProfile(`donor:${id}`),portraitProfile(id));
  assert.notEqual(portraitProfile('donor:donor_iris'),portraitProfile('vesper'));
});
test('fallback prints are deterministic and definitions cannot be mutated',()=>{
  const first=portraitProfile('future-contact');
  for(const key of ['unrelated','other','future-contact']) portraitProfile(key);
  assert.equal(portraitProfile('future-contact'),first);
  assert.equal(portraitProfile(null),portraitProfile('sire'));
  assert.ok(Object.isFrozen(PORTRAIT_PROFILES));
  for(const profile of PORTRAIT_PROFILES) {assert.ok(Object.isFrozen(profile));assert.throws(()=>{profile.face='anything';},TypeError);}
});
test('rendered prints have distinct silhouettes and thumbnail/detail identity',()=>{
  const faces=[],hair=[];
  for(const p of PORTRAIT_PROFILES) {
    const dom=new JSDOM(render(p.id)+render(p.id,true));
    try {
      const [full,small]=dom.window.document.querySelectorAll('svg[data-portrait]');
      assert.equal(full.dataset.portrait,p.id);assert.equal(small.dataset.portrait,p.id);
      const feature=svg=>[...svg.querySelectorAll('[data-silhouette], [data-face], [data-hair], [data-nose], [data-wear]')].map(n=>n.outerHTML).join('');
      assert.equal(feature(full),feature(small));
      faces.push(full.querySelector('[data-silhouette]').getAttribute('d'));
      hair.push(full.querySelector('[data-hair]').outerHTML);
    } finally {dom.window.close();}
  }
  assert.ok(new Set(faces).size>=8);assert.equal(new Set(hair).size,10);
});
test('repeated prints use unique valid SVG resource ids and inert decoration',()=>{
  const dom=new JSDOM(renderToStaticMarkup(React.createElement('div',null,...['sire','sire','vesper','rook','mara','donor_iris','donor_eli'].map((id,i)=>React.createElement(ContactPrint,{id,key:i})))));
  try {
    const doc=dom.window.document,ids=[...doc.querySelectorAll('[id]')].map(n=>n.id);
    assert.equal(new Set(ids).size,ids.length);
    for(const svg of doc.querySelectorAll('svg')) {
      assert.equal(svg.getAttribute('aria-hidden'),'true');assert.equal(svg.getAttribute('focusable'),'false');
      assert.equal(svg.querySelector('script,image,a,[tabindex]'),null);
      for(const el of svg.querySelectorAll('[fill],[clip-path]')) for(const name of ['fill','clip-path']) {
        const ref=el.getAttribute(name)?.match(/^url\(#(.+)\)$/)?.[1];if(ref)assert.ok(doc.getElementById(ref),ref);
      }
    }
  } finally {dom.window.close();}
});
test('portrait implementation has no runtime download, font or animation dependency',async()=>{
  const source=await readFile(new URL('../ui/artwork.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/<image|fetch\(|https?:\/\/|requestAnimationFrame|setInterval|Math\.random/);
  const css=await readFile(new URL('../ui/copy-portraits.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/@import|@font-face|url\(|backdrop-filter|animation:/);
  assert.match(css,/pointer-events:\s*none/);
});
