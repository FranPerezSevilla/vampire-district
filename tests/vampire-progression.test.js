import test from "node:test";
import assert from "node:assert/strict";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { sanitizeCampaignState } from "../phaser/src/campaign/CampaignState.js";
import { VAMPIRE_ASSETS, VAMPIRE_RULES as R } from "../phaser/src/vampire/VampireCatalog.js";

function campaign() { return new CampaignSystem({ autoLoad: false, autoSave: false, now: () => 1000 }); }
function establishedContact(service, id) {
  // Supply/consequence fixtures start with an already earned introduction.
  // The full ascent above and domain tests exercise earning it through play.
  service.contact(id).introduced = true;
  assert.equal(service.meet(id).ok, true);
}
function delivery(service, id) {
  assert.equal(service.acceptDelivery(id).ok, true);
  assert.equal(service.handoff(service.deliverySite()).ok, true);
  assert.equal(service.handoff(service.deliverySite()).ok, true);
}

test("old saves gain a vampire network without losing cash, rights, vehicles or reputation", () => {
  const state = sanitizeCampaignState({ version: 5, player: { cash: 912 }, reputation: { contacts: { old_friend: 27 } }, world: { ownedVehicles: ["personal_car"], flags: { preserved: true } } });
  assert.equal(state.version, 6);
  assert.equal(state.player.cash, 912);
  assert.equal(state.reputation.contacts.old_friend, 27);
  assert.deepEqual(state.world.ownedVehicles, ["personal_car"]);
  assert.equal(state.world.flags.preserved, true);
  assert.equal(state.vampire.prince, false);
  assert.equal(state.vampire.body.hunger, null);
  assert.equal(Object.keys(state.vampire.contacts).length, 4);
});

test("a broke newcomer can earn every step to Prince using normal agreements and deliveries", () => {
  const c = campaign(), v = c.vampire;
  assert.equal(c.wallet.balance(), 0);
  v.meet("sire");
  assert.equal(v.borrow().ok, true);
  assert.equal(v.borrow().ok, false);
  assert.equal(v.state.bloodBags, 2);
  delivery(v, "sire");
  assert.equal(v.contact("sire").debt, 20);
  delivery(v, "sire");
  assert.equal(v.contact("sire").debt, 0);
  for (const def of VAMPIRE_ASSETS) {
    v.meet(def.contactId);
    delivery(v, def.contactId);
    for (let level = 0; level < 2; level++) {
      const cost = level ? Math.round(def.price * .75) : def.price;
      let attempts = 0;
      while (c.wallet.balance() < cost) { delivery(v, def.contactId); assert.ok(++attempts < 20); }
      assert.equal(v.invest(def.id).ok, true);
    }
    if (v.trust(def.contactId) < 40) delivery(v, def.contactId);
    assert.equal(v.endorse(def.contactId).ok, true);
  }
  while (c.wallet.balance() < R.princeCost) v.tick(90);
  assert.ok(v.princeRequirements().every(item => item.met));
  assert.equal(v.claimPrince().ok, true);
  const after = c.wallet.balance();
  assert.equal(v.claimPrince().ok, false);
  assert.equal(c.wallet.balance(), after);
  assert.equal(Object.keys(c.state.huntingLaw.rights).filter(id => id.startsWith("prince:")).length, 14);
  assert.ok(c.state.world.unlockedRefuges.includes("canal_depot_refuge"));
  assert.equal(v.setPolicy("supply", "open").ok, true);
  const restored = campaign();
  restored.import(c.export(), { persist: false });
  assert.equal(restored.vampire.snapshot().stage, "Prince of the city");
  assert.equal(restored.vampire.state.assets.supply.policy, "open");
  assert.equal(restored.wallet.balance(), after);
});

test("deliveries pay only at the agreed handoff and once; save/load preserves cargo and debt", () => {
  const c = campaign(), v = c.vampire;
  v.meet("sire"); v.borrow(); v.acceptDelivery("sire");
  assert.equal(v.handoff("warehouse").ok, false);
  assert.equal(v.acceptDelivery("mara").ok, false);
  v.handoff("hospital");
  const saved = c.export();
  const restored = campaign(); restored.import(saved, { persist: false });
  assert.equal(restored.vampire.deliverySite(), "club");
  assert.equal(restored.vampire.handoff("club").ok, true);
  const cash = restored.wallet.balance();
  assert.equal(restored.vampire.handoff("club").ok, false);
  assert.equal(restored.wallet.balance(), cash);
  assert.equal(restored.vampire.contact("sire").debt, 20);
});

