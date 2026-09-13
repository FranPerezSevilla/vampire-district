// Display only: no inference from a portrait, job, district authority or patron.
export const FACTION_IDENTITIES = Object.freeze({
  first_estate: Object.freeze({ label: 'First Estate', seal: 'estate', ink: '#82364e', light: '#ecc1ce' }),
  gutter_crown: Object.freeze({ label: 'Gutter Crown', seal: 'crown', ink: '#956a2e', light: '#efd2a1' }),
  independent: Object.freeze({ label: 'Independent', seal: 'house', ink: '#61717d', light: '#cbd6dc' }),
  unaligned: Object.freeze({ label: 'Unaffiliated', seal: 'unbound', ink: '#55515b', light: '#d5cdd9' }),
  unknown: Object.freeze({ label: 'Unrecorded', seal: 'unknown', ink: '#55515b', light: '#d5cdd9' })
});
export const NATURE_IDENTITIES = Object.freeze({
  vampire: 'Vampire', human: 'Human', retainer: 'Retainer', unknown: 'Unknown'
});
export const ALL_PEOPLE = Object.freeze({ nature: 'all', faction: 'all' });
export function personIdentity(person = {}) {
  const nature = Object.hasOwn(NATURE_IDENTITIES, person.nature) ? person.nature : 'unknown';
  const faction = ['first_estate', 'gutter_crown'].includes(person.factionId) ? person.factionId
    : !person.factionId && ['independent', 'unaligned'].includes(person.affiliation) ? person.affiliation : 'unknown';
  return { nature, natureLabel: NATURE_IDENTITIES[nature], faction, ...FACTION_IDENTITIES[faction] };
}
export function identityAttributes(person) {
  const identity = personIdentity(person);
  return { 'data-faction': identity.faction, 'data-nature': identity.nature,
    style: { '--person-ink': identity.ink, '--person-light': identity.light } };
}
export function peopleFiles(model) {
  return [...(model.contacts || []).map(person => ({ person, kind: 'contact', target: `contact:${person.id}` })),
    ...(model.herd || []).map(person => ({ person, kind: 'donor', target: `donor:${person.id}` }))];
}
export function matchingPeople(files, filter = ALL_PEOPLE) {
  return files.filter(file => {
    const identity = personIdentity(file.person);
    return (filter.nature === 'all' || identity.nature === filter.nature)
      && (filter.faction === 'all' || identity.faction === filter.faction);
  });
}
