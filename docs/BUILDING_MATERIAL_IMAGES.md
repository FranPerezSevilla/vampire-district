# Materiales de imagen para edificios

## Alcance
Tejado del hospital y urgencias, fachadas de edificios con paralaje y cartel frontal HOSPITAL. No se modifica geometría, colisiones ni navegación. Autoridad: BuildingParallax; preparación de superficies en BuildingMaterialImages.

## Recursos
- `phaser/assets/materials/slate-gray-v1.png`: pizarra neutra.
- `phaser/assets/materials/masonry-gray-v1.png`: mampostería neutra.

Generados con la herramienta integrada de imágenes; no CLI. La generación conserva sus originales. El runtime reduce cada muestra a un patrón de 128 × 128, en escala de grises, con repetición reflejada para que coincidan los bordes. Las fachadas reciben el color de BuildingIdentity mediante multiplicación. El tejado conserva sus planos y detalles sobre el material. La repetición reflejada puede producir simetrías leves.

## Cartel
Placa frontal oscura con borde y cruz roja. Texto real Canvas 2D, Georgia bold con fallback serif. No se usan glifos formados por rectángulos. La placa está integrada en la textura frontal y sigue la perspectiva.

## Rendimiento y ciclo de vida
Las dos versiones WebP de 512 × 512 se precargan una vez. Los PNG originales se conservan para edición y no se cargan en la partida. Se preparan superficies por edificio/segmento visible, no por fotograma. Cada fachada usa una malla de 8 x 8 celdas WebGL en el mismo lote; interpolan los cuatro vértices de la pared y reducen el quiebre diagonal de ventanas que producía un único quad afín. Las ventanas y detalles quedan incluidos en la misma textura. Anchura limitada a 1024 px y altura a 256 px (384 en torres). Las texturas de un edificio se eliminan al salir del conjunto residente, y al cerrar la escena. Es un renderer WebGL, acorde al runtime actual; no añade fallback Canvas.

La caché estática de suelo permanece separada. Esto no elimina el coste de preparar por primera vez el pavimento ni garantiza 60 FPS en todos los equipos.

## Prompts usados

### Pizarra
Create a single seamless tileable grayscale material texture for a topdown gothic punk videogame hospital roof. 512x512 square image. Orthographic flat surface only, evenly lit diffuse albedo, absolutely no perspective or directional lighting. Small overlapping rectangular weathered slate tiles arranged in staggered horizontal courses, 8 columns and 12 rows across image. Stylized angular restrained detail, subtle mottled stone grain and worn tile edges, medium gray palette intended for runtime green tint. Seamless repeat on all four edges, matching courses at boundaries. No frame, no text, no building, no environment, no dramatic cracks, no baked shadows or highlights.

### Mampostería
One seamless repeating grayscale architectural material texture, square 512x512. Flat orthographic diffuse albedo of aged limestone masonry and weathered plaster for dark gothic punk videogame facades. Restrained stylized angular stone blocks, shallow thin mortar joints in staggered courses, medium gray neutral tintable base with subtle dark mineral patina and fine grain. About 6 stones wide and 8 courses high. No windows, doors, lettering, plants, lighting gradients, perspective or objects. All four borders designed to repeat seamlessly, understated contrast without large distinctive stains.

## Revisión visual
Pizarra menos verdosa, piedra neutralizada y sombras de cornisa integradas en la textura. Luz cálida discreta en el frente hospitalario. Se elimina la cruz del tejado principal; la identificación permanece en el cartel frontal. Estas mejoras no equivalen a una renovación completa de la arquitectura o la iluminación urbana.
