import test from 'node:test';
import assert from 'node:assert/strict';
import { uiHarness, keyEvent } from './helpers/ui-harness.js';
import { DOMAIN_TABS } from '../phaser/src/vampire/DomainNavigation.js';
import { buildDomainModel } from '../phaser/src/vampire/VampireDomainModel.js';

test('all six sections stay live while the actual scene pause is owned by the UI', async()=>{
 const h=await uiHarness(); assert.equal(h.ui.openDomain(),true); assert.equal(h.paused(),true);
 assert.equal(h.registry.get('uiPaused'),false); assert.equal(h.registry.get('uiKeyboardOwned'),true);
 h.scene.currentInputFrame.worldEnabled=false;
 for(const tab of DOMAIN_TABS){assert.equal(h.ui.command('tab',{tab:tab.toLowerCase()}),true); assert.equal(h.ui.store.getSnapshot().tab,tab.toLowerCase());}
 assert.equal(h.v.state.elapsed,.01); h.ui.command('close'); assert.equal(h.paused(),false); assert.equal(h.registry.get('uiKeyboardOwned'),false); h.destroy();
});
test('Locate changes inspection only; Go here sets the live target and resumes',async()=>{
 const h=await uiHarness(); h.ui.openDomain(); const before=h.v.state.guide;
 h.ui.command('locate',{target:'contact:rook'}); assert.equal(h.v.state.guide,before); assert.equal(h.ui.store.getSnapshot().selection,'contact:rook'); assert.equal(h.paused(),true);
 h.ui.command('go',{target:'contact:rook'}); assert.equal(h.v.state.guide,'contact:rook'); assert.equal(h.paused(),false); assert.equal(h.ui.activeMode(),null);
 h.runtime.people.get('rook').x+=50; h.ui.refresh(); assert.equal(h.ui.store.getSnapshot().guide.label,'Rook Mercer'); h.destroy();
});
test('one keyboard press closes a domain rather than opening pause underneath',async()=>{
 const h=await uiHarness(); h.ui.openDomain(); const e=keyEvent('Escape'); h.ui.handleDomKeyDown(e);
 assert.ok(e.stopped); assert.equal(h.ui.activeMode(),null); assert.equal(h.paused(),false);
 h.ui.handleDomKeyDown(keyEvent('KeyM')); assert.equal(h.runtime.domain.tab,'errand');
 h.ui.handleDomKeyDown(keyEvent('KeyM')); assert.equal(h.ui.activeMode(),null);
 h.ui.handleDomKeyDown(keyEvent('KeyL')); assert.equal(h.ui.activeMode(),'ledger'); h.ui.handleDomKeyDown(keyEvent('Escape')); assert.equal(h.ui.activeMode(),null); h.destroy();
});
test('interaction transaction executes once on the resumed frame, not a stale locked frame',async()=>{
 const h=await uiHarness(); h.runtime.openContact('sire'); h.ui.refresh(); h.scene.currentInputFrame.worldEnabled=false;
 const id='work:sire'; assert.equal(h.ui.command('choose',{id}),true); assert.equal(h.v.state.job,null);
 assert.equal(h.ui.command('choose',{id}),false); assert.equal(h.paused(),false);
 h.step(); assert.equal(h.v.state.job.issuer,'sire'); assert.equal(h.ui.activeMode(),'domain'); assert.equal(h.runtime.domain.tab,'errand'); assert.equal(h.paused(),true);
 h.destroy();
});
test('carried blood waits for the real unlocked frame and cannot be double-spent',async()=>{
 const h=await uiHarness(); h.v.state.bloodBags=2; h.ui.openDomain('resources'); h.scene.currentInputFrame.worldEnabled=false;
 assert.ok(h.ui.command('blood')); assert.equal(h.ui.command('blood'),false); assert.equal(h.v.state.bloodBags,2);
 h.step(); assert.equal(h.v.state.bloodBags,1); assert.equal(h.scene.feedingSystem.hunger,15); assert.equal(h.ui.activeMode(),null); h.destroy();
});
test('new modal cancels a queued gameplay command and does not override other locks',async()=>{
 const h=await uiHarness(); h.v.state.bloodBags=1; h.ui.command('blood'); h.ui.command('pause');
 assert.equal(h.ui.activeMode(),'pause'); assert.equal(h.ui.pendingAction,null); h.ui.command('close'); h.step(); assert.equal(h.v.state.bloodBags,1);
 h.registry.set('taskRevealActive',true); assert.equal(h.ui.openDomain(),false); h.destroy();
});
test('abandon needs confirmation and cannot apply to a replaced errand',async()=>{
 const h=await uiHarness(); h.v.meet('sire'); h.runtime.acceptDelivery('sire'); h.ui.refresh();
 const trust=h.v.trust('sire'); h.ui.command('abandon'); assert.ok(h.v.state.job); h.ui.command('cancel-confirm'); assert.equal(h.v.trust('sire'),trust);
 h.ui.command('abandon'); h.v.state.job.stage='collected'; assert.equal(h.ui.command('confirm-abandon'),false); assert.ok(h.v.state.job);
 h.ui.command('cancel-confirm'); h.ui.command('abandon'); h.ui.command('confirm-abandon'); assert.equal(h.v.state.job,null); assert.equal(h.v.trust('sire'),trust-10); h.destroy();
});
test('disabled interaction stays disabled in the read model and cannot execute',async()=>{
 const h=await uiHarness(); let calls=0; h.scene.interactionSystem.open([{id:'locked',label:'Locked',disabled:true,run(){calls++;}}]); h.ui.refresh();
 assert.equal(h.ui.store.getSnapshot().interaction.options[0].disabled,true); assert.equal(h.ui.command('choose',{id:'locked'}),false); assert.equal(calls,0); h.destroy();
});
test('district ownership, reception and hunting rights are independent campaign facts',async()=>{
 const h=await uiHarness(); const before=buildDomainModel(h.runtime).districts.find(d=>d.ownerId==='first_estate'); assert.ok(before); assert.equal(before.relationship,'tolerated'); assert.equal(before.permitted,false);
 h.campaign.reputation.setFaction('first_estate',50);
 let district=buildDomainModel(h.runtime).districts.find(d=>d.id===before.id); assert.equal(district.relationship,'welcome'); assert.equal(district.permitted,false);
 h.campaign.huntingLaw.grantRight({id:'ui-test',districtId:before.id,factionId:'first_estate'});
 district=buildDomainModel(h.runtime).districts.find(d=>d.id===before.id); assert.equal(district.relationship,'welcome'); assert.equal(district.permitted,true); h.destroy();
});
test('external panel closes its own service lock before returning to play',async()=>{
 const h=await uiHarness(); h.registry.set('vehicleMaintenanceOpen',true);
 h.ui.openExternal({id:'garage',read:()=>({vehicles:[],balance:0}),close:()=>{h.registry.set('vehicleMaintenanceOpen',false);return h.ui.closeExternal('garage');}});
 assert.equal(h.paused(),true); assert.equal(h.registry.get('uiPaused'),true); h.ui.closeActive(); assert.equal(h.paused(),false); assert.equal(h.registry.get('uiPaused'),false); h.destroy();
});
test('UI failure is a visible paused mode rather than an invisible world lock',async()=>{
 const h=await uiHarness(); h.ui.command('ui-error',{message:'render fault'}); assert.equal(h.ui.store.getSnapshot().mode,'error'); assert.equal(h.ui.store.getSnapshot().error,'render fault'); assert.equal(h.paused(),true); h.destroy();
});
