# Traffic population and circuit distribution

## Goal

More civilian traffic reaches the player's surroundings consistently across districts, while cars retain predefined broad circuits and physical driving.

## In scope

- Population authority: the existing `MacroTrafficPoliceSystem` bootstrap. Size civilian flows using compiler road length and configured district density, replacing a fixed handful of tokens per macro connection.
- Circuit allocation: a pure bootstrap policy used by `TrafficDriverRuntime` for capacity-based production populations. Compare alternative broad circuits against district/street demand and spread initial phases before first appearance. Keep supplied/manual legacy populations compatible.
- Materialization: keep the 32-slot physical pool, existing camera/road clearance and streaming ownership. Measure real eligibility and retention, rather than assuming the pool fills.
- Files: population/circuit allocation policy, macro initialization, driver integration, focused population/streaming simulations and current traffic documentation. Adjust spawn eligibility only if a measured camera-entry gap requires it.

## Out of scope

- No browser tests, player or police handling changes, generated geometry edits, second gameplay loop, visible relocation, recurring route replacement, or automatic merge.

## Acceptance

- [x] Production population grows in proportion to road capacity and is deterministic.
- [x] Recurring circuits have measured district/street coverage and a more balanced density per road length than the previous 58-car population.
- [x] Initial cars are distributed across their circuits; all later poses use the same vehicle controls and retain identity.
- [x] Native simulations use production camera/streaming/materialization rules and demonstrate a meaningful increase in nearby/visible traffic in multiple districts, with no visible spawn or new collision.
- [x] Unit, flow/recovery regressions and a bounded runtime-cost measurement pass; document remaining limits honestly.

## Validation and delivery

Use native simulations, `npm run check:fast`, and inspect `npm run check:affected:plan -- --base=origin/main`. The user explicitly excludes browser execution. PR 73 already runs native validation only in CI. Publish on the existing branch and report actual CI/Pages status; no browser playtest or automatic merge.

## Measured result

Current city population grows from 58 to 223; physical local capacity stays 32. Recurring circuits cover 414/434 directed lanes (previously 363), across 138 source roads and all 14 districts. Independent 256-point circuit sampling reduces aggregate district occupancy-fraction error from 0.42175 to 0.08636. Initial poses and routes are deterministic across camera positions, and every driver retains its predefined itinerary through the native simulations.

Three 90-second native comparisons use the real chunk stream, materializer, camera guards, macro accounting and vehicle contacts, replacing only rendering and file transport. Visible averages after a ten-second entry warmup: Old Quarter 1.17 to 2.05; Blackwater 1.28 to 12.01; North Harbor 0.81 to 6.80. No contacts, overlaps or guarded-camera spawns occurred; maximum continuous stop was 12.5 seconds. The 60-second versions are permanent native regressions.

890/890 units and static suite ownership pass; focused driver/recovery/network tests remain 17/17. The affected plan selects cumulative release-candidate coverage; browser execution is excluded by the user. Native traffic pipeline cost is 4.98–6.65 ms mean and 6.33–8.81 ms p95 on this runner, with 2.67–2.88 seconds initialization. This is not browser FPS evidence. North Harbor remains below its planned capacity share (2.41 against 5.58 cars); broad circuits and street geometry constrain the distribution. See the live PR for exact published head and CI/Pages status.
