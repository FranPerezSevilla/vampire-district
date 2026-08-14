# Viceblood audio asset pipeline

_Last updated: 2026-08-14_

This document is the durable handoff contract for sourcing and integrating real audio into Viceblood. Future ChatGPT/agent sessions should read this file together with `docs/audio-catalog.md` before doing audio work.

## Working model

The human supplies only:

1. the downloaded source audio file (`.wav`, `.mp3`, `.ogg`, etc.); and
2. the original Pixabay/source page URL.

The assistant/agent owns the rest of the integration from that point onward.

Do not ask the human to rename files, edit metadata, generate variants, convert formats, update attribution, wire gameplay code or upload final runtime files unless a tool limitation makes a specific step impossible.

## Runtime compatibility rule

The current browser playtest must use **MP3 files in `SampleAudioCatalog.js`** for sample-backed one-shots. Do not point the runtime catalogue at Ogg/Vorbis assets as its only source: older WebKit/Safari builds used by playtesters can fail `decodeAudioData()` on Ogg/Vorbis and silently force `RawAudioSystem` back to its procedural fallback.

Processed OGG derivatives may remain beside the MP3 runtime mirrors for audio work, archival comparison and future targets. The compatibility mirror must preserve the same audible processing/variant identity. `.github/workflows/materialize-audio-assets.yml` currently generates mono 44.1 kHz MP3 mirrors from committed OGG derivatives and validates them with FFmpeg/FFprobe.

When browser support changes later, the runtime format policy may be revisited deliberately. Do not change it incidentally while integrating a new sound family.

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
   - Process a high-quality derivative first; OGG remains acceptable as an intermediate/working derivative.
   - For the current browser playtest, generate the corresponding MP3 compatibility mirror and point `SampleAudioCatalog.js` at the MP3 file.
   - Trim unnecessary leading/trailing silence.
   - Apply sensible gain/normalization without destroying transient character.
   - Avoid clipping.
   - For loops, create/test clean loop boundaries rather than applying one-shot processing; validate loop behavior separately before choosing the final browser runtime encoding.

5. **Generate variants only when useful**
   - One-shots that repeat often (gunshots, impacts, screams, footsteps, horns) should usually receive several subtle variants.
   - Variants must still sound like the same source/weapon/material, not different assets.
   - Typical variation may combine very small pitch, EQ, transient, timing or gain changes.
   - Do not generate variants mechanically for long ambience, music-like beds or loops unless the design specifically benefits from them.
   - Keep processing deterministic/reproducible where practical.
   - If the source's basic loudness/timbre is uncertain, it is acceptable to stop after one representative processed sample and use the Audio Lab acceptance gate before spending time on the complete variant family.
   - A single accepted variant may be integrated for a playtest when repetition is acceptable; extra variants then remain polish rather than blocking real gameplay wiring.

6. **Name and place files**
   - Runtime path: `phaser/assets/audio/<category>/`.
   - Lowercase descriptive filenames with numbered variants, e.g.:
     - `combat/weapon-fire-01.mp3`
     - `combat/weapon-fire-02.mp3`
     - `combat/weapon-fire-03.mp3`
   - A matching `.ogg` working derivative may live beside each MP3 when useful.
   - Variants share the same stable gameplay event ID.

7. **Upload binaries safely**
   - Treat audio as binary, not UTF-8 text.
   - Prefer Git blob/tree/commit operations (base64 when required by the connector) for binary files.
   - On audio branches, `.github/workflows/materialize-audio-assets.yml` may be used as a narrow transport/compatibility helper: it can decode a staged valid `*.ogg.b64`, verify the `OggS` header, and generate verified MP3 mirrors from committed OGG derivatives.
   - Creative processing/inspection still happens before staging. The workflow's MP3 conversion is a deterministic browser-compatibility derivative, not a substitute for source selection or mix judgement.
   - Keep binary upload separate from subsequent text/code edits when that reduces failure risk.
   - Verify the repository actually contains each expected runtime MP3 before declaring the asset uploaded.

