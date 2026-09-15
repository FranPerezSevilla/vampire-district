# ViceBlood intro — art direction and concept frames

Status: **art-direction reference only**. This directory records the intro decisions approved during the September 2026 iteration. The images are concept/reference frames; this PR does **not** wire a runtime intro, change gameplay, repoint Pages, or replace the current title/menu implementation.

## Core visual language

- Gothic-punk decadence and cynicism, not prestige-cinematic spectacle.
- Simple, abstract, angular characters and props: flat geometric shapes, minimal facial detail and strong silhouettes.
- Limited palette: near-black / charcoal, cream / off-white, burgundy / crimson, with restrained gray-purple accents.
- Subtle paper / halftone / print grain is welcome; glossy painterly rendering and hyper-detailed realism are not.
- The art should look intentionally authored and compatible with the current Contacts / Black Book portrait language, not like polished generic AI illustration.
- **High quality means high pixel resolution and clean composition, not more artistic detail.** Do not increase rendering complexity just to make an asset “higher quality”.

## Canonical vampire skin treatment

All vampires must use a consistently **very pale, cool off-white / gray-cream skin tone**. This applies to the protagonist after conversion, the Sire, feeding scenes, smoking/night scenes, hands, and any future vampire shown in the intro.

Humans and not-yet-converted characters must remain visibly warmer / darker so vampirism reads immediately from the palette. During the conversion shot specifically, the vampire is markedly pale while the person being converted is still warmer.

## Composition and motion rules

- Compose natively for **16:9 landscape**.
- The intended video treatment uses **black letterbox bands above and below**.
- Do not stretch a smaller composition to fill the frame and do not use aggressive crops that destroy the original balance.
- No Ken Burns treatment: **no camera pans, pushes, or zooms** on static frames.
- Static shots with simple cuts / short crossfades are preferred.
- Images themselves should contain **no narrative captions, panel labels, place names, or duplicated subtitle copy**. Text belongs in the subtitles.
- Subtitle language is English.
- Do not show incidental world labels such as “Santo Vale” in intro art.

## Title treatment

- Use the actual main-menu wordmark, not a reinterpretation.
- Bold condensed sans-serif block title.
- `VICE` in warm off-white / pale gray; `BLOOD` in vivid red.
- Avoid serif title variants, blood-drip horror typography, crowns, and decorative gothic flourishes that do not exist in the game title.
- `ONE MORE NIGHT` may appear as the small supporting tagline.

## Locked narrative / shot direction

1. **Blood / Power / Control / Destiny** — hand and blood/wine glass; each word is its own subtitle beat.
2. **Conversion** — centered intimate conversion moment. No city in the background, no extra blood cup. The vampire is clearly paler than the still-warm convert.
3. **Dream beyond mortality / return setup** — wide urban mood without unnecessary labels.
4. **“Decades have passed.”** — city skyline only, **no protagonist silhouette**.
5. **“Only now have I been allowed to return to my city.”** — use the protagonist silhouette against the city in contrast with the previous empty skyline.
6. **Family / what was lost** — the framed family photo is deliberately small within a larger empty interior composition. No city should be visible through the window.
7. **The Sire** — current composition is approved; no crown. Sire skin must follow the pale-vampire rule.
8. **Blood / Weakness / Dependence / Punishment** — exhausted pale protagonist drinking from a medical blood bag; show the four words **one at a time**, matching the opening cadence. Protagonist is pale.
9. **Night after night** — place this subtitle over the dusk-to-night skyline sequence rather than a separate feeding shot.
10. **Closing** — night, protagonist smoking, then `Here we go again.` The protagonist is pale. No siren.

## Audio / tone notes

- The dusk-to-night transition replaces the earlier siren idea; **no siren** is wanted.
- The ending should feel mundane and cynical — another night / another shift — rather than heroic.
- Keep the atmosphere low-key and dirty rather than building toward a cinematic trailer climax.

## Reference assets

The `concepts/` directory contains the current visual references used to lock these decisions. They are intentionally kept as reference art rather than wired into the production asset pipeline by this PR.
