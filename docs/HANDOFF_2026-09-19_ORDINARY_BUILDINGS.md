# Pausa solicitada por el usuario — 19/09/2026

## Estado actual — 20/09/2026

**Última actualización: personajes articulados y control de orientación.** `CharacterMotion` compartido por protagonista/NPC/policía: WASD orienta al protagonista, el cursor no lo gira salvo ataque aceptado; rodillas/codos con superficies continuas, pies centrados y paralaje de personajes siempre verticalmente negativo para evitar inversión cabeza/pies. Paso acumulado y transiciones suaves; pistola bajada en reposo, combate/gestos/caídas conservados. Atlas SVG nítido sin antigua sobreimpresión raster de caras/ropa, 64–65 piezas reutilizadas, ~36–38 quads visibles; 512×1024 y 2,67 MiB con mips. Mirilla bajo el ratón, 650 ms visible + 200 ms desvanecido; pausa borra la mirilla congelada y devuelve el cursor del menú. Coches y paralaje de edificios/props no cambian.

Build y **64 pruebas enfocadas pasan**, navegador valida WASD/ratón/ataques aceptados y vacíos/pausa, tres tipos de personaje en ocho direcciones y ocho acciones. Sin errores JS ni assets visuales ausentes. Muestra local de 120 frames: p95 16,8 ms, máximo 33,3 ms; no extrapolar a 60 FPS en toda la ciudad. Suite nativa completa: 1274/1319 pasan, 45 fallan en contratos más amplios de UI/ciudad/tráfico/arranque; runner affected sigue fallando al lanzar npm hijo en Windows. Detalle y evidencia: `docs/tasks/CHARACTER_PRESENTATION_REBUILD.md`, `docs/screenshots/characters-*`. Preview **4174**, PID **24296**; comprobar proceso real antes de detenerlo. Sin commit/push. Las entradas siguientes son historial.

**Última actualización: renovación de los 14 barrios y fachadas de Vesper, comisaría y catedral.** Petición completa implementada, a falta del siguiente feedback visual del usuario. No se amplía el mundo: 4800×3600 y red vial existente conectada. `district-blocks.js` contiene 14 composiciones explícitas, 102 volúmenes, 75 espacios peatonales y 48 anclajes decorativos; compiler propio integrado en el pipeline existente. Se eliminan rellenos incidentales, se conservan West Market y recintos aprobados. Pasos, accesos y azoteas reconciliados. Nuevas familias cívica, académica, lujo, canal, fábrica y depósito, con cubiertas a dos aguas/dientes de sierra y equipos en atlas compartido. Mobiliario nuevo con residencia acotada y orden por Y compartido con actores.

Siete originales raster con ImageGen integrado, prompts exactos junto a cada PNG. Juego carga versiones WebP sin pérdida, idénticas píxel a píxel: 16,11 → 11,29 MB (~30% menos transferencia). Fuentes de los tres enclaves adaptadas a masas negras y luz cálida; evitan doble oscurecido. No se cambiaron cámara/paralaje, coches, personajes, tráfico ni simulación. Defaults NS/EW 100%, debug 0–2000%; coches independientes.

**75 pruebas enfocadas pasan**, validación de ciudad 0 errores/avisos, 82 archivos regenerados idénticos. Revisión real de todos los barrios, tres enclaves y paseos con teclado. La pasada visual aumentada mantuvo foco en slider y sus paseos quedaron inmóviles; se corrigió el harness y el informe final valida recorridos de 85–90 unidades. Sin errores JS ni visuales ausentes; radio privada no incluida en build local produce los 404 conocidos. Plan/runner affected intentados; persiste limitación npm hijo en Windows y no se declara suite global verde. No prometer 60 FPS estables: muestras p95 ~33 ms y un intervalo de 550 ms; falta comparación controlada. Nuevas fuentes añaden ~24,9 MiB RGBA, decor cercano 1–8 en recorrido; caché materiales observada ~13–55 MiB.

Detalle, mapa, galería, todos los assets/prompts y límites: **`docs/art-direction/CITY_DISTRICT_RENEWAL.md`**. Tarea: `docs/tasks/CITY_DISTRICT_RENEWAL.md`; test: `tests/district-renewal.test.js`; evidencia `docs/screenshots/district-renewal-*`. Preview actual **4174**, PID **11100**. Sin commit/push; conservar cambios previos. Siguiente paso: feedback visual del usuario sobre los barrios y los tres enclaves. Las entradas siguientes son historial.

