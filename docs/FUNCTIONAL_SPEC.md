# Functional specification

_Current city/vehicle/control reconciliation: 2026-09-08. The snapshot and technical architecture own current tuning; retired mission and streetlight sections below are explicitly historical._

## 1. Experience goals

The game should feel immediate, readable and systemic:

- crossing a block should be enjoyable rather than administrative;
- mouse aim should make attacks and draining understandable;
- traversal should be one contextual action without a route menu;
- feeding should be powerful, risky and tactically useful;
- vision and hearing should create different reactions;
- NPCs should never appear to chase, report, investigate and attack at the same time;
- movement, stealth, violence, weapon choice, feeding and route choice should solve situations.

## 2. Core gameplay loop

1. Enter the persistent missionless street sandbox from the title screen.
2. Navigate on foot, drive or use public transport.
3. Read NPC vision, hearing, AI role and alert state.
4. Hunt, distract, fight or feed to manage Hunger.
5. Use cover and escape routes to control encounters.
6. Protect the Veil and manage witnesses, evidence and police pressure.
7. Return to safety, maintain vehicles and preserve campaign state.

Future authored contracts use the existing campaign framework; the old sire/journalist mission is not registered in production.

## 3. Current control scheme

| Action | Input | Behaviour |
|---|---|---|
| Move | WASD / arrows | Run by default. |
| Quiet movement | Hold Shift | Slower movement and much smaller footstep hearing radius. |
| Aim / face | Mouse | Player faces the cursor's world position. |
| Primary attack | Left mouse | Use equipped weapon in the aimed direction. |
| Weapon / radio selection | Mouse wheel | Weapons on foot; station or OFF while driving. |
| Feed | Hold right mouse | Release for Quick Bite or Full Feed, or continue to lethal Drain. |
| Traverse / handbrake | Space | Contextual traversal on foot; handbrake while driving. |
| Vehicle / bus | Enter | Enter/exit a vehicle; passenger/theft chooser near a bus. |
| Interact | E | Talk, collect, inspect and use non-traversal objects. |
| Dash | Q | Shadow Dash. |
| Whisper | R | Vampiric Whisper. |
| Blood Sense | F | Read heartbeats, wounds, feeding traces, drained bodies and learned marks through cover. |
| Give In | B | Voluntary short Beast burst: faster movement/feeding and stronger melee at Hunger/evidence cost. |
| Mission | M | Toggle mission information. |
| Horn | H | Sound the horn while driving. |
| Menu | Escape / Menu button | Pause/help or close the active UI. |
| Night Ledger | L | Open the paused faction, Heat and evidence view. |
| Dialogue | Left click / Escape | Advance one dialogue bubble. |

The tutorial control modes suppress weapon cycling until full gameplay control is restored.

## 4. Movement and stealth

### Default run

Normal WASD movement uses the fast traversal speed. Space is never a sprint modifier.

### Quiet movement

Holding Shift lowers speed and footstep pressure. Quiet movement should allow deliberate approaches without making every nearby NPC react.

| Mode | Speed multiplier | Base hearing radius |
|---|---:|---:|
| Run | 1.55 | 120 |
| Quiet | 0.72 | 42 |

Ordinary NPCs only react to running inside the short 42-unit range and ignore quiet footsteps. Police and hunters retain enhanced hearing.

Footsteps only create `WTF`/orientation when heard without a confirmed sighting. Hearing alone does not start pursuit or reporting.

## 5. Traversal

Space is exclusively physical movement between navigation layers.

Supported actions:

- rooftop jump;
- roof drop;
- fire escape up/down;
- street-to-sewer entrance;
- sewer-to-street exit;
- private shaft to the refuge.

Selection order:

1. a route already close and in the aimed direction;
2. closest valid route;
3. smallest aim angle;
4. route priority;
5. stable ID.

The highlighted route and executed route must always be the same. Space with no valid route does nothing. E never activates traversal.

## 6. Aiming and primary attacks

- Cursor coordinates are projected through the active camera.
- The last valid aim direction is retained near the player.
- A weapon-coloured indicator shows facing.
- Aim must remain correct after resizing, CSS scaling, zoom and quality changes.
- Attack direction and equipped weapon config are stored at attack start.
- One press starts one attack; holding does not damage every frame.
- UI, dialogue, transitions, hit stun and draining suppress attacks.

## 7. Weapon inventory

Starting inventory:

1. Unarmed.
2. Iron Pipe.
3. Pistol.

Mouse wheel changes exactly one owned slot per normalized step and wraps at either end. The weapon HUD always shows current name and ammunition.

### Unarmed

- melee forward arc;
- one resilience damage;
- 32-unit range;
- fast commitment;
- low sound pressure;
- unlimited use.

### Iron Pipe

- melee forward arc;
- two resilience damage;
- 42-unit range;
- slower windup/recovery;
- stronger stagger and sound;
- unlimited use.

### Pistol

- hitscan;
- three resilience damage;
- 260-unit range;
- eight rounds;
- ammunition consumed on every valid shot, including misses;
- no reload/replenishment in the current slice;
- empty attacks produce feedback but no shot, damage or noise.

