# Black Book: readable contact identities

## Goal and authority
Distinguish faction affiliation from vampire/human nature without recolouring the
whole card, changing portraits or adding gameplay rules. VampireCatalog is the
narrative identity authority; existing VampireDomainModel projections carry its
fields. World actor creation and docs/VAMPIRE_CITY_POWER.md establish four vampire
negotiators and two human donors. Existing factionId remains authoritative: Sire
and Vesper are First Estate, Rook is Gutter Crown, Mara is an independent House.
Iris and Eli have no recorded faction membership. Patronage is not membership.

## Scope
Catalog display fields; pure identity/filter helpers; shared badges and portrait
frames; Contacts directory/dossiers, Blood donor cards and City people previews;
scoped CSS and existing native/installed-policy/compiled-UI tests.

## Behaviour
Faction uses a narrow ink strip, a distinctive seal and a readable name: wine for
First Estate, dirty ochre for Gutter Crown, cool grey for Independent, charcoal
for unrecorded affiliation. Nature uses its own pictogram and text, never colour
alone. Vampire frames have clipped corners; human frames remain square. Status,
selection and disabled/refused states stay independent from those identity marks.
Unknown identities remain unrecorded; they are not inferred from appearance,
portraits, district authorities or a patron. Retainer is supported as the original
setting's future term, but no current person gains that nature.

Contacts includes the existing six people; human dossiers link to their existing
Blood file rather than granting new service actions. Two compact, keyboard-native
filters select nature and faction; they can combine, reset and show empty results.
Inspection/filtering never changes the tracked objective, advances time, consumes
blood or overwrites saved data. Cross-file navigation reveals its selected person.

## Non-goals
No further hunting-rule simplification in this presentation pass; no new faction,
character, classification mechanic, portrait illustration, external font/image,
loop, save owner, input reader, boot/camera/audio change, main update or PR merge.
No new runtime dependency or asset request. Existing portraits remain intact.

## Acceptance / validation
Assert canonical identities against real actors, no inferred donor affiliation,
unknown fallbacks, stable record targets, paired text/icons, matching thumbnail/
dossier/Blood marks, filtering including no results and external selection, and
unchanged campaign/guide/paused state. Retain M/1–5/Escape and real donor controls.
Run check:fast and affected plan, production build/package and compiled UI smoke.
The standing no-browser instruction remains: native/jsdom/HTTP verification is not
a browser layout, WebGL, accessibility or FPS acceptance. Publish the exact green
source plus CI outputs through the authorized Pages branch.