**Última actualización: mobiliario y equipos de azotea con materiales más tranquilos.** El usuario aprobó West Market y pidió extender su estilo a contenedores, farolas, bancos, columnas y objetos de la catedral. Dos assets editados con ImageGen: `props/gothic-street-atlas-v2.png` y `architecture/ordinary-rooftop-objects-v2.png`. Mantienen recortes, dimensiones y geometría; eliminan buena parte del desgaste fino/ruido. El altar usa un tinte gris más moderado. Las luces cálidas se conservan. Se cambian los loaders y la clave de RooftopObjects; la clave interna del atlas preparado de props sigue estable. Sin cambios en los coches, personajes, ciudad, plantas o paralaje.

Build + **40 pruebas enfocadas pasan**. Comparativa real antes/después de seis vistas, contenedor roto y ejes extremos sin errores. Mismos atlas/coste de geometría de props; PNG totales ~19% más pequeños, sin prometer mejora de FPS. Variación de caché de tejados entre recorridos no se interpreta como cambio de memoria del material. La aserción de unión de cubierta de la catedral ahora admite error numérico 1e-8 en vez de igualdad exacta. Runner affected vuelve a fallar al iniciar npm en Windows; validación global de la rama sigue pendiente. Fallback Canvas conserva sus imágenes anteriores; el WebGL activo usa v2.

Detalle: `docs/tasks/QUIET_CITY_PROPS.md`; capturas/informes `docs/screenshots/quiet-props-*`; prompts exactos junto a los assets. Preview **4174**, PID **16940**. Sin commit/push. Trabajo solicitado terminado, pendiente feedback visual. Las entradas siguientes son historial.

**Última actualización: arte extendido a los once volúmenes de West Market y paralaje clásico recuperado.** Nuevas fachadas raster para viviendas de patio, almacén y taller en un único atlas `west-market-facades-v1.png`; los tres diseños aprobados se conservan. Cubiertas por uso, buhardillas orientadas al acceso real y sin solaparse con equipos. No se modificaron distribución, plantas ni colliders en esta pasada.

Eliminado el sesgo frontal; proyección radial compartida por edificios/objetos. Debug: **Norte–Sur / Este–Oeste**, 0–2000%, 100% valor clásico, coches independientes a su valor anterior. Márgenes de visibilidad según valor elegido. Build y **59 pruebas específicas pasan**; revisión real del barrio, controles extremos/reset/caché y carga de hospital/comisaría/Vesper sin errores. Atlas ~6 MiB decodificado; 22 piezas de cubierta en los once volúmenes. No prometer mejora de FPS ni 60 estables. Plan affected revisado; runner vuelve a salir al intentar `npm test` en Windows. Las suites amplias y sus fallos previos siguen documentadas por separado.

Detalles: `docs/tasks/WEST_MARKET_ART_AND_PARALLAX.md`; capturas `docs/screenshots/west-market-art-*`; prompt exacto en `phaser/assets/architecture/west-market-facades-v1.md`. Preview actualizado en **4174**, PID **18768**. Sin commit/push. Trabajo de esta petición terminado; siguiente paso: feedback visual y valores de paralaje elegidos por el usuario. Las entradas siguientes son historial.

**Última actualización: distribución de West Market aplicada.** El usuario autorizó reorganizar esta zona: plaza del mercado al oeste y viviendas/patio al este, con pasos y accesos de azotea. Fuente única `phaser/src/data/west-market-block.js`, compilada por `tools/city-compiler/west-market-block.js` en el pipeline habitual. Se conservan carreteras y edificios fuera de la prueba; siete volúmenes recolocados y cuatro añadidos. Mismos 12 peatones locales, materiales existentes, sin nuevos atlas. Puertas orientadas al espacio al que sirven, paredes compartidas ocultas por altura y reserva de patios frente a futuro infill. Detalles y resultados en `docs/tasks/WEST_MARKET_LAYOUT.md`.

