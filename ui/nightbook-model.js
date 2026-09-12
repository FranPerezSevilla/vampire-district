// Read-only editorial helpers. No saved state, transactions or game rules here.
export const BOOK_CHAPTERS = Object.freeze([
  { id: 'tonight', label: 'Tonight', question: 'What do I do next?', icon: 'moon' },
  { id: 'city', label: 'City', question: 'Whose streets are these?', icon: 'city' },
  { id: 'network', label: 'Network', question: 'Who can open doors?', icon: 'people' },
  { id: 'feeding', label: 'Feeding', question: 'Where is my next blood?', icon: 'blood' },
  { id: 'ledger', label: 'Ledger', question: 'What do I own & owe?', icon: 'brief' }
]);
export const money = value => `$${Math.round(Number(value) || 0).toLocaleString('en-US')}`;
export const districtName = (model, id) => model.districts.find(d => d.id === id)?.name || 'City location';
export const distanceTo = (player, destination) => destination && Number.isFinite(destination.x) && Number.isFinite(destination.y)
  ? Math.round(Math.hypot(destination.x - player.x, destination.y - player.y)) : null;
export function bookSummary(model) {
  const ready = model.herd.filter(p => p.ready && !p.dead)
    .slice().sort((a, b) => (distanceTo(model.player, a.destination) ?? Infinity) - (distanceTo(model.player, b.destination) ?? Infinity));
  return { ready, known: model.contacts.filter(p => p.met).length,
    suspended: model.contacts.filter(p => p.suspended).length,
    permitted: model.districts.filter(d => d.permitted).length,
    stored: model.assets.filter(a => a.level && !a.suspended && a.reserve > 0),
    owned: model.assets.filter(a => a.level > 0).length,
    district: model.districts.find(d => model.player.x >= d.x && model.player.x <= d.x+d.w && model.player.y >= d.y && model.player.y <= d.y+d.h) || null };
}
export function contactState(person) {
  if (person.suspended) return { label: 'Agreement suspended', tone: 'danger' };
  if (!person.met) return { label: person.available ? 'Ready to meet' : 'Introduction needed', tone: 'neutral' };
  return { label: person.endorsed ? 'Backing your claim' : 'Known contact', tone: 'good' };
}
export function recommendationFile(target) {
  if (String(target).startsWith('contact:')) return { tab: 'network', target };
  if (String(target).startsWith('donor:')) return { tab: 'feeding', target };
  if (String(target).startsWith('asset:')) return { tab: 'ledger', target };
  return { tab: 'city', target };
}
