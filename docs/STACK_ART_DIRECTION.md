# Stacked assets: gothic-punk material pass

## Scope and owners

The user rejected the bright, clean, toy-like props and asked for the same correction on people and vehicles. Keep `CharacterSpriteStack`, `PropSpriteStack`, `VehicleSpriteStack` and the existing shared depth pass. Change their art, silhouettes and material preparation. Combat, collisions, population, saves, city layout and projection settings keep their existing owners.

## Implemented visual language

- Dark ashlar piers with engaged shafts instead of framed metal boxes; solid-backed walnut pews instead of park benches.
- Blackened iron lamps/fences and worn, muted dumpster paint. Small amber light sources remain readable.
- Angular character shoulders/head profiles, narrower head, arms lowered at rest. Grayscale painted faces and worn jacket/uniform surfaces are tinted by existing identities. No individual character textures.
- Matte vehicle paint, subdued highlights, baked grime and smoked glass, shared by the entire fleet.
- New smoke, stumble/recovery, firearm-hit and vehicle-hit/fatal poses stay driven by the existing view, scene clock and damage events. Fatal NPCs retain their articulated sprite; the existing corpse/drag/hide rules still own them. Smoking is an idle presentation, not a new player command. Stumbling on an obstructed run is cosmetic and does not introduce a movement lock.

## Source assets

Generated with the built-in **imagegen** tool, then copied into the repository. Original generated PNGs retain alpha; there is no runtime noise generator. The editable SVG sections still own pivots, masks and contours.

- `phaser/assets/props/gothic-street-atlas.png`: 1254 × 1254, 16 prop material/surface crops.
- `phaser/assets/props/gothic-actor-surfaces.png`: 1774 × 887, two faces, four clothing surfaces, painted metal and glass.
- `phaser/assets/characters/human-stack.svg`: editable articulated silhouette sections, 32 frames.
- `phaser/assets/vehicles/fleet-stack.svg`: editable vehicle sections, 32 frames.

`StackMaterialAtlas` composites the image surfaces into the established silhouette masks **once before actor creation**. It packs native-resolution frame crops, with transparent gutters, into shared power-of-two atlases. Mipmaps select an appropriate level when a large source is only a few pixels wide on screen; the original level remains available when enlarged. This prevents small stone/wood details from turning into flickering grit. The temporary source textures are released. There are no per-object bakes, filters, additional frame loops or realtime lights.

## Validation and measured cost

- Reviewed actual hospital, police, Vesper and cathedral views, plus enlarged articulated poses. Fixed the face surface's compressed appearance by sloping it towards the overhead view and painting it after the head sections; sunglasses are no longer stamped twice. The source bitmap remains unchanged.
- 32 static props, 10 fence objects and 28 dumpsters were present in the browser run. Breaking a dumpster changed its art without changing its position or hit radius. Actual NPC/player fatal reactions retained their stacks and settled on the floor.
- All three packed atlases use `LINEAR_MIPMAP_LINEAR`. The original upload textures were released. Native-resolution packed sizes: people 512 × 1024; vehicles and props each 1024 × 2048. Estimated combined RGBA allocation including mipmaps: **24 MiB**, excluding driver overhead. Shared across every instance.
- 45 focused tests passed, production built, and the targeted browser runs reported no page errors. Full-suite and affected-selector limitations are recorded in [character validation](CHARACTER_SPRITE_STACKING.md).

Controlled material-build benchmark: 64 visible animated people, then the same 64 people plus 64 props; isolated scene, city simulation paused. Chromium/ANGLE D3D11 on Intel HD 530, five-second samples after warmup. CPU draw and pose time exclude GPU execution time.

| Scene | CPU draw + pose mean | Frame pacing |
|---|---:|---|
| Previous 40–42-section people, two samples | 1.51 ms | approximately 60 FPS |
| Refined 67–69-section people, two samples | 2.60 ms | approximately 60 FPS |
| Refined people plus 64 props | 3.12 ms | approximately 60 FPS |

No frames over 50 ms occurred in these samples. The richer people cost about 1.09 ms more for 64 visible actors than the previous stack. This does **not** establish full-city 60 FPS; traffic, streaming and building rendering were excluded. Source textures were not reduced to reach these results.

Review: [cathedral in game](screenshots/stack-gothic-cathedral.png), [police and traffic](screenshots/stack-gothic-police.png), [fleet](screenshots/stack-gothic-fleet.png), [animated gestures](screenshots/stack-gothic-preview.mp4).

### Final generation prompts

#### Prop atlas

