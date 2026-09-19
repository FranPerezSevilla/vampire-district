import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { uiHarness } from './helpers/ui-harness.js';
import { InteractionSystem } from '../phaser/src/systems/InteractionSystem.js';

// Actual installed surface policy, campaign, Phaser injection and React DOM.
// Scene rendering/time are fixtures; this is not a browser-layout test.
let dom, act, h;
const observers = [];
before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="game-root"><canvas tabindex="0"></canvas></div><div id="game-ui"><div id="interface-root"></div><div id="ui-overlay-host"></div></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) {
    const bound = ['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bound ? dom.window[key].bind(dom.window) : dom.window[key] });
  }
  const Observer = globalThis.MutationObserver;
  globalThis.MutationObserver = class extends Observer { constructor(callback) { super(callback); observers.push(this); } };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  ({ act } = await import('react'));
  await mkdir('.artifacts', { recursive: true });
  await build({ entryPoints:['ui/main.jsx'], outfile:'.artifacts/ui-policy-test.mjs', bundle:true, format:'esm', platform:'node', jsx:'automatic', packages:'external', loader:{'.css':'empty'}, define:{'process.env.NODE_ENV':'"development"'} });
  globalThis.NBD_INTERFACE_VIEW = await import('../.artifacts/ui-policy-test.mjs');
  const base = await uiHarness(); base.destroy();
  const { installPlaytestSurfacePolicy } = await import('../phaser/src/policies/PlaytestSurfacePolicy.js');
  installPlaytestSurfacePolicy();
});
beforeEach(async () => {
  h = await uiHarness();
  assert.ok(h.scene.interactionSystem instanceof InteractionSystem);
  assert.equal(h.scene.interactionSystem.__nbdHiddenTraversalPolicy, true);
  h.ui.game.events ||= { on(){}, off(){} };
  await act(async () => h.ui.create());
  assert.equal(h.ui.bootError, null);
});
afterEach(async () => {
  await act(async () => { h.ui.cleanup(); h.destroy(); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve,0)); });
});
after(() => { for (const observer of observers) observer.disconnect(); dom.window.close(); });
const button = label => [...document.querySelectorAll('button')].find(n => n.textContent.trim() === label || n.getAttribute('aria-label') === label);
async function click(node) { assert.ok(node,'requested control must be mounted'); await act(async () => node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))); }
async function press(code, target = document.body) { await act(async () => target.dispatchEvent(new KeyboardEvent('keydown',{key:code,code,bubbles:true,cancelable:true}))); }
async function tab(label) {
  const node = document.querySelector(`[role=tab][aria-label="${label}"]`);
  assert.ok(node, `${label} tab must exist`);
  await act(async () => { node.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true,cancelable:true})); node.focus(); });
}
function expectDomain(tabId) {
  assert.equal(h.ui.activeMode(),'domain'); assert.equal(h.ui.store.getSnapshot().tab,tabId);
  assert.equal(h.scene.interactionSystem.menu.view,'vampire-domain');
  assert.equal(document.querySelectorAll('[role=tab]').length,5);
  assert.ok(document.querySelector('[role=tabpanel][data-state=active]'));
  assert.equal(document.querySelector('.vb-choices'),null,'never render the obsolete launcher');
  assert.equal(h.paused(),true); assert.equal(h.registry.get('uiPaused'),false);
  assert.equal(h.registry.get('uiKeyboardOwned'),true); assert.equal(h.ui.pendingAction,null);
}

