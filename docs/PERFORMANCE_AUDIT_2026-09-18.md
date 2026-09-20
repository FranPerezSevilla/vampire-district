# AuditorÃ­a de rendimiento â€” 18 septiembre 2026

## ConclusiÃ³n
Hay tres problemas superpuestos: creaciÃ³n sÃ­ncrona de texturas con lectura de pÃ­xeles, coste sostenido de simulaciÃ³n (especialmente trÃ¡fico) y coste de renderizado/presentaciÃ³n. Optimizar Ãºnicamente el paralaje o reducir la resoluciÃ³n de los assets no los resolverÃ¡ juntos.

Esta entrega es un diagnÃ³stico. Las alternativas se probaron mediante instrumentaciÃ³n temporal en navegadores independientes; no se han aplicado al juego ni se ha cambiado la partida del usuario.

## MÃ©todo y lÃ­mites
- Build local de producciÃ³n en 127.0.0.1:4174, Chromium de Playwright, ventana de 1400Ã—850, zoom 0.9.
- GPU verificada por CDP: ANGLE D3D11 sobre **Intel HD Graphics 530**. La mÃ¡quina tambiÃ©n enumera una GTX 960M; no se ha comprobado quÃ© GPU utiliza el navegador de la partida del usuario. Estos resultados no son una medida de esa pestaÃ±a.
- Primera pasada: hospital, comisarÃ­a y Vesper; seis segundos por fase de llegada, reposo y desplazamiento. Perfil CPU y temporizadores alrededor de preparaciÃ³n/dibujo.
- El recorrido recoloca al jugador entre enclaves y luego desplaza cÃ¡mara/jugador un pÃ­xel por fotograma. Sirve para provocar cargas; no es un recorrido normal cronometrado ni un benchmark determinista de combate.
- Segunda pasada sin profiler CPU: mismo encuadre caliente del Vesper, congelaciÃ³n del cÃ¡lculo de paralaje, omisiÃ³n del renderizado y omisiÃ³n de la actualizaciÃ³n de escena. Se comprueba que desaparecen las llamadas al sistema desactivado.
- La fase no-simulation de la **primera** pasada no desactivÃ³ la actualizaciÃ³n enlazada por Phaser: se descarta. La segunda usa sys.sceneUpdate y sÃ­ verifica la ausencia de simulaciÃ³n.
- Temporizadores CPU, no GPU timers. El tiempo dentro de renderer.render no incluye necesariamente toda la ejecuciÃ³n GPU/presentaciÃ³n. Hay dos llamadas de render por paso: no confundir el promedio por llamada con el coste completo del fotograma.
- Los rankings internos de la primera pasada conservan muestras anteriores. Para comparar subsistemas se utilizan los temporizadores por fase de la segunda, cuyos contadores se reinician.
- Una repeticiÃ³n por fase; IA y trÃ¡fico siguen cambiando. Se informan medidas observadas, no garantÃ­as de FPS. P95: el 95% de los intervalos estÃ¡ por debajo de ese valor.

## Intervalos entre fotogramas
60 FPS requieren aproximadamente 16.7 ms; 30 FPS, 33.3 ms. Los valores siguientes incluyen carga y pausas del navegador.

| Zona | Fase | Intervalos | Media ms | P95 ms | MÃ¡ximo ms |
|---|---|---:|---:|---:|---:|
| hospital | cold | 69 | 86.9 | 175.7 | 1111.0 |
| hospital | still | 98 | 61.2 | 201.9 | 500.9 |
| hospital | moving | 101 | 58.9 | 216.2 | 582.5 |
| police | cold | 28 | 211.9 | 1382.0 | 1393.4 |
| police | still | 141 | 42.4 | 88.6 | 123.1 |
| police | moving | 120 | 49.7 | 103.1 | 496.9 |
| vesper | cold | 71 | 84.2 | 156.0 | 205.5 |
| vesper | still | 104 | 57.6 | 101.3 | 121.5 |
| vesper | moving | 61 | 98.0 | 261.7 | 859.9 |

## 1. PreparaciÃ³n de texturas: primer objetivo, confianza alta
El perfil de 79.28 segundos atribuye **18.79 segundos (23.7%)** a getImageData. No significa que cada fotograma gaste ese porcentaje: se concentra en bloqueos de creaciÃ³n.

Cadena comprobada: BuildingMaterialImages.register â†’ TextureManager.addCanvas â†’ CanvasTexture.initialize â†’ getImageData. Phaser crea una copia CPU de los pÃ­xeles incluso para texturas que solo usamos como imagen. MaterialTiles tambiÃ©n registra canvases temporales para polÃ­gonos del suelo.

