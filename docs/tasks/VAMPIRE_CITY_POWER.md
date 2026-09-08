# Vampire city power

## Goal

Deliver a playable, persistent progression from dependent predator to Prince of the city. Player authorization on 2026-09-08 supersedes the previous voluntary-only Beast decision: Hunger 100 causes involuntary feeding frenzy. Hunters are excluded from this gameplay direction.

## Authority and scope

- `CampaignSystem` retains ownership of saves, wallet, reputation and hunting rights. A vampire service owns contacts, agreements, supply, investments, favours and recognition inside that campaign state.
- `GameplayRuntime` remains the sole frame owner. A frenzy controller filters its existing input frame and uses existing movement, vehicle braking and feeding; it must never teleport the player or add another input reader.
- Existing interaction menus, NPC presentation, city buildings and HUD carry contacts, directions, agreements and consequences. No new art/assets or city regeneration.
- Native tests exercise migration, an earned end-to-end ascent, abuse/repair of agreements, donor recovery, economic boundaries, frame locks and frenzy exits.

## Acceptance

- Hunger warnings at 85/95 and involuntary frenzy at 100; ordinary inputs cannot cancel a frenzy bite. Pause/death/vehicle/blocked-target cases stay bounded.
- Contacts are present at semantic city locations, offer actionable agreements and acknowledge rewards and breaches.
- A player starting with no cash can earn it through world deliveries, obtain blood/rights, invest, collect revenue, receive endorsements and claim the Prince title without diagnostics.
- Established businesses delegate routine production. Their resources and policies change actual supply/income/rights.
- Witness-limited consequences suspend services with explicit reasons and reachable repair paths. Donors retain injuries/recovery across saves.
- A persistent HUD guide, notices and the existing interaction menu expose the next useful action and actual relationship changes.
- Existing traffic, buses, audio and city geometry remain intact. No browser tests, including CI for this branch.

## Delivery

One feature PR for the integrated vampire progression and its required documentation, migration and native validation. Do not merge or repoint the existing Pages branch as incidental cleanup.