test('installed traversal filter preserves menu metadata, disabled options and hidden-action restrictions', async () => {
  const visible = {id:'service',label:'Service',type:'vampire',disabled:true,run(){}};
  let hiddenCalls=0; const hidden={id:'roof',type:'privateShaft',run(){hiddenCalls++;}};
  const presentation={title:'Sire services',detail:'Keep the briefing',view:'vampire-domain'};
  h.scene.interactionSystem.open([hidden,visible],presentation);
  const snapshot=h.scene.interactionSystem.snapshot();
  for(const key of ['title','detail','view']) assert.equal(snapshot[key],presentation[key]);
  assert.equal(snapshot.options.length,1); assert.equal(snapshot.options[0].disabled,true);
  const previous=h.scene.interactionSystem.menu;
  assert.equal(h.scene.interactionSystem.open([hidden],presentation),false);
  assert.equal(h.scene.interactionSystem.menu,previous);
  assert.equal(h.scene.interactionSystem.runOption(hidden),false); assert.equal(hiddenCalls,0);
  h.scene.interactionSystem.open([visible]);
  assert.equal(h.scene.interactionSystem.menu.title,'Choose interaction'); assert.equal(h.scene.interactionSystem.menu.view,null);
});
test('HUD City opens the domain and all five named chapters change content while paused', async () => {
  await click(button('City')); expectDomain('city'); assert.equal(document.querySelectorAll('.vb-map-district').length,14);
  const elapsed=h.v.state.elapsed; h.scene.currentInputFrame.worldEnabled=false;
  for(const [label,id,content] of [['Contacts','network','Rook Mercer'],['Blood','feeding','Donors'],['Accounts','ledger','Holdings'],['Tonight','tonight','No outstanding errand'],['City','city',null]]) {
    await tab(label); expectDomain(id);
    if(id==='city') assert.ok(document.querySelector('.vb-city-map'));
    else assert.ok(document.querySelector('[role=tabpanel][data-state=active]').textContent.includes(content),content);
    assert.equal(h.step(),false); assert.equal(h.v.state.elapsed,elapsed);
  }
  assert.doesNotMatch(document.body.textContent,/undefined|NaN|\[object Object\]/);
});
test('all five number shortcuts and internal links work with the installed policy and locked frame', async () => {
  await click(button('City')); h.scene.currentInputFrame.worldEnabled=false;
  for(const [i,id] of ['tonight','city','network','feeding','ledger'].entries()) {
    await press(`Digit${i+1}`); expectDomain(id); assert.equal(h.scene.interactionSystem.menu.index,i);
  }
  await press('Digit1'); await click([...document.querySelectorAll('.nb-task button')].find(n=>n.textContent==='Contacts')); expectDomain('network');
  await press('Escape'); await act(async()=>{await new Promise(r=>setTimeout(r,0));});
  assert.equal(h.ui.activeMode(),null); assert.equal(h.paused(),false); assert.equal(h.registry.get('uiKeyboardOwned'),false);
  assert.equal(document.activeElement.tagName,'CANVAS'); assert.ok(document.querySelector('.vb-hud'));
});
test('pause-to-city and M share the same live domain instead of the obsolete chooser', async () => {
  await click(button('Pause')); assert.equal(h.ui.activeMode(),'pause');
  await click(button('City')); expectDomain('city');
  await click(button('Close window')); await click(button('Black Book M')); expectDomain('tonight');
  await press('KeyM'); assert.equal(h.ui.activeMode(),null); await press('KeyM'); expectDomain('tonight');
});
test('map inspection and Go here retain their meanings through the installed wrapper', async () => {
  await click(button('City')); const guide=h.v.state.guide;
  await click(document.querySelector('[aria-label="contact: Rook Mercer"]'));
  assert.equal(h.v.state.guide,guide); assert.match(document.querySelector('.vb-city-detail').textContent,/Rook Mercer/);
  await click(button('Go here')); assert.equal(h.v.state.guide,'contact:rook'); assert.equal(h.paused(),false);
  assert.equal(h.ui.activeMode(),null); assert.ok(document.querySelector('.vb-hud'));
});
test('Sire work still uses the resumed transaction and opens the actual errand', async () => {
  await act(async()=>{assert.equal(h.runtime.openContact('sire'),true);h.ui.refresh();});
  assert.equal(h.ui.activeMode(),'interaction'); assert.match(h.scene.interactionSystem.snapshot().title,/Sire/);
  assert.equal(h.scene.interactionSystem.menu.view,null);
  const index=h.scene.interactionSystem.menu.options.findIndex(o=>o.id==='work:sire');
  h.scene.currentInputFrame.worldEnabled=false;
  await click(document.querySelectorAll('.vb-choice')[index]); assert.equal(h.v.state.job,null); assert.ok(h.ui.pendingAction);
  await act(async()=>{h.step();}); assert.equal(h.v.state.job.issuer,'sire'); expectDomain('tonight');
  assert.match(document.querySelector('.vb-errand').textContent,/Collect the sealed supplies/);
});
test('Tonight has one next step and opening the book never replaces the destination', async () => {
  const guide=h.v.state.guide; await click(button('Black Book M')); expectDomain('tonight');
  assert.equal(document.querySelectorAll('.nb-task').length,1); assert.match(document.querySelector('.nb-task').textContent,/Meet The Sire/);
  assert.match(document.querySelector('.nb-night-margin').textContent,/No blood on hand/);
  assert.equal(h.v.state.guide,guide); await press('KeyM'); assert.equal(h.ui.activeMode(),null); assert.equal(h.paused(),false);
});
test('old and new public names keep route IDs without advertising the long-game compact', async () => {
  for(const [alias,chapter] of [['overview','tonight'],['errand','tonight'],['map','city'],['contacts','network'],['herd','feeding'],['resources','ledger'],['power','ledger'],['blood','feeding'],['accounts','ledger']]) {
    await act(async()=>h.ui.openDomain(alias)); expectDomain(chapter);
    if(alias==='power') { assert.equal(document.querySelector('.nb-compact'),null); assert.ok(document.querySelector('.nb-demo-goal')); }
  }
  await press('Digit6'); expectDomain('ledger'); assert.equal(h.ui.bootError,null);
});
test('city, contact, donor and business links preserve the selected subject', async () => {
  await click(button('City')); await click(document.querySelector('[aria-label="contact: Vesper Vale"]'));
  await click(button('Open file')); expectDomain('network'); assert.match(document.querySelector('.vb-person-detail h2').textContent,/Vesper Vale/);
  await click([...document.querySelectorAll('.nb-linked-files button')].find(n=>n.textContent.includes('Iris'))); expectDomain('feeding');
  assert.match(document.querySelector('.nb-donor-card[data-selected=true]').textContent,/Iris/);
  await click(document.querySelector('.nb-donor-card[data-selected=true] .nb-patron button')); expectDomain('network');
  await click([...document.querySelectorAll('.nb-linked-files button')].find(n=>n.textContent.includes('Club feeding rooms'))); expectDomain('ledger');
  assert.match(document.querySelector('.nb-receipt[data-selected=true]').textContent,/Club feeding rooms/);
  await click(document.querySelector('.nb-receipt[data-selected=true] .nb-operator')); expectDomain('network');
  assert.match(document.querySelector('.vb-person-detail h2').textContent,/Vesper Vale/);
});
test('a territorial permit never invents consent and Blood links to the actual patron', async () => {
  h.campaign.huntingLaw.grantRight({id:'book-right',districtId:'old-quarter',factionId:'first_estate'});
  await click(button('Black Book M')); await tab('Blood'); expectDomain('feeding');
  const iris=[...document.querySelectorAll('.nb-donor-card')].find(n=>n.textContent.includes('Iris'));
  assert.match(iris.textContent,/No donation agreed/);
  assert.match(document.querySelector('.nb-hunting-note').textContent,/1 district covered/);
  assert.match(document.querySelector('.nb-hunting-note').textContent,/An agreement is not consent.*Protected prey/);
  await click([...iris.querySelectorAll('button')].find(n=>n.textContent==='Arrange an introduction')); expectDomain('network');
  assert.match(document.querySelector('.vb-person-detail h2').textContent,/Vesper Vale/);
  assert.match(document.querySelector('.vb-person-detail').textContent,/An introduction/);
});
test('Drink a bag uses the existing once-only resumed transaction', async () => {
  h.v.state.bloodBags=2; await click(button('Black Book M')); await tab('Blood');
  assert.equal(document.querySelectorAll('.nb-bag-rack [data-full=true]').length,2);
  await click(button('Drink a bag')); assert.equal(h.v.state.bloodBags,2); assert.equal(h.ui.activeMode(),null); assert.ok(h.ui.pendingAction);
  await act(async()=>{h.step();}); assert.equal(h.v.state.bloodBags,1); assert.equal(h.scene.feedingSystem.hunger,15);
  assert.equal(h.paused(),false); assert.equal(h.ui.pendingAction,null);
});
test('Tonight keeps the real errand and urgent warning despite shorter copy', async () => {
  h.v.meet('sire'); h.runtime.acceptDelivery('sire'); h.scene.feedingSystem.hunger=90;
  await act(async()=>h.ui.refresh()); expectDomain('tonight'); assert.equal(document.querySelectorAll('.nb-task').length,1);
  assert.match(document.querySelector('.nb-task h3').textContent,/Collect the sealed supplies/);
  assert.match(document.querySelector('.nb-condition.urgent').textContent,/The Beast is close.*100/);
  const before=h.v.state.guide; await click(button('Find blood')); expectDomain('feeding'); assert.equal(h.v.state.guide,before); assert.ok(h.v.state.job);
  await press('KeyM'); expectDomain('tonight');
});
test('hidden capabilities stay hidden and instructions belong to deliberate Controls help', async () => {
  assert.deepEqual(h.ui.store.getSnapshot().powers.map(p=>p.id),['whisper','beast']);
  await click(button('Black Book M')); assert.equal(button('Incident file'),undefined);
  assert.match(document.querySelector('.nb-incident-slip').textContent,/Police.*The Veil/);
  await press('KeyL'); expectDomain('tonight'); await click(button('Back to the streets')); await click(button('Pause'));
  assert.equal(button('Police & the Veil'),undefined);
  const help=[...document.querySelectorAll('details')].find(n=>n.querySelector('summary')?.textContent==='Controls');
  assert.equal(help.open,false); assert.doesNotMatch(help.textContent,/Dash|Blood Sense|Night Ledger|Traverse available/);
  assert.match(help.textContent,/Black Book/); assert.match(help.textContent,/Go here/); assert.match(help.textContent,/Locate/);
  await click(button('Back to the streets')); assert.equal(h.paused(),false); assert.equal(h.registry.get('uiPaused'),false); assert.equal(h.registry.get('uiKeyboardOwned'),false);
});
test('district selection shows one hunting decision and the authority, not reception', async () => {
  await click(button('City')); expectDomain('city'); assert.equal(button('Hunting').getAttribute('aria-pressed'),'true');
  const select=document.querySelector('[aria-label="Inspect a district"]'); assert.equal(select.options.length,14);
  await act(async()=>{select.value='old-quarter';select.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.match(document.querySelector('.nb-permit').textContent,/No settled claim/);
  assert.match(document.querySelector('.vb-city-detail').textContent,/Authority/); assert.equal(button('Reception'),undefined); assert.equal(button('Control'),undefined); assert.equal(h.ui.store.getSnapshot().selection,'district:old-quarter');
});

// Editorial/portrait acceptance beyond the retained navigation regressions.
test('chapter names are concise and ordinary pages contain no tutorial subtitles or pause notices', async () => {
  await click(button('Black Book M'));
  assert.deepEqual([...document.querySelectorAll('[role=tab]')].map(n=>n.getAttribute('aria-label')),['Tonight','City','Contacts','Blood','Accounts']);
  for(const label of ['Tonight','City','Contacts','Blood','Accounts']) {
    await tab(label);
    assert.equal(document.querySelectorAll('.vb-domain-tab small').length,0);
    assert.doesNotMatch(document.querySelector('.nb-book').textContent,/What do I|Who can open|WORLD PAUSED|NO TIME LOST|active play|returns? to play|closes the book|SELECTED RECORD|sets your arrow/i);
    assert.equal(document.querySelector('.vb-window-head p'),null);
    assert.equal(document.querySelector('[role=dialog]').hasAttribute('aria-describedby'),false);
  }
});
test('contact thumbnail and dossier share a stable face across selection and refresh', async () => {
  await click(button('Black Book M')); await tab('Contacts');
  const cards=[...document.querySelectorAll('.vb-contact-list button')];
  assert.equal(new Set(cards.map(n=>n.querySelector('[data-portrait]').dataset.portrait)).size,6);
  const guide=h.v.state.guide;
  for(const card of cards) {
    const expected=card.querySelector('[data-portrait]').dataset.portrait; await click(card);
    const full=document.querySelector('.nb-photo [data-portrait]'); assert.equal(full.dataset.portrait,expected);
    const markup=full.outerHTML; await act(async()=>{h.ui.refresh();});
    assert.equal(document.querySelector('.nb-photo [data-portrait]').outerHTML,markup);
  }
  assert.equal(h.v.state.guide,guide);
});
test('both donors have their own portrait and drawings never take interaction focus', async () => {
  await click(button('Black Book M')); await tab('Blood');
  const prints=[...document.querySelectorAll('.nb-donor-card [data-portrait]')];
  assert.deepEqual(prints.map(n=>n.dataset.portrait).sort(),['donor_eli','donor_iris']);
  for(const print of prints) { assert.equal(print.getAttribute('aria-hidden'),'true'); assert.equal(print.getAttribute('focusable'),'false'); assert.equal(print.querySelector('image,script,[tabindex],a'),null); }
  assert.equal(document.querySelector('.nb-donor-initial'),null);
});
test('shorter copy retains price, refusal and irreversible errand confirmation', async () => {
  h.v.meet('sire'); h.v.borrow(); h.runtime.acceptDelivery('sire'); await act(async()=>h.ui.refresh());
  assert.match(document.querySelector('.nb-payment').textContent,/Debt repaid/);
  await click(button('Abandon errand…')); assert.ok(h.v.state.job);
  assert.match(document.querySelector('[role=alert]').textContent,/cargo.*payment.*trust.*cannot take it back/i);
  await click(button('Keep my word')); assert.ok(h.v.state.job);
  await tab('Blood'); assert.equal(button('Drink a bag').disabled,false);
  h.v.state.bloodBags=0; await act(async()=>h.ui.refresh()); assert.equal(button('Drink a bag').disabled,true); assert.match(document.querySelector('.nb-pocket-card').textContent,/No bags on hand/);
});

test('City routes to a named broker and the in-person agreement updates the actual hunting rule once', async () => {
  h.v.contact('mara').introduced=true; h.v.meet('mara');
  h.v.acceptDelivery('mara');h.v.handoff(h.v.deliverySite());h.v.handoff(h.v.deliverySite());
  await click(button('City'));
  await act(async()=>h.ui.command('select',{target:'district:hospital-district'}));
  assert.match(document.querySelector('.nb-permit').textContent,/Hunting on your own/);
  const objective=h.v.state.guide;
  await click(button('Speak to Mara Voss'));expectDomain('network');
  assert.equal(h.ui.store.getSnapshot().selection,'contact:mara');assert.equal(h.v.state.guide,objective);
  assert.match(document.querySelector('.nb-agreement').textContent,/Agreement offered/);
  assert.match(document.querySelector('.nb-agreement').textContent,/Leave victims alive/);
  await click(button('Go here'));assert.equal(h.v.state.guide,'contact:mara');
  await act(async()=>{h.step();h.runtime.openContact('mara');h.ui.refresh();});
  const index=h.scene.interactionSystem.menu.options.findIndex(o=>o.id==='access:mara');
  await click(document.querySelectorAll('.vb-choice')[index]);
  assert.equal(h.v.agreement('mara').active,false);assert.ok(h.ui.pendingAction);
  await act(async()=>h.step());assert.equal(h.v.agreement('mara').active,true);assert.equal(h.ui.pendingAction,null);
  await click(button('City'));await act(async()=>h.ui.command('select',{target:'district:hospital-district'}));
  assert.match(document.querySelector('.nb-permit').textContent,/Agreement held/);
  assert.match(document.querySelector('.vb-city-detail').textContent,/Mara Voss/);
  await click(button('The agreement'));expectDomain('network');assert.equal(h.ui.store.getSnapshot().selection,'contact:mara');
  assert.equal(h.v.state.guide,'contact:mara');
  await press('Escape');assert.equal(h.paused(),false);
});
test('City displays the public Crown rule and unclaimed ground without a hidden reputation switch', async () => {
  h.campaign.reputation.setFaction('gutter_crown',-100);
  await click(button('City'));await act(async()=>h.ui.command('select',{target:'district:canal-west'}));
  assert.match(document.querySelector('.nb-permit').textContent,/Open hunt/);
  assert.match(document.querySelector('.vb-city-detail').textContent,/police level 0 or 1/);
  await click(button('Authorities'));assert.equal(button('Authorities').getAttribute('aria-pressed'),'true');
  assert.equal(button('Reception'),undefined);assert.equal(button('Control'),undefined);
  await act(async()=>h.ui.command('select',{target:'district:old-quarter'}));
  assert.match(document.querySelector('.nb-permit').textContent,/No settled claim/);
  assert.doesNotMatch(document.querySelector('.vb-city-detail').textContent,/NO HUNTING PERMIT|Reputation/);
});

// The Sire has introductions/credit/compact, not a normal hunting negotiation.
test('an unsigned Sire file does not offer an unavailable hunting negotiation', async () => {
  await click(button('Black Book M'));
  await act(async()=>h.ui.command('tab',{tab:'network',target:'contact:sire'}));
  assert.match(document.querySelector('.vb-person-detail').textContent,/The Sire/);
  assert.equal(document.querySelector('.nb-agreement'),null);
  await act(async()=>h.ui.command('tab',{tab:'network',target:'contact:vesper'}));
  assert.ok(document.querySelector('.nb-agreement'));
});

async function filterFiles(label, value) {
  const select=document.querySelector(`select[aria-label="${label}"]`);assert.ok(select);
  await act(async()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
}
const peopleCards=()=>[...document.querySelectorAll('.vb-contact-list button[data-person-target]')];
test('all six identity cards match the real actor nature and show independent text and icons',async()=>{
  await click(button('Black Book M'));await tab('Contacts');
  assert.equal(peopleCards().length,6);
  const saved=h.campaign.export();
  for(const card of peopleCards()) {
    const id=card.dataset.personTarget.split(':')[1], actor=h.runtime.people.get(id);
    assert.equal(card.dataset.nature,actor.vampire?'vampire':'human');
    assert.ok(card.querySelector('.nb-affiliation').textContent);assert.ok(card.querySelector('.nb-nature').textContent);
    assert.equal(card.querySelectorAll('.nb-identity-line [data-identity-glyph]').length,2);
    const {faction,nature}=card.dataset;await click(card);
    const dossier=document.querySelector('.vb-person-detail');assert.equal(dossier.dataset.faction,faction);assert.equal(dossier.dataset.nature,nature);
  }
  assert.deepEqual(h.campaign.export(),saved);expectDomain('network');
});
test('human filters reveal real donor dossiers without enabling feeding or changing the objective',async()=>{
  await click(button('Black Book M'));await tab('Contacts');const saved=h.campaign.export(),guide=h.v.state.guide;
  await filterFiles('Filter by nature','human');assert.equal(peopleCards().length,2);
  assert.ok(peopleCards().every(p=>p.dataset.nature==='human'&&p.dataset.faction==='unknown'));
  await click(peopleCards()[1]);assert.equal(document.querySelector('.nb-photo [data-portrait]').dataset.portrait,'donor_eli');
  assert.ok(button('Blood file'));assert.equal(h.ui.pendingAction,null);assert.equal(h.v.state.guide,guide);
  assert.deepEqual(h.campaign.export(),saved);expectDomain('network');
  await click(button('Blood file'));expectDomain('feeding');assert.equal(h.runtime.domain.selection,'donor:donor_eli');
  const donor=document.querySelector('.nb-donor-card[data-selected=true]');assert.equal(donor.dataset.nature,'human');assert.equal(donor.dataset.faction,'unknown');
});
test('combined filters never show a stale unrelated dossier and clear restores the directory',async()=>{
  await click(button('Black Book M'));await tab('Contacts');
  await filterFiles('Filter by nature','human');await filterFiles('Filter by faction','first_estate');
  assert.equal(peopleCards().length,0);assert.equal(document.querySelector('.vb-person-detail'),null);
  assert.match(document.querySelector('.nb-filter-count').textContent,/0 \/ 6/);
  await click(button('Clear filters'));assert.equal(peopleCards().length,6);assert.ok(document.querySelector('.vb-person-detail'));
});
test('faction filtering and selected-state styling retain identity after refresh and failed agreements',async()=>{
  await click(button('Black Book M'));await tab('Contacts');const guide=h.v.state.guide;
  await filterFiles('Filter by faction','gutter_crown');assert.equal(peopleCards().length,1);assert.equal(peopleCards()[0].dataset.personTarget,'contact:rook');
  await act(async()=>{h.v.contact('rook').suspended=true;h.ui.refresh();});
  const card=peopleCards()[0];assert.equal(card.dataset.faction,'gutter_crown');assert.equal(card.getAttribute('aria-pressed'),'true');
  assert.match(card.textContent,/Agreement suspended/);assert.equal(h.v.state.guide,guide);
});
test('cross-file links reveal a person even after another nature was filtered',async()=>{
  await click(button('Black Book M'));await tab('Contacts');await filterFiles('Filter by nature','human');
  await click(button('Vesper Vale'));expectDomain('network');
  assert.equal(document.querySelector('.vb-person-detail h2').textContent,'Vesper Vale');
  assert.equal(document.querySelector('select[aria-label="Filter by nature"]').value,'all');
  assert.equal(peopleCards().find(p=>p.getAttribute('aria-pressed')==='true').dataset.personTarget,'contact:vesper');
});
test('identity filters are keyboard-native, do not leak world controls, and Escape returns control',async()=>{
  await click(button('Black Book M'));await tab('Contacts');
  const select=document.querySelector('select[aria-label="Filter by nature"]');await act(async()=>select.focus());
  await press('ArrowDown',select);await press('KeyW',select);await press('Digit4',select);expectDomain('network');
  assert.equal(h.ui.pendingAction,null);await filterFiles('Filter by nature','human');
  await act(async()=>button('Clear filters').focus());await press('Escape',button('Clear filters'));
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  assert.equal(h.ui.activeMode(),null);assert.equal(h.paused(),false);assert.equal(document.activeElement.tagName,'CANVAS');
});
test('City person previews and Blood donor cards share identity without colouring business records as people',async()=>{
  await click(button('City'));
  await act(async()=>h.ui.command('select',{target:'contact:mara'}));
  const identity=document.querySelector('.nb-map-file .nb-identity-line');assert.ok(identity);assert.equal(identity.dataset.faction,'independent');assert.equal(identity.dataset.nature,'vampire');
  await act(async()=>h.ui.command('select',{target:'asset:supply'}));assert.equal(document.querySelector('.nb-map-file .nb-identity-line'),null);
  await tab('Blood');assert.equal(document.querySelectorAll('.nb-donor-card .nb-nature').length,2);
});

test('Tonight retains the first-business goal alongside the current real errand', async () => {
  await click(button('Black Book M'));
  assert.match(document.querySelector('.nb-demo-goal').textContent,/A stake in the club.*0\/3.*\$600/);
  assert.doesNotMatch(document.querySelector('.nb-book').textContent,/Prince|city compact|Backing your claim/);
  await click(button('The offer')); expectDomain('ledger');
  assert.match(document.querySelector('.nb-receipt[data-selected=true]').textContent,/Finish 3 errands.*0\/3/);
  assert.equal(document.querySelector('.nb-compact'),null);
  await press('Escape');
  await act(async()=>{h.runtime.openContact('sire');h.ui.refresh(true);});
  const option=h.scene.interactionSystem.menu.options.find(o=>o.id==='work:sire');
  await act(async()=>{h.scene.interactionSystem.runOption(option);h.ui.refresh(true);});
  expectDomain('tonight');assert.ok(document.querySelector('.nb-demo-goal'));assert.equal(document.querySelectorAll('.nb-task').length,1);
});

test('first investment completes through the real queued UI action and Keep playing returns control', async () => {
  const work=id=>{assert.ok(h.v.acceptDelivery(id).ok);assert.ok(h.v.handoff(h.v.deliverySite()).ok);assert.ok(h.v.handoff(h.v.deliverySite()).ok);};
  await act(async()=>{h.v.meet('sire');work('sire');h.v.meet('vesper');for(let i=0;i<3;i++)work('vesper');h.runtime.openBusiness('club');h.ui.refresh(true);});
  const index=h.scene.interactionSystem.menu.options.findIndex(o=>o.id==='invest:club');
  await click(document.querySelectorAll('.vb-choice')[index]);
  assert.equal(h.v.state.assets.club.level,0,'no purchase while world paused');assert.ok(h.ui.pendingAction);
  await act(async()=>{h.step();h.ui.refresh(true);});
  assert.equal(h.v.state.assets.club.level,1);assert.equal(h.campaign.wallet.balance(),270);
  expectDomain('tonight');assert.ok(document.querySelector('.nb-demo-ending'));
  assert.match(document.querySelector('.nb-demo-ending').textContent,/first chapter is complete/);
  assert.equal(h.v.state.notices.filter(n=>n.text.startsWith('A FOOTHOLD')).length,1);
  await click(button('Keep playing'));assert.equal(h.paused(),false);assert.equal(h.ui.activeMode(),null);
  await act(async()=>{h.step();h.v.tick(90);});assert.equal(h.campaign.wallet.balance(),355);
  await click(button('Black Book M'));assert.ok(document.querySelector('.nb-demo-ending'));
  assert.equal(h.v.state.notices.filter(n=>n.text.startsWith('A FOOTHOLD')).length,1,'inspecting the ending is not another reward');
});