Picos observados:
- Preparar una fachada de comisarÃ­a: **1213.7 ms**.
- Preparar una fachada durante el desplazamiento junto al Vesper: **777.4 ms**.
- Redibujado del suelo del hospital: **991.6 ms**.

BuildingParallax limita a dos materiales por pasada, pero ese lÃ­mite cuenta objetos, no milisegundos. Una sola tarea larga bloquea todo el hilo. Techos y otras preparaciones tampoco estÃ¡n sujetos al mismo lÃ­mite.

### Experimento reversible
Para las texturas estÃ¡ticas de edificios/suelo se sustituyÃ³ addCanvas por addImage(canvas) SOLO en el navegador de prueba. Se conserva el canvas como fuente; no se crea CanvasTexture ni su copia imageData.

- Microprueba de 1024Ã—512: addCanvas 14.5â€“180.7 ms frente a addImage 0â€“0.2 ms. Se verifican fuente y dimensiones; no es una prueba de tiempo GPU ni de igualdad pixel a pixel.
- En juego: peor preparaciÃ³n de fachada de comisarÃ­a **1213.7 â†’ 18.4 ms**; en movimiento junto al Vesper **777.4 â†’ 1.1 ms**.
- No se registraron errores de pÃ¡gina.
- **TodavÃ­a hubo pausas de fotograma de 0.9â€“1.4 segundos en el experimento.** La mejora de preparaciÃ³n es real, pero no resuelve todos los bloqueos. Una carga puede trasladar trabajo a la subida/dibujo posteriores o coincidir con otro subsistema. Hay que trazar esos picos restantes antes de atribuirlos a la GPU o al streaming.

ImplementaciÃ³n propuesta: helper especÃ­fico para materiales estÃ¡ticos, mantener CanvasTexture donde se necesiten sus APIs de ediciÃ³n/lectura; comprobar render, mÃ¡scaras y limpieza. DespuÃ©s presupuesto temporal para preparaciÃ³n, cachÃ© acotada de materiales recientes y trabajo anticipado fuera del instante de apariciÃ³n.

## 2. SimulaciÃ³n: coste continuo alto, confianza alta
En Vesper ya cargado, la actualizaciÃ³n completa de escena cuesta **23.8â€“28.0 ms de media**. Por sÃ­ sola supera el presupuesto total de 60 FPS en este entorno.

Mediciones independientes por llamada:
- Rutas de trÃ¡fico: **6.5â€“9.1 ms** de media.
- Comportamiento local del trÃ¡fico: **3.6â€“5.3 ms**.
- MaterializaciÃ³n de coches: **0.6â€“0.85 ms**.
- Consecuencias fÃ­sicas de trÃ¡fico: **0.6â€“1.14 ms**.
- MacrotrÃ¡fico y testigos de ocupantes: pequeÃ±os frente a esos costes.
- Core.WorldState: **5.8â€“7.0 ms** segÃºn muestras internas (incluye policÃ­a, evidencias, daÃ±o, reconstrucciÃ³n espacial y misiÃ³n). TodavÃ­a necesita desglose por operaciÃ³n.

El perfil sitÃºa junctionProjection entre las funciones costosas; el cÃ³digo consulta cruces para cada vehÃ­culo/carril, aunque exista cachÃ© de proyecciones. El coste puede ser tambiÃ©n el nÃºmero de consultas y creaciÃ³n de claves, no solo calcular una proyecciÃ³n.

Propuesta: precalcular cruces relevantes por carril, filtrar candidatos cercanos y reutilizar consultas geomÃ©tricas. Separar frecuencia de decisiones de IA de la integraciÃ³n fÃ­sica; no reducir a ciegas la frecuencia de colisiones ni el nÃºmero de coches. Validar semÃ¡foros, bloqueos, persecuciones e impactos.

## 3. Dibujo y presentaciÃ³n: segundo lÃ­mite independiente
Prueba estable del Vesper, sin perfilador CPU:

| Variante | Media de intervalo | P95 |
|---|---:|---:|
| Normal | 57.5 ms | 116.4 ms |
| CÃ¡lculo de paralaje congelado | 57.7 ms | 121.2 ms |
| Renderizado omitido | 30.3 ms | 41.4 ms |
| ActualizaciÃ³n de escena omitida | 58.3 ms | 152.5 ms |
| Normal al regresar | 61.9 ms | 130.4 ms |

