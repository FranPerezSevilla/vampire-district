# Functional specification

## 1. Experience goals

The game should feel immediate, readable and systemic:

- Movement should be fast enough that crossing a block is enjoyable rather than administrative.
- The mouse should make attacks understandable: the player attacks where they point.
- Traversal should remain a single contextual action with no route-selection menu.
- Feeding should be powerful, risky and easy to understand.
- Police and civilians should react differently according to what they see and what they only hear.
- The player should solve situations through movement, stealth, violence, feeding and route choice rather than scripted corridors.

## 2. Core gameplay loop

1. Receive an order from the sire.
2. Navigate the district through streets, rooftops and sewers.
3. Read NPC vision, hearing and alert state.
4. Avoid, distract, strike, knock down or drain targets.
5. Control Hunger and protect the veil.
6. Manage evidence and police pressure.
7. Complete the objective and report back.

## 3. Target control scheme

| Action | Input | Behaviour |
|---|---|---|
| Move | WASD / arrows | Move relative to the screen; running is the default speed. |
| Aim / face | Mouse position | Player faces the cursor's world position. |
| Primary attack | Left mouse | Punch, swing or fire the equipped weapon in the aimed direction. |
| Drain | Right mouse | Start a drain when a valid target is available. |
| Previous / next weapon | Mouse wheel | Cycle available weapons with wheel-step debouncing. |
| Traverse | Space | Jump, climb, descend or enter/exit a sewer at the selected traversal point. |
| Interact | E | Talk, collect, inspect, use mission objects and other non-traversal actions. |
| Dash | Q | Use Shadow Dash in the aimed or movement direction. |
| Whisper | R | Use Vampiric Whisper. |
| Blood Sense | F | Reveal relevant supernatural/perception information. |
| Mission | M | Toggle mission information. |
| Menu | H / Escape where appropriate | Open or close menus. |

### Recommended stealth modifier

**Proposed:** Hold Shift to walk quietly. Running remains the default, but the player keeps a deliberate low-noise option. This is especially important once footsteps and combat noise feed the hearing system.

## 4. Traversal rules

Space is exclusively physical movement between navigation layers.

### Context priority

When Space is pressed, the game selects one valid traversal action using this order:

1. A traversal point the player is currently inside and facing.
2. The closest valid traversal point in world distance.
3. If two points are similarly close, the point closest to the aim direction.
4. If no traversal is valid, Space does nothing.

### Traversal actions

- Rooftop edge: jump to the connected roof.
- Fire escape at street level: climb to the roof.
- Fire escape on a roof: descend to the street.
- Manhole at street level: enter the sewer.
- Sewer exit: return to the street or refuge shaft.
- Roof drop point: drop to the street.

A small contextual icon should appear before Space is accepted. The interaction must not open a radial menu or compete with E.

## 5. Aiming and attacks

### Mouse aim

- The cursor is projected into world coordinates through the active camera.
- The player keeps the last valid aim direction when the cursor is too close to the character.
- A subtle reticle or facing indicator communicates direction.
- Aim must remain accurate under browser resizing, CSS scaling, camera zoom and all render-quality presets.

### Primary attack

Left mouse performs the equipped weapon's primary action.

**Unarmed baseline**

- Short directional arc.
- One resilience point of damage per confirmed hit.
- Brief attack commitment and recovery; no unlimited frame-by-frame hits.
- Small hit stun on the victim.
- Generates a low-to-medium sound event.

**World props**

Streetlights become damageable objects. A punch or weapon hit can break them; E is no longer used for vandalism.

## 6. NPC resilience and states

The term **resilience** is used instead of “lives” because NPCs do not respawn after each hit.

| NPC type | Baseline resilience | Initial behaviour at zero |
|---|---:|---|
| Civilian | 3 | Downed |
| Journalist / normal target | 3 | Downed |
| Police | 4 | Downed |
| Rooftop thug | 4 | Downed |
| Hunter | 5 | Downed |
| Streetlight | 1 | Broken |

### Combat states

`active → staggered → downed → recovered / drained / killed`

- **Active:** normal AI and combat behaviour.
- **Staggered:** short hit reaction; cannot attack during the reaction.
- **Downed:** cannot move or pursue; valid drain target from any side.
- **Recovered:** optional later state if the recovery timer is enabled.
- **Drained / killed:** terminal state.

The current implementation keeps downed NPCs on the ground until the encounter resolves. Recovery can be added after the core combat loop is stable.

## 7. Contextual drain

Right mouse starts a drain only when one of these conditions is true:

### Downed drain

- Target is downed.
- Target is within drain range.
- No blocking geometry lies between player and target.
- Approach angle does not matter.

### Rear stealth drain

- Target is standing and unaware.
- Player is within drain range.
- Player is inside the target's rear arc and outside its vision cone.
- Target is not alarmed, pursuing, attacking or reacting to a confirmed sighting.

### Invalid drain

When no valid target exists, right mouse does not open the browser context menu and does not trigger a generic interaction menu. Feedback should be minimal: reticle state, a short icon or a brief contextual prompt.

### Channel behaviour

- Drain is held/channelled for the configured feeding duration.
- Movement, taking damage or losing the target cancels it.
- Witness and sound systems continue to evaluate the action.
- Completion reduces Hunger and resolves the target as drained.

## 8. Player damage and Hunger

