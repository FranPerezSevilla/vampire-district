# Ordinary night-city materials

## Quiet rooftop equipment — 2026-09-20

[ordinary-rooftop-objects-v2.png](ordinary-rooftop-objects-v2.png) replaces v1 for ventilation boxes, chimneys and access huts. Dark broad metal/stone surfaces, subdued wear and crisp louvers/handles match the accepted quiet roofs. Same 1254 × 1254 sheet, six regions, UVs and mesh geometry. Built-in ImageGen edit; [exact prompt and provenance](ordinary-rooftop-objects-v2.md). Street/cathedral furniture uses the companion [quiet prop atlas](../props/gothic-street-atlas-v2.md). No character, car or building material change in this pass.

## West Market rollout — 2026-09-20

The quiet `ordinary-block-v2.png` / `ordinary-block-roofs-v2.png` kit now covers all eleven West Market volumes. One complementary atlas adds courtyard housing, a warehouse and a service workshop: [west-market-facades-v1.png](west-market-facades-v1.png). Its exact prompt, source path, dimensions and crop contract are in [west-market-facades-v1.md](west-market-facades-v1.md). Facades are composed through the existing material cache; the new source adds about 6 MiB decoded, with no per-frame image processing. Other districts retain their existing art.

## ordinary-facades-v2.png — active facade material

Generated with the built-in image_gen tool (imagegen skill), editing v1 against the actual hospital/street and vehicle-body study. Dark smoke-grey render/stone replaces the fine red-brick field; simpler surrounds and warm panes match the restrained city art. Original generated PNG copied losslessly from `exec-3b605819-cb08-48f5-a381-ca1aab7ed300.png`. Same 2-column / 4-row layout and 1254 × 1254 dimensions. Composition excludes 5 px of the panel borders to remove the dark sheet separators. v1 is retained for comparison and not loaded at runtime; roofs/equipment continue using their existing v1 atlases.

Final prompt:

Use case: precise-object-edit.
Asset type: replacement production facade atlas for an existing top-down 2.5D gothic-punk 1990s game.
Input 1 is the atlas to replace, layout reference ONLY. Input 2 is the actual existing game's hospital/street, the MATERIAL AND VALUE STYLE target. Input 3 shows the game's cars, a reference for restrained broad shaded planes and readable shapes.

Repaint input 1 completely as a coherent stylized game-art facade sheet that fits input 2 and input 3. Preserve the EXACT two-column, four-equal-row eight-panel atlas layout and each panel's window/door positions and usage, not its brick texture. Deliver only the full square atlas, no labels/gutters.

MATERIAL DIRECTION: old urban buildings of soot-black stone and smoke-grey worn lime render, restrained blue-grey undertones. Broad quiet dark surfaces, softly suggested large stone blocks in places, muted non-repeating broad staining near the base. Subtle hand-painted/pre-rendered shading and sharply readable architectural edges. Material grain nearly invisible at game scale. Palette charcoal #191e22 to dark warm-grey #333735; recessed glass #0b1419; selected luminous panes muted amber gold. Wall surfaces predominantly neutral, not red, brown or green.
Less ornate architecture: narrow dark stone window surrounds with one readable bevel and thin sill, steel/painted wood door frames. Windows have simple black mullions and inset glass, solid readable proportions. Slight curved or squared lintels are fine, no little decorative bricks, no carved ornaments or columns on every window. Lighting belongs to interiors: warm opaque panes with a few simple dark curtain divisions, no detailed miniature room illustrations, no lamp silhouettes, no exterior glow, no mist or bloom. Preserve quiet space between openings.

PANELS, row-major:
0 upper-left: two tall narrow unlit rectangular residential windows at x25% and75%, window span y20–80%; smoky worn charcoal render with barely hinted masonry at the base, broad continuous wall.
1 upper-right: SAME module, left window unlit, right window amber lit, same coordinates and wall material.
2 row2-left: recessed residential double entrance in centre, warm small transom, two smaller dark windows at sides, door threshold at bottom. Plain strong stone surround.
3 row2-right: old modest shopfront, left40% amber display glass with only simple dark silhouettes, small centre door, right closed charcoal shutter with broad restrained horizontal ribs. No fascia or writing.
4 row3-left: industrial two tall steel windows, left dark right a small amber pane, large quiet blackened stone blocks. Few wide joints, subtle contrast.
5 row3-right: austere dark stone urban facade with two narrow rectangular windows left unlit right warm, plain slender vertical reveals and one simple lintel, no ornate deco floral carving.
6 bottom-left: blank seamless matching dark charcoal render / blackened masonry, low-contrast large subtle patches, no obvious grid, no objects. This wall tile must meet the outer edges of all other panels seamlessly.
7 bottom-right: closed industrial charcoal shutter across left70%, small steel service door at right, one tiny warm utility light above that door.

