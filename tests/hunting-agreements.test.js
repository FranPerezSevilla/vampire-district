import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignSystem } from '../phaser/src/campaign/CampaignSystem.js';
import { classifyHuntingFacts } from '../phaser/src/factions/HuntingLawModel.js';

const campaign = () => new CampaignSystem({autoLoad:false,autoSave:false,now:()=>1000});
function meet(v,id) {v.contact(id).introduced=true;assert.ok(v.meet(id).ok);}
function work(v,id) {assert.ok(v.acceptDelivery(id).ok);assert.ok(v.handoff(v.deliverySite()).ok);assert.ok(v.handoff(v.deliverySite()).ok);}
function deal(c,id='mara') {meet(c.vampire,id);work(c.vampire,id);assert.ok(c.vampire.grantAccess(id).ok);}
const quiet = district => ({district,victim:{id:'ordinary',type:'civilian'},victimAlive:true,witnessCount:0,bodyEvidence:false,wantedLevel:0});
const feed = (c,extra={}) => c.huntingLaw.assessFeed({districtId:'hospital-district',victim:{id:'ordinary',type:'civilian'},victimAlive:true,feedingDepth:'quick_bite',victimOutcome:'alive',...extra});

for (const rep of [-100,-40,0,35,100]) {
  test(`reputation ${rep} cannot act as a hidden hunting permit in either faction`,()=>{
    const c=campaign();
    c.reputation.setFaction('first_estate',rep);c.reputation.setFaction('gutter_crown',rep);
    const estate=c.territory.district('hospital-district'), crown=c.territory.district('canal-west');
    assert.equal(classifyHuntingFacts(quiet(estate)).classification,'poaching');
    assert.equal(classifyHuntingFacts(quiet(crown)).classification,'tolerated');
    assert.equal(c.huntingLaw.districtAccess(estate.id).status,'poaching');
    assert.equal(c.huntingLaw.districtAccess(crown.id).status,'open');
  });
}
test('public Crown rule has exact nonlethal, discretion and police limits',()=>{
  const c=campaign(), facts=quiet(c.territory.district('canal-west'));
  assert.equal(classifyHuntingFacts({...facts,wantedLevel:1}).classification,'tolerated');
  for(const change of [{victimAlive:false},{bodyEvidence:true},{witnessCount:1},{wantedLevel:2}]) {
    assert.equal(classifyHuntingFacts({...facts,...change}).classification,'poaching');
  }
  const permission={id:'network:rook',source:'vampire_agreement'};
  assert.equal(classifyHuntingFacts({...facts,wantedLevel:3,right:permission}).classification,'legal','signed discretion terms do not add an unstated police cutoff');
  for(const change of [{victimAlive:false},{witnessCount:1}]) assert.equal(classifyHuntingFacts({...facts,...change,right:permission}).classification,'poaching');
});
test('unclaimed ground, rats and protected people keep distinct consequences',()=>{
  const c=campaign(), d=c.territory.district('old-quarter');
  assert.equal(c.huntingLaw.districtAccess(d.id).status,'unclaimed');
  assert.equal(classifyHuntingFacts({...quiet(d),victimAlive:false}).classification,'unclaimed');
  assert.equal(classifyHuntingFacts({...quiet(d),right:{id:'general'},protection:{id:'ward'}}).classification,'protected');
  assert.equal(classifyHuntingFacts({...quiet(d),victim:{id:'rat',type:'rat'},protection:{id:'ward'}}).classification,'exempt');
});
test('one signed contact agreement is used by both the district projection and real feeding',()=>{
  const c=campaign(),v=c.vampire;
  assert.match(v.agreement('mara').reason,/Meet/);meet(v,'mara');assert.equal(v.grantAccess('mara').ok,false);
  work(v,'mara');assert.equal(v.agreement('mara').status,'offered');assert.ok(v.grantAccess('mara').ok);
  assert.equal(v.agreement('mara').status,'active');
  const access=c.huntingLaw.districtAccess('hospital-district');assert.equal(access.status,'covered');assert.equal(access.right.referenceId,'mara');
  assert.equal(feed(c).classification,'legal');
  const rights=JSON.stringify(c.state.huntingLaw.rights);v.grantAccess('mara');assert.equal(JSON.stringify(c.state.huntingLaw.rights),rights,'reopening an active agreement does not rewrite it');
  c.reputation.setFaction('first_estate',-100);assert.equal(v.agreement('mara').active,true);assert.equal(feed(c).classification,'legal');
});
test('victim-specific permissions and expired/revoked grants never cover the district',()=>{
  const c=campaign();
  c.huntingLaw.grantRight({districtId:'hospital-district',id:'one',victimIds:['only'],source:'special'});
  assert.equal(c.huntingLaw.districtAccess('hospital-district').status,'poaching');
  c.huntingLaw.grantRight({districtId:'hospital-district',id:'old',expiresAt:999});
  assert.equal(c.huntingLaw.districtAccess('hospital-district').status,'poaching');
  c.huntingLaw.grantRight({districtId:'hospital-district',id:'revoked'});c.huntingLaw.revokeRight('revoked');
  assert.equal(c.huntingLaw.districtAccess('hospital-district').status,'poaching');
});
test('bad standing prevents a new agreement, and ordinary work for an independent broker can repair it',()=>{
  const c=campaign(),v=c.vampire;meet(v,'mara');work(v,'mara');c.reputation.setFaction('first_estate',-40);
  assert.equal(v.agreement('mara').available,false);assert.match(v.grantAccess('mara').text,/Work/);
  work(v,'mara');work(v,'mara');assert.ok(v.agreement('mara').available);assert.ok(v.grantAccess('mara').ok);
});
test('unlicensed hunting remains possible and only discovery changes faction standing, exactly once',()=>{
  const c=campaign(),v=c.vampire, before=c.reputation.faction('first_estate');
  const a=feed(c,{biteEvidence:true});assert.equal(a.classification,'poaching');assert.equal(c.reputation.faction('first_estate'),before);
  c.huntingLaw.discover(a.id,{source:'witness_report'});assert.equal(c.reputation.faction('first_estate'),before-10);
  c.huntingLaw.discover(a.id,{source:'body'});v.tick(90);assert.equal(c.reputation.faction('first_estate'),before-10);
  assert.ok(Object.values(v.state.contacts).every(p=>!p.suspended),'do not blame an arbitrary unsigned patron');
});
test('quiet agreement breaches wait for discovery, then suspend the actual supplier and can be repaired with work',()=>{
  const c=campaign(),v=c.vampire;deal(c);
  const a=feed(c,{victimAlive:false,victimOutcome:'dead',bodyEvidence:true});
  assert.equal(a.classification,'poaching');assert.equal(v.contact('mara').suspended,false);
  c.huntingLaw.discover(a.id,{source:'body'});assert.equal(v.contact('mara').suspended,true);
  assert.equal(v.buyBlood('mara').ok,false);assert.equal(c.huntingLaw.districtAccess('hospital-district').status,'poaching');
  work(v,'mara');assert.equal(v.contact('mara').suspended,false);
  assert.equal(c.huntingLaw.districtAccess('hospital-district').status,'covered','one repair restores the existing agreement, no second permission click');
});
test('two contacts in the same district: punish the signer, not the first contact in a list',()=>{
  const c=campaign(),v=c.vampire;meet(v,'vesper');work(v,'vesper');deal(c,'sire');
  const a=c.huntingLaw.assessFeed({districtId:'old-quarter',victim:{id:'guest',type:'civilian'},victimAlive:false,witnessCount:1});
  assert.equal(a.permissionId,'network:sire');assert.equal(v.contact('sire').suspended,true);assert.equal(v.contact('vesper').suspended,false);
});
test('repair never invents a permit, resurrects a donor, or revives an expired/right under a new authority',()=>{
  const c=campaign(),v=c.vampire;meet(v,'mara');work(v,'mara');v.suspend('mara','Breach');work(v,'mara');
  assert.equal(c.huntingLaw.right('network:mara'),null);
  assert.ok(v.grantAccess('mara').ok);v.harmDonor('donor_eli',{dead:true});v.suspend('mara','Breach');work(v,'mara');
  assert.equal(v.state.donors.donor_eli.dead,true);assert.equal(v.donate('donor_eli',90).ok,false);
  v.suspend('mara','Breach');c.territory.setInfluence('hospital-district','first_estate',0);c.territory.setInfluence('hospital-district','gutter_crown',90);
  work(v,'mara');assert.ok(c.huntingLaw.right('network:mara').revokedAt);assert.equal(v.agreement('mara').status,'displaced');
});
test('a broker cannot reissue the other faction\'s promise, and investment must not charge for it',()=>{
  const c=campaign(),v=c.vampire;deal(c,'rook');
  c.territory.setInfluence('canal-west','gutter_crown',0);c.territory.setInfluence('canal-west','first_estate',90);
  c.wallet.credit(3000);const cash=c.wallet.balance();
  assert.equal(v.agreement('rook').active,false);assert.equal(v.grantAccess('rook').ok,false);assert.equal(v.invest('depot').ok,false);assert.equal(c.wallet.balance(),cash);
});
test('business ownership and its economic policies do not conquer the district',()=>{
  const c=campaign(),v=c.vampire;meet(v,'mara');work(v,'mara');c.wallet.credit(5000);
  const before=JSON.stringify(c.state.territory);v.invest('supply');v.invest('supply');
  assert.equal(v.agreement('mara').active,true);
  assert.equal(JSON.stringify(c.state.territory),before);
  const cash=c.wallet.balance();v.tick(90);assert.equal(c.wallet.balance()-cash,260);assert.equal(v.state.assets.supply.reserve,3);
  v.setPolicy('supply','open');const next=c.wallet.balance();v.tick(90);assert.equal(c.wallet.balance()-next,390);assert.equal(v.state.assets.supply.reserve,5);
});
test('existing saves keep rights, donors, jobs, money and one-time consequences across import',()=>{
  const c=campaign(),v=c.vampire;deal(c);v.donate('donor_eli',90);v.acceptDelivery('mara');
  const saved=c.export(), restored=campaign();restored.import(saved,{persist:false});
  assert.equal(restored.vampire.agreement('mara').active,true);assert.deepEqual(restored.vampire.state.job,v.state.job);
  assert.equal(restored.wallet.balance(),c.wallet.balance());assert.deepEqual(restored.vampire.state.donors,v.state.donors);
  assert.deepEqual(restored.state.huntingLaw.rights,c.state.huntingLaw.rights);
  const a=feed(restored,{witnessCount:1});const rep=restored.reputation.faction('first_estate');
  const again=campaign();again.import(restored.export(),{persist:false});again.huntingLaw.discover(a.id,{source:'again'});again.vampire.tick(2);
  assert.equal(again.reputation.faction('first_estate'),rep);
});
test('protected people do not lose their patron when another authority supplies a permit',()=>{
  const c=campaign(),v=c.vampire;deal(c);
  c.huntingLaw.grantRight({id:'prince:hospital-district',districtId:'hospital-district',source:'prince_compact',grantedAt:2000});
  c.huntingLaw.protectVictim({victimId:'protected-donor',contactId:'mara'});
  const a=feed(c,{victim:{id:'protected-donor',type:'civilian'}});
  assert.equal(a.permissionSource,'prince_compact');assert.equal(a.classification,'protected');assert.equal(v.contact('mara').suspended,true);
});
test('expiry is not a broken agreement that an errand can revive',()=>{
  const c=campaign(),v=c.vampire;deal(c);
  const right=c.huntingLaw.right('network:mara');c.huntingLaw.grantRight({...right,expiresAt:999});
  v.suspend('mara','Breach');work(v,'mara');assert.ok(c.huntingLaw.right('network:mara').revokedAt);
  assert.equal(v.agreement('mara').active,false);
});

