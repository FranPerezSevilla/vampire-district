# Hospital lighting pilot

The existing BuildingMaterialImages owner bakes the hospital south facade lighting and ground contact when the building becomes resident. CachedWarmLights shares two 128px canvas stamps (halo and directional downlight) across those bakes. No animated shadows, new update loop, or per-frame canvas work is added.

The entrance has a restrained halo and a directional pool on the pavement. Two wall fixtures cast narrow-to-wide downlights; smaller window halos retain crisp openings. The facade light layer follows the existing parallax and occlusion bands. Other buildings retain their prior lighting pending visual approval.

The hospital south light layer uses half-resolution rather than quarter-resolution to reduce visible softness. Existing face disposal removes the layer; scene disposal releases the shared stamps. This preserves draw-object count, with a modest increase to the one facade light texture.

Validation: 13 focused light lifecycle, stamp reuse and parallax tests pass. Build passes. The broad affected selector stops at launching npm test on this Windows environment; it is not a full-suite pass. GPU frame time has not been benchmarked on the user's device.

## Parallax stability
The runtime uses a fixed camera-size projection envelope rather than the current visible building set. Culling and streaming therefore cannot change the projection scale of buildings already on screen. The 4x axis setting and shared affine projection for adjoining volumes remain. Height normalization covers the active viewport and its 320-unit margin; offscreen vertices outside that envelope are not individually clamped.