Strict orthographic straight-on elevations with no perspective. Crisp raster illustration in the existing game's style; depth from restrained value planes, no vector/cartoon outlines and no photorealistic noisy microdetail. No dense tiny red brick anywhere. No gritty white speckles, scratches on every surface, heavy horizontal cornices, bevels around the entire panel, new text, people, streets or roofs. Output 1024x1024 square.

## ordinary-rooftop-objects-v1.png

Independent rooftop cuboid surfaces: 3 columns; top row ends at y=40.8% in delivered output. Ventilation, chimney, access enclosure top surfaces above their upright sides. Projection crops normalized UVs directly from the shared atlas. The access door appears only on the south face. No equipment from ordinary-roofs-v1.png is painted onto a roof.

Use case: stylized-concept. Production GAME MATERIAL ATLAS, not a scene or illustration. Create ONE square sheet, exactly THREE equal columns and TWO equal rows, no labels, margins or grid lines. Each rectangular cell filled edge to edge by a flat orthographic object surface texture, with zero perspective and NO background. Dark restrained realistic 1990s gothic-punk city, charcoal metal, worn dark brick, crisp readable construction, muted cool highlights, no cartoon or voxel. These six flat surfaces will be mapped onto real rectangular rooftop objects. TOP ROW: left is the TOP PANEL of a boxy HVAC ventilation unit, dark square-ish panel with centred circular fan grille and screw heads, fills entire cell; middle is the TOP of a dark brick chimney, coping and centred black square flue, fills entire cell; right is the TOP of a roof access enclosure, dark flat metal roof panel with seams, fills entire cell. BOTTOM ROW: left is a straight-on VERTICAL SIDE PANEL of the same HVAC machine, horizontal metal louvres and small utility inspection hatch, fills entire cell; middle is straight-on VERTICAL SIDE of the chimney, soot-dark brick with restrained mortar joints, fills entire cell; right is straight-on FRONT WALL of the rooftop access enclosure, dark grey masonry and one centred narrow steel access door with black handle and small wired-glass pane, door bottom touches lower edge. Absolutely no surrounding rooftop field, exterior scene, cast shadows outside the panel, perspective side planes, floor, people, letters or symbols. Fully opaque sheet. High-quality authored raster textures with quiet broad dark surfaces, readable bevels and recesses. Target square 1024x1024.

Generated with built-in image_gen using the imagegen skill. Original PNG output copied losslessly; normalized atlas coordinates tolerate the delivered 1254 px dimension. Facades: 2 columns × 4 rows. Roofs: 2 × 2. Only the two upper roof cells are used: membrane and nine-slice coping. Equipment in the unused lower cells is superseded by separate rooftop objects.

## ordinary-facades-v1.png

Use case: stylized-concept. Asset type: production raster modular facade atlas for a top-down 2.5D gothic-punk 1990s night-city game, NOT a concept scene.
Reference image is STYLE ONLY: blackened brick, believable old urban construction, sparse amber interiors, cinematic but legible small-scale forms. Do not copy its composition.
Make a square 1024x1024 texture atlas, EXACTLY TWO COLUMNS and FOUR ROWS. Eight rectangular panels each 512 wide x 256 high filling the canvas with NO GUTTERS, NO LABELS, NO GRID LINES. All panels are perfectly straight-on orthographic wall elevations, zero perspective/foreshortening, all edges horizontal/vertical. Each panel depicts ONE storey, consistent construction scale, about 7 metres wide by 3.5 metres tall. Every panel has matching soot-dark neutral charcoal brick at its outer edges, masonry should read as near-black in a night scene but have restrained readable mid-dark detail. Not crushed black. No huge contrast outlines. Large quiet masonry areas. Crisp painted/pre-rendered realism, no pixel art, no voxel, no cartoon.
Top row LEFT: dark red-black tenement brick, two elegant narrow tall sash windows, rectangular with subtly arched stone lintels and projecting dark stone sills. Window centres at 25% and 75% panel width; openings only 15% panel width, vertical span from 20% to 80% of panel height. Both interiors unlit nearly black blue-grey, restrained frame highlights.
Top row RIGHT: IDENTICAL architecture and positions, LEFT window unlit, RIGHT window warm golden lit showing simple curtain silhouette and hint of interior depth; no outer halo, no baked glow, no fog.
Second row LEFT: ground-floor brick panel, centred substantial recessed residential entrance with dark double doors and a small amber transom, two small unlit storefront windows to its sides. Door reaches panel bottom. Narrow lintel, black iron detail, no signs or words.
Second row RIGHT: ground-floor old shop with one warmly lit display window taking left 40%, dark narrow door in middle, closed charcoal steel shutter on right; restrained aged brass details, no writing.
Third row LEFT: industrial upper floor in same dark brick, two tall steel multipane windows, only one little amber pane, generous masonry surrounding them. 
Third row RIGHT: restrained old deco facade, charcoal stone facing, two elegant rectangular recessed windows dark glass and vertical pilasters; one little warm pane. No church shapes.
Bottom row LEFT: completely BLANK matching dark soot brick wall, subtly varied bricks, no objects, no stains with obvious repeated pattern, seamless at left and right.
Bottom row RIGHT: ground floor industrial loading entrance, broad closed dark ribbed steel shutter and one small service door, discrete warm utility lamp, no lettering.
No roof, street, sky, people, vehicles, plants. No baked shadows extending outside panels. Texture detail restrained, material depth and strong proportions are crucial.