Congelar el paralaje mantiene las mismas superficies dibujadas: este resultado descarta su cÃ¡lculo continuo como causa principal en reposo, no el coste de dibujar sus fachadas. El cÃ¡lculo caliente ronda **0.1â€“1 ms**; los picos vienen al preparar recursos nuevos.

Quitar el dibujo reduce mucho el intervalo y quitar solo simulaciÃ³n no lo hace en esa muestra. Esto seÃ±ala un lÃ­mite de render/presentaciÃ³n en paralelo al coste de simulaciÃ³n. No permite separar por sÃ­ solo GPU, controlador, compositor y sincronizaciÃ³n del navegador.

En el recorrido se alcanzaron **873 quads de fachada/luz**, y en la vista estable aproximadamente 1264 objetos de escena, 898 visibles. Son objetos/quads, **no draw calls medidas**.

El cÃ³digo divide fachadas por alturas canÃ³nicas de toda la ciudad y crea objetos separados para superficies y luces. Eso conserva el orden, pero puede fragmentar demasiado edificios que no se superponen. Hay ademÃ¡s mÃ¡scaras de oclusiÃ³n y texturas individuales que dificultan agrupar trabajo.

Propuesta: recortar divisiones a alturas que realmente puedan interferir, agrupar superficies compatibles y usar atlas para mÃ³dulos repetidos, conservando la oclusiÃ³n. Medir nÃºmero real de envÃ­os GPU y pÃ­xeles superpuestos antes de decidir quÃ© recortar. No bajar primero la calidad de farolas/ventanas: no es el principal coste demostrado.

## 4. Carga y vida de recursos
- El suelo se recompone como una gran render texture cuando cambia su clave de sector/edificios residentes.
- Los polÃ­gonos crean canvases temporales y registran/eliminan texturas.
- Los materiales de edificios se destruyen al salir del conjunto retenido: volver puede recrearlos.
- El margen de visibilidad es amplio; mantiene material fuera de la vista para evitar apariciones bruscas.

Propuesta: cachÃ© acotada con presupuesto de memoria, invalidaciÃ³n mÃ¡s selectiva y tareas de preparaciÃ³n repartidas. Verificar ida/vuelta por fronteras de sector, no solo teletransporte.

## 5. Memoria y recolecciÃ³n
Se observaron alrededor de 177â€“225 MB de heap JS segÃºn pasada y unas 200 texturas en zonas cargadas. performance.memory es aproximado y no incluye toda la VRAM ni los canvases/controladores. El perfil atribuye unos 0.77 s a GC; no domina esta captura. No hay evidencia suficiente para afirmar una fuga ni para descartarla: falta recorrido de ida/vuelta prolongado y medidas de recursos tras estabilizar.

## Orden recomendado de implementaciÃ³n
1. Quitar la lectura de pÃ­xeles en materiales estÃ¡ticos; comprobar visualmente todos los enclaves.
2. Presupuesto temporal y reutilizaciÃ³n de materiales/suelo para las entradas y retornos.
3. Optimizar consultas de trÃ¡fico y desglosar Core.WorldState.
4. Reducir fragmentaciÃ³n y envÃ­os de fachadas/luces sin perder el orden de oclusiÃ³n.
5. Repetir prueba en la pestaÃ±a real, con su resoluciÃ³n/GPU, y un recorrido prolongado.

Criterios: informar P50/P95/P99 y pausas >50/100 ms por fase, ademÃ¡s del FPS medio. Separar cachÃ© frÃ­a/caliente. Buscar primero que desaparezcan las pausas de cientos de ms; despuÃ©s ajustar coste estable a 33.3 y, si el hardware lo permite, 16.7 ms. No prometer 60 FPS a partir del microbenchmark.

## Evidencias
Datos JSON, perfiles y scripts: `.artifacts/performance-2026-09-18/`. Los scripts incluyen rutas locales de esta estaciÃ³n y no son una nueva baterÃ­a CI. La instrumentaciÃ³n y las desactivaciones temporales desaparecen al cerrar los navegadores de diagnÃ³stico.


### Comprobación exploratoria de tamaño de ventana
Se repitió Vesper en ventanas 1400×850 → 700×425 → 1400×850, compensando el zoom para mantener aproximadamente la zona visible. Medias: 57.7 → 57.2 → 58.8 ms. No hubo una mejora clara. El script no registró el tamaño efectivo del drawing buffer ni GPU timestamps; por tanto no se usa para descartar definitivamente un límite de fill-rate ni justificar bajar la resolución del juego. Hace falta registrar esas dimensiones en la siguiente validación.
