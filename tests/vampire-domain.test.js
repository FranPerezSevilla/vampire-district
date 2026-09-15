import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { sanitizeCampaignState } from "../phaser/src/campaign/CampaignState.js";
import { VampireRuntime } from "../phaser/src/vampire/VampireRuntime.js";
import { buildDomainModel, domainDestination, clientToMapPoint, mapViewBox } from "../phaser/src/vampire/VampireDomainModel.js";
import { InteractionSystem } from "../phaser/src/systems/InteractionSystemCore.js";
import { createEmptyInputFrame } from "../phaser/src/input/actions.js";
import { buildings, CITY_WORLD } from "../phaser/src/data/district.js";
import { DOMAIN_TABS } from "../phaser/src/vampire/DomainNavigation.js";

function harness() {
  const campaign = new CampaignSystem({ autoLoad: false, autoSave: false, now: () => 1000 });
  const scene = { campaignSystem: campaign, registry: new Map(), events: new EventEmitter(), currentLayer: 0,
    player: { x: 1540, y: 1575 }, currentInputFrame: createEmptyInputFrame({ worldEnabled: true }),
    canStandAt: (x, y) => x >= 4 && y >= 4 && x <= CITY_WORLD.width - 4 && y <= CITY_WORLD.height - 4 && !buildings.some(b => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4),
    npcSystem: { npcs: [], createNpc: def => ({ ...def }), rebuildSpatialIndex() {} },
    playerDamageSystem: { state: { vitality: 100 }, isDead: () => false },
    feedingSystem: { hunger: 50, isActive: () => false, relieveHunger(amount) { this.hunger = Math.max(0, this.hunger - amount); } }
  };
  scene.interactionSystem = new InteractionSystem(scene);
  const runtime = new VampireRuntime(scene);
  scene.vampireRuntime = runtime;
  runtime.update(.01, scene.currentInputFrame);
  return { campaign, scene, runtime, v: campaign.vampire };
}
function delivery(v, id) { assert.ok(v.acceptDelivery(id).ok); assert.ok(v.handoff(v.deliverySite()).ok); assert.ok(v.handoff(v.deliverySite()).ok); }
function known(v, id) { v.contact(id).introduced = true; assert.ok(v.meet(id).ok); }

test("fresh networks enforce introductions in the service and show the actual next objective", () => {
  const h = harness();
  assert.deepEqual(buildDomainModel(h.runtime).contacts.map(c => c.available), [true, false, false, false]);
  assert.equal(h.v.meet("mara").ok, false);
  assert.equal(h.v.acceptDelivery("mara").ok, false);
  assert.equal(h.v.invest("supply").ok, false);
  h.runtime.openContact("mara");
  assert.match(h.scene.interactionSystem.menu.title, /Introduction needed/);
  assert.equal(h.scene.interactionSystem.menu.options.some(o => o.id === "work:mara"), false);
  assert.equal(h.v.contact("mara").met, false);
  h.scene.interactionSystem.close();
  h.v.meet("sire"); h.v.borrow(); delivery(h.v, "sire");
  assert.equal(h.v.contactAccess("vesper").available, false);
  assert.match(buildDomainModel(h.runtime).next.text, /Settle.*Sire/);
  delivery(h.v, "sire");
  assert.equal(h.v.contactAccess("vesper").available, true);
  assert.equal(h.v.contact("vesper").introduced, true);
  assert.equal(h.v.state.notices.filter(n => /INTRODUCTION.*Vesper/.test(n.text)).length, 1);
  h.v.meet("vesper");
  for (let n = 0; n < 3; n++) delivery(h.v, "vesper");
  assert.equal(h.v.contactAccess("rook").available, false);
  assert.ok(h.v.invest("club").ok);
  assert.equal(h.v.contactAccess("rook").available, true);
  h.v.meet("rook");
  for (let n = 0; n < 4; n++) delivery(h.v, "rook");
  assert.equal(h.v.contactAccess("mara").available, false);
  assert.ok(h.v.invest("depot").ok);
  assert.equal(h.v.contactAccess("mara").available, true);
  h.runtime.destroy();
});

