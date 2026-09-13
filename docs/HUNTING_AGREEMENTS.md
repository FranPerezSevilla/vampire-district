# City gameplay: personal hunting agreements

## Goal / authority
The user approved simplifying reception, hunting rights and control into a legible
relationship -> agreement -> investment progression. HuntingLawSystem remains the
sole classifier and permission store; VampireSystem owns personal negotiation and
breach consequences; TerritorySystem owns factions, not player property. The UI
projects these facts and uses the existing in-person/queued command boundary.

## Scope
HuntingLawModel/System, VampireSystem/catalog/runtime/domain projections,
TerritoryRuntime announcements, Black Book City/Contacts/Blood/Accounts and focused
native/DOM/compiled tests. No new simulation, input or save owner.

## Rules
- Faction reputation never silently grants a hunting permit. First Estate requires
  an agreement. Gutter Crown openly tolerates quiet, nonlethal hunting while the
  police search is at most level 1, regardless of reputation. Contested/unclaimed
  territory has no consolidated authority; protected people are still protected.
- Known poaching costs 10 faction reputation; harming protected prey costs 20.
  A personal suspension still carries its existing contact-trust loss. Low faction
  standing blocks new negotiation, not an existing valid grant. Work for a broker
  (including independent Mara) can restore that standing; no permanent dead end.
- Negotiated coverage is an explicit personal hunting agreement with named broker,
  district, requirements and terms. Existing network rights remain the stored
  record, including suspension and revocation. Relationship unlocks negotiation;
  signed coverage does not disappear just because a reputation threshold changes.
- Personal agreements require discreet, nonlethal feeding. A discovered breach is
  charged to the actual agreement's broker, not the first contact in the district.
  No witness/evidence discovery means no omniscient personal punishment.
- Repair settles the breach and restores that same revoked agreement when the
  issuing authority still applies; it does not create an unsigned agreement or
  reset a dead donor. Donor consent, police and exposure remain independent.
- Investment is ownership of an operation, not sovereignty over its district.
  Its hunting agreement is explicit in the investment offer, never a hidden perk.
  Changing business policy retains the existing cash/supply tradeoff.
- City has one actionable hunting status and an optional Authorities view, not a
  third Reception layer. It names the broker or the applicable public rule.
  Contacts shows personal trust; Accounts shows actual holdings.

## Non-goals
Boot, audio, camera, styling overhaul, portraits, geometry, traffic, save reset,
new faction-war AI and a new Prince government simulation. The existing city
compact and owned-business policy powers remain; faction maps are not recoloured
as if a business purchase conquered a district. Do not merge PRs or change main.

## Acceptance / validation
Cover both factions at low/high reputation; signed/unsigned/open/unclaimed and
protected prey; lethal/public breach discovery and correct broker; repair and
ownership changes; old-save round trip; agreements in UI with real commands,
tracking unchanged on inspection and meaningful owned-business policies.
Run check:fast, affected plan, native affected checks, production build/package
and compiled UI smoke. Browser execution remains excluded by the standing user
instruction; report that limitation separately from rules/delivery verification.
Publish exact green source plus CI outputs through the authorized Pages branch.
