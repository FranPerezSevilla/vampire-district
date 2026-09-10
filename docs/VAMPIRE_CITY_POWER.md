# Vampire city power

Implemented feature branch: `codex/vampire-city-power`, PR #83. The player liked the initial system and requested a structured domain/progression iteration on 2026-09-09. That iteration is implemented with native verification and awaits player review. No browser testing was performed, as requested.

## Player experience

Begin dependent on your Sire. Earn cash and trust through deliveries, negotiate blood and hunting access, invest in businesses, buy control, earn political support and become Prince of the city. The player remains physically present in the existing city; staff delegate routine production and revenue once an investment is established.

The `DOMAIN` HUD button opens six sections: **Overview, Contacts, Herd, Resources, Errand and Map**. The overview gives the next progression objective and Prince requirements. Contacts explain their services, trust, debt and introduction requirements; Herd distinguishes permitted, recovering, suspended and deceased donors; Resources shows actual output, reserves, ownership and the next investment requirement. Transactions with contacts remain in-person: walk to them and press **E**.

`MAP` opens the city view; `ERRAND` or the existing **M** shortcut opens the current job instructions. `BLOOD` consumes a carried reserve bag. The HUD independently shows the tracked destination and current errand step, so choosing another marker does not hide the job. Important agreements, debts, repayments and discovered breaches appear as notices, with action feedback also visible inside the domain panel.

### The first useful actions

1. Meet the Sire at the street frontage of the refuge building.
2. Ask for two blood bags and $150 against a $200 obligation, or start a supply delivery without borrowing.
3. Collect at the hospital frontage and deliver to the club frontage. The tracked guide changes with the handoff. Payment repays debt first.
4. Complete at least one Sire delivery and settle his debt to earn an introduction to Vesper. Without borrowing, one delivery is enough; the $200 advance requires two $180 deliveries or cash repayment.
5. Complete Vesper work and invest in the club to unlock Rook. Complete Rook work and invest in the depot to unlock Mara. At trust 15, each operator offers hunting access/investment, and Vesper/Mara provide access to their donor. Maintain discretion and keep victims alive.
6. Buy control of all three businesses, earn trust 40 and obtain each operator's endorsement. Settle all debts, bring $1200 to the Sire and claim the city compact.

## Contacts, agreements and sites

Introductions are enforced by the campaign service, not just hidden UI buttons. Approaching a locked contact explains the objectives and offers the Contacts panel. Once earned, an introduction stays earned. Previously met contacts from existing saves remain accessible, so this iteration does not take away an established network.

| Contact | Semantic site | Offers |
|---|---|---|
| The Sire | `refugeTower` | advances, deliveries, stored blood, debt repayment, recovery, Prince compact |
| Vesper Vale | `club` | deliveries, Old Quarter hunting agreement, Iris, club investment, endorsement |
| Rook Mercer | `warehouse` | deliveries, Canal West hunting agreement, depot/refuge investment, endorsement |
| Mara Voss | `hospital` | deliveries, Hospital Ward hunting agreement, Eli, blood supply, endorsement |

Contacts reuse the current character presentation. Site coordinates are derived from compiler-owned building identities and checked for walkable frontage. No city geometry or assets were added. The four named vampire negotiators are non-combat contact actors; the two human donors can be attacked, compelled and fed upon.

Deliveries are concrete operational agreements in the vampire service, not revived legacy story missions. Only one can be active. Cargo must be collected at its source and handed off at its destination through nearby world interactions. No advance payment or cash prerequisite is needed. Completion pays once, adds 15 contact trust and repairs that operator's suspended agreement. Abandonment or player death loses 10 trust and forfeits that cargo. A death rescue adds $120 of debt to the Sire.

Accepting an errand immediately opens its two-step instructions: where to collect, where to deliver, the **E** handoff action, cargo status, gross payment, cash/debt split and trust reward. All contacts replace new delivery offers with **View your current errand** until it is completed or abandoned. The service also rejects a second acceptance without replacing the existing cargo. Abandoning through the panel requires a second deliberate confirmation.

