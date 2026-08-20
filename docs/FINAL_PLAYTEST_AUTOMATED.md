# Final automated playtest — PR #55

_State: automated acceptance evidence assembled; subjective in-game listening/feel remains human-only._

## Authority snapshot

This report closes the automated part of the current ViceBlood playtest backlog without changing runtime or gameplay behavior.

- PR: `#55` (`audio/playtest-p0` -> `main`), intentionally open and unmerged.
- Product head before this documentation-only report: `a08dd80420989f42682b13cf23aa2afbab77f9ea`.
- `main` authority at the grouped validation checkpoint: `b0bca65a20e3aa177f6d05f8165a51b2a7315583`.
- Branch comparison at the checkpoint: **0 commits behind `main`**.
- Netlify deploy preview for the product head: **success**.
- Full Actions authority: workflow run `32325734336` (`Tests`, run 1759), conclusion **SUCCESS**.
- Performance Pass 6 is closed as **`no optimization warranted`**. The final concrete contenders are micro-costs rather than material hotspots; no runtime optimization is justified from the captured evidence.

The successful workflow run exercised:

- `unit-tests`: PASS, including the complete `tests/*.test.js` suite;
- City Compiler: PASS;
- Foundry candidate compile: PASS;
- `browser-boot`: PASS;
- `browser-campaign`: PASS;
- `browser-systems` shard 1/3: PASS;
- `browser-systems` shard 2/3: PASS;
- `browser-systems` shard 3/3: PASS.

`package.json` defines the grouped browser authority as the boot/presentation loop, the complete focused systems list, and the campaign/free-roam loop. The workflow runs all three system shards after unit success.

## Automated acceptance matrix

`AUTOMATED PASS` below means the current product contracts are covered by deterministic unit/source-level tests and/or the successful Chromium suites. It does **not** mean subjective sound balance, pacing, visual readability or driving feel have been human-approved.

### 1. Death, Vitality, mission failure and hospital recovery — AUTOMATED PASS

Evidence:

- `tests/player-damage.test.js`
  - Vitality is authoritative life;
  - Hunger alone does not kill;
  - lethal Vitality damage creates one authoritative dead state.
- `tests/death-recovery-beat.test.js`
  - death sequence is idempotent;
  - world audio attenuates before blackout;
  - blackout completes before the conventional Sire dialogue;
  - Sire dialogue remains DOM-backed above the black frame;
  - death recovery keeps advancing while normal world input is locked.
- `tests/hospital-death-recovery.test.js`
  - hospital revive is partial;
  - transient pursuit is cleared;
  - lackey + replacement owned vehicle + blood bag exist;
  - control remains locked through lackey dialogue/departure and is then restored;
  - post-hospital police grace starts when control returns;
  - blood bag auto-consumes only after the recovery intro and only inside its pickup radius.
- `tests/campaign-mission-authority.test.js`
  - `player death fails the active mission once without rewards or a blocking failure result`.

Human-only remainder: pacing of the blackout/Sire/lackey beats and whether the recovery feels appropriately punitive but not frustrating.

### 2. Vehicle destruction, progressive damage and explosion — AUTOMATED PASS

Evidence:

- `tests/vehicle-destruction.test.js`
  - zero hull enters critical state first;
  - follow-up damage explodes a critical vehicle;
  - sufficiently severe final impact may explode immediately;
  - radial explosion damage falls off to zero at the configured radius;
  - one runtime authority owns critical state, occupant death and radial damage.
- `tests/vehicle-explosion-presentation.test.js`
  - explosion produces boom/flash/pressure/smoke/debris presentation;
  - duplicate per-frame presentation is guarded;
  - `VehicleSystem` emits the authoritative explosion event once.
- `tests/playtest-feedback-polish.test.js`
  - damaged vehicles progress through smoking/burning/exploded presentation;
  - exploded wreck presentation includes the charred state and persistent smoke/fire ownership.

Human-only remainder: smoke/fire readability, explosion impact and the visual strength of the charred wreck in the live scene.

### 3. Civilian traffic, queues, junctions and avoidance — AUTOMATED PASS

Evidence:

- `tests/traffic-local-separation.test.js`
  - collision broadphase stays local;
  - vehicle footprints enforce a safety pad;
  - same-lane separation retreats the follower;
  - junction yielding remains subordinate to hard physical separation.
- `tests/traffic-junction-reservation.test.js`
  - traffic already inside a junction owns priority;
  - arrival order plus stable tie-break determines reservation;
  - granted movement has a commitment window;
  - a stalled reservation becomes recoverable after its lease;
  - separation retreats reserved traffic before the committed movement.
- `tests/playtest-feedback-polish.test.js`
  - sustained blockers can trigger conservative obstacle avoidance;
  - a civilian vehicle struck by a bullet enters the panic/escape path;
  - the production player spawn is offset away from the problematic traffic handoff crossing.
