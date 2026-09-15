# Fast production boot — 2026-09-12

Authority: existing app-bootstrap ordering, ChunkFileStore/ChunkStreamSystem
residency, RawAudio sample decoding, compiler-authored city JSON. Scope: build
transport, boot asset cache, bounded chunk transport, title preloader and focused
tests. No economy, save, camera, typography or simulation changes.

Acceptance: production executes one shared module graph with preserved relative
asset URLs; initial 3x3 compiler chunks and manifest are seeded before any fetch;
all 40 sample files are transported losslessly in one shared, hashed package;
Phaser comes from the same deployment; subsequent chunk reads are bounded and
cacheable with revisioned URLs. Entry points and all build outputs are published
atomically. Tests exercise real compiled assets and a bounded-latency transport;
no browser execution, no claimed browser load time/FPS or visual acceptance.

No force push, PR merge, manual city data editing or second gameplay authority.