## 8. Melee and hitscan rules

### Melee

- uses weapon range and half-angle;
- every NPC/prop inside the arc can be hit once;
- one shared per-attack hit set prevents duplicate damage;
- pipe and unarmed use the same target/state infrastructure.

### Hitscan

The pistol creates one ordered ray across NPC and prop candidates.

A candidate must:

- be in front of the captured direction;
- be within range;
- intersect shot width plus entity radius;
- be on the current layer;
- have clear world geometry.

The closest valid candidate along the ray wins. A nearby NPC can block a farther lamp, a lamp can block a farther NPC and buildings block both.

## 9. NPC resilience, combat state and AI state

| NPC type | Resilience |
|---|---:|
| Civilian | 3 |
| Journalist | 3 |
| Police | 4 |
| Rooftop thug | 4 |
| Hunter | 5 |

Combat state:

```text
active → staggered → downed → drained / killed
```

Resolved AI priority:

```text
inactive / dead
→ downed
→ being drained
→ staggered
→ attacking
→ chasing
→ fleeing / reporting
→ lured
→ investigating sound
→ searching
→ patrolling
→ idle
```

The resolved state must prevent contradictory behaviour:

- a downed NPC cannot move, pursue, report or attack;
- a target being drained cannot attack or flee;
- stagger pauses movement, attack and reporting;
- confirmed visual response clears heard-only `WTF`;
- dead, hidden and intercepted NPCs cannot regain lower-priority intent.

## 10. Civilian and journalist behaviour

### Confirmed visual violence

A civilian or the journalist who sees violence follows:

```text
react
→ turn toward source
→ flee toward best report point
→ report
```

Rules:

- the initial reaction is brief and readable;
- a hit during flight causes stagger and stops movement;
- the report target/reason survive stagger, so flight resumes afterward;
- downing cancels the report permanently;
- draining, killing, hiding or intercepting also prevents the report;
- the journalist follows the same rules until mission handling resolves them.

### Heard-only event

- stop briefly;
- turn toward the source;
- show `WTF`;
- do not choose a report point;
- do not begin pursuit.

Later visual confirmation may promote the response.

## 11. Police combat behaviour

Wanted/search behaviour remains level-dependent. During confirmed player contact, police use roles rather than every officer targeting the same coordinate.

### Attacker

- one eligible officer is selected deterministically;
- the officer closes to baton distance;
- only this role may start a baton telegraph;
- leadership is held for a finite window;
- after attack/recovery, another ready officer may take the next turn.

### Containment

Other officers with contact:

- receive different deterministic positions around the player;
- continue to face and contain rather than all attacking simultaneously;
- preserve soft separation;
- contribute to the existing surrounded-arrest rule.

Containment radius:

| Wanted level | Radius |
|---:|---:|
| 1 | 43 |
| 2 | 49 |
| 3 | 55 |

Search, patrol, heat investigation, reinforcements and the level-3 helicopter remain active. A police officer who only hears an event investigates; confirmed sight overrides that sound reaction.

## 12. Rooftop thug behaviour

The tutorial thug remains passive during dialogue and the sire's instruction. The first confirmed player hit makes him hostile.

| Property | Value |
|---|---:|
| Hunger damage | +8 |
| Start range | 28 |
| Hit range | 24 |
| Windup | 520 ms |
| Active | 150 ms |
| Recovery | 900 ms |
| Cooldown | 650 ms |

The long telegraph keeps the tutorial readable. He does not recover after knockdown and remains a valid right-click drain target.

## 13. Hunter behaviour

A hunter uses direct sight, prediction and memory:

- confirmed sight stores a point 54 units ahead of current player movement;
- the hunter keeps the last-known point for 6200 ms after losing sight;
- entering shadow does not cancel the chase immediately;
- while memory is valid, the hunter continues toward that point and may attack at close range;
- reaching an empty last-known point shortens the remaining search;
- after memory expires, blood tracking, route blocking and church patrol resume.

## 14. Downed recovery

Recovery is type-specific:

| NPC type | Recovery delay | Restored resilience |
|---|---:|---:|
| Civilian | Never | — |
| Journalist | Never | — |
| Rooftop thug | Never | — |
| Police | 18 s | 2 / 4 |
| Hunter | 24 s | 3 / 5 |

Recovered police/hunters first enter a short stagger. Police rejoin the search; hunters resume the hunt with refreshed memory.

Starting a drain before the timer expires prevents recovery. Completing a drain or killing the NPC prevents all later recovery.

## 15. Contextual drain

### Downed drain

- target is downed;
- within 34-unit start range;
- aimed toward;
- clear geometry;
- approach angle does not matter.

### Rear stealth drain

- target is standing and unaware;
- player is behind its facing direction;
- within range and aimed toward;
- target is not alarmed, chasing, attacking, reacting or reporting.

### Channel

- right mouse must remain held;
- movement cancels;
- taking damage cancels;
- release cancels;
- range/layer/geometry loss cancels;
- exceeding 42 units cancels;
- witnesses and hearing continue evaluating;
- target recovery is suspended during the channel.

