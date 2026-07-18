# Milestone 3 browser regression checklist

Use this checklist before changing Milestone 3 from 🟡 to ✅. Record browser, operating system, viewport, render quality and commit SHA.

## Required configurations

1. Laptop viewport around 1366 × 768 at **Low** quality.
2. Desktop viewport around 1920 × 1080 at **Ultra** quality.
3. Narrow viewport at or below 720 CSS pixels at **High** or **Very high** quality.
4. Resize the browser during at least one combat encounter without reloading.

## Police melee

- Create wanted level 1 by assaulting a police officer or committing a visible felony.
- A chasing officer closes distance before attacking.
- The police attack shows a blue windup arc.
- The active window is visually stronger than windup/recovery.
- Remaining inside the arc applies `Hunger +12`.
- Moving outside range or around the stored direction avoids the hit.
- The officer stays visually fixed during its attack rather than sliding through the player.
- The same attack cannot apply damage twice.
- A downed or stunned officer cannot attack.

## Hunter melee

- Activate a hunter through the current exposure/debug route.
- The hunter attacks only while active and hunting on the street.
- Standing in shadow prevents a new hunter melee attack from starting.
- A hunter strike applies `Hunger +20`.
- The hunter windup and recovery are slower than the police attack.
- A downed or stunned hunter cannot attack.

## Hit stun and action interruption

- A confirmed hit stops player movement briefly.
- WASD resumes after hit stun without needing a page reload.
- A hit cancels a punch already in progress.
- A hit cancels an active drain channel.
- Space traversal does not start during hit stun.
- E interaction does not start during hit stun.
- Q, R and F do not activate during hit stun.
- Aim direction may still follow the cursor while hit-stunned.

## Invulnerability

- The player flickers and shows a red ring after a confirmed hit.
- A second officer striking during the invulnerability window does not add more Hunger.
- After invulnerability expires, a later valid hit applies normally.
- Overlapping police cannot raise Hunger from 0 to 100 in one instant.
- Enemy active windows are spent even when invulnerability rejects their damage.

## Hunger feedback

- Police hit: `+12` baseline Hunger.
- Hunter hit: `+20` baseline Hunger.
- Hunger is capped at 100.
- At 85 or above, feedback clearly reads as critical.
- Feeding after damage lowers Hunger and remains the only recovery resource.
- Damage feedback does not introduce a separate health bar.
- The floating Hunger label remains legible at every tested render quality.

## Frenzy failure

- Reaching 100 Hunger through damage triggers `FRENZY` failure.
- The failure reason states that Hunger overwhelmed the player.
- World input is locked by the failure screen.
- The report/success finale cannot trigger after frenzy failure.
- Closing or restarting from the failure state does not retain enemy attack state.

## UI and dialogue ownership

- Enemy attacks cancel when a dialogue bubble opens.
- Enemy attacks cancel when pause, task reveal or result UI owns input.
- The click used to advance dialogue never becomes a punch.
- No enemy hit is applied behind a paused scene or mission report.
- Returning from a dialogue does not leave movement or attacks stuck.

## Mission regression

- Rooftop thug tutorial remains non-retaliatory.
- Four punches still knock the thug down.
- E still drains the downed thug in the temporary tutorial flow.
- Police informant and journalist steps still advance.
- Killing or draining the journalist still requires returning to the refuge.
- Sire approval bubble appears before the final report.

## Pass criteria

Milestone 3 may be marked ✅ only when:

- police and hunter damage values are correct;
- dodgeable attack geometry is readable;
- hit stun does not leave controls stuck;
- overlapping enemies are controlled by invulnerability;
- feeding clearly recovers combat pressure;
- frenzy failure occurs only at the configured Hunger limit;
- the complete mission and finale still work;
- failures are fixed or recorded as known limitations.
