import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignSystem } from '../phaser/src/campaign/CampaignSystem.js';
import { createCampaignState } from '../phaser/src/campaign/CampaignState.js';
import { CAMPAIGN_STORAGE_KEY, LEGACY_CAMPAIGN_STORAGE_KEYS } from '../phaser/src/campaign/constants.js';
import { createBootProfile } from '../phaser/src/boot/BootProfile.js';
import { demoChapter } from '../phaser/src/vampire/DemoChapter.js';

let sequence = 0;
const boot = () => import(`../phaser/src/campaign/preload.js?session-test=${++sequence}`);
function globals(t, descriptors) {
  t.mock.method(Date, 'now', () => 2000);
  const previous = Object.fromEntries(Object.keys(descriptors).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, descriptor] of Object.entries(descriptors)) Object.defineProperty(globalThis, key, { configurable:true, ...descriptor });
  t.after(() => {
    globalThis.NBD_CAMPAIGN_SYSTEM?.destroy?.();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  });
}
function install(t, storage, existing = undefined) {
  globals(t, { localStorage:{value:storage}, sessionStorage:{value:storage},
    NBD_CAMPAIGN_SYSTEM:{value:existing,writable:true}, NBD_CAMPAIGN_ENTRY:{value:undefined,writable:true} });
}
function oldProgress() {
  const state = createCampaignState({now:1000});
  state.player.cash = 9000;
  state.vampire.assets.club.level = 2;
  state.vampire.contacts.vesper.met = true;
  state.vampire.contacts.vesper.jobs = 10;
  state.vampire.body = {hunger:99,vitality:1};
  state.vampire.job = {issuer:'vesper',stage:'collected',sequence:8};
  return JSON.stringify(state);
}
function assertFresh(c) {
  const baseline = new CampaignSystem({storage:null,autoLoad:false,autoSave:false,now:()=>c.state.createdAt});
  try {
    assert.deepEqual(c.snapshot(),baseline.snapshot());
    assert.equal(c.wallet.balance(),0);
    assert.equal(c.vampire.state.job,null);
    assert.equal(c.vampire.state.assets.club.level,0);
    assert.equal(c.vampire.state.contacts.vesper.met,false);
    assert.equal(demoChapter(c.vampire).completed,false);
    assert.equal(demoChapter(c.vampire).next.target,'contact:sire');
    assert.equal(c.autoSave,false);
    assert.equal(c.storage.available(),false);
  } finally { baseline.destroy(); }
}

for (const search of ['', '?mode=normal', '?mode=explore', '?mode=playtest', '?testScenario=street-damage', '?continue=1&load=1']) {
  test(`session flags forbid campaign persistence for ${search || 'default URL'}`, () => {
    const profile=createBootProfile(search);
    for (const key of ['persistentCampaign','autoLoadCampaign','autoSaveCampaign']) assert.equal(profile[key],false,key);
  });
}
for (const key of [CAMPAIGN_STORAGE_KEY,...LEGACY_CAMPAIGN_STORAGE_KEYS]) {
  test(`real preload ignores ${key} without reading, writing, migrating or deleting it`,async t=>{
    const stored = new Map([[key,oldProgress()],['viceblood-resolution','high']]), calls=[];
    const storage={getItem(k){calls.push(['read',k]);return stored.get(k)||null;},
      setItem(k,v){calls.push(['write',k]);stored.set(k,v);},removeItem(k){calls.push(['delete',k]);stored.delete(k);}};
    install(t,storage);
    const {campaign:c,campaignEntry}=await boot();
    assertFresh(c); assert.equal(campaignEntry.show,false);
    assert.equal(campaignEntry.autoEnter,true);
    c.wallet.credit(500); c.vampire.meet('sire'); c.vampire.acceptDelivery('sire'); c.vampire.tick(15);
    assert.equal(c.state.sequences.save,0,'events and elapsed play do not autosave');
    c.save();
    assert.equal(c.wallet.balance(),500,'live progress remains after an explicit legacy save call');
    assert.equal(c.storage.load({fallbackToFresh:false}),null,'there is no hidden memory-save cache');
    assert.deepEqual(calls,[]);
    assert.equal(stored.get(key),oldProgress());assert.equal(stored.get('viceblood-resolution'),'high');
  });
}
test('boot replaces a progressed global campaign and disposes its subscriptions',async t=>{
  const stale=new CampaignSystem({storage:null,autoLoad:false,autoSave:false});
  stale.import(oldProgress(),{persist:false});
  let destroyed=0;const destroy=stale.destroy.bind(stale);stale.destroy=()=>{destroyed++;destroy();};
  install(t,null,stale);
  const {campaign:c}=await boot();
  assert.notEqual(c,stale);assert.equal(globalThis.NBD_CAMPAIGN_SYSTEM,c);assert.equal(destroyed,1);assertFresh(c);
});
test('progress lasts within a run, but another real bootstrap returns every authority to initial state',async t=>{
  install(t,null);
  const {campaign:first}=await boot();
  first.vampire.meet('sire');first.vampire.acceptDelivery('sire');
  first.vampire.handoff(first.vampire.deliverySite());first.vampire.handoff(first.vampire.deliverySite());
  assert.equal(first.wallet.balance(),180);assert.equal(first.vampire.contact('sire').jobs,1);
  first.vampire.tick(120);first.snapshot();first.snapshot();
  assert.equal(first.wallet.balance(),180);assert.equal(first.vampire.contact('sire').jobs,1);
  first.vampire.meet('vesper');first.vampire.acceptDelivery('vesper');
  assert.equal(first.vampire.state.job.issuer,'vesper');
  const {campaign:second}=await boot();
  assert.notEqual(first,second);assertFresh(second);
});
test('campaign bootstrap never even resolves denied browser-storage getters',async t=>{
  const denied=()=>{throw new Error('Storage is disabled');};
  globals(t,{localStorage:{get:denied},sessionStorage:{get:denied},
    NBD_CAMPAIGN_SYSTEM:{value:undefined,writable:true},NBD_CAMPAIGN_ENTRY:{value:undefined,writable:true}});
  const {campaign:c}=await boot();assertFresh(c);c.wallet.credit(25);assert.doesNotThrow(()=>c.save());
});
