# First-business playtest chapter: A foothold

## Goal
A readable short playtest: survive, earn an introduction, work for Vesper and buy
your first stake in a business. No player-facing Prince claim or endorsement.
Target: roughly 20–35 minutes for a new player. This is a pacing hypothesis, not
a measured average, and there is no minimum-time gate or forced waiting.

## In scope / authority
VampireSystem remains the single owner of jobs, cash, trust and purchases. A pure
DemoChapter projection reads those records; no extra quest/save/input owner or
second update loop. Files: DemoChapter, VampireSystem/State/Runtime/Catalog,
VampireDomainModel, Domain.jsx, nightbook-model, focused tests and this note.

## Acceptance
- Tonight always gives one next playable step towards a first business; an active
  errand takes priority. The long goal remains visible while travelling/working.
- Three Vesper errands have named briefings and different existing-city routes.
  The first club stake requires three completed Vesper jobs, trust 15, $600 and
  the same intact agreement/negotiation conditions as before. These requirements
  are shown before accepting/investing, never charged on failure.
- New jobs latch a validated route ID into the existing job record. Saved legacy
  cargo with no route ID keeps its original endpoints and pay; retries, deaths
  and reloads cannot skip a job, change cargo or duplicate payment.
- First investment yields a once-only completion notice and opens Tonight using
  the existing interaction boundary. An already-owned operation counts in old
  saves. Ending does not reset, freeze or close the city; income works and the
  player can keep exploring. No repeated completion popup after reload/upgrade.
- Remove Prince/support menus and public long-game requirements, not old saves.
  Internal late-game service methods are retained for future chapters, not offered.
- Preserve approved title, contact identities/portraits, controls, audio, fast
  startup, city geometry, police and donor/hunting rules.

## Pacing / economy
From $0 with no advance, one Sire job ($180) and three Vesper jobs ($230 each)
produce $870 gross: $600 stake plus $270 for survival/repairs. Taking the Sire's
optional $150/two-bag advance incurs $200 debt, giving $820 after the same four
jobs and debt settlement ($220 after purchase). Debt may be paid directly or
worked off; extra free-to-accept deliveries remain available after setbacks.
No arbitrary survival timer, mandatory crime, new combat system or extra currency.
A faster knowledgeable route is allowed. Measure first-completion time with human
playtests before claiming a mean of thirty minutes.

## Validation / delivery
Run check:fast, affected plan against origin/main, focused service/UI regressions,
production build, packed-assets verification and compiled UI smoke. The standing
no-browser restriction remains; native/DOM tests are not visual or timing proof.
Publish exact green source + CI assets to the existing Pages branch; no PR merge
or main update. Temporary source-export workflow is isolated and retired.