8. **Update attribution**
   - Add a row to `phaser/assets/audio/ATTRIBUTION.md` containing catalogue ID, runtime file/family, description, author, original source URL, licence and all processing changes.
   - Keep attribution even when the source licence does not require credit; the project uses the ledger for provenance.

9. **Update catalogue/audio mapping**
   - Keep the stable event ID unchanged.
   - Register all runtime variants under the audio layer/catalogue rather than using separate gameplay IDs.
   - For the current browser playtest, register the MP3 compatibility mirrors, not OGG-only paths.
   - Preserve the procedural fallback until the sample-backed path has been validated unless there is a clear reason to remove it.

10. **Audio Lab acceptance gate**
    - In `?mode=playtest`, press **F8** or use **AUDIO LAB**.
    - The Audio Lab reads `SampleAudioCatalog.js` directly and can play an event or an exact numbered variant without causing combat, witnesses, Heat or gameplay cooldowns.
    - Judge the sample at **100% first**. That preview uses the same ×0.20 master gain as `RawAudioSystem`; the 0–300% lab slider is diagnostic only.
    - Compare repeated plays and variants for transient, body, harshness and relative loudness.
    - If a sample is weak/overpowering at the baseline, adjust processing or catalogue gain before gameplay wiring.
    - A decode error in Audio Lab is a release-blocking compatibility failure for that sample; do not rely on the procedural fallback to hide it.
    - Do not call a family gameplay-integrated merely because it is present in Audio Lab; this gate can intentionally precede final variants and gameplay wiring.

11. **Wire the real gameplay event**
    - Locate the actual gameplay authority that produces the event.
    - Trigger the sample-backed event there once per real action/state transition.
    - Material-specific events must remain specific: for example `bulletHitBody` belongs only to confirmed human-body hits and must not be reused for props, walls or vehicles.
    - For loops, explicitly start and stop with state changes; never retrigger every frame.

12. **Validate**
    - Confirm final runtime MP3 files decode and have sensible duration/levels.
    - Confirm the event is reachable from real gameplay, not only from Audio Lab or a test helper.
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

- Never claim an audio family is integrated until the final binary files are verified in the PR branch and real gameplay wiring has been validated.
- A family may instead be explicitly labelled **Audio Lab candidate** when only provenance, processing, binary upload, attribution and catalogue mapping are complete.
- If a binary upload fails, leave text/code changes untouched until the binary state is known; then retry the binary operation rather than guessing.
- If processing is interrupted, report exactly which of these stages are complete: provenance, processing, binary upload, attribution, mapping, Audio Lab acceptance, gameplay wiring, validation.
- One sound family should be independently finishable, so an interruption does not corrupt the rest of the audio pass.

## Automation policy

Do not build a large GitHub Actions audio factory before the manual pipeline has been validated on several representative assets.

The narrow `materialize-audio-assets.yml` helper exists to make binary transport and browser-compatible MP3 mirroring reliable when the connector cannot directly write the processed binary. It may perform deterministic validation/transcoding, but it must not make creative source, mix or variant decisions.

After the process is stable, extract repeatable processing into `tools/audio/` (using `ffmpeg`) and optionally add a manual `workflow_dispatch` action. Automation should handle conversion/normalization/variant generation/validation; human/agent judgement should still choose the source, licence metadata, event mapping and suitable processing profile.

## Integrated pilot: `weaponFire`

The first end-to-end pilot is implemented on PR #55:

