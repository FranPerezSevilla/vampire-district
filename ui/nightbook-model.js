// Read-only editorial helpers. Route IDs are intentionally stable across renames.
import { DOMAIN_LABELS } from "../phaser/src/vampire/DomainNavigation.js";
export const BOOK_CHAPTERS = Object.freeze([
  { id: 'tonight', label: DOMAIN_LABELS.tonight, icon: 'moon' },
  { id: 'city', label: DOMAIN_LABELS.city, icon: 'city' },
  { id: 'network', label: DOMAIN_LABELS.network, icon: 'people' },
  { id: 'feeding', label: DOMAIN_LABELS.feeding, icon: 'blood' },
  { id: 'ledger', label: DOMAIN_LABELS.ledger, icon: 'brief' }
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
