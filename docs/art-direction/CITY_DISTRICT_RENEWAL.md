# Ciudad: barrios con intención y fachadas nocturnas

20 de septiembre de 2026 · Implementado en la preview local, puerto 4174.

## Decisión sobre la ciudad

La ciudad actual tiene espacio suficiente: **4800 × 3600**, catorce barrios y una red de **107 nodos / 148 conexiones**, todos conectados. No se amplía el mapa ni se cambia la red de tráfico. El problema era la colocación dispersa de edificios y rellenos, más que la falta de terreno.

Se sustituyen los rellenos incidentales por **102 volúmenes definidos a mano**, 75 superficies peatonales y 48 anclajes de mobiliario. El total de registros de edificios/colisión pasa de 188 a 193. Ese total incluye muros y piezas de los enclaves; no equivale a 193 edificios independientes. West Market conserva su composición aprobada. Los grandes recintos conservan sus accesos y geometría.

El análisis de ocupación mide rectángulos de colisión, no superficie de cubierta: la catedral, por ejemplo, tiene interior transitable y no debe interpretarse como un solar casi vacío por su porcentaje bajo.

- [Plano anterior](city-districts-before.png)
- [Plano actual](city-districts-after.png)
- [Galería real de los 14 barrios](city-districts-gallery.png)
- [Datos del análisis](city-districts-after.json)

Los planos son diagramas de estructura. La galería contiene capturas reales del juego con NS 500% / EW 150% para inspeccionar las fachadas. Los valores por defecto siguen en 100% / 100%, y el volumen de los coches sigue independiente.

## Qué cambia en cada barrio

| Barrio | Organización del espacio | Fachadas, tejados y objetos | Punto de revisión |
|---|---|---|---|
| Hospital Ward | Residencias de personal y patio al norte; paseo de hospicio al oeste. | Vivienda oscura, piedra académica, mansardas y zinc; banco y farola. Se conserva el acceso de ambulancias. | 489, 119 |
| Civic Centre | Plaza del ayuntamiento encuadrada por dos pabellones; paso de servicio de archivos. | Art déco de piedra negra, cubiertas sobrias, bancos y luces en el eje de llegada. | 2749, 603 |
| Cathedral Hill | Patio alargado entre biblioteca, casa y taller del recinto. | Gótico académico y vivienda antigua; mansardas y taller bajo. Banco y luz discreta. | 3297, 558 |
| North Harbor | Paseo de personal con patios alternos entre naves y alojamiento. | Almacenes, fábrica y vivienda portuaria; tejados a dos aguas y equipamiento industrial. | 4615, 585 |
| West Market | Se conservan plaza, patio residencial, calle comercial y pasos aprobados. | Se mantienen sus familias de fachada y cubiertas; mobiliario puntual. | 838, 1610 |
| Old Quarter | Patio de imprenta, paso posterior y frentes hacia Vesper. | Viviendas antiguas, talleres y locales nocturnos; mansardas, terraza y lucernario. | 1398, 1341 |
| Glasshouse | Paseo de galerías, patio comercial y calle de servicio del hotel. | Piedra negra y marcos de bronce; terrazas y cubiertas de galería. | 2710, 1519 |
| University District | Edificio central con dos alas y patio de lectura; residencias frente al campus. | Gótico académico, mansardas y viviendas de estudiantes; bancos y farolas. Escalera de azotea recolocada en el ala real. | 3880, 1544 |
| Canal West | Patio de almacén rehabilitado y calle de vivienda obrera. | Almacenes con lucernarios, casas de canal y talleres; banco, carga y luz de servicio. | 616, 2406 |
| Foundry Ward | Naves paralelas con patios de carga y corredores entre anexos. | Fábricas con dientes de sierra, depósitos y chimeneas independientes; transformador y cajas. | 2078, 2365 |
| Canal East | Instalaciones de refrigeración, patio de servicio y frente residencial. | Naves, almacenes y vivienda de canal; cubierta industrial, carga y equipos de servicio. | 2710, 2480 |
| Harbor North | Frente de aduanas y sucesión de patios de inspección. | Oficinas art déco intercaladas con depósitos bajos; carga, banco y alumbrado puntual. | 4615, 2428 |
| Blackwater Industrial | Frentes de naves separados por patios de maquinaria y pasos de mantenimiento. | Fábricas, almacenes y casetas de control de alturas distintas; chimeneas y equipos. | 1853, 3460 |
| South Harbor | Naves pareadas, patio de carga y patio de reparaciones con oficina baja. | Almacenes, taller industrial y pequeño edificio cívico; carga y luz de servicio. | 4020, 3475 |

