# Pausa solicitada por el usuario — 19/09/2026

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
