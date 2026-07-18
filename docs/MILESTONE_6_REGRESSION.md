# Milestone 6 browser regression checklist

Use this checklist before changing Milestone 6 from 🟡 to ✅. Record browser, operating system, viewport, render quality and commit SHA.

## Required configurations

1. Laptop viewport around 1366 × 768 at Low quality.
2. Desktop viewport around 1920 × 1080 at Ultra quality.
3. Resize the browser during one run without reloading.
4. Test at least one streetlight near civilians and one near police.

## Attack ownership

- E does not show or execute `Break streetlight`.
- Left-click remains the only player input that damages a streetlight.
- Dialogue clicks do not damage nearby lights.
- Attacks during pause, task reveal, transition, hit stun or active drain do not damage props.
- Holding left mouse does not repeatedly damage a prop without new attack presses.

## Hit geometry

- A streetlight in front and inside punch reach breaks.
- A streetlight behind the player does not break.
- A streetlight outside the attack arc does not break.
- A streetlight beyond reach does not break.
- Moving the cursor after attack start does not bend the stored attack toward a light.
- A broken streetlight cannot be hit or broken again.

## Visual and world state

- One valid unarmed hit breaks a baseline streetlight.
- The intact light field disappears immediately.
- The broken pole drawing appears.
- A dark circular shadow appears around the broken light.
- `currentLight()` no longer reports that light.
- `currentShadowAt()` reports the broken-light shadow inside its radius.
- The break burst and `BROKEN` label appear briefly without remaining on screen.
- Redrawing, changing layer and returning to the street preserve the broken state.

## Sound and reactions

- The glass/break audio plays once.
- A civilian who sees the break enters the visual witness response.
- A police officer who sees the break escalates police attention.
- An NPC that hears but does not see the break turns toward the source and shows `WTF`.
- Hearing alone does not begin pursuit or reporting.
- A downed, dead, inactive or already alarmed NPC does not use the heard-only reaction.

## Compatibility

- NPC punches and resilience still work normally beside a streetlight.
- One attack may hit an NPC and a light only when both are genuinely inside the stored arc.
- Right-click draining remains unaffected.
- Default run, Shift quiet movement and Space traversal remain unaffected.
- The journalist mission and refuge finale still complete normally after breaking lights.

## Pass criteria

Milestone 6 may be marked ✅ only when:

- hit and miss geometry are consistent;
- E cannot break lights;
- broken-light darkness persists;
- visual and heard-only reactions remain distinct;
- no world action leaks through UI locks;
- the complete mission still passes;
- failures are fixed or recorded as known limitations.