## ordinary-roofs-v1.png

Use case: stylized-concept. Asset type: production roof texture / detail atlas for gothic-punk 1990s top-down city game. Use reference as style only: charcoal roof, weathered stone coping, quiet large dark areas and meaningful silhouettes, realistic authored raster game art.
Output SQUARE 1024x1024, EXACTLY TWO COLUMNS and TWO ROWS, four 512x512 tiles with NO GUTTER, NO LABELS or dividers, no perspective. All top-down orthographic 90 degrees looking straight down.
TOP LEFT: seamless coal-black bitumen urban flat roof membrane, large irregular rectangular roof seams at real architectural scale, subtle damp patches, subdued cool grey, fine subtle grain but no busy random speckle. No perimeter, no objects. Flat even neutral illumination suitable for repeating in game.
TOP RIGHT: an entire square old flat roof viewed strictly top-down, dark quiet bitumen field surrounded on all four sides by a narrow detailed weathered charcoal stone coping/parapet. Crisp bevels and small construction joints, cap depth only 6% of tile width, subdued silver-grey edge at top, no bright cream border, no objects inside, no perspective side wall.
BOTTOM LEFT: a roof service arrangement seen strictly TOP DOWN: one dark metal square ventilation unit with round black fan grate occupying about 45% of tile, and a smaller masonry chimney to its right, a short connecting metal duct. Both on same unobtrusive dark membrane as top left. Shallow realistic shadows about 5px to bottom right, no cinematic spotlight, no glow. Objects clustered in centre with generous empty dark surrounding field.
BOTTOM RIGHT: a low rectangular roof access housing with flat metal hatch on top, short pipes beside it, dark brick and steel. TOP DOWN, no visible vertical front facade, no oblique angle. Object group in centre covers about 50% of cell, otherwise the same dark roof membrane. Fine but legible rim highlights.
No exterior building facade, no grass, roads, people, vehicles, text, icons or symbols. No ornate gothic fantasy carvings. This is believable urban night architecture, deliberately quiet and reusable.
# West Market architecture trial — 2026-09-20

`ordinary-block-v1.png` is an authored raster atlas generated with the built-in image_gen tool (imagegen skill), using the user's night-city concept as a mood reference. Original: `C:/Users/Franelly/.codex/generated_images/01a0a55f-f06c-7ff3-9e79-c762c9424c59/exec-d6e42efc-e059-4b55-9889-279e619d71f9.png`. Saved intact, no procedural raster replacement or post-generation repainting.

Only tenementNorth, marketBlock and shops use the new elevation recipes. Others retain v2. The sheet contains three composed two-storey elevations and a row of secondary wall/window materials. Actual generated row boundaries differ from the requested equal quarters; normalized crop coordinates live in OrdinaryBlockArchitecture.js. The shop front uses the narrower middle half of its row. The hierarchy of piers, entrance and upper windows is preserved as one elevation. This is a bounded two-storey art trial; taller and substantially different proportions need additional authored recipes before wider adoption.

Relief is a continuous shallow fold of the existing facade, aligned to the authored piers and fading flush into ground/roof. No extra collider, roof geometry or separate pillar sprite. One shared atlas; existing composed facade size and residency budget. Warm spill uses the shared cached light stamp, added once during material preparation.