Los nombres de edificios sirven para definir su uso y carácter urbano. Esta pasada no añade tiendas funcionales, misiones ni interiores nuevos.

## Vesper, comisaría y catedral

Los tres reciben **arte de fachada nuevo**, manteniendo sus huecos y recortes existentes:

- **Vesper:** antiguo teatro ennegrecido; relieves más tranquilos, metal oscuro, detalles granates y luz ámbar. La puerta de servicio y la forma del tejado se conservan.
- **Comisaría:** grandes paños de piedra carbón, pilastras art déco nítidas y ventanas espaciadas con interiores cálidos. La fortaleza, el parking y las puertas conservan su geometría.
- **Catedral:** piedra casi negra, tracería legible y vidrio de color contenido. Conserva rosetón, portal, torres y espacio interior transitable.

Las fuentes ya tienen exposición nocturna: se evita aplicarles además el filtro antiguo de oscurecido. Las capas de luz existentes se mantienen separadas donde lo requiere la proyección. Las superficies secundarias de comisaría y Vesper comparten la piedra tranquila del kit aprobado.

Capturas finales: [Vesper](../screenshots/district-renewal-art-vesper-facade.png), [comisaría](../screenshots/district-renewal-art-police-facade.png), [catedral](../screenshots/district-renewal-art-cathedral-facade.png).

## Assets y procedencia

Generados/editados con **ImageGen integrado**. Los PNG son los originales conservados. El juego carga sus versiones **WebP sin pérdida**, verificadas píxel a píxel contra los originales; no se reduce resolución ni se modifica el color. Cada enlace a «prompt» contiene la instrucción exacta y referencia utilizada.

| Uso | PNG original | Versión cargada | Prompt |
|---|---|---|---|
| Cívico / académico / lujo | [Atlas](../../phaser/assets/architecture/district-civic-facades-v1.png) | [WebP](../../phaser/assets/architecture/district-civic-facades-v1.webp) | [Prompt](../../phaser/assets/architecture/district-civic-facades-v1.md) |
| Casas de canal / fábrica / depósito | [Atlas](../../phaser/assets/architecture/district-industrial-facades-v1.png) | [WebP](../../phaser/assets/architecture/district-industrial-facades-v1.webp) | [Prompt](../../phaser/assets/architecture/district-industrial-facades-v1.md) |
| Extractor / chimenea / carga | [Atlas](../../phaser/assets/architecture/district-utility-objects-v1.png) | [WebP](../../phaser/assets/architecture/district-utility-objects-v1.webp) | [Prompt](../../phaser/assets/architecture/district-utility-objects-v1.md) |
| Comisaría | [Fachada](../../phaser/assets/police/facade-v2.png) | [WebP](../../phaser/assets/police/facade-v2.webp) | [Prompt](../../phaser/assets/police/facade-v2.md) |
| Vesper | [Fachada](../../phaser/assets/vesper/facade-v2.png) | [WebP](../../phaser/assets/vesper/facade-v2.webp) | [Prompt](../../phaser/assets/vesper/facade-v2.md) |
| Catedral, módulos | [Atlas](../../phaser/assets/cathedral/facade-atlas-v2.png) | [WebP](../../phaser/assets/cathedral/facade-atlas-v2.webp) | [Prompt](../../phaser/assets/cathedral/facade-atlas-v2.md) |
| Catedral, frente | [Fachada](../../phaser/assets/cathedral/front-v2.png) | [WebP](../../phaser/assets/cathedral/front-v2.webp) | [Prompt](../../phaser/assets/cathedral/front-v2.md) |