- `tests/aggressive-driving-panic.test.js`
  - civilian panic has a dedicated fleeing path without automatically creating witness reporting/Heat;
  - ordinary cornering remains below the aggressive-driving panic threshold.
- Browser authority from successful `browser-systems` shards includes:
  - `tests/browser/city-streaming-traffic.spec.js`;
  - `tests/browser/city-streaming-traffic-behavior.spec.js`;
  - `tests/browser/city-streaming-traffic-physics.spec.js`;
  - `tests/browser/city-streaming-traffic-impact.spec.js`;
  - `tests/browser/traffic-visibility-retention.spec.js`;
  - `tests/browser/vehicle-collision-softening.spec.js`.

Human-only remainder: watch several busy intersections for natural queueing, no visible stacking, believable obstacle avoidance and no new traffic deadlock/jitter.

### 4. Police navigation, pursuit and Wanted escalation — AUTOMATED PASS

Evidence:

- `tests/foot-police-pedestrian-policy.test.js`
  - normal foot-police routes and response spawns are pedestrian-valid;
  - officers that lose roadway pursuit return to pedestrian navigation before searching;
  - active visual pursuit remains free to target a player on the roadway.
- `tests/playtest-feedback-polish.test.js`
  - an officer already chasing the player and visible on screen does not depend on the facing cone to maintain pursuit.
- `tests/police-vehicle-tactics.test.js`
  - motorized response owns telegraphed ram behavior;
  - driving pursuit pressures rear quarters and uses PIT cooldown;
  - roadblocks keep a lateral escape gap;
  - Wanted 2 enables active ram/PIT pressure while roadblocks remain Wanted 3.
- `tests/police-firearms.test.js`
  - armed foot response starts at Wanted 2 and scales at Wanted 3;
  - only active chasing officers are firearm-eligible;
  - police bullets use swept collision;
  - occupied vehicles are targeted through the vehicle damage path and friendly police impacts are excluded.
- Successful Chromium coverage includes `tests/browser/motorized-police.spec.js`, `tests/browser/police-stress.spec.js` and the general systems/campaign loops.

Human-only remainder: pursuit pressure, police sidewalk discipline and whether Wanted 2/3 escalation feels readable rather than omniscient or unfair.

### 5. Visible projectiles and moving-vehicle collision — AUTOMATED PASS

Evidence:

- `tests/ballistic-projectile.test.js`
  - pistol projectiles advance visibly over time;
  - swept collision accepts a moving traffic proxy;
  - runtime uses stable civilian-traffic and motorized-police collider snapshots;
  - traffic and police vehicles receive their dedicated hit paths.
- `tests/bullet-hit-world-audio.test.js` and `tests/audio-sample-catalog.test.js`
  - real world-hit sample routing is present and browser-compatible.
- `tests/police-firearms.test.js`
  - police projectile collision targets the occupied vehicle when appropriate.

Human-only remainder: perceived tracer speed, hit readability and whether real wall/car bullet hits sound convincing in context.

### 6. Blood Sense-only perception overlays — AUTOMATED PASS

Evidence:

- `tests/playtest-feedback-polish.test.js`: `Blood Sense exclusively owns NPC and player perception overlays`.
- `tests/predator-runtime.test.js` and successful Chromium `tests/browser/predator-powers.spec.js` cover the broader Blood Sense/predator-power runtime.

Human-only remainder: visual legibility of the cones/noise overlays when Blood Sense is active and confirmation that normal gameplay stays visually clean.

### 7. Controls, pause, numeric hotkeys and upright aim — AUTOMATED PASS

Evidence:

- `tests/control-ux-shell.test.js`
  - weapon wheel stays active without the intrusive contextual wheel tutorial;
  - the DOM main menu owns a canonical controls panel;
  - Escape owns pause and H is not an alternate help shortcut.
- `tests/debug-layer-hotkeys.test.js`
  - numeric choices 1/2/3/4 remain available to menus but cannot trigger gameplay layer switching.
- `tests/combat.test.js`
  - mouse aim changes attack direction while the player body remains upright.
- Successful Chromium boot/system suites include `tests/browser/input-locks.spec.js` and general runtime/presentation coverage.

Human-only remainder: confirm the final control feel after the modular top-down character integration, especially aim/weapon direction versus fixed upright torso.

### 8. Title splash, audio gate, menu and NEW NIGHT handoff — AUTOMATED PASS

Evidence:

- `tests/main-menu-music.test.js`
  - committed browser runtime theme;
  - splash remains the autoplay gate;
  - real key/pointer/touch interaction starts the theme before menu presentation;
  - Satie attribution remains present.
- `tests/main-menu-audio-binary.test.js`
  - complete browser audio binary is present and preloaded during boot.
- `tests/main-menu.test.js`
  - normal boot routes through `MainMenuScene`;
  - one persistent DOM title surface owns first paint/runtime menu;
  - live GameScene preview remains authoritative while input/aim are frozen;
  - Options owns render quality;
  - `NEW NIGHT` returns control to the same running world without restart/blackout.
