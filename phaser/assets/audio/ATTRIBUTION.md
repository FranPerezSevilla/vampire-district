# Viceblood audio attribution ledger

Record every third-party audio asset here before it is merged into the game.

| Catalogue ID | File | Title / description | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- | --- | --- |
| `weaponFire` | `combat/weapon-fire-01.ogg` … `combat/weapon-fire-03.ogg` | Gunshot / handgun report | Universfield | https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-gunshot-352466/ | Pixabay Content License (verified 2026-08-14) | Source MP3 converted to mono 44.1 kHz OGG/Vorbis; high-pass cleanup, conservative gain/limiting; variants 02–03 use subtle pitch and EQ changes while preserving duration/weapon identity. |
| `bulletHitBody` | `combat/bullet-hit-body-02.ogg` | Bulletimpact2 / bullet-to-body impact candidate | u_68csiaifb5 | https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-bulletimpact2-442718/ | Pixabay Content License (verified 2026-08-14) | User-supplied source MP3 processed to mono 44.1 kHz OGG/Vorbis with light cleanup, EQ/pitch variation and conservative limiting. This reference sample is exposed in Audio Lab for loudness/timbre acceptance before finalizing the full variant family. |
| `drainStart` / `drainLoop` / `drainComplete` | `feeding/drain-start-01.mp3`, `feeding/drain-loop-01.wav`, `feeding/drain-complete-01.mp3` (+ OGG working derivatives) | Female vampire bite | KatjaSavia | https://pixabay.com/es/sound-effects/horror-female-vampire-bite-218083/ | Pixabay Content License (verified 2026-08-14) | Source split into early sigh (0.23–2.18 s) and later bite performance (2.15–4.70 s). Sigh lowered about 3.5 semitones with shifted formants, lightly filtered and normalized; separate trims become start/end cues. Bite section keeps original pitch/timbre and is only trimmed/downmixed/resampled with tiny edge fades. Runtime loop uses PCM WAV to avoid compressed-frame loop gaps. |

## Rules

- Prefer CC0 or licences explicitly allowing commercial use and modification.
- Do not use assets with unclear ownership.
- Preserve the original source page, author and exact licence/version.
- Note edits such as trimming, pitch changes, layering or normalization.
- Keep filenames descriptive and lowercase with hyphens.
- Do not remove attribution just because an asset was edited.