test("introduced and previously met contacts survive migration without losing access", () => {
  const old = sanitizeCampaignState({ version: 6, vampire: { version: 1, contacts: { mara: { met: true, jobs: 2 } }, guide: "contact:mara" } });
  assert.equal(old.vampire.version, 2);
  assert.equal(old.vampire.contacts.mara.introduced, true);
  const h = harness();
  h.campaign.import(JSON.stringify(old), { persist: false }); h.runtime.update(.01, h.scene.currentInputFrame);
  assert.ok(h.runtime.service.meet("mara").ok);
  assert.equal(h.runtime.service.contact("mara").jobs, 2);
  assert.equal(h.runtime.guideTarget().label, "Mara Voss");
  h.runtime.destroy();
});

test("the herd and hunting map follow actual consent, recovery and hunting-law rights independently", () => {
  const h = harness(); known(h.v, "vesper"); delivery(h.v, "vesper");
  let m = buildDomainModel(h.runtime);
  assert.equal(m.herd[0].ready, true);
  assert.equal(m.districts.find(d => d.id === "old-quarter").permitted, false);
  h.v.grantAccess("vesper");
  assert.equal(buildDomainModel(h.runtime).districts.find(d => d.id === "old-quarter").permitted, true);
  h.v.donate("donor_iris", 70);
  m = buildDomainModel(h.runtime);
  assert.equal(m.herd[0].permitted, true); assert.equal(m.herd[0].ready, false); assert.match(m.herd[0].reason, /Recovering/);
  h.v.tick(240);
  assert.equal(buildDomainModel(h.runtime).herd[0].ready, true);
  h.v.harmDonor("donor_iris", {});
  assert.equal(buildDomainModel(h.runtime).herd[0].permitted, false);
  h.v.suspend("vesper", "Discovered breach");
  assert.equal(buildDomainModel(h.runtime).districts.find(d => d.id === "old-quarter").permitted, false);
  // A victim-specific grant must not paint the whole district as permitted.
  h.campaign.huntingLaw.grantRight({ id: "specific", districtId: "old-quarter", factionId: h.campaign.territory.district("old-quarter").ownerId || "first_estate", victimIds: ["only-this-person"] });
  assert.equal(buildDomainModel(h.runtime).districts.find(d => d.id === "old-quarter").permitted, false);
  h.runtime.destroy();
});

test("accepting an errand opens instructions and removes every other offer without overwriting cargo", () => {
  const h = harness(); h.runtime.openContact("sire");
  h.scene.interactionSystem.runOption(h.scene.interactionSystem.menu.options.find(o => o.id === "work:sire"));
  assert.equal(h.scene.interactionSystem.snapshot().view, "vampire-domain");
  assert.equal(h.runtime.domain.tab, "tonight");
  assert.equal(h.scene.interactionSystem.menu.index, 0);
  let e = buildDomainModel(h.runtime).errand;
  assert.equal(e.current.target, "site:hospital");
  assert.match(e.current.description, /Collect the sealed supplies outside/);
  assert.doesNotMatch(e.current.description, /Press E/);
  assert.equal(e.cash, 180);
  const original = { ...h.v.state.job };
  h.runtime.openContact("sire");
  assert.equal(h.scene.interactionSystem.menu.options.some(o => o.id.startsWith("work:") && o.id !== "work:active"), false);
  assert.equal(h.v.acceptDelivery("sire").ok, false);
  assert.deepEqual(h.v.state.job, original);
  h.v.handoff("hospital"); e = buildDomainModel(h.runtime).errand;
  assert.equal(e.collected, true); assert.equal(e.steps[0].state, "done"); assert.equal(e.current.target, "site:club");
  h.v.handoff("club");
  assert.equal(buildDomainModel(h.runtime).errand, null);
  h.runtime.openContact("sire");
  assert.ok(h.scene.interactionSystem.menu.options.some(o => o.id === "work:sire"));
  h.runtime.destroy();
});

test("errand debt breakdown stays truthful and the service applies abandonment consequences", () => {
  const h = harness(); h.v.meet("sire"); h.v.borrow(); h.runtime.acceptDelivery("sire");
  const e = buildDomainModel(h.runtime).errand;
  assert.equal(e.repaid, 180); assert.equal(e.cash, 0);
  const trust = h.v.trust("sire");
  h.v.abandonDelivery();
  assert.equal(h.v.state.job, null); assert.equal(h.v.trust("sire"), trust - 10);
  h.runtime.destroy();
});