46 pruebas específicas y validación de ciudad pasan; recorrido real WASD por plaza, callejón, patio y frente comercial sin bloqueos ni errores JS. Suite nativa general: 1259 pasan, 44 fallan; grupo browser de ciudad: 9 pasan, 5 fallan (contratos antiguos y sistemas ajenos al barrio, detallados en la tarea). No declarar suite completa verde. Regenerar streaming tras la suite amplia: algunos tests escriben fixtures en esa salida. Build final y preview en **4174**, PID **20428**. Cambios siguen sin commit/push. Siguiente paso: revisión del usuario de esta distribución, antes de extenderla a otro barrio. Coordenadas: plaza (347,1538), patio (840,1640). Las notas siguientes son historial.

**Última actualización: materiales más oscuros y tranquilos en West Market.** El usuario aprobó reducir el ruido y ganar masa negra. Assets editados con imagegen: `ordinary-block-v2.png` y `ordinary-block-roofs-v2.png`; mismo encuadre y tamaño que v1, sin modificar formas/alturas/paralaje ni posición de huecos. Piedra y cubiertas más uniformes, marcos menos claros y luz cálida conservada. Ajustado el tinte de terraza para no dejarla negra sin lectura. Solo se precarga v2; v1 queda guardado para comparar. Sin nuevas capas, objetos ni filtros. Build + 32 pruebas enfocadas pasan; revisión real de cuatro vistas sin errores y exactamente la misma memoria de materiales/objetos. PNG combinados ~38% más pequeños en disco, sin prometer mejora de FPS. Nuevas capturas e informes `ordinary-quiet-*`; prompts/fuentes en README de assets. Runner affected sigue sin lanzar npm en Windows; suite completa pendiente.

Servidor local actual: puerto **4174**, último PID **7052**. Cambios posteriores a `5e61857` siguen sin commit/push. Siguiente paso: opinión del usuario sobre masas negras y lectura de luces de esta manzana. No ampliar todavía a toda la ciudad. Las entradas que siguen son historial.

**Actualización anterior: tejados y alturas de West Market terminados.** Tras aceptar las fachadas, el usuario autorizó la siguiente propuesta: vivienda de 4 plantas con mansarda/buhardillas, mercado de 2 con lucernario, local de 3 con terraza/barandilla/caseta. Implementado con perfiles de presentación compartidos, plantas a escala y nuevo atlas `ordinary-block-roofs-v1.png`. No se modificaron huellas, calles ni colliders. Los equipos se apoyan en la terraza y dejan libres los volúmenes nuevos. Sigue pendiente la jugabilidad futura sobre esos tejados; esta pasada es visual.

Build + 35 pruebas enfocadas pasan. Revisión real de los tres tejados, sliders extremos, vuelta por hospital/comisaría/catedral y caché sin errores ni objetos huérfanos. Coste medido de envío de los tejados y barandillas ~0,17–0,22 ms/frame; comparación breve con/sin dibujarlos ~58–60 FPS, con tirones puntuales y variación entre muestras. No prometer 60 estables ni mejora global. Runner affected no lanza npm en Windows; suite completa pendiente. Nuevas capturas e informes `docs/screenshots/ordinary-roofs-*`; prompts exactos y fuente en el README de assets. El README de arquitectura detalla límites y mediciones.

Vista local actualizada en puerto 4174, último PID **16572**. Cambios posteriores a `5e61857` todavía sin commit/push. Siguiente paso: feedback del usuario sobre tejados y ritmo 4/2/3 antes de extender el kit a otros edificios. El texto siguiente conserva el historial anterior.

La pausa terminó. Tras la revisión v2, el usuario autorizó una prueba de carácter arquitectónico en West Market. Aplicada únicamente a tenementNorth, marketBlock y shops: vivienda señorial deteriorada, antiguos soportales comerciales y local AFTER HOURS. Nuevo asset raster ordinary-block-v1.png; recetas y relieves continuos en OrdinaryBlockArchitecture, integrados con los materiales/paralaje existentes. Cubiertas, equipos, ciudad, coches y controles conservan su comportamiento anterior. Datos de edificios no modificados.

Build y 34 pruebas enfocadas pasan. Navegador: tres frentes, reverso, sliders extremos y recorrido por enclaves sin errores; reutilización de materiales 59 -> 59. Comparación breve de esta sesión ~59.5 -> 59.2 FPS; recorrido p95 16.8 ms, un frame >33.4 ms. Atlas adicional ~6 MiB decodificados, seis objetos de render adicionales y mismo tamaño de materiales compuestos. No afirmar 60 FPS garantizados. Runner affected intentado pero no lanza npm en Windows; suite completa pendiente. Ver docs/ORDINARY_BUILDING_ART.md y nuevas capturas/informes ordinary-block-*.

