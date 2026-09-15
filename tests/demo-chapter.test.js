import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignSystem } from '../phaser/src/campaign/CampaignSystem.js';
import { DEMO_DELIVERIES, demoChapter, demoStage, deliveryOffer } from '../phaser/src/vampire/DemoChapter.js';
import { sanitizeVampireState } from '../phaser/src/vampire/VampireState.js';
import { createVampireSites } from '../phaser/src/vampire/VampireWorldSites.js';
import { buildings } from '../phaser/src/data/district.js';
import { buildDomainModel, errandModel, domainDestination } from '../phaser/src/vampire/VampireDomainModel.js';
import { uiHarness } from './helpers/ui-harness.js';

const campaign = () => new CampaignSystem({autoLoad:false,autoSave:false,now:()=>1000});
function work(v,id) {assert.ok(v.acceptDelivery(id).ok);assert.ok(v.handoff(v.deliverySite()).ok);assert.ok(v.handoff(v.deliverySite()).ok);}
function introduce(v) {assert.ok(v.meet('sire').ok);work(v,'sire');assert.ok(v.meet('vesper').ok);}

test('first chapter has a reachable business objective, not a cash-only or Prince finish',()=>{
  const c=campaign(),v=c.vampire;
  assert.equal(demoChapter(v).next.target,'contact:sire');
  introduce(v);
  for(let i=0;i<3;i++) {
    assert.equal(demoChapter(v).jobs,i);work(v,'vesper');
  }
  assert.equal(c.wallet.balance(),870);
  assert.equal(demoChapter(v).completed,false,'money by itself is not the ending');
  assert.equal(demoChapter(v).next.target,'asset:club');
  const result=v.invest('club');assert.ok(result.ok);assert.equal(result.demoComplete,true);
  assert.equal(c.wallet.balance(),270);assert.equal(v.state.assets.club.level,1);
  assert.equal(demoChapter(v).completed,true);assert.equal(v.state.prince,false);
  const before=c.wallet.balance();v.tick(90);assert.equal(c.wallet.balance(),before+85);
});

test('three jobs are a visible prerequisite and an early click never debits cash',()=>{
  const c=campaign(),v=c.vampire;introduce(v);c.wallet.credit(2000);
  for(let i=0;i<3;i++) {
    const before=c.export();const result=v.invest('club');
    assert.equal(result.ok,false);assert.match(result.text,new RegExp(`${i}/3`));assert.equal(c.export(),before);
    work(v,'vesper');
  }
  assert.ok(v.invest('club').ok);
});

test('the optional advance remains repayable and the same route funds blood as well as the stake',()=>{
  const c=campaign(),v=c.vampire;v.meet('sire');v.borrow();work(v,'sire');
  assert.equal(v.contact('sire').debt,20);assert.match(demoChapter(v).next.text,/Settle/);
  assert.ok(v.repay('sire').ok);assert.ok(v.meet('vesper').ok);
  for(let i=0;i<3;i++)work(v,'vesper');
  assert.equal(c.wallet.balance(),820);assert.equal(v.state.bloodBags,2);
  v.consumeBlood(60);assert.ok(v.buyBlood('sire').ok);
  assert.ok(v.invest('club').ok);assert.ok(c.wallet.balance()>=0);
});

test('three authored offers have distinct real-city routes and stable pay',()=>{
  const sites=createVampireSites(buildings), routes=new Set();
  for(let i=0;i<3;i++) {
    const d=deliveryOffer('vesper',i);assert.ok(d.title);assert.ok(d.briefing);
    assert.ok(sites[d.pickup]);assert.ok(sites[d.delivery]);assert.equal(d.reward,230);
    routes.add(`${d.pickup}:${d.delivery}`);
  }
  assert.equal(routes.size,3);assert.equal(DEMO_DELIVERIES.length,3);
});

test('each new route survives collection, reload, failed wrong-site handoff and pays once',()=>{
  for(let i=0;i<3;i++) {
    const c=campaign(),v=c.vampire;introduce(v);for(let n=0;n<i;n++)work(v,'vesper');
    const offer=v.deliveryOffer('vesper');v.acceptDelivery('vesper');assert.equal(v.state.job.routeId,offer.routeId);
    assert.equal(v.handoff('refugeTower').ok,false);v.handoff(offer.pickup);
    const next=campaign();next.import(c.export(),{persist:false});const nv=next.vampire;
    assert.equal(nv.deliverySite(),offer.delivery);assert.equal(nv.activeDelivery().briefing,offer.briefing);
    const cash=next.wallet.balance();assert.ok(nv.handoff(offer.delivery).ok);
    assert.equal(next.wallet.balance(),cash+230);assert.equal(nv.handoff(offer.delivery).ok,false);
    assert.equal(nv.contact('vesper').jobs,i+1);
  }
});