// Old saves may carry an existing network identifier without the newer source tag.
test('legacy network rights keep the same terms, named broker and discovery consequence',()=>{
  const c=campaign(),v=c.vampire;deal(c);
  const right=c.huntingLaw.right('network:mara');
  c.huntingLaw.grantRight({...right,source:'unknown',referenceId:null});
  const access=c.huntingLaw.districtAccess('hospital-district');
  assert.match(access.terms,/Leave victims alive/);
  const a=feed(c,{victimAlive:false,witnessCount:1});
  assert.equal(a.classification,'poaching');assert.equal(v.contact('mara').suspended,true);
});
test('exempt animal feeding cannot suspend a contact through incidental protection metadata',()=>{
  const c=campaign(),v=c.vampire;deal(c);
  const rep=c.reputation.faction('first_estate');
  const a=feed(c,{victim:{id:'rat',type:'rat',protectedByContactId:'mara'},victimAlive:false,witnessCount:1});
  assert.equal(a.classification,'exempt');assert.equal(v.contact('mara').suspended,false);
  assert.equal(c.reputation.faction('first_estate'),rep);
});
test('a valid older grant is honoured even when the broker could not negotiate a new one',()=>{
  const c=campaign(),v=c.vampire;deal(c,'rook');
  c.territory.setInfluence('canal-west','gutter_crown',0);c.territory.setInfluence('canal-west','first_estate',90);
  c.huntingLaw.grantRight({id:'network:rook',districtId:'canal-west',factionId:'first_estate',source:'vampire_agreement',referenceId:'rook'});
  assert.equal(v.agreement('rook').active,true);assert.equal(v.agreement('rook').reason,'');
  assert.equal(v.grantAccess('rook').ok,true);
});
