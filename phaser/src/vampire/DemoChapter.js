import { VAMPIRE_ASSETS, VAMPIRE_RULES, contactById, assetById } from './VampireCatalog.js';

// Presentation and authored content for the public playtest, not a second quest
// runner. Progress is derived solely from the existing campaign's jobs/assets.
export const DEMO_CHAPTER = Object.freeze({ title: 'A foothold', assetId: 'club', contactId: 'vesper', jobs: 3 });
export const DEMO_DELIVERIES = Object.freeze([
  Object.freeze({ id: 'vesper:house-guests', issuer: 'vesper', title: 'House guests',
    pickup: 'hospital', delivery: 'saintOrisonHotel',
    briefing: 'The hotel has guests who cannot order from room service. Collect their sealed supply at the hospital and leave it at Saint Orison. Vesper is watching how you handle yourself.' }),
  Object.freeze({ id: 'vesper:after-hours', issuer: 'vesper', title: 'After hours',
    pickup: 'marketBlock', delivery: 'club',
    briefing: 'A supplier at West Market has a package for the private rooms. Bring it to the club. The streets are yours to cross; how much trouble you attract is up to you.' }),
  Object.freeze({ id: 'vesper:return-favour', issuer: 'vesper', title: 'A favour returned',
    pickup: 'warehouse', delivery: 'hospital',
    briefing: 'The hospital kept the club supplied. Collect the replacement stock at the canal warehouse and take it back. Finish this third favour and Vesper will sell you a stake in the rooms.' })
]);
export function demoRoute(id, issuer) {
  return DEMO_DELIVERIES.find(route => route.id === id && route.issuer === issuer) || null;
}
export function deliveryOffer(issuer, completed = 0) {
  const def = contactById(issuer);
  if (!def) return null;
  const route = issuer === 'vesper' ? DEMO_DELIVERIES[Math.min(DEMO_DELIVERIES.length - 1, Math.max(0, Math.floor(completed)))] : null;
  return { ...def, ...route, id: def.id, routeId: route?.id || null };
}
export function activeDelivery(job) {
  const def = contactById(job?.issuer);
  if (!def) return null;
  // An old in-flight delivery always keeps the old endpoints; never infer a
  // new route from mutable job counters after loading a save.
  const route = demoRoute(job.routeId, job.issuer);
  return { ...def, ...route, id: def.id, routeId: route?.id || null };
}
export function firstBusiness(state) {
  return VAMPIRE_ASSETS.find(asset => state.assets[asset.id]?.level > 0) || null;
}
export function demoInvestmentBlocker(service, assetId) {
  if (assetId !== DEMO_CHAPTER.assetId || service.state.assets[assetId]?.level > 0) return '';
  const done = service.contact(DEMO_CHAPTER.contactId).jobs;
  return done < DEMO_CHAPTER.jobs ? `Finish ${DEMO_CHAPTER.jobs} errands for Vesper first (${done}/${DEMO_CHAPTER.jobs}).` : '';
}
export function demoChapter(service) {
  const state = service.state, owned = firstBusiness(state), club = assetById(DEMO_CHAPTER.assetId);
  const sire = service.contact('sire'), vesper = service.contact('vesper');
  const cash = service.wallet.balance(), agreement = service.agreement('vesper');
  const totalDebt = Object.values(state.contacts).reduce((sum, person) => sum + person.debt, 0);
  const jobs = Math.min(DEMO_CHAPTER.jobs, vesper.jobs);
  let next;
  if (owned) next = { text: 'Your first foothold', target: `asset:${owned.id}`, why: `${owned.name} is yours. Visit your operation, or keep exploring the city.` };
  else if (!sire.met && !vesper.met) next = { text: 'Meet The Sire', target: 'contact:sire', why: 'He can offer blood, startup cash and your first paid errand. Earn an introduction to Vesper.' };
  else if (!vesper.met && !service.contactAccess('vesper').available) {
    next = !sire.jobs ? { text: 'Work for The Sire', target: 'contact:sire', why: 'Complete a supply delivery to earn an introduction to Vesper.' }
      : { text: "Settle The Sire's debt", target: 'contact:sire', why: `You owe $${sire.debt}. Pay him directly or take another delivery; earnings repay the debt first.` };
  } else if (!vesper.met) next = { text: 'Meet Vesper Vale', target: 'contact:vesper', why: `She runs the club. Three errands and $${club.price} can buy your first stake.` };
  else if (vesper.suspended) next = { text: 'Make amends with Vesper', target: 'contact:vesper', why: `Complete an errand or pay $${VAMPIRE_RULES.repairCost} to repair the agreement.` };
  else if (jobs < DEMO_CHAPTER.jobs) next = { text: deliveryOffer('vesper', vesper.jobs).title, target: 'contact:vesper', why: `Ask Vesper for the next errand. ${jobs}/${DEMO_CHAPTER.jobs} favours delivered; the club stake costs $${club.price}.` };
  else if (vesper.debt) next = { text: "Settle Vesper's debt", target: 'contact:vesper', why: `You owe $${vesper.debt}. Pay directly or work it off before investing.` };
  else if (!agreement.active && !agreement.available) next = { text: 'Restore Vesper\'s backing', target: 'contact:vesper', why: agreement.reason };
  else if (cash < club.price) next = { text: 'Earn the rest of your stake', target: 'contact:vesper', why: `$${cash}/$${club.price}. More paid work is available. Keep enough blood to get there.` };
  else next = { text: 'Buy your stake in the club', target: 'asset:club', why: `You have $${cash}. Meet Vesper at the club and invest $${club.price}; the operation then earns $${club.income} every ${VAMPIRE_RULES.businessPeriod} seconds of play.` };
  return { ...DEMO_CHAPTER, completed: Boolean(owned), ownedId: owned?.id || null,
    assetName: owned?.name || club.name, price: club.price, cash, jobs,
    jobsRequired: DEMO_CHAPTER.jobs, totalDebt, next };
}
export function demoStage(state) {
  if (firstBusiness(state)) return 'Investor';
  return state.contacts.vesper?.met ? 'Connected' : 'Survivor';
}