Use case: stylized-concept. Asset type: production game sprite texture atlas, NOT a scene or concept sheet. Make ONE square 1024x1024 RGBA image with transparent background and a precisely aligned 4 by 4 regular grid of 16 cells, each cell 256x256 pixels. NO gutters between cells, no labels, no gridlines, no text, no camera perspective. Every item is orthographic and front-facing or flat top surface, filling the cell with a 16px transparent padding. This will texture extruded 3D sprites in a dark 1990s gothic-punk topdown city: charcoal soot, blackened iron, decayed dark walnut, weathered cathedral stone, restrained amber light. Painterly gritty low contrast textures with broad readable tonal shapes, matte materials, sharp silhouettes. NOT cartoon, NOT shiny toy metal, NOT clean outlined vector art, NOT voxel, NOT ornate gold fantasy. Cell layout exactly in row-major order: Row1 col1: rectangular flat black cast iron plate with extremely subtle worn grain and no raised border. Row1 col2: simple dark charcoal iron square cap seen from above, narrow worn bevel only. Row1 col3: FRONT of a slender old street lantern, black iron frame enclosing two narrow muted warm amber panes, transparent outside silhouette. Row1 col4: single long rectangular dark aged wooden board texture straight-on, grain horizontal, matte, no gold border. Row2 col1: dark cast iron side support bracket of an old park bench, readable thin silhouette and transparent openings. Row2 col2: flat dirty charcoal green painted metal panel with subtle rust at base. Row2 col3: TOP VIEW of an old rectangular dumpster lid, three shallow ribs, dark gray green muted industrial paint. Row2 col4: FRONT of the same old dumpster, rectangular metal panel with very small torn unreadable paper label, dirty matte olive charcoal. Row3 col1: old bent dumpster lid, isolated flat FRONT silhouette, dark metal. Row3 col2: flat dark aged walnut wood panel for church pews, vertical grain, chipped varnish, dark almost black. Row3 col3: FRONT flat carved oak church pew end, rectangular base and pointed gothic arch cutout, worn dark walnut, no gold trim, transparent openings. Row3 col4: rectangular flat wall surface of rough very dark grey cathedral ashlar stone, blocks and fine cracks, moss and soot, NO framed panel or bevel. Row4 col1: flat TOP of a worn off-white altar runner with a small desaturated burgundy cross, dirty ivory fabric, muted brightness. Row4 col2: a single slender old beeswax candle on black metal saucer, TOP VIEW with tiny muted amber center, genuine transparent outside silhouette. Row4 col3: a rectangular flat FRONT wrought iron fence section with slender vertical bars and pointed tips, no backdrop between bars, rusty black iron with subdued gray highlights. Row4 col4: rectangular flat top of a thin black iron rail, nearly black rough surface, no shine. Exact equal cells, no objects spanning cells. Preserve transparent padding and all cutouts. Designed to read at small game scale against rough stone city textures.

#### People and vehicle surfaces

Use case: stylized-concept. Asset type: ONE production game texture atlas, 4 columns x 2 rows, wide 2:1 aspect ratio. Precisely regular equal square cells, no captions, no labels, no grid lines, no text, transparent background around cutout silhouettes. Dark gritty 1990s gothic-punk crime/vampire art, like painted grimy miniature game sprites, NOT clean vector art, NOT cartoon, NOT cute or chibi, NOT shiny 3D render. Sharp planar shapes and restrained brush texture, low saturation. Exact layout: TOP ROW cell 1: only a serious angular adult male FACE from forehead to jaw, face facing straight towards viewer, without neck or hair, pale neutral grayscale skin, sharp cheekbones, tired dark eyes, narrow nose, subtle unshaven jaw, NO smile, isolated alpha outside face. Top row cell 2: same FACE but more pallid and wearing slim BLACK SUNGLASSES, angular cheekbones, isolated without hair or neck. Top row cell 3: FRONT torso surface of a worn black leather biker jacket from shoulders to waist, no head, no arms, no legs, visible slim angular lapels and asymmetric zip, fill most cell. Top row cell 4: FRONT torso surface of an old street police uniform from shoulders to waist, no head/arms/legs, muted dark gray, small very subdued brass shield, two pockets, no writing. BOTTOM ROW cell 1: FRONT torso surface of an old gray canvas street jacket over worn charcoal shirt, small uneven seams, no head/arms/legs, matte fabric. Bottom row cell 2: BACK torso surface of worn charcoal leather jacket from shoulders to waist, no head/arms/legs, faint seam between shoulders, no logo. Bottom row cell 3: rectangular edge-to-edge neutral medium-gray painted old car steel surface, flat orthographic, restrained broad grime and weathering, very fine scratches, subtle low contrast large tonal variation, no rust holes, NO bevels, no outline. Bottom row cell 4: rectangular edge-to-edge smoked gray automobile window glass surface, flat orthographic, faint grime and restrained diagonal gray reflection, not bright blue or shiny, no border or window framing. ALL clothing surfaces should use desaturated medium-dark gray highlights instead of bright white, and large simple readable shapes. Faces should not look like masks, skulls, cartoons or stickers. Real alpha background in silhouette cells. Exact equal cells, no object outside its cell.

The generated dimensions and cell spacing differ from the requested ideal grid. Crop coordinates were inspected and fitted to the actual outputs; runtime packing preserves those crops rather than assuming the requested pixel dimensions.