test("blood supply respects capacity, hunger and available money", () => {
  const c = campaign(), v = c.vampire;
  establishedContact(v, "mara");
  assert.equal(v.buyBlood("mara").ok, false);
  delivery(v, "mara");
  assert.equal(v.buyBlood("mara").ok, true);
  assert.equal(v.consumeBlood(0).ok, false);
  assert.equal(v.state.bloodBags, 1);
  assert.equal(v.consumeBlood(95).relief, 35);
  assert.equal(v.consumeBlood(95).ok, false);
  assert.ok(c.wallet.balance() >= 0);
});

test("hunting breaches require discovery, suspend actual services, and remain repairable without cash", () => {
  const c = campaign(), v = c.vampire;
  establishedContact(v, "mara");
  delivery(v, "mara");
  assert.equal(v.grantAccess("mara").ok, true);
  const assessment = c.huntingLaw.assessFeed({ districtId: "hospital-district", victim: { id: "hidden-victim", type: "civilian" }, feedingDepth: "drain", victimOutcome: "dead", victimAlive: false, bodyEvidence: true, biteEvidence: true });
  v.tick(1);
  assert.equal(v.contact("mara").suspended, false);
  c.huntingLaw.discover(assessment.id, { source: "witness_report", witnessId: "witness" });
  v.tick(1);
  assert.equal(v.contact("mara").suspended, true);
  assert.ok(c.huntingLaw.right("network:mara").revokedAt > 0);
  assert.equal(v.buyBlood("mara").ok, false);
  const trust = v.trust("mara");
  v.tick(90);
  assert.equal(v.trust("mara"), trust);
  delivery(v, "mara");
  assert.equal(v.contact("mara").suspended, false);
  assert.equal(v.grantAccess("mara").ok, true);
});

test("donors recover during play, retain refusal and death, and never become infinite blood", () => {
  const c = campaign(), v = c.vampire;
  establishedContact(v, "vesper"); delivery(v, "vesper");
  assert.equal(v.donate("donor_iris", 70).ok, true);
  assert.equal(v.donate("donor_iris", 70).ok, false);
  const saved = c.export();
  const next = campaign(); next.import(saved, { persist: false });
  assert.equal(next.vampire.donate("donor_iris", 70).ok, false);
  next.vampire.tick(R.donorRecovery);
  assert.equal(next.vampire.donate("donor_iris", 70).ok, true);
  next.vampire.harmDonor("donor_iris", { depth: "full_feed" });
  next.vampire.tick(300);
  assert.equal(next.vampire.donate("donor_iris", 70).ok, false);
  delivery(next.vampire, "vesper");
  next.vampire.tick(300);
  assert.equal(next.vampire.donate("donor_iris", 70).ok, true);
  next.vampire.harmDonor("donor_iris", { dead: true });
  delivery(next.vampire, "vesper"); next.vampire.tick(300);
  assert.equal(next.vampire.donate("donor_iris", 70).ok, false);
  assert.equal(next.vampire.buyBlood("sire").ok, false); // must still meet the supplier
});

test("business control changes production and income; suspension interrupts both", () => {
  const c = campaign(), v = c.vampire;
  establishedContact(v, "mara");
  for (let i = 0; i < 7; i++) delivery(v, "mara");
  assert.equal(v.invest("supply").ok, true);
  assert.equal(v.setPolicy("supply", "open").ok, false);
  assert.equal(v.invest("supply").ok, true);
  const before = c.wallet.balance();
  v.tick(90);
  assert.equal(c.wallet.balance() - before, 260);
  assert.equal(v.state.assets.supply.reserve, 3);
  v.setPolicy("supply", "open");
  const openBefore = c.wallet.balance();
  v.tick(90);
  assert.equal(c.wallet.balance() - openBefore, 390);
  assert.equal(v.state.assets.supply.reserve, 5);
  assert.equal(v.withdrawBlood("supply").ok, true);
  assert.equal(v.state.bloodBags, 4);
  v.suspend("mara", "A reported breach");
  const suspended = c.wallet.balance(); v.tick(300);
  assert.equal(c.wallet.balance(), suspended);
  assert.equal(v.withdrawBlood("supply").ok, false);
});

test("malformed network saves are bounded and cannot invent contacts or invalid job locations", () => {
  const c = sanitizeCampaignState({ vampire: { bloodBags: 999, contacts: { imaginary: { met: true } }, assets: { supply: { level: 500, reserve: 999, policy: "bad" } }, job: { issuer: "missing", stage: "collected" }, elapsed: Infinity } });
  assert.equal(c.vampire.bloodBags, 4);
  assert.equal(c.vampire.assets.supply.level, 2);
  assert.equal(c.vampire.assets.supply.reserve, 12);
  assert.equal(c.vampire.assets.supply.policy, "discreet");
  assert.equal(c.vampire.job, null);
  assert.equal(c.vampire.elapsed, 0);
  assert.equal(c.vampire.contacts.imaginary, undefined);
});
