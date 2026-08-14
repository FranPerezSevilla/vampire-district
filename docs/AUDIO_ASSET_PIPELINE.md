# Viceblood audio asset pipeline

_Last updated: 2026-08-14_

This document is the durable handoff contract for sourcing and integrating real audio into Viceblood. Future ChatGPT/agent sessions should read this file together with `docs/audio-catalog.md` before doing audio work.

## Working model

The human supplies only:

1. the downloaded source audio file (`.wav`, `.mp3`, `.ogg`, etc.); and
2. the original Pixabay/source page URL.

The assistant/agent owns the rest of the integration from that point onward.

Do not ask the human to rename files, edit metadata, generate variants, convert formats, update attribution, wire gameplay code or upload final runtime files unless a tool limitation makes a specific step impossible.

## Per-asset procedure

Work on one sound family at a time unless explicitly asked to batch them.

1. **Identify the catalogue event**
   - Confirm the stable gameplay event ID (for example `weaponFire`).
   - Confirm its category and whether it is a one-shot, loop or ambience.
   - Do not invent extra gameplay IDs for variants.

2. **Verify provenance**
   - Open the supplied source page.
   - Record author/uploader, source URL and exact licence/usage terms available at the time of integration.
   - If ownership or commercial-use rights are unclear, stop and flag it rather than integrating the asset.

3. **Inspect the source master**
   - Check duration, channels, sample rate, peak level and obvious silence/clipping.
   - Preserve the source file locally during processing; shipped runtime files may be derived copies.

4. **Process for runtime**
   - Prefer `.ogg` for shipped compressed runtime audio unless a technical reason requires another format.
   - Trim unnecessary leading/trailing silence.
   - Apply sensible gain/normalization without destroying transient character.
   - Avoid clipping.
   - For loops, create/test clean loop boundaries rather than applying one-shot processing.

5. **Generate variants only when useful**
   - One-shots that repeat often (gunshots, impacts, screams, footsteps, horns) should usually receive several subtle variants.
   - Variants must still sound like the same source/weapon/material, not different assets.
   - Typical variation may combine very small pitch, EQ, transient, timing or gain changes.
   - Do not generate variants mechanically for long ambience, music-like beds or loops unless the design specifically benefits from them.
   - Keep processing deterministic/reproducible where practical.

6. **Name and place files**
   - Runtime path: `phaser/assets/audio/<category>/`.
   - Lowercase descriptive filenames with numbered variants, e.g.:
     - `weapon/weapon-fire-01.ogg`
     - `weapon/weapon-fire-02.ogg`
     - `weapon/weapon-fire-03.ogg`
   - Variants share the same stable gameplay event ID.

7. **Upload binaries safely**
   - Treat audio as binary, not UTF-8 text.
   - Prefer Git blob/tree/commit operations (base64 when required by the connector) for binary files.
   - Keep binary upload separate from subsequent text/code edits when that reduces failure risk.
   - Verify the repository actually contains each expected binary before declaring the asset uploaded.

8. **Update attribution**
   - Add a row to `phaser/assets/audio/ATTRIBUTION.md` containing catalogue ID, runtime file/family, description, author, original source URL, licence and all processing changes.
   - Keep attribution even when the source licence does not require credit; the project uses the ledger for provenance.

9. **Update catalogue/audio mapping**
   - Keep the stable event ID unchanged.
   - Register all runtime variants under the audio layer/catalogue rather than using separate gameplay IDs.
   - Preserve the procedural fallback until the sample-backed path has been validated unless there is a clear reason to remove it.

10. **Wire the real gameplay event**
    - Locate the actual gameplay authority that produces the event.
    - Trigger the sample-backed event there once per real action/state transition.
    - For loops, explicitly start and stop with state changes; never retrigger every frame.

11. **Validate**
    - Confirm final files decode and have sensible duration/levels.
    - Confirm the event is reachable from real gameplay, not only from a test helper.
    - Confirm variant selection does not change gameplay behavior.
    - Run/inspect relevant tests when available.
    - Verify the PR head contains binaries, attribution and code before reporting completion.

## Variant guidance

Default starting points, not hard requirements:

| Family | Typical variants | Notes |
| --- | ---: | --- |
| Firearm report | 3–4 | Very subtle variation; preserve weapon identity |
| Body/projectile impact | 3 | Avoid comic/gore exaggeration |
| Melee body impact | 3–4 | Vary transient/body slightly |
| Footsteps | 4–6 | Larger set because repetition is frequent |
| Civilian scream | 3–4 | Prefer genuinely different source takes when available |
| Vehicle collision | 3–4 | Separate light/heavy families |
| Horn | 3–4 | Prefer different authentic recordings over heavy DSP |
| UI one-shot | 1–2 | Consistency usually matters more than variation |
| Loop/ambience | 1 | Prioritize seamless looping over variants |

## Source/licence policy

- Prefer CC0 or sources/licences explicitly permitting commercial use and modification.
- Pixabay assets may be used only after checking the current source page/licence terms for the supplied item.
- Never infer a licence solely from a filename or from an earlier asset from the same site.
- Preserve the exact original source URL in the attribution ledger.
- Do not redistribute the untouched source as a standalone asset pack; integrate it as part of the game.

## Failure/recovery rules

- Never claim an audio family is integrated until the final binary files are verified in the PR branch.
- If a binary upload fails, leave text/code changes untouched until the binary state is known; then retry the binary operation rather than guessing.
- If processing is interrupted, report exactly which of these stages are complete: provenance, processing, binary upload, attribution, mapping, gameplay wiring, validation.
- One sound family should be independently finishable, so an interruption does not corrupt the rest of the audio pass.

## Automation policy

Do not build a large GitHub Actions audio factory before the manual pipeline has been validated on several representative assets.

After the process is stable, extract repeatable processing into `tools/audio/` (using `ffmpeg`) and optionally add a manual `workflow_dispatch` action. Automation should handle conversion/normalization/variant generation/validation; human/agent judgement should still choose the source, licence metadata, event mapping and suitable processing profile.

## Current pilot

The first end-to-end pilot is:

- Event: `weaponFire`
- Source file supplied by the human: `universfield-gunshot-352466.mp3`
- Source page: `https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-gunshot-352466/`
- Intended processing: one cleaned runtime master plus 2–3 subtle one-shot variants
- Target family: `phaser/assets/audio/weapon/weapon-fire-XX.ogg`

Complete this pilot before generalizing the processing into reusable automation.