## City map and markers

The interactive SVG map uses the compiler-owned roads, buildings and fourteen district bounds. Contacts, herd, businesses, the current errand objective, saved markers and the player have map locations. Select a marker or its corresponding location button to see what it offers, its access state, district hunting permission and a direction/distance. Zoom 1×/2×/4× around the selection, locate yourself, or return to the whole-city view.

Green districts indicate an **active general civilian hunting permission** returned by `HuntingLawSystem`, including revocation, expiry and faction ownership checks. A permission for one individual does not colour the whole district green. Donor consent is displayed separately: a district permission never implies that a particular donor consents or is ready to donate.

Use **Track & return** for immediate navigation, **Save marker** to retain a named destination, or click empty map space to save a coordinate waypoint. Up to eight markers persist in the campaign; duplicate named markers are reused, and unwanted markers can be removed. Named markers follow their person's live position. The HUD and a nearby world label show the tracked destination. The map's dashed line is a bearing, not a pathfinding route; marking a destination never moves the player or performs a transaction.

The domain uses the existing interaction menu's world gate and frame input. **1–6** choose sections, **W/S or arrows then E** select a section, **Enter** activates a focused DOM button, and **7/Esc** return to the city. Hunger, business production and donor recovery pause while the panel is open. No second game loop or key listener is added. The existing mission shortcut now routes to Errand in this runtime; legacy mission fixtures retain their original drawer.

Hunting permissions use `HuntingLawSystem`. A discovered political violation, lethal feed or publicly witnessed feeding in a met operator's district can suspend their permission, production and endorsement. Hidden physical evidence does not automatically inform the operator. The player can repair through a delivery or $180 compensation, and renegotiate permission. Surviving assaulted donors remember their own harm and refuse further donations until the relationship is repaired; deceased donors stay dead. Other suppliers and zero-cost work remain available.

## Supply and investment

| Business | Investment | Buy control | Base income / 90s | Base blood / 90s |
|---|---:|---:|---:|---:|
| Club feeding rooms | $600 | $450 | $85 | 0 |
| Canal distribution depot | $800 | $600 | $115 | 1 |
| Hospital blood supply | $1000 | $750 | $130 | 2 |

Control doubles base income and adds one bag per cycle. Production advances only during active gameplay, never while paused/in a choice menu or while the application is closed. Blood reserves cap at 12 per business; the pouch caps at four. Income is automatically credited through the campaign wallet; reserve collection requires visiting the business.

Controlled businesses offer two real operating policies: reserve capacity for the network (full blood production), or sell access to other vampires (50% more income and one fewer bag per cycle). The depot investment unlocks a refuge; the depot and Sire offer recovery using one carried blood bag for up to 45 Vitality, only after losing active police attention.

Blood bags cost $80, or $60 from a trusted supplier, and relieve 35 Hunger. Consensual donations relieve 28 and require 240 seconds of active-play recovery. Assault prolongs recovery to 480 seconds and causes refusal. The player can use blood mending from DOMAIN → Resources: up to 30 Vitality for 12 Hunger, including the risk of reaching 100. Mending closes the panel so a threshold crossing cannot be bypassed by staying in a menu. Passive Vitality recovery remains in its existing damage authority.

## Hunger and the Beast

The user explicitly superseded the previous voluntary-only design. Hunger now rises at 0.04/second. Blood Sense costs 1, Come here 6 and Forget this 6; the three-power sequence costs 13 against a fresh quick bite's 14 relief. Powers retain their resistance, cooldowns and witnessed consequences.