## Exact generation prompt: block trial

```text
Use case: stylized-concept
Asset type: production texture atlas for a dark top-down 2.5D 1990s gothic-punk city game. This is a flat orthographic front-elevation ART SHEET to map onto real projected building facades, NOT a concept perspective painting.
Input: supplied image is mood reference only: near-black building masses, crisp subtle blue-grey worn stone edges, selective warm amber interiors, decayed urban grandeur and analog 1990s street culture. Match its understated texture and readable light, NOT photoreal noise.
Output portrait 1536 x 2048, FOUR EXACTLY EQUAL horizontal rows. Every row exactly one quarter of sheet height. No headings, gutters, borders or perspective. All surfaces fill their row to its edges. Front faces only, no visible roof tops, side walls, sky, people, ground or vehicles.
ROWS:
1 top: two-storey former wealthy urban tenement, five sparse tall recessed bays, strong central tall stone entrance arch with heavy dark double door, central upper paired narrow window and shallow black iron balcony, two flanking recessed windows each side, one warm amber upper window at x=29% and faint warm transom at central door. Two-storey vertical stone piers at x=10%, 40%, 60%, 90%, crisp and dignified. Thin aged coping, quiet soot-black masonry with broad smooth shadow fields. Discreet torn paper and electrical conduit at ground level, one boarded ground bay. Architecture spans x=9% to91%; outside is plain same wall, so it can be cropped. Door and window sizes physically plausible for two storeys, no miniature decorative clutter.
2 second: a former elegant covered market now occupied by cheap late-night businesses, same two storeys and overall size as row1. Three distinct deeply recessed stone arches across the ground floor, one with warm amber shop interior at x=28%, central battered closed roller shutter, right dark doorway and wheat-pasted band posters. Upper floor has three tall restrained rectangular windows with projecting stone lintels, shallow black iron rail under one, faded former stone nameplate without readable text. Sparse warm upper window at x=71%. Strong plain masonry piers. Architecture spans x=9% to91%. Dark brown-black stone, hints of oxidized iron, no neon glow.
3 third: a narrower two-storey former townhouse adapted into a basement music shop/bar. Its ENTIRE front centered between x=25% and75% only; outside these bounds quiet matching wall. Two tall upper windows with deep frames, one mostly shuttered, one dim amber at x=59%. Ground floor asymmetrical: a recessed warm entrance at x=40%, metal shutter with a single subdued wine-red painted abstract mark, one small amber-lit record-shop display at x=58%, a black sign board reading AFTER HOURS in small pale ivory condensed lettering over the entrance (no other text), torn music flyers in a coherent low-detail patch. A drainpipe and black iron cellar railing. Vertically proportioned old stone framework, weathered narrow cornice.
4 bottom: utility wall strip divided into FOUR equal square panels left-to-right, perfectly separate without lines: first solid quiet soot-black masonry matching above, no openings; second one tall dark recessed service window centered, no other openings; third one tall amber-lit recessed window centered with interior light only (no external glow); fourth dark weathered stone coping top surface and shallow bevels, front elevation, no text. These four panels are reusable.
All three fronts have a continuous finished base flush at the exact bottom of each row, and their coping at the very top. Two floors ONLY: ground 50% of height and upper50%. Consistent dark palette across rows, no huge horizontal light bands, no red brick grid, no white window trim, no church ornament, no spires. Simple large convincing material shapes and readable architecture even at low resolution. Warm interiors crisp and bright but external light halos absent; game adds those separately. Gothic-punk through oppressive urban elegance, deep apertures, iron and occupied decayed grandeur. NOT medieval fantasy, NOT Victorian haunted house caricature, NOT clean generic suburban apartment, NOT bright arcade. Near black yet edges visible.
```

## West Market roof atlas — 2026-09-20

`ordinary-block-roofs-v1.png` was generated with built-in image_gen (imagegen skill), with the accepted `ordinary-block-v1.png` as its material reference. Original output: `C:/Users/Franelly/.codex/generated_images/01a0a55f-f06c-7ff3-9e79-c762c9424c59/exec-80a5497b-4390-4c1b-8a33-ec72d69fcb22.png`. Copied intact, with no procedural raster replacement or image repainting.