El transporte de los siete archivos baja de **16,11 MB a 11,29 MB**, aproximadamente un 30%. Esto mejora el peso de carga, no implica una mejora automática de FPS. [Verificación de codificación](city-district-asset-encoding.json).

## Coste y límites

- Seis familias de fachadas nuevas comparten dos atlas; las cubiertas reutilizan el atlas aprobado. Plantas y entradas se componen al entrar en la caché, no en cada fotograma.
- Equipos de azotea con base y altura propias, cinco superficies y atlas compartido. Tejados de fábrica y depósito tienen geometría fija preparada una vez.
- Los 48 anclajes decorativos se materializan cerca de la cámara y se liberan al alejarse, con margen de retención para evitar crear/destruir al rozar el borde. En el recorrido con NS 500% había **1–8 elementos nuevos residentes** por vista, no los 48 a la vez.
- Mobiliario nuevo integrado en el orden por contacto con el suelo de coches y personajes. Las nuevas farolas reutilizan el límite existente de luces visibles; no se añade otro bucle de simulación.
- Los siete originales equivalen a unos **42 MiB RGBA**, sustituyendo cuatro fuentes anteriores y añadiendo tres. El incremento estimado de fuentes decodificadas es **24,9 MiB**, sin contar copias de CPU/GPU. WebP no reduce ese tamaño decodificado.
- La caché de materiales observada durante el recorrido osciló entre unos 13 y 55 MiB, y las entradas dormidas se mantuvieron limitadas a 12. Es una observación del recorrido, no una prueba prolongada de ausencia de fugas.
- Los contadores de FPS variaron durante arranque, desplazamientos y carga. Las muestras de 180 intervalos en Civic, Foundry y comisaría tuvieron mediana ~16,7 ms y p95 ~33,4 ms. En Foundry hubo un intervalo de 550 ms. No hay comparación controlada antes/después que permita atribuir ese tirón a esta modificación. **No se dan por alcanzados 60 FPS estables.**
- Decoración nueva de presentación, sin nuevos cuerpos físicos ni comportamiento de interacción. Azoteas mantienen sus rutas existentes; esta pasada no implementa nueva navegación sobre tejados inclinados.
- La revisión se hizo con WebGL. El fallback Canvas no forma parte de esta validación visual.

## Validación

- **75 pruebas específicas pasan**: planes de barrio, calles despejadas, puertas, patios conectados, edificios/tejados, paralaje, luces, orden de dibujo y recintos existentes.
- Validación del compilador: **0 errores, 0 avisos**, 87,7/100. Red de carretera en una sola componente de 107 nodos.
- Regeneración de topología y streaming: **82 archivos idénticos** tras repetir el proceso. [Informe](city-district-regeneration.json).
- Revisión de los 14 barrios a paralaje clásico y aumentado; revisión final de las tres fachadas emblemáticas sin errores JavaScript ni assets visuales ausentes.
- Recorridos reales con teclado por patio del cabildo, acceso del ayuntamiento y patio de Canal East: movimiento de 85–90 unidades sin bloqueos. Las pruebas de rejilla comprueban además acceso peatonal a todos los patios de tamaño relevante.
- Informe de recorrido: [clásico](../screenshots/district-renewal-review.json), [visual aumentado](../screenshots/district-renewal-art-review.json), [validación final](../screenshots/district-renewal-final-review.json). La primera pasada visual dejaba el foco en un slider y no podía ejecutar el paseo: el control funciona como debe, aislando el teclado del juego. La pasada final desenfoca el slider y verifica el paseo correctamente. Los 404 de pistas privadas de radio ausentes en el paquete local se registran aparte.
- Se revisó y ejecutó el runner de pruebas afectadas. En este Windows se detiene al intentar lanzar `npm test` como proceso hijo, igual que en las tareas anteriores; se ejecutaron directamente las pruebas nativas enfocadas. La suite global de la rama **no se declara verde**; conserva los fallos previamente documentados.

Fuentes de autoridad: `phaser/src/data/district-blocks.js` y `tools/city-compiler/district-blocks.js`, integradas en el compilador existente. No se ha creado otra ciudad paralela, otro controlador de cámara ni otra población de tráfico. Cambios locales, sin commit ni push.
