import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { VAMPIRE_CONTACTS, VAMPIRE_DONORS } from '../phaser/src/vampire/VampireCatalog.js';
import { FACTION_IDENTITIES, NATURE_IDENTITIES, ALL_PEOPLE, personIdentity, identityAttributes, peopleFiles, matchingPeople } from '../ui/contact-identity.js';

const model = { contacts: VAMPIRE_CONTACTS, herd: VAMPIRE_DONORS };
test('current contact nature and affiliation use the catalog, never the district or portrait', () => {
  assert.deepEqual(VAMPIRE_CONTACTS.map(p => [p.id, personIdentity(p).faction, personIdentity(p).nature]), [
    ['sire','first_estate','vampire'],['vesper','first_estate','vampire'],['rook','gutter_crown','vampire'],['mara','independent','vampire']
  ]);
  for (const p of VAMPIRE_DONORS) {
    assert.equal(personIdentity(p).nature, 'human');
    assert.equal(personIdentity(p).faction, 'unknown', 'a patron does not establish faction membership');
  }
});
test('unknown and unaffiliated identities are not disguised as independent vampires', () => {
  for (const p of [{}, { id:'sire', role:'Vampire lord' }, { nature:'toString', factionId:'other' }, { factionId:'other', affiliation:'independent' }]) {
    assert.equal(personIdentity(p).nature, 'unknown'); assert.equal(personIdentity(p).faction, 'unknown');
  }
  assert.equal(personIdentity({ affiliation:'unaligned', nature:'human' }).label, 'Unaffiliated');
  assert.equal(personIdentity({ nature:'retainer' }).natureLabel, 'Retainer');
  assert.equal(peopleFiles(model).filter(f => personIdentity(f.person).nature === 'retainer').length, 0);
});
test('directory targets and order remain stable and do not mutate the source collections', () => {
  const before=JSON.stringify(model), files=peopleFiles(model);
  assert.equal(files.length,6); assert.equal(new Set(files.map(p=>p.target)).size,6);
  assert.deepEqual(files.slice(-2).map(p=>p.target), ['donor:donor_iris','donor:donor_eli']);
  matchingPeople(files,{nature:'human',faction:'unknown'});
  assert.equal(JSON.stringify(model),before); assert.equal(files[0].person,VAMPIRE_CONTACTS[0]);
});
test('nature and faction filters combine with a real empty state and clear to all', () => {
  const files=peopleFiles(model), filter=(nature,faction)=>matchingPeople(files,{nature,faction});
  assert.equal(filter('human','all').length,2); assert.equal(filter('vampire','all').length,4);
  assert.equal(filter('all','first_estate').length,2); assert.equal(filter('vampire','gutter_crown')[0].person.id,'rook');
  assert.equal(filter('all','independent')[0].person.id,'mara');
  assert.equal(filter('human','first_estate').length,0);
  assert.equal(matchingPeople(files,ALL_PEOPLE).length,6); assert.deepEqual(peopleFiles({}),[]);
});
test('identity channels have independent machine-readable values and non-conflicting accents', () => {
  const colours=Object.values(FACTION_IDENTITIES).slice(0,3).map(x=>x.ink);
  assert.equal(new Set(colours).size,3);
  const p=VAMPIRE_CONTACTS[2], before=identityAttributes(p);
  assert.deepEqual(identityAttributes({...p,suspended:true,endorsed:false}),before);
  assert.equal(before['data-faction'],'gutter_crown');assert.equal(before['data-nature'],'vampire');
  assert.ok(Object.isFrozen(FACTION_IDENTITIES)); assert.ok(Object.isFrozen(NATURE_IDENTITIES));
});
test('faction label colours have readable contrast on the contact index and selected card', () => {
  const luminance=hex=>{const v=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
  for(const faction of Object.values(FACTION_IDENTITIES)) for(const bg of ['#151217','#2b242b']) {
    const contrast=(luminance(faction.light)+.05)/(luminance(bg)+.05);
    assert.ok(contrast>=4.5,`${faction.label} contrast ${contrast}`);
  }
});
test('identity is lightweight local decoration; selection and forced-colour states are explicit', async () => {
  const css=await readFile(new URL('../ui/contact-identity.css',import.meta.url),'utf8');
  const jsx=await readFile(new URL('../ui/People.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(css,/@import|@font-face|url\(|backdrop-filter|animation:/);
  assert.doesNotMatch(jsx,/fetch\(|https?:\/\/|setInterval|requestAnimationFrame|<image/);
  assert.match(css,/forced-colors:active/);assert.match(css,/focus-visible/);assert.match(css,/aria-pressed=true/);
  assert.match(jsx,/aria-hidden="true" focusable="false"/);
});