Six surfaces, row-major: slate, standing-seam zinc, bitumen terrace, framed glass, dormer front, roof-access front. Actual generated rows are unequal; exact normalized inset crops are in `OrdinaryBlockRoofs.js` (`CELLS`). This avoids pulling neighbouring panels into a surface. All projected meshes share the single atlas. The plain terrace receives a subdued blue-grey tint; lighted panes remain in their authored surfaces. Roof geometry, dormers, skylight, access enclosure and railing are separate from the baked facade. Existing ventilation/chimney objects sit on the raised terrace and avoid its occupied areas.

Delivered size: 1254 × 1254, 3,282,314 bytes on disk and 6,290,064 decoded RGBA bytes. Loaded once for the three-building trial.

The accepted facade atlas is reused at physical storey scale for the 4/2/3-floor trial. Additional upper strips are mirrored on alternating floors; the shop nameboard is removed from added rows using a quiet masonry crop, leaving one original AFTER HOURS sign. This extends the bounded trial only; substantially different proportions still need authored recipes.

### Exact generation prompt

```text
Use case: stylized-concept
Asset type: production raster surface atlas for dark 1990s gothic-punk urban roofs in a top-down 2.5D game.
Input reference shows the accepted building masonry/iron style. Match its near black tones, weathered materials and clear forms, with much quieter texture. Generate materials and small facade elevations ONLY, not buildings or a city scene.
SQUARE image 1536x1536, exactly TWO columns and THREE equal rows = SIX rectangular cells with NO gutters or outlines. Each cell entire surface, perfectly orthographic, crisp usable at small game scale. Keep all tile boundaries precisely at x50%, y33.333%, y66.666%.
Cell top-left: seamless charcoal/blue-black slate roofing material, small overlapping horizontal slate rows, subtle edge highlights, slight wear, no large cracks, no props, no perspective.
Cell top-right: seamless dark standing seam zinc roof, vertical dark metal seams spaced regularly, subtle cold reflections, almost black, restrained tarnish, no props.
Cell middle-left: quiet seamless worn dark bitumen terrace material, broad soft mottling, no tile grid, no borders, no strong patches or objects.
Cell middle-right: a long rectangular skylight pane surface viewed perfectly straight-on, black metal frame right at cell edges, six vertical mullions and one horizontal middle mullion, smoked glass with a very subtle muted warm interior in two panes, dusty but crisp, no exaggerated glow, flat plane with no visible sides.
Cell bottom-left: small roof dormer FRONT ELEVATION filling cell, one tall narrow rectangular window centered in a deep dark weathered zinc housing; window inner width22% of cell, height64%, with two narrow panes separated by a dark mullion. One pane muted amber-lit. Housing fills cell outside window with quiet dark zinc, absolutely NO sky, transparent background or ground. No triangular roof; roof will be separate geometry.
Cell bottom-right: roof access enclosure FRONT ELEVATION filling cell, one narrow dark metal service door slightly to the right of center, charcoal stone walls matching the supplied facade. Door inner width30% and height80% of cell. Small service lamp at top left of door; warm bulb only, no giant glow. No roof, ground, lettering or perspective.
Color: predominantly near black, charcoal, cold dark greys; tiny warm amber glass only. Understated raster painted game art, crisp intentional edges, no glossy plastic, no pixel voxel look, no white frames, no ornate decorative noise. No text, no labels, no symbols.
```

## Quiet material revision — 2026-09-20

Active replacements for the West Market trial:
- `ordinary-block-v2.png`: 1086 × 1448, 1,966,522 bytes on disk; 6,290,112 decoded RGBA bytes
- `ordinary-block-roofs-v2.png`: 1254 × 1254, 1,853,605 bytes on disk; 6,290,064 decoded RGBA bytes

Built-in image_gen edits via the imagegen skill. Each v1 source atlas was the sole edit target, inspected first. The entire composition, unequal row boundaries and opening positions were preserved; original crop coordinates still apply. Only surface drawing/value hierarchy changed: quieter near-black walls, less chalky edge wear, calm slate/zinc/bitumen, retained warm interiors. No procedural repainting, external image editing or extra render filters. Original outputs copied intact:
- Facade: `C:/Users/Franelly/.codex/generated_images/01a0a55f-f06c-7ff3-9e79-c762c9424c59/exec-b94a94b8-d7b0-4544-ada5-74826dc14642.png`
- Roof: `C:/Users/Franelly/.codex/generated_images/01a0a55f-f06c-7ff3-9e79-c762c9424c59/exec-f183515d-136b-4421-ab41-33c825995233.png`

Only v2 is preloaded. Both v1 files remain on disk for comparison. Two textures replace two textures, with identical decoded dimensions. No changes to mesh geometry, frame work, light stamps or storey/door scale.