The player does not use a separate conventional health bar. Enemy damage is pressure on the Hunger resource.

### Confirmed damage behaviour

- A valid enemy active window adds Hunger.
- Stronger attacks add more Hunger.
- The current player punch is cancelled.
- An active drain channel is cancelled.
- Movement, attack, powers, traversal and interaction are briefly suppressed by hit stun.
- Aim may continue updating during hit stun.
- A following invulnerability window rejects overlapping damage.
- Feeding functions as recovery because it lowers Hunger.

### Implemented timing baseline

| Player response | Value |
|---|---:|
| Hit stun | 260 ms |
| Invulnerability | 720 ms |
| Floating damage feedback | 620 ms |
| Critical Hunger threshold | 85 |
| Frenzy/failure threshold | 100 |

### Implemented enemy damage baseline

| Enemy attack | Hunger increase |
|---|---:|
| Police baton strike | +12 |
| Hunter heavy strike | +20 |

These remain tuning values rather than permanent final balance.

### Overlap rule

Only the first confirmed hit inside the invulnerability period applies Hunger. Other enemy active windows are spent without damage. This prevents several enemies standing together from instantly filling the Hunger resource.

### Critical Hunger and frenzy

- At Hunger 85 or above, player damage feedback becomes critical.
- At Hunger 100, the current vertical-slice rule ends the mission with `FRENZY`: the vampire loses control before fulfilling the sire's order.
- Draining before the limit is reached lowers Hunger and restores tactical room.

### Current enemy eligibility

- Police use melee only while their existing AI marks them as actively chasing the player.
- Hunters use melee while active and hunting outside shadow.
- Civilians, the journalist and rooftop thug do not autonomously attack yet.

## 9. Weapons

Weapons are a later milestone built on the unarmed combat foundation.

### Weapon contract

Each weapon defines:

- id and display name;
- attack type: melee, hitscan or projectile;
- damage;
- range;
- cooldown / recovery;
- hit arc or spread;
- sound radius and sound type;
- ammo and reload rules where applicable;
- animation and effect identifiers.

### Initial weapon set

**Proposed:**

1. Unarmed.
2. Improvised melee weapon.
3. Pistol.

The mouse wheel cycles only weapons currently owned. Numeric shortcuts can be added later as an accessibility option.

## 10. Perception and reactions

### Vision

A confirmed sighting uses the NPC's facing direction, vision cone, range and line of sight.

- Police who see a felony escalate police response and pursue according to the wanted level.
- Civilians who see a felony enter their witness/report behaviour.
- Hunters use their own hostile response.

### Hearing

Sound uses a wider directional field and event-specific radius.

- Hearing without sight makes the NPC stop, turn toward the source and enter a temporary `WTF` / investigate reaction.
- Hearing alone does not start police pursuit.
- If the NPC turns and subsequently sees a suspicious or criminal action, the normal sight reaction begins.

### High fall rule

- If an NPC is looking at the landing point when the player drops from a roof, it triggers that NPC type's confirmed-sighting response.
- If the NPC only hears the impact, it turns toward the player and enters `WTF` without pursuit.

### Streetlight rule

- The hit and break create sound events.
- An NPC watching the vandalism reacts as a visual witness.
- An NPC outside the visual cone but inside hearing range turns toward the broken light without immediately reporting or pursuing.

## 11. UI and feedback

- Crosshair communicates current weapon and whether a drain target is valid.
- Target resilience is not permanently displayed over every NPC.
- On hit, short pips or a compact feedback burst may show remaining resilience.
- Downed state must be visually obvious.
- Enemy melee windup must be telegraphed before its active window.
- Player damage shows Hunger gain rather than a health-loss number.
- Invulnerability is shown by player flicker and a short impact ring.
- Critical Hunger receives a stronger red warning treatment.
- Space traversal prompt and E interaction prompt remain distinct.
- Mouse-wheel weapon changes show a short weapon-name toast.
- Dialogue remains above the speaker and advances with left click; Escape is the fallback.
- Vision/hearing visualization should be configurable to avoid permanent screen clutter.

## 12. Browser behaviour

- Disable the context menu only over the game canvas/frame.
- Prevent wheel-driven page scrolling only while the pointer is over the active game area.
- Do not capture mouse input while a modal or menu owns focus.
- Pause or neutralize combat input when the tab loses focus.
- Enemy attacks must not resolve behind dialogue, pause, task reveal or result UI.

## 13. Acceptance criteria for the first combat slice

The first combat slice is complete when:

- Mouse aim stays accurate at all supported browser sizes and quality presets.
- Left mouse punches in the aimed direction.
- A civilian is downed after three valid punches.
- A police officer is downed after four valid punches.
- Hits cannot apply more than once per attack window.
- Right mouse drains a downed target.
- Right mouse drains an unaware standing target only from behind.
- A front-facing alert target cannot be stealth-drained.
- Police and hunter melee attacks are visibly telegraphed and dodgeable.
- Taking damage raises Hunger and respects hit stun/invulnerability.
- Overlapping enemy attacks cannot stack during one invulnerability window.
- Feeding clearly recovers combat pressure.
- Hunger 100 follows the current frenzy failure rule.
- Streetlights can be broken by attacks.
- Visual witnesses and heard-only NPCs react differently.
- Space performs traversal only and never runs, attacks or activates a vampire power.