- Workflow `browser-boot` passed on the product head.

Human-only remainder: final subjective timing of splash -> keypress -> music -> menu, fade into NEW NIGHT and overall menu polish.

### 9. Car-to-wall/car collision audio, horn, skid, siren, engine and footsteps — AUTOMATED PASS for routing/binaries; HUMAN LISTENING REQUIRED

Automated evidence:

- `tests/playtest-feedback-polish.test.js`
  - car impacts against walls remain audible even when collision recovery resolves into an oblique wall slide;
  - per-contact cooldown prevents frame-repeat spam.
- `tests/vehicle-collision-audio.test.js`
  - impact-speed severity chooses `vehicleCollisionLight` vs `vehicleCollisionHeavy`;
  - world crashes use collision audio;
  - light/heavy real MP3 families are complete and registered;
  - ordinary vehicle contact stays mundane while police vehicle contact may create Heat.
- `tests/traffic-contextual-horn.test.js`
  - contextual horns require a real sustained blockage;
  - driver timing/cooldown varies deterministically;
  - horn spatial mix attenuates/pans;
  - contextual horns do not grant right-of-way or Heat.
- `tests/vehicle-horn-audio.test.js`
  - three real horn variants are valid;
  - H is the central remappable driving horn edge;
  - player horn creates no Heat.
- `tests/vehicle-skid-audio.test.js`
  - committed PCM skid loop exists and is sustained by aggressive-driving pulses.
- `tests/vehicle-audio-balance.test.js`
  - current skid level is 0.50;
  - all engine archetype profiles retain the accepted gain lift;
  - player engine presence is favored while preserving collision/siren headroom.
- `tests/audio-sample-catalog.test.js`
  - police siren loop and the sample-backed audio catalogue retain browser/runtime registrations and binary guards.
- `tests/footstep-audio.test.js`
  - all ten concrete footstep cuts pass MP3 integrity checks;
  - footsteps are driven by measured world displacement and suppressed while driving.
- `tests/feeding-narrative-mix.test.js`
  - feeding samples remain on the narrative bus;
  - feeding ducks world audio without ducking its own narrative bus.

These tests prove ownership, trigger rules, binary integrity, severity routing and numerical mix contracts. They cannot prove subjective listening quality.

Human-only remainder:

- footstep cadence/mix;
- real wall/car bullet-hit feel;
- light/heavy crash balance, including frontal and oblique wall impacts;
- horn character/level;
- skid level;
- repaired siren loop seam and mix;
- player/traffic/police engine balance;
- feeding ducking in context.

## Automated closure conclusion

The current product head has a complete green unit + City Compiler + Foundry + Chromium boot/campaign/system authority, the required post-playtest contracts are represented by focused tests, and Performance Pass 6 has been closed without unjustified optimization.

No new runtime defect was found while assembling this grouped evidence. Therefore the remaining acceptance work is intentionally **human listening/feel/visual validation**, not another autonomous feature-development pass.

## Final human validation checklist

Use the PR #55 deploy preview and perform one normal play session. Validate:

1. Splash stays at `PRESS ANY KEY TO START`; the first real interaction starts the menu theme and only then reveals the menu; NEW NIGHT fades cleanly into the already-running world.
2. Walk/run for long enough to judge footstep cadence and level; confirm no footsteps while driving.
3. Fire into walls and cars; confirm real impacts are clear without sounding oversized.
4. Drive and deliberately create light/heavy frontal and oblique wall impacts; confirm both sound, severity feels right and wall sliding does not spam repeated crashes.
5. Check horn, skid, siren and engine balance in normal traffic and police pursuit.
6. Trigger/deepen vehicle damage: smoke should appear first, then fire; an exploded vehicle should read as a dark/charred wreck and continue smoking/burning.
7. Watch multiple traffic queues/intersections; confirm no obvious stacking, disappearing-at-spawn artifact, chronic deadlock or absurd obstacle avoidance.
8. Shoot a civilian car and verify it visibly panics/tries to escape rather than calmly continuing.
9. Trigger police pursuit: an on-screen pursuing officer should keep coming even if the player leaves its facing cone; outside active pursuit, foot police should respect pedestrian space.
10. Activate/deactivate Blood Sense and confirm vision/hearing overlays appear only while Blood Sense is active.
11. Verify the vampire body remains upright while mouse aim/weapon/reticle track independently; 1/2/3/4 must not switch street/building/subterranean layers; Escape must pause.
12. Die once: judge world-audio attenuation, blackout, Sire line, hospital transition, lackey pacing/control return, blood-bag walk-over and replacement car.

If this checklist is accepted, PR #55 is ready for the user's next explicit integration decision. This report does not authorize merging and PR #55 must remain unmerged until explicitly requested.