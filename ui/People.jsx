import { ContactPrint } from './artwork.jsx';
import { Badge, Button, Locations } from './components.jsx';
import { districtName } from './nightbook-model.js';
import { FACTION_IDENTITIES, NATURE_IDENTITIES, ALL_PEOPLE, personIdentity, identityAttributes } from './contact-identity.js';

// Decorative seals always have an adjacent text label. No borrowed clan symbols.
export function IdentityGlyph({ symbol }) {
  const paths = {
    estate: 'M3 20h18M5 17V8l7-5 7 5v9M8 10v7m4-7v7m4-7v7',
    crown: 'm3 7 4 4 5-7 5 7 4-4-3 12H6ZM7 16h10',
    house: 'm3 11 9-8 9 8M6 10v11h12V10M10 21v-6h4v6',
    unbound: 'm8 4-5 8 5 8m8-16 5 8-5 8M10 12h4',
    unknown: 'M7 4H3v4m14-4h4v4M3 16v4h4m14-4v4h-4M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1',
    vampire: 'M3 5h18M4 5l3 14 4-10h2l4 10 3-14',
    human: 'M2 12h5l3-7 4 14 3-7h5',
    retainer: 'M4 7h7v10H4ZM13 7h7v10h-7M9 12h6'
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-identity-glyph={symbol}>
    <path d={paths[symbol] || paths.unknown} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
export function IdentityLine({ person, compact = false }) {
  const identity = personIdentity(person);
  return <span className={`nb-identity-line ${compact ? 'compact' : ''}`} {...identityAttributes(person)}>
    <span className="nb-affiliation" aria-label={`Faction: ${identity.label}`}><IdentityGlyph symbol={identity.seal}/><span>{identity.label}</span></span>
    <span className="nb-nature" aria-label={`Nature: ${identity.natureLabel}`}><IdentityGlyph symbol={identity.nature}/><span>{identity.natureLabel}</span></span>
  </span>;
}
export function PersonPortrait({ person, small = false }) {
  return <span className={`nb-identity-portrait ${small ? 'small' : ''}`} {...identityAttributes(person)}>
    <ContactPrint id={person.id} small={small}/>
  </span>;
}
export function PeopleFilters({ files, value, onChange, count }) {
  const identities = files.map(file => personIdentity(file.person));
  return <div className="nb-people-filters" role="group" aria-label="Filter contact files">
    <label><span>Nature</span><select aria-label="Filter by nature" value={value.nature} onChange={event => onChange({ ...value, nature: event.target.value })}>
      <option value="all">All</option>{Object.entries(NATURE_IDENTITIES).filter(([id]) => identities.some(p => p.nature === id)).map(([id, label]) => <option key={id} value={id}>{id === 'vampire' ? 'Vampires' : id === 'human' ? 'Humans' : label}</option>)}
    </select></label>
    <label><span>Faction</span><select aria-label="Filter by faction" value={value.faction} onChange={event => onChange({ ...value, faction: event.target.value })}>
      <option value="all">All</option>{Object.entries(FACTION_IDENTITIES).filter(([id]) => identities.some(p => p.faction === id)).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
    </select></label>
    <div className="nb-filter-count"><span role="status">{count} / {files.length} files</span>{(value.nature !== 'all' || value.faction !== 'all') && <button type="button" onClick={() => onChange(ALL_PEOPLE)}>Clear filters</button>}</div>
  </div>;
}
export function DonorFile({ person, model, command }) {
  return <article className="vb-person-detail nb-human-file" {...identityAttributes(person)}>
    <div className="nb-person-head"><div className="nb-photo"><PersonPortrait person={person}/><span>PERSONAL FILE</span></div><div><span className="vb-eyebrow">Donor</span><h2>{person.name}</h2><IdentityLine person={person}/><Badge tone={person.dead || person.refused ? 'danger' : person.ready ? 'good' : 'neutral'}>{person.status}</Badge></div></div>
    <div className="nb-file-columns"><div><h3>Consent</h3><p>{person.permitted ? 'Agrees to donate' : 'No donation agreed'}</p><p>{person.reason || 'Meet in person. Allow time between donations.'}</p></div><div><h3>Introduced by</h3><Button onClick={() => command('tab', { tab: 'network', target: `contact:${person.contactId}` })}>{person.patron}</Button></div></div>
    <div className="nb-address">{districtName(model, person.districtId)}</div><Locations target={`donor:${person.id}`} command={command} disabled={person.dead}/>
    <Button onClick={() => command('tab', { tab: 'feeding', target: `donor:${person.id}` })}>Blood file</Button>
  </article>;
}
