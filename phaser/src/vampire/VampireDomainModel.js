import { CITY_WORLD, districtZones } from "../data/district.js";
import { VAMPIRE_CONTACTS, VAMPIRE_DONORS, VAMPIRE_ASSETS, CONTACT_BENEFITS, VAMPIRE_RULES as R, contactById, donorById, assetById, powerStage } from "./VampireCatalog.js";
import { directionTo } from "./VampireWorldSites.js";

export function clampMapPoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { x: Math.max(0, Math.min(CITY_WORLD.width, point.x)), y: Math.max(0, Math.min(CITY_WORLD.height, point.y)) };
}

export function domainDestination(runtime, target) {
  const service = runtime.service;
  if (!service) return null;
  if (String(target).startsWith("marker:")) {
    const marker = service.state.markers.find(value => value.id === target);
    if (!marker) return null;
    const live = marker.target ? domainDestination(runtime, marker.target) : clampMapPoint(marker);
    return live ? { ...live, label: marker.label, target, kind: "marker" } : null;
  }
  if (target === "delivery") {
    const site = runtime.sites[service.deliverySite()];
    return site ? { ...site, target, kind: "errand", label: service.state.job.stage === "accepted" ? "Collect supplies" : "Deliver supplies" } : null;
  }
  const [kind, id] = String(target || "").split(":");
  const def = kind === "contact" ? contactById(id) : kind === "donor" ? donorById(id) : kind === "asset" ? assetById(id) : null;
  const site = runtime.sites[def?.buildingId || (kind === "site" ? id : "")];
  if (!site) return null;
  const npc = ["contact", "donor"].includes(kind) ? runtime.people.get(id) : null;
  return { ...site, ...(npc ? { x: npc.x, y: npc.y } : {}), label: def?.name || service.siteLabel(site.id), kind, target };
}

export function errandModel(runtime) {
  const service = runtime.service, job = service.state.job;
  if (!job) return null;
  const def = contactById(job.issuer), collected = job.stage === "collected";
  const repaid = Math.min(def.reward, service.contact(def.id).debt);
  const steps = [
    { title: "Collect the sealed supplies", description: `Go to ${service.siteLabel(def.pickup)}, street frontage. Press E and choose Collect sealed supplies.`, target: `site:${def.pickup}`, state: collected ? "done" : "current" },
    { title: "Deliver the cargo", description: `Go to ${service.siteLabel(def.delivery)}, street frontage. Press E and choose Deliver sealed supplies.`, target: `site:${def.delivery}`, state: collected ? "current" : "waiting" }
  ].map(step => ({ ...step, destination: domainDestination(runtime, step.target) }));
  return { issuer: def.name, issuerId: def.id, collected, steps, current: steps[collected ? 1 : 0], reward: def.reward, repaid, cash: def.reward - repaid, trust: 15,
    summary: `${collected ? "2/2 · Deliver" : "1/2 · Collect"} · ${service.siteLabel(service.deliverySite())}`, cargo: collected ? "Sealed supplies carried" : "Cargo not collected yet" };
}