test('legacy in-flight cargo and invalid metadata cannot be silently redirected',()=>{
  for(const routeId of [undefined,'vesper:missing','sire:after-hours']) {
    const state=sanitizeVampireState({job:{issuer:'vesper',stage:'collected',sequence:8,routeId},contacts:{vesper:{met:true,jobs:1}}});
    assert.equal(state.job.routeId,undefined);
    const c=campaign();c.state.vampire=state;assert.equal(c.vampire.deliverySite(),'saintOrisonHotel');
    assert.ok(c.vampire.handoff('saintOrisonHotel').ok);assert.equal(c.wallet.balance(),230);
  }
});

test('abandoning or dying never skips an offer and free paid recovery work remains available',()=>{
  const c=campaign(),v=c.vampire;introduce(v);work(v,'vesper');
  const offer=v.deliveryOffer('vesper');v.acceptDelivery('vesper');v.handoff(v.deliverySite());v.abandonDelivery({death:true});
  assert.equal(v.contact('vesper').jobs,1);assert.equal(v.deliveryOffer('vesper').routeId,offer.routeId);
  c.wallet.debit(c.wallet.balance());v.suspend('vesper','Breach');
  assert.match(demoChapter(v).next.text,/amends/);work(v,'vesper');
  assert.equal(v.contact('vesper').suspended,false);assert.equal(c.wallet.balance(),230);
});

test('existing operations complete the goal without replaying a popup or resetting an old save',()=>{
  const c=campaign(),v=c.vampire;v.state.assets.club.level=1;v.state.prince=true;
  v.contact('vesper').met=true;v.contact('vesper').jobs=1;v.changeTrust('vesper',25);c.wallet.credit(1000);
  const save=c.export(),next=campaign();next.import(save,{persist:false});
  assert.equal(demoChapter(next.vampire).completed,true);assert.equal(demoStage(next.vampire.state),'Investor');
  assert.equal(next.vampire.state.prince,true,'future-game save metadata is preserved');
  const result=next.vampire.invest('club');assert.ok(result.ok);assert.equal(result.demoComplete,undefined);
  assert.equal(next.vampire.state.notices.some(n=>n.text.startsWith('A FOOTHOLD')),false);
});

test('legacy known contacts are not sent back to repeat an introduction',()=>{
  const c=campaign(),v=c.vampire;v.contact('vesper').met=true;
  assert.equal(demoChapter(v).next.target,'contact:vesper');
});

test('live errand projection, destinations and map use the same latched second route',async t=>{
  const h=await uiHarness();t.after(()=>h.destroy());introduce(h.v);work(h.v,'vesper');h.v.acceptDelivery('vesper');
  const e=errandModel(h.runtime),m=buildDomainModel(h.runtime);
  assert.equal(e.title,'After hours');assert.equal(e.current.target,'site:marketBlock');
  assert.equal(m.next.target,'delivery');assert.equal(m.demo.completed,false);
  assert.equal(domainDestination(h.runtime,'delivery').id,'marketBlock');
  h.v.handoff('marketBlock');assert.equal(domainDestination(h.runtime,'delivery').id,'club');
  assert.equal(buildDomainModel(h.runtime).errand.current.target,'site:club');
});

test('every public contact menu omits Prince and endorsement; legacy shortcut goes to Tonight',async t=>{
  const h=await uiHarness();t.after(()=>h.destroy());
  for(const id of ['sire','vesper','rook','mara']) {
    h.v.contact(id).introduced=true;h.runtime.openContact(id);
    assert.doesNotMatch(JSON.stringify(h.scene.interactionSystem.snapshot()),/Prince|city compact|support:/i);
    h.scene.interactionSystem.close();
  }
  h.runtime.openPrince();assert.equal(h.runtime.domain.tab,'tonight');
  const m=buildDomainModel(h.runtime);assert.equal(m.prince,false);assert.deepEqual(m.requirements,[]);
});