### Exact edit prompt: facade v2

```text
Use case: precise-object-edit
Asset type: replacement production facade texture atlas for an existing top-down 2.5D 1990s gothic-punk game.
Input 1 is the EDIT TARGET: preserve its exact canvas aspect ratio, full framing, all irregular row boundaries, and exact pixel-relative positions/sizes of every column, window, door, balcony, shutter, shopfront, sign and light. Keep the composition completely fixed. Do not add or remove architectural openings.
Primary request: repaint ONLY material surfaces and their value hierarchy. Current walls and stone piers are far too mottled and uniformly edge-highlighted. Remove about 90% of the fine scratches, chalky specks, flaking patches, tiny cracks and granular contrast. Replace them with large quiet near-black soot-stone / worn charcoal render areas. Broad subtle smooth tonal variation, almost invisible masonry joints. Dark stone piers should merge into the wall masses, with restrained narrow cool edge accents only on a few projecting edges. Reduce the bright repetitive horizontal and vertical outlines greatly, maintaining crisp shapes, no blur.
Materials: dark wall faces around charcoal #101419 to #191d22, most shadow material details barely lighter than their own base; worn broad edges up to restrained #323941 in isolated places. No bright white or silver stone chips. No speckled brown marble effect. Keep broad simple shadow planes in mouldings and recesses. Quiet, weighty, almost black urban elegance. This is simplification of the material drawing, not a dark exposure filter over the whole sheet.
KEEP warm luminous glass and entry bulbs at approximately their original warm amber brightness, sharp mullions, simple dark curtain silhouettes. Windows and entrances remain visual focal points. All other dark windows read as simple recessed openings. Keep sparse torn posters and the muted red shutter mark in the third row but simplify their tiny paper noise. Preserve EXACT readable text "AFTER HOURS" once in its existing position, same size. No other new text.
Preserve bottom-row four secondary-material cells, including blank wall, dark window, lit window and coping, at their existing positions. Their stone should match the quiet near-black walls above.
Maintain original orthographic elevation with zero perspective, all rows edge to edge, no margins/gutters, no outer background, no crop, no camera move, no added lighting blooms. Crisp authored raster game art. No defocus, no smearing, no painterly strokes or vector/cartoon borders. Keep architecture intact; dramatically reduce surface noise and broad trim brightness. Return the full edited portrait sheet at the same proportions as input.
```

### Exact edit prompt: roofs v2

```text
Use case: precise-object-edit
Asset type: replacement production roof surface atlas for a top-down 2.5D 1990s gothic-punk game.
Input 1 is the EDIT TARGET. Keep EXACT full square composition, two columns, all unequal row boundaries, six original cell contents, all mullions/door/window/lamp positions, and all material seam spacing. No crop, no rearrangement, no new objects.
Primary request: simplify surface drawing into calm near-black masses. Remove about 90% of the fine speckled/chalky/scratched grain and marbled mottling, while keeping sharp physical edges. Do not blur or smear. Strongly reduce continuous bright outlines around every slate tile and metal seam. Most joints are barely visible dark separations, with occasional restrained cool edge light. Keep plausible slate/zinc materials, not glossy or plastic.
Top-left slate cell: near-black blue slate, largely uniform flat shaded tile faces, only subtle row overlaps and a few restrained clean cool highlights; no chalky scratches.
Top-right zinc: very dark blue-grey metal with soft broad tonal variation, narrow restrained seams, no gritty speckle.
Middle-left bitumen: quiet almost black charcoal, just very gentle large-scale value variation, NO fine grain, strong mottle, visible pattern, objects, borders or bright patches. Must repeat unobtrusively.
Middle-right skylight: keep sharp black metal framing and same panes, dark clean glass, keep the two warm panes luminous at their original brightness; remove the grain on glass, keep simple interior silhouettes.
Bottom-left dormer front: same housing/window placement, clean dark zinc planes, sharply recessed window. Keep amber pane brightness and mullions, reduce redundant bright nested frame lines and all speckling.
Bottom-right access front: same dark service door, small warm lamp and stone blocks. Smooth soot-dark masonry, very faint joints, no white chips or brown flaking. Lamp remains a warm focal point.
Large dark areas around #101419 to #1b2027; selected material edges can reach muted #333d49, warm light brightness preserved. Avoid blanket exposure reduction of luminous glass. Fixed orthographic surfaces, no perspective, borders, gutters, labels, symbols or added glow. Return the entire edited square sheet, same proportions, crisp and calm.
```
