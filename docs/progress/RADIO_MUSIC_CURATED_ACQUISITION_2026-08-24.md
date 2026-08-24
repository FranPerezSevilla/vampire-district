# CURATED-3 acquisition checkpoint — 2026-08-24

## Gate closed

GitHub Tests #2299 completed successfully on commit `8b2b793b0459382d210221cbd40c17c672c06f2b`.

The user approved all twelve curated tracks: three per core station. Every track remains `acquisition-ready` in `docs/audio/radio-curated-track-catalog.json`.

## Acquisition boundary discovered

The official Pixabay and Free Music Archive track pages expose their downloads through interactive controls rather than stable download anchors available to the current automation environment.

The available web access can verify the official source page, licence statement, duration/format metadata and Content-ID warning, but it cannot invoke those interactive download controls or produce the exact official MP3 bytes. No installed or available plugin provides an authorised Pixabay/FMA download action.

Do not work around this by scraping private endpoints, guessing CDN asset URLs or downloading from mirrors.

## What is complete

- `docs/audio/radio-acquisition-ledger.json` defines all twelve exact approved recordings, licences, credits, Content-ID state and expected stable master filenames.
- `.private/radio-acquisition/` is the private ingest location and is gitignored.
- `tools/radio-curator/hash-acquired-audio.js` computes exact SHA-256 and file size for the acquired masters.
- `tests/radio-curated-acquisition.test.js` locks the 12-track/3-per-station set, licence policy and repository-publication boundary.
- `docs/audio/RADIO_CURATED_CREDITS.md` is the ready-to-use credit roll authority.

## Exact ingest procedure

For each approved track:

1. use the official `sourceUrl` from `docs/audio/radio-acquisition-ledger.json`;
2. use the site's official free-download control;
3. place the resulting MP3 in `.private/radio-acquisition/` using the ledger's `expectedMasterFilename`;
4. run:

   `npm run radio:acquisition-hash -- .private/radio-acquisition --report .private/radio-acquisition-report.json`

5. record the exact downloaded filename, SHA-256, byte size and acquisition date into the ledger;
6. preserve any Pixabay download/licence certificate or equivalent evidence alongside the private master;
7. do not commit substantially unchanged Pixabay masters to the public repository.

The two CC BY 4.0 tracks may legally be redistributed with attribution, but ViceBlood intentionally uses the same private-master workflow for consistency.

## Remaining CURATED-3 work

The only missing acquisition evidence is binary-dependent:

- exact official MP3 bytes;
- original downloaded filename where it differs from the stable runtime name;
- SHA-256;
- byte size;
- acquisition timestamp/certificate where supplied.

Until those exact official downloads exist, do not mark any track `acquired` and do not start runtime radio integration.
