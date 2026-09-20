# Performance implementation, 18 September
Goal: remove synchronous pixel readback stalls and reduce repeat work without changing density or gameplay rules.
Authority: existing BuildingMaterialImages/BuildingParallax, MaterialTiles, TrafficLocalBehaviorSystem.
In scope: static image registration, bounded caches, time-budgeted material preparation, lane junction candidates, facade partition candidates.
Acceptance: focused geometry and traffic regression tests; browser cold/warm timing and no runtime errors; no new loop and same 64 vehicle target.
Non-goals: changing art resolution, collisions, traffic population, publishing.


## Cambios aplicados
- Materiales estáticos: addImage(canvas) evita la copia de píxeles de CanvasTexture. Conservamos canvas como fuente para patrones y texturas.
- Preparación de fachadas: hasta dos por pasada, dejando de empezar la segunda si ya se consumieron 3ms. No es preemptivo: una tarea individual puede sobrepasar el presupuesto.
- Edificios recientes: LRU de hasta 12 entradas y 32MiB de imágenes RGBA estimadas. Los objetos se ocultan al retirarlos y se destruyen en expulsión/shutdown. El límite no es la VRAM total; hay recursos activos y geometría aparte.
- Polígonos del pavimento: caché de hasta 64 entradas/16MiB, con claves de geometría y recorte y limpieza de escena. No se cachean entradas individuales que exceden ese presupuesto.
- Luces fijas de fachadas frontales: composición una sola vez con la fachada, misma proyección y mezcla normal; fachadas laterales conservan luz independiente para preservar su tinte.
- Tráfico: candidatos de cruces por identidad de carril, orden original, mismas proyecciones y reglas. La política de reservas consume también los candidatos. Invalidación al reconstruir carriles. No se cambia el límite de 64.

## Medición de la primera build (antes de conectar candidatos a la política de reservas)
Mismo script, GPU Intel D3D11, perfilador y viewport. Una pasada por zona; IA y trayectoria por frame no son deterministas. No atribuir toda la diferencia a un cambio aislado ni extrapolar a otra GPU.

|Zona/fase|Media ms antes → después|P95 ms|Máximo ms|
|---|---:|---:|---:|
|hospital / cold|86.9 → 28.2|175.7 → 56.1|1111.0 → 120.5|
|hospital / still|61.2 → 27.2|201.9 → 51.6|500.9 → 247.2|
|hospital / moving|58.9 → 27.5|216.2 → 49.4|582.5 → 348.7|
|police / cold|211.9 → 30.8|1382.0 → 36.2|1393.4 → 145.5|
|police / still|42.4 → 28.3|88.6 → 31.6|123.1 → 41.7|
|police / moving|49.7 → 32.9|103.1 → 37.1|496.9 → 162.9|
|vesper / cold|84.2 → 38.6|156.0 → 43.5|205.5 → 186.3|
|vesper / still|57.6 → 39.7|101.3 → 45.7|121.5 → 199.8|
|vesper / moving|98.0 → 45.6|261.7 → 68.4|859.9 → 190.0|

Sin errores de página. La caché inactiva se mantuvo en 7–12 edificios, aproximadamente 2.2–5.1MiB de imágenes; pavimento 50,560 bytes en esta ruta. Snapshot del límite de tráfico: 64 en todas las fases. Capturas revisadas de la comisaría; se conservan geometría, iluminación y farolas.

## Validación
36 pruebas de geometría, proyección y comportamiento de tráfico; 2 nuevas pruebas de caché de cruces/composición de luces; 16 pruebas de reservas/integración (con solapamiento de algunos casos): todas pasaron. Build de producción correcta. El selector conservador de tests se intentó pero vuelve a fallar al lanzar npm en Windows. No se afirma que la batería global esté verde; la auditoría previa documenta fallos en otras áreas de esta rama.

## Pendiente de mayor alcance
Los tirones no han desaparecido por completo: aún hay máximos aislados de 190–349ms. Se preserva la división actual por alturas para no introducir regresiones de solape; la reducción de dibujo aplicada aquí es la composición de luz frontal. Atlas general, partición selectiva, GPU timings y la medida prolongada en la pestaña del usuario siguen pendientes. No se ha cambiado la selección de GPU del sistema ni se han reducido población o calidad.


Validación final con la política de reservas conectada: Vesper caliente, sin profiler CPU, media37.18ms, P95 45.6ms, máximo58.5ms en6segundos; 2 intervalos >50ms. No equivale a una garantía para una partida larga. Tiempos medios de subsistemas: {'trafficRoutes': 8.27, 'trafficLocalBehaviorSystem': 1.93, 'simulation': 23.54, 'parallax': 0.1} ms. Sin errores de página.