// Read-only projection: permission, trust, debt, supply and unlock decisions are
// read from campaign authorities, never duplicated in UI state.
export function buildDomainModel(runtime) {
  const v = runtime.service, state = v.state;
  const destination = target => domainDestination(runtime, target);
  const contacts = VAMPIRE_CONTACTS.map(def => {
    const person = v.contact(def.id), access = v.contactAccess(def.id);
    return { ...def, ...access, ...person, trust: v.trust(def.id), benefits: CONTACT_BENEFITS[def.id], destination: destination(`contact:${def.id}`),
      status: person.suspended ? "Agreement suspended" : person.met ? "Known contact" : access.available ? "Ready to meet" : "Introduction needed" };
  });
  const herd = VAMPIRE_DONORS.map(def => {
    const donor = state.donors[def.id], patron = v.contact(def.contactId);
    const permitted = patron.met && v.trust(def.contactId) >= R.investmentTrust && !patron.suspended && !donor.refused && !donor.dead;
    const reason = v.donorAvailable(def.id);
    return { ...def, ...donor, permitted, ready: permitted && !reason, reason, patron: contactById(def.contactId).name,
      status: donor.dead ? "Deceased" : donor.refused || patron.suspended ? "Permission suspended" : !permitted ? "Agreement needed" : reason ? "Recovering" : "Donation available",
      destination: destination(`donor:${def.id}`), relief: R.donorRelief };
  });
  const assets = VAMPIRE_ASSETS.map(def => {
    const asset = state.assets[def.id], person = v.contact(def.contactId);
    const suspended = person.suspended;
    return { ...def, ...asset, suspended, operator: contactById(def.contactId).name, destination: destination(`asset:${def.id}`),
      income: asset.level && !suspended ? Math.round(def.income * asset.level * (asset.policy === "open" ? 1.5 : 1)) : 0,
      production: asset.level && !suspended ? Math.max(0, def.bags + asset.level - 1 - (asset.policy === "open" ? 1 : 0)) : 0,
      nextCost: asset.level ? Math.round(def.price * .75) : def.price,
      requirement: !v.contactAccess(def.contactId).available ? `Earn an introduction to ${contactById(def.contactId).name}` : !person.met ? `Meet ${contactById(def.contactId).name}` : suspended ? "Repair the operator's agreement" : person.debt ? `Settle $${person.debt} debt to the operator` : v.trust(def.contactId) < 15 ? `Trust ${v.trust(def.contactId)}/15 · complete work for the operator` : asset.level < 2 ? `Bring $${asset.level ? Math.round(def.price * .75) : def.price} to the operator` : "Controlled · visit the operator to change policy or collect blood" };
  });
  const districts = districtZones.map(zone => {
    const district = v.campaign.territory.district(zone.id);
    const permission = v.campaign.huntingLaw.activeRight({ districtId: zone.id, ownerId: district.ownerId, victimType: "civilian" });
    return { ...zone, ownerId: district?.ownerId || null,
      ownerLabel: district?.ownerLabel || "Independent", politicalStatus: district?.status || "unknown",
      relationship: district?.relationship || "unknown", reputation: district?.reputation ?? null,
      influence: district?.influence || {}, permitted: Boolean(permission), permissionId: permission?.id || null };
  });
  const errand = errandModel(runtime);
  let next;
  if (errand) {
    next = { text: errand.current.title, target: "delivery", why: `${errand.issuer} · ${errand.summary}. ${errand.current.description}` };
  } else {
    const unmet = contacts.find(contact => !contact.met);
    if (unmet) {
      const rule = unmet.requirements.find(rule => !rule.met);
      next = unmet.available ? { text: `Meet ${unmet.name}`, target: `contact:${unmet.id}`, why: unmet.benefits } : { text: rule.text, target: rule.target, why: `Earn an introduction to ${unmet.name}. ${unmet.benefits}` };
    } else {
      const asset = assets.find(asset => asset.level < 2);
      const supporter = contacts.find(contact => contact.id !== "sire" && !contact.endorsed);
      const debt = contacts.find(contact => contact.debt > 0);
      next = asset ? { text: `Buy control: ${asset.name}`, target: `asset:${asset.id}`, why: asset.requirement } : supporter ? { text: `Secure ${supporter.name}'s support`, target: `contact:${supporter.id}`, why: `Trust ${supporter.trust}/40 · controlled business · intact agreement · no debt` } : debt ? { text: `Settle ${debt.name}'s debt`, target: `contact:${debt.id}`, why: `$${debt.debt} outstanding` } : { text: state.prince ? "Manage your city" : "Fund and claim the city compact", target: "contact:sire", why: state.prince ? "Maintain supply, agreements and the permitted herd." : `$${v.wallet.balance()}/${R.princeCost} · visit the Sire to claim Prince` };
    }
  }
  return { stage: powerStage(state), cash: v.wallet.balance(), bags: state.bloodBags, hunger: Math.round(runtime.scene.feedingSystem.hunger), vitality: Math.round(runtime.scene.playerDamageSystem?.state?.vitality ?? 100),
    contacts, herd, assets, districts, errand, next, prince: state.prince, requirements: v.princeRequirements(),
    debt: contacts.reduce((sum, person) => sum + person.debt, 0), income: assets.reduce((sum, asset) => sum + asset.income, 0),
    markers: state.markers.map(marker => ({ ...marker, destination: destination(marker.id) })),
    guide: destination(state.guide), player: { x: runtime.scene.player.x, y: runtime.scene.player.y },
    notices: state.notices.slice(-5).reverse(), direction: target => directionTo(runtime.scene.player, target) };
}

export function mapViewBox(focus, zoom = 1) {
  const scale = Math.max(1, Math.min(4, zoom));
  const w = CITY_WORLD.width / scale, h = CITY_WORLD.height / scale;
  const point = clampMapPoint(focus) || { x: CITY_WORLD.width / 2, y: CITY_WORLD.height / 2 };
  return { x: Math.max(0, Math.min(CITY_WORLD.width - w, point.x - w / 2)), y: Math.max(0, Math.min(CITY_WORLD.height - h, point.y - h / 2)), w, h };
}

// Respect SVG's xMidYMid meet letterboxing as well as zoom, without browser-only
// matrix APIs. Clicking the letterbox never creates an out-of-city marker.
export function clientToMapPoint(client, rect, view) {
  const scale = Math.min(rect.width / view.w, rect.height / view.h);
  if (!(scale > 0)) return null;
  const x = client.x - rect.left - (rect.width - view.w * scale) / 2;
  const y = client.y - rect.top - (rect.height - view.h * scale) / 2;
  if (x < 0 || y < 0 || x > view.w * scale || y > view.h * scale) return null;
  return clampMapPoint({ x: view.x + x / scale, y: view.y + y / scale });
}
