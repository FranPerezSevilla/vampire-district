# M6 — Grounding and shadow consistency

Branch: `agent/city-noir-atmosphere`  
Initiative: `city-noir-atmosphere`  
Depends on: completed M5 grime/service dressing and the existing building/character/vehicle presentation authorities.

## Goal

Improve the sense that moving/placed objects sit on the same ground plane without creating a second lighting model, rewriting the approved building shadow language, or making dark gameplay areas harder to read.

M6 is presentation-only. Shadows must not affect collision, AI, stealth, visibility, Heat, traffic, missions or pathfinding.

## M6.1 — shadow-language audit — complete

The audit was performed against the current branch after M5 closed. No runtime shadow code was changed in M6.1.

### Building authority — already strong; locked

`phaser/src/rendering/buildings/BuildingPresentationPolishRenderer.js` already owns the approved PR #63 building depth/shadow grammar:

- layered rectangular shadows with several small directional offsets;
- equivalent layered polygon/circle shadows;
- roof/parapet directional shade;
- raised roof volumes with explicit shadow/depth faces;
- building-family depth integrated into the existing building presentation plan.

**Decision:** do not add a city-atmosphere building shadow overlay and do not rewrite PR #63 shadow primitives. Buildings are not the M6 grounding deficit.

### Character authority — contact grounding already exists

`phaser/src/rendering/ModularCharacterView.js` creates one presentation-only contact ellipse inside each modular character root:

- black ellipse;
- alpha approximately `0.27`;
- width tied to shoulder width;
- shallow footprint under the feet/body core;
- part of the character view, not gameplay state.

This already provides a consistent contact cue for player, civilians and police while preserving pure overhead readability.

**Decision:** keep the existing character shadow language. Do not stack another atmosphere shadow under characters in M6.2.

### Vehicle authority — real remaining deficit

`phaser/src/vehicles/VehicleView.js` currently starts each vehicle with a subtle dark underlay rectangle (`0x070a11`, alpha `0.20`) at nearly the same body footprint.

That underlay helps separate the procedural body from asphalt, but because it is almost coincident with the body it reads more like body depth/outline than a soft ground contact shadow. Vehicles are visually larger than characters and move across wet/dark surfaces, so this is the clearest remaining grounding inconsistency.

**Decision:** M6.2 should target **vehicles only** with one cheap presentation-only contact-shadow primitive, keeping `VehicleView` as the vehicle presentation authority.

### Street props — secondary, not first target

`phaser/src/systems/StreetFurnitureSystemCore.js` paints gameplay dumpsters as body/lid/wheels/label inside the existing prop container and does not currently add a separate ground shadow.

Dumpsters are sparse and gameplay-authoritative objects. Any future grounding adjustment must be a visual child of the existing prop renderer and must never create a duplicate prop or alter hit/collision/broken/body-containment state.

**Decision:** record this as a possible M6.3 follow-up only if gameplay-scale review still shows a meaningful floating-prop problem after vehicle grounding. Do not combine it with M6.2.

## M6.2 — next bounded task: vehicle contact shadow

Do not implement this task until the user authorizes the next bounded task.

### Authority

- existing `VehicleView` remains sole vehicle visual authority;
- no new vehicle entity/container/system;
- no lighting/gameplay state;
- no dependency on M3 practical-light intensity.

### Intended visual primitive

One small soft/low-contrast footprint beneath each vehicle, for example:

- shallow ellipse or similarly cheap overhead shape;
- slight consistent south/east bias compatible with the existing building shadow direction;
- dimensions derived from current archetype width/height;
- alpha kept below body/road-navigation contrast;
- same primitive for civilian and police cars, with size derived from archetype only;
- rotates/moves naturally with the existing vehicle container rather than creating a per-frame world scan.

The existing same-footprint underlay may be reduced/retained only as needed to avoid double-darkening; do not broadly restyle vehicle bodies.

### M6.2 focused acceptance

Add focused tests protecting:

- exactly one contact-shadow element per vehicle view;
- dimensions remain bounded relative to archetype footprint;
- alpha remains restrained;
- presentation creation does not mutate vehicle/archetype data;
- police/civilian styles use the same grounding rule;
- no gameplay state or collision authority is introduced.

Gameplay-scale evidence should include:

- ordinary civilian traffic on dark asphalt;
- at least one larger vehicle (SUV/van);
- police vehicle on a wet/lighted road;
- dark control showing the shadow does not swallow wheels/body silhouette.

## M6.3 — optional local prop grounding

Only if M6.2 review shows the remaining inconsistency is meaningful, consider a tiny existing-renderer shadow for selected street props such as dumpsters.

Rules:

- no duplicate prop entities;
- presentation child only;
- broken/intact state stays owned by `StreetFurnitureSystem`;
- no collision/interaction changes;
- one family at a time.

## M6 exit

M6 closes only when:

- moving vehicles feel seated on the ground plane;
- existing building shadow grammar remains intact;
- character readability remains intact;
- pure top-down language is preserved;
- any prop adjustment is proven necessary rather than added by default;
- affected validation is green.

## Current checkpoint

M6.1 is complete as a read-only authority audit. The next task is M6.2 vehicle contact shadow, but the current user-approved batch ends here. Report/document this checkpoint and wait for a new user instruction before implementing M6.2.
