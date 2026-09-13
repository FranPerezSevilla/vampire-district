import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uiHarness } from './helpers/ui-harness.js';
import { buildDomainModel } from '../phaser/src/vampire/VampireDomainModel.js';
import { BOOK_CHAPTERS, bookSummary, contactState, recommendationFile, distanceTo } from '../ui/nightbook-model.js';
import { DOMAIN_TABS, domainTab } from '../phaser/src/vampire/DomainNavigation.js';

test('five chapters and native number shortcuts share the same order',()=>{
  assert.deepEqual(BOOK_CHAPTERS.map(c=>c.label),DOMAIN_TABS);
  assert.equal(domainTab('invalid'),'tonight');assert.equal(domainTab('power'),'ledger');
  assert.equal(domainTab('errand'),'tonight');assert.equal(domainTab('herd'),'feeding');
});
test('editorial summaries project real facts without changing saved campaign or objective',async()=>{
  const h=await uiHarness();try{
    const before=JSON.stringify(h.campaign.state), model=buildDomainModel(h.runtime), summary=bookSummary(model);
    assert.equal(summary.known,model.contacts.filter(p=>p.met).length);
    assert.equal(summary.permitted,model.districts.filter(d=>d.permitted).length);
    assert.equal(summary.ready.length,model.herd.filter(d=>d.ready).length);
    assert.equal(summary.stored.length,0);
    assert.equal(JSON.stringify(h.campaign.state),before);
  }finally{h.destroy();}
});
test('reception is not loyalty and a suspended deal is never presented as a useful active agreement',()=>{
  assert.equal(contactState({met:true,trust:100,suspended:true}).label,'Agreement suspended');
  assert.equal(contactState({met:true,trust:100}).label,'Known contact');
  assert.equal(contactState({met:false,available:false}).label,'Introduction needed');
  assert.equal(contactState({met:true,endorsed:true}).label,'Backing your claim');
});
test('file references keep their actual IDs and distance requires a valid destination',()=>{
  assert.deepEqual(recommendationFile('donor:donor_iris'),{tab:'feeding',target:'donor:donor_iris'});
  assert.deepEqual(recommendationFile('asset:club'),{tab:'ledger',target:'asset:club'});
  assert.equal(distanceTo({x:0,y:0},{x:3,y:4}),5);assert.equal(distanceTo({x:0,y:0},null),null);
});
test('book styling stays viewport native, reflows, and adds no font/image downloads or expensive screen filters',()=>{
  const css=readFileSync(new URL('../ui/interface.css',import.meta.url),'utf8');
  assert.match(css,/\.vb-window\.wide\{inset:/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/@media\(max-height:550px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/:focus-visible/);
  assert.doesNotMatch(css,/@import|@font-face|url\(|backdrop-filter|filter:blur/);
  assert.doesNotMatch(css,/#(?:game-ui|interface-root)[^}]*transform:\s*scale/);
  const art=readFileSync(new URL('../ui/artwork.jsx',import.meta.url),'utf8');
  assert.match(art,/aria-hidden="true"/);assert.doesNotMatch(art,/<image|fetch\(|requestAnimationFrame/);
});