Vista local: puerto 4174, último PID 15860. Cambios posteriores a 5e61857 siguen sin commit/push. Trabajo de esta prueba terminado; pendiente opinión del usuario antes de extenderlo a más edificios. Las notas de pausa siguientes son históricas.

**Reanudado el 19/09/2026 por petición expresa.** El usuario rechaza la textura de las nuevas fachadas porque desentona con suelo/coches. Prioridad: alternativa de material más sobria y coherente, conservando geometría, equipos de azotea y controles. El estado previo ya figura en el commit `5e61857`; el árbol estaba limpio al retomar.

**Actualización tras reanudar:** variante `ordinary-facades-v2.png` generada, integrada y revisada en la manzana real; revoco/piedra gris carbón y marcos sencillos. Capturas e informe v2 en docs/screenshots; prompts en phaser/assets/architecture/README.md. Build + 30 pruebas enfocadas + revisión de arranque/materiales sin errores. La nueva muestra corta dio ~33.3 ms/frame; no atribuir el cambio entre sesiones al material sin A/B controlado. Caché de materiales y cantidad de objetos coinciden con v1. Servidor local reiniciado, último PID 8932. Estos cambios posteriores a `5e61857` siguen sin commit/push. Siguiente paso: feedback visual del usuario sobre la alternativa v2; las dimensiones, azoteas, objetos y controles permanecen como antes.

El usuario va a apagar el ordenador. Trabajo detenido por petición expresa; retomar cuando lo indique. No hay generación de imágenes ni pruebas en curso. No se ha hecho commit ni push en esta sesión.

## Directorio y rama

- Repositorio: `C:/Users/Franelly/Documents/ViceBlood-UI`
- Rama: `codex/gothic-punk-game-hud`
- Hay muchos cambios anteriores sin commit: conservarlos. No hacer reset ni restauraciones generales.
- Vista local: `http://127.0.0.1:4174/`, sirviendo `dist` con Python. Último PID 9720; después de reiniciar el ordenador habrá que volver a levantar el servidor.
- Node: `C:/Users/Franelly/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`
- Python: mismo runtime, `dependencies/python/python.exe`.
- Build: ejecutar Node con `tools/ui/build.mjs --package` desde el repositorio. El build de los últimos cambios terminó correctamente.
- Servidor: Python con `-m http.server 4174 --bind 127.0.0.1 --directory C:/Users/Franelly/Documents/ViceBlood-UI/dist`; si se lanza con Start-Process, usar WindowStyle Hidden.

## Petición activa

Acercar los edificios normales al concept de ciudad nocturna gótico punk: materiales predominantemente negros, menos ruido, ventanas nítidas, luz cálida como acento, azoteas creíbles. Reutilizar fachadas/tejados proyectados; no convertir edificios enteros a sprite stacking.

Última ampliación del usuario: equipos de azotea como objetos independientes con paralaje, pensando en futuras escenas sobre tejados; controles debug para paralaje frontal, lateral y trasero.

## Implementado y guardado

1. Tres atlas raster originales generados y copiados a `phaser/assets/architecture`: ordinary-facades-v1.png, ordinary-roofs-v1.png, ordinary-rooftop-objects-v1.png. El README de esa carpeta conserva prompts exactos y disposición de celdas. Generación mediante herramienta image_gen y skill imagegen.
2. `OrdinaryBuildingMaterials.js`: viviendas, bajos comerciales e industrial; módulos a escala de planta, huecos espaciados, algunas ventanas cálidas, coronación de ancho fijo. Se aplica a edificios normales; preserva arte de enclaves, rascacielos y anexos especiales. Materiales preparados al entrar en caché, sin repintado por frame.
3. `RooftopObjects.js`: ventilación, chimeneas y casetas de acceso independientes. Huella, altura física, altura de apoyo del tejado e identificadores estables. Cinco caras por objeto, atlas compartido, sin texturas individuales. Los equipos NO están pintados en la textura del nuevo tejado. Datos editables por `building.roofObjects`. Aún NO hay colisiones/interacciones nuevas ni adaptación del modo jugable de azotea.
4. Integración en BuildingMaterialImages, BuildingParallax y preload de GameScene. Los objetos se ocultan, recuperan y destruyen con la residencia del edificio. Caché inactiva mantiene límite de 12 edificios / 32 MiB. Los tres atlas suman unos 18 MiB decodificados compartidos.
5. CityPerspective + panel existente VehiclePerspectiveControls: Frontal / Lateral / Trasero 0–250%, coches por separado y botón Restablecer perspectiva. 100% mantiene la perspectiva anterior; todo a 0 aplana la ciudad. Una transformación afín común mantiene unidos tejados, paredes y objetos; se evita que el control trasero invierta la geometría con zoom cercano. Props y luces de farola leen los mismos ajustes. Valores actualmente en memoria de la escena; no hay guardado de preferencias entre recargas.