- Event: `weaponFire`
- Source file supplied by the human: `universfield-gunshot-352466.mp3`
- Source page: `https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-gunshot-352466/`
- Runtime family: `phaser/assets/audio/combat/weapon-fire-01.mp3` through `weapon-fire-03.mp3`.
- Working derivatives: matching OGG/Vorbis files remain beside the MP3 mirrors.
- Processing: mono 44.1 kHz, high-pass cleanup and conservative gain/limiting; variants 02–03 use subtle pitch/EQ changes while preserving the same handgun identity. Runtime MP3 mirrors are generated from the processed OGG derivatives.
- Mapping: one stable `weaponFire` event in `SampleAudioCatalog.js`; the audio layer chooses between the three MP3 files.
- Gameplay wiring: the pistol calls `RawAudio.play("weaponFire")` from `WeaponSystem`.
- Fallback: the previous procedural pistol sound remains available if the sample has not loaded or cannot decode.
- Binary validation: all three runtime MP3 files are present in the PR branch with non-placeholder sizes and covered by `tests/audio-sample-catalog.test.js`.
- Human listening acceptance: accepted again in the playtest preview after the WebKit-compatible MP3 conversion.

## Integrated pilot: `bulletHitBody`

- Event: `bulletHitBody`
- Source file supplied by the human: `u_68csiaifb5-bulletimpact2-442718.mp3`
- Source page: `https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-bulletimpact2-442718/`
- Current runtime reference: `phaser/assets/audio/combat/bullet-hit-body-02.mp3`; matching OGG derivative remains for audio work.
- Mapping: registered in `SampleAudioCatalog.js` at catalogue gain ×1.15.
- Human listening acceptance: accepted through Audio Lab after the WebKit-compatible MP3 conversion.
- Gameplay wiring: `WeaponSystem` listens to the authoritative `combat:hit` event and plays `bulletHitBody` only when the originating weapon is hitscan. `CombatSystem` emits that event from its human-NPC `applyHit` path; prop hits use `propDamageSystem` and do not emit it. Vehicle/world hits therefore do not receive the body sample.
- Variant status: one accepted runtime sample is enough for the current playtest; additional subtle variants remain optional polish.
- Regression coverage: `tests/audio-sample-catalog.test.js` asserts the MP3 mapping, the human-hit event wiring and the separation from prop/world hits.

## Wired candidate: `civilianScream`

- Event: `civilianScream`
- Source file supplied by the human: `universfield-man-scream-04-252034.mp3`
- Source page: `https://pixabay.com/es/sound-effects/gente-man-scream-04-252034/`
- Author/source credit: Universfield / Pixabay Content License, verified 2026-08-14.
- Runtime family: `phaser/assets/audio/civilians/civilian-scream-01.mp3` through `civilian-scream-06.mp3`; matching OGG working derivatives remain beside them.
- Voice treatment: 01–03 preserve the masculine source performance with subtle pitch/EQ variation. 04–06 are deliberately female-sounding DSP derivatives using higher pitch/formant treatment; they are **not** independent recordings by a female performer. If authentic sex-specific casting is needed later, source separate performers rather than mislabelling these derivatives.
- Processing: trimmed/downmixed to mono 44.1 kHz, loudness-aligned around the same target, with conservative true-peak headroom. Variant 06 also uses a tiny tempo change.
- Binary integrity: the transported processed master was reconstructed with mandatory SHA256 `bd635361663446d6093d2fb8a1ab2b84df2feb90d42d73c516c082fa1544c78b` before generating runtime assets.
- Mapping: one stable `civilianScream` event owns all six MP3 variants; `RawAudioSystem` chooses the next variant and retains a procedural gasp fallback if sample playback is unavailable.
- Gameplay wiring: `WitnessSystem` plays the event once when an alarmed civilian finishes its shock timer and transitions into the report/flee phase; it is not retriggered every frame.
- Human listening acceptance: pending in Audio Lab / playtest preview.

## Next sourcing order

Continue one family at a time after the currently wired candidates are listening-accepted:

1. `policeSirenLoop`
2. `ambienceStreetNight`

`bulletHitWorld` remains a separate material family for later firearm polish. Never substitute `bulletHitBody` for wall, prop or vehicle impacts.