test("saved named markers follow people, persist, remain bounded and never move or transact for the player", () => {
  const h = harness(), before = { ...h.scene.player };
  const result = h.runtime.saveMarker("donor:donor_iris");
  const id = result.marker.id;
  assert.deepEqual(h.scene.player, before); assert.equal(h.campaign.wallet.balance(), 0); assert.equal(h.v.state.job, null);
  h.runtime.people.get("donor_iris").x += 40;
  assert.equal(domainDestination(h.runtime, id).x, h.runtime.people.get("donor_iris").x);
  assert.ok(h.runtime.saveMarker("donor:donor_iris").ok); assert.equal(h.v.state.markers.length, 1);
  for (let n = 0; n < 7; n++) assert.ok(h.runtime.saveMarker(null, { x: 200 + n * 30, y: 250 }).ok);
  assert.equal(h.runtime.saveMarker(null, { x: 600, y: 800 }).ok, false);
  assert.equal(h.v.state.markers.length, 8);
  const saved = h.campaign.export(); h.campaign.import(saved, { persist: false }); h.runtime.update(.01, h.scene.currentInputFrame);
  assert.equal(h.runtime.service.state.markers.length, 8);
  assert.ok(h.runtime.guideTarget());
  const guide = h.v.state.guide;
  assert.ok(h.runtime.service.removeMarker(guide).ok);
  assert.equal(h.runtime.service.state.guide, "contact:sire");
  assert.equal(h.runtime.track("invented:place"), false);
  h.runtime.destroy();
});

test("malformed markers and guides cannot inject unknown locations or invalid map coordinates", () => {
  const state = sanitizeCampaignState({ vampire: { guide: "javascript:bad", markers: [null, { id: "marker:1", x: NaN, y: 5 }, { id: "evil", x: 1, y: 2 }, { id: "marker:2", x: 10, y: 15, target: "marker:2" }, { id: "marker:2", x: 20, y: 30 }] } });
  assert.equal(state.vampire.guide, "contact:sire"); assert.equal(state.vampire.markers.length, 1); assert.equal(state.vampire.markers[0].target, null);
});

test("map coordinates honor zoom, letterboxing and compiled city boundaries", () => {
  const view = mapViewBox({ x: CITY_WORLD.width, y: CITY_WORLD.height }, 4);
  assert.equal(view.x + view.w, CITY_WORLD.width); assert.equal(view.y + view.h, CITY_WORLD.height);
  const rect = { left: 10, top: 20, width: 800, height: 800 };
  assert.equal(clientToMapPoint({ x: 20, y: 30 }, rect, view), null);
  assert.deepEqual(clientToMapPoint({ x: 410, y: 420 }, rect, view), { x: view.x + view.w / 2, y: view.y + view.h / 2 });
  assert.equal(clientToMapPoint({ x: 0, y: 0 }, { ...rect, width: 0 }, view), null);
});

test("all domain sections keep real data and headless navigation in the existing interaction authority", () => {
  const h = harness();
  for (const label of DOMAIN_TABS) {
    h.runtime.openDomain(label.toLowerCase());
    assert.ok(buildDomainModel(h.runtime).contacts.length);
    assert.equal(h.runtime.domain.tab, label.toLowerCase());
    assert.equal(h.scene.interactionSystem.menu.options.length, 6);
  }
  const guide = h.v.state.guide;
  h.runtime.domain.navigate("city", "contact:rook");
  assert.equal(h.runtime.domain.selection, "contact:rook");
  assert.equal(h.v.state.guide, guide);
  const elapsed = h.v.state.elapsed;
  h.runtime.update(120, h.scene.currentInputFrame); assert.equal(h.v.state.elapsed, elapsed);
  h.scene.interactionSystem.updateInput(createEmptyInputFrame({ menuDigitPressed: 1 }));
  assert.equal(h.runtime.domain.tab, "tonight");
  h.scene.interactionSystem.updateInput(createEmptyInputFrame({ menuCancelPressed: true }));
  assert.equal(h.scene.interactionSystem.isOpen, false);
  h.runtime.destroy();
});

test("resource cards use actual production policy and suspended output rather than catalog promises", () => {
  const h = harness(); known(h.v, "mara");
  for (let n = 0; n < 7; n++) delivery(h.v, "mara");
  h.v.invest("supply"); h.v.invest("supply"); h.v.setPolicy("supply", "open");
  let asset = buildDomainModel(h.runtime).assets.find(a => a.id === "supply");
  assert.equal(asset.income, 390); assert.equal(asset.production, 2);
  h.v.suspend("mara", "Breach");
  asset = buildDomainModel(h.runtime).assets.find(a => a.id === "supply");
  assert.equal(asset.income, 0); assert.equal(asset.production, 0);
  h.runtime.destroy();
});