Cambios anteriores a conservar: estado de motor/luces y arranque de coches, perspectiva independiente de coches, retirada del efecto especial por proximidad a edificios emblemáticos, arte/animación previa.

## Comprobaciones realizadas

- 30 pruebas enfocadas pasan: ordinary-building-art, city-perspective, building-parallax, vehicle-perspective-controls, night-light-presentation, stacked-props-and-gestures y performance-material-traffic.
- Build de producción correcto; git diff --check sin errores (solo avisos CRLF).
- Plan de affected revisado contra origin/main; runner intentado. No pudo lanzar su primer hijo `npm test` en este entorno Windows. Se ejecutaron las pruebas enfocadas directamente con Node. La suite completa NO se ha vuelto a ejecutar durante esta pasada; la rama ya tenía fallos de otros ámbitos documentados en trabajo anterior.
- Navegador Chromium con producción local: arranque, manzana de prueba, los tres sliders, todos a cero, reset, independencia de coches, unión de equipos a tejado, recorrido de cámara y cambios de zona hasta hospital/comisaría/catedral, sin errores JS.
- La comprobación de unión en ejecución real tiene error máximo aproximado de 2.5e-13 unidades. Sin objetos de azotea huérfanos tras los cambios de zona.
- Repetir el recorrido de cámara no creó materiales nuevos: serial 59 → 59. Mediana y percentil 95 de frame ~16.7 ms en una muestra breve de 180 frames; ningún frame >33.4 ms en la segunda vuelta. Esto NO garantiza 60 FPS en toda la ciudad ni compara de forma concluyente con el rendimiento anterior.
- El primer intento de la prueba final leyó el estado antes de terminar el frame; se corrigió el harness para esperar a la proyección/materiales. El último recorrido completo pasa.

## Evidencias y ubicación de prueba

- Captura actual: `docs/screenshots/ordinary-buildings-v1.png`.
- Informe: `docs/screenshots/ordinary-buildings-review.json`.
- Resumen de arquitectura: `docs/ORDINARY_BUILDING_ART.md`.
- Manzana: tenementNorth (650,1280), shops (900,1320), marketBlock (260,1320). Colocar personaje en (780,1524) para las dos primeras fachadas.
- Harness y capturas adicionales: `C:/Users/Franelly/Documents/Codex/2026-09-15/referenced-chatgpt-conversation-this-is-an/work/ordinary-rooftop-controls-review.cjs` y archivos ordinary-*.png/json en la misma carpeta. Usa Playwright de node_modules del repositorio. Ejecutar ese archivo con Node desde el directorio de tarea.

## Por dónde continuar

1. Levantar otra vez la vista local y comprobar los sliders con el usuario.
2. Revisar visualmente las últimas capturas frontal/trasera de valores extremos. Las capturas generales de la primera integración ya se inspeccionaron; la última corrección matemática del slider trasero pasó el navegador, pero queda mirar sus capturas finales con calma.
3. Ajustar con el usuario la magnitud deseada y decidir si guardamos esos valores como predeterminados. No cambiar las dimensiones de edificios ni el aspecto de coches como parte de ese ajuste.
4. Revisar variedad de colocación y lectura de los objetos de azotea y las fachadas a escala de juego. No retocar a ciegas materiales ya aceptados ni añadir detalle diminuto.
5. Si se requiere, ampliar medición de rendimiento con recorridos largos; la muestra actual solo valida esta zona. Para una futura jugabilidad en azoteas faltan colisiones, interacción, acceso y orden de dibujo de actores respecto a los nuevos objetos; hacerlo desde las autoridades existentes, en un paso separado.

No abrir PR, hacer push ni reanudar trabajo mientras siga vigente esta pausa.