- 85: warning to seek blood.
- 95: explicit warning that 100 causes loss of control.
- 100: involuntary frenzy, distinct from voluntary Give In.
- Frenzy overrides movement, weapon/power input, traversal and voluntary feeding release. It uses existing movement and FeedingSystem, without lateral displacement or teleportation.
- The Beast chooses nearby human prey with a walkable direct corridor. It has no knowledge of hidden targets through buildings, ignores social protection, and cannot feed on vampire contacts.
- A healthy full feed normally lowers Hunger from 100 to 66 and releases the victim unconscious. Previously bitten prey may require draining because less blood remains. Evidence, feeding outcomes and witnesses use the normal systems.
- Below 70, control returns. An unresolved episode ends after ten active seconds with fifteen seconds of exhaustion; a still-starving player can suffer another episode after 35 seconds. This bounds failed pursuit/blocked-exit cases without granting free powers at Hunger 100.
- Driving first applies the existing handbrake, then requests a normal exit only when stopped. Bus passengers request a stop. Neither action forces an unsafe teleport.
- Pause/transition/death gates remain authoritative; a power crossing 100 is reconciled before movement in the same frame.

The legacy threshold hunter no longer receives a gameplay update. Human police, witnesses, Heat and concrete Exposure remain active.

## Prince and continued play

Prince requires three controlled businesses, Vesper/Rook/Mara's support, no outstanding debt and $1200. Claiming is idempotent and grants actual hunting rights across all fourteen districts through the existing hunting-law authority. The HUD retains the title. Business policies and agreements remain playable; personal breaches can still suspend services. Existing faction district ownership is not overwritten by the title: the compact represents political recognition and hunting access, with economic control expressed by the owned businesses.

## Persistence and ownership

Campaign schema 6 adds `state.vampire`, preserving earlier wallet, territory, attention, vehicle and mission/checkpoint data. The vampire substate is now version 2, adding saved markers and permanent introductions while retaining earlier met contacts. Contacts, jobs/cargo, debts, donations, investments, policies, support, title, guide, notices, Hunger/Vitality and frenzy exhaustion survive campaign serialization. No separate localStorage owner exists. Routine simulation clocks are saved at a bounded interval; meaningful transactions and health/hunger events persist through the campaign.

`CampaignSystem.vampire` owns operations and agreements. `VampireRuntime` projects contacts, actions and feedback. `FrenzyController` filters the existing frame inside `GameplayRuntime`; it never reads keys or owns movement integration. The HUD only projects state and invokes existing interaction choices. Hidden-assessment discovery checks and HUD refresh are throttled; production has three bounded records and introduces no citywide NPC simulation.

`VampireDomainModel` is a read-only projection of those authorities; `VampireDomainPanel` renders it and dispatches UI choices. Map geometry is cached, the full model is built only for an open/invalidated panel, and the closed map does no per-frame model work. `InputSystem` consumes native button Enter edges to avoid double activation; `UIScene` routes Escape/M and blocking modal visibility through existing handlers.

## Verification and remaining scope

Native tests cover an earned ascent from zero cash, migration, handoff/cargo persistence, double-payment prevention, agreement discovery/repair, donor recovery/death, production policies, bounded resources, real feeding/evidence during frenzy, input locks, pause, blocked targets, cars, buses, world frontage and runtime rebinding.

Validation on 2026-09-09: `npm run check:fast` passed all **950 native tests** and the static browser-suite ownership check. The final focused run passed **46 tests** covering vampire progression/frenzy/world/domain, save compatibility, marker navigation, consent/permissions, the single-errand UI and existing input handling. The affected plan's native gate passed; its selected Chromium specs were deliberately not executed, in accordance with the user's instruction. The feature PR uses the same native-only CI policy.

This delivery does not implement a daytime/solar cycle, autonomous rival economies, faction combat, forensic services, Retainers or a hunter investigation. These are not prerequisites for the delivered survival-to-Prince progression. The existing traffic, buses, radio and compiled map are preserved. Review deployment advances the established `codex/traffic-junction-topology` Pages branch to this feature, retaining the existing Pages configuration and URL; it does not merge the feature into main or imply player acceptance.