Completion lowers Hunger and resolves the target as drained.

## 16. Player damage and Hunger

The player has no conventional health bar in the current slice.

- rooftop thug swing: Hunger +8;
- police melee: Hunger +12;
- hunter heavy strike: Hunger +20;
- hit stun: 260 ms;
- invulnerability: 720 ms;
- critical feedback: 85 Hunger;
- Beast critical pressure: 100 Hunger; control remains with the player and no automatic frenzy failure occurs.

Invulnerability prevents overlapping enemies from instantly filling Hunger. Feeding functions as recovery.

## 17. World props

Streetlight rendering, damage, darkness patches and their stealth effects are retired. Generated light records remain compiler data; they do not create a player destruction action. Current street furniture and vehicle impacts use their existing bounded physical owners. E remains a contextual interaction, not a generic destruction command.

## 18. Perception

### Vision

Confirmed sight uses facing, cone, range and layer. It promotes the appropriate response:

- police pursue/escalate and receive combat roles;
- civilians and the journalist react/report;
- hunters begin or refresh pursuit memory;
- the rooftop thug becomes hostile when directly attacked.

### Hearing

Sound uses event-specific ranges.

- heard-only NPCs stop and turn toward the source;
- `WTF` or investigate feedback appears;
- hearing alone does not pursue or report;
- later confirmed sight promotes the response and clears `WTF`.

Current sound hierarchy:

```text
quiet footsteps < punch < pipe impact < broken streetlight < gunshot
```

A gunshot emits even when it misses. Melee impact noise requires a confirmed hit.

## 19. Historical mission completion

The following is the retired journalist fixture, available only when explicitly supplied to the campaign framework. Production has zero registered missions. In that fixture, handling the journalist is not mission completion.

```text
journalist handled
  → objective becomes return to refuge
  → player reaches refuge
  → sire approval dialogue
  → player dismisses dialogue
  → mission marked complete
  → final report opens
```

The report never appears before the return objective and never precedes the sire's final dialogue.

## 20. UI and browser behaviour

- dialogue click owns input before combat;
- world-space `SPACE` marker shows selected traversal;
- target resilience appears briefly rather than permanently;
- downed state is visually obvious;
- weapon HUD shows equipped name and ammunition;
- wheel changes show an `EQUIPPED` toast;
- empty pistol uses warning feedback;
- right-click context menu is suppressed only over the game;
- wheel scrolling is suppressed only over the active game canvas while WeaponSystem owns it;
- normal scrolling remains outside the canvas;
- blur/pause/task reveal clear held and pending input;
- perception and AI-role feedback should not permanently overcrowd the screen.

## 21. Acceptance criteria for the current slice

- Aim remains accurate across supported sizes and zooms.
- Left mouse uses the equipped weapon in the aimed direction.
- Resilience counts and weapon damage are exact.
- One wheel gesture changes one slot and cannot leak through tutorial/UI locks.
- Pistol ammo decrements once and never becomes negative.
- Hitscan nearest-target and obstruction rules are deterministic.
- Overlapping enemy attacks respect invulnerability.
- Only the current police attacker begins baton attacks.
- Containment officers occupy different positions around the player.
- Visual witness reporting pauses on stagger and ends on knockdown.
- Rooftop thug retaliation is slow, readable and +8 Hunger.
- Hunter memory persists briefly after sight loss and through shadow.
- Police/hunter recovery timings and resilience are exact.
- Right mouse drains downed targets and unaware rear targets only.
- Taking damage raises Hunger.
- WASD runs without a modifier.
- Shift is measurably slower and quieter.
- Space performs traversal on foot and handbrake control while driving.
- E never performs traversal, draining or streetlight destruction.
- Nearby traversal conflicts resolve deterministically.
- Hearing alone never automatically pursues or reports.
- Handling the journalist still requires returning to the refuge.


## 22. Current driving, traffic, transit and radio

Civilian cars follow broad repeating city circuits, use both avenue lanes per direction and drive through the same acceleration, braking, reverse and steering model as the player. They seek physical clearance around obstructions, including safe opposing pavement; a blocked car may reverse a bounded distance and reassess without needing a complete bypass first. Junction permissions protect whole bodies and downstream exits. No lateral position snapping or teleport is allowed.

The current city has 600 civilian cars and six buses, with at most 64 local materialized traffic proxies. Avenues/local/service roads are 150/96/88 units wide. C Circular, N Norte–Sur and E Este–Oeste each have two buses, stops and real NPC boarding/alighting. The player can board a stopped bus through the existing chooser or steal it; passenger mode follows the bus until a safe stopped exit.

Driving enables Vice FM, Night Shift or Pulse 94.6 (three tracks each), plus OFF. Each station has a continuous timeline; entering joins the current song rather than restarting a playlist. Nearby civilian cars provide quiet radio ambience. Pages uses the nine pinned official sources; other packaged hosts require staged masters.

Distant scheduling and cached/incremental traffic work reduce CPU cost while preserving physical local interactions. This does not guarantee every jam is eliminated or a particular hardware FPS: native testing still observes some junction waits, up to roughly 50 seconds at the widened Blackwater fixture.
