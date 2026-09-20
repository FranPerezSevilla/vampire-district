# Street and cathedral prop materials

## Active quiet materials — 2026-09-20

[gothic-street-atlas-v2.png](gothic-street-atlas-v2.png) supplies lamps, street benches, intact/broken dumpsters, wrought-iron fences, cathedral pews, piers, altar and candles through the existing PropSpriteStack renderer. Broad dark iron, charcoal stone and subdued timber replace busy pitting, bright chips and wood-grain noise. The lantern/candle light cores remain warm.

Source: 1254 × 1254 RGBA. Same sixteen source crop rectangles, same packed 1024 × 2048 mipmapped GPU atlas, same geometry and projection. The stable packed key remains `street-stack-v1`; versioning belongs to the authored source filename. The raw source is released after packing. v1 remains on disk for comparison and is not preloaded.

Generated with built-in ImageGen; [exact prompt and provenance](gothic-street-atlas-v2.md). Companion roof-equipment revision: [ordinary-rooftop-objects-v2](../architecture/ordinary-rooftop-objects-v2.md).

Older `lamp-clean-v2`, `bench-clean-v1` and cathedral `furniture-v1` remain the existing Canvas fallback art; the normal WebGL path uses the new shared sheet. Actor/car surfaces remain unchanged. Review scope and measured costs: `docs/tasks/QUIET_CITY_PROPS.md` at the repository root.
