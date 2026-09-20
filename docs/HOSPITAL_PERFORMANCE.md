# Diagnóstico de rendimiento del hospital

Medición local automatizada, Chromium headless WebGL, viewport 1400 × 850. Dos fases de 7 segundos, cámara quieta y desplazamiento sintético de cámara/jugador. No representa los FPS del navegador integrado ni una partida prolongada. No se reprodujo un bloqueo permanente ni hubo errores JavaScript.

Antes: mapa estático con 661796 entradas en commandBuffer; reconstrucción máxima 136.9 ms; intervalo medio de fotogramas en movimiento 1010.3 ms.

Después: mapa estático rasterizado y reutilizado como RenderTexture, commandBuffer residual 0; intervalo medio en movimiento 538.6 ms (aprox. 47 % menor en este entorno). La primera rasterización todavía puede superar 300 ms; no se da por resuelto el tirón de carga ni se afirma alcanzar 60 FPS.

La caché vive en SidewalkCoveragePresentationPolicy, que es la composición activa y sustituye drawDistrictStreet. Se invalida por geometría, edificios visibles, ventana y capa. Se oculta al redibujar otras capas y se libera al finalizar la escena. Actores, rutas y paralaje permanecen dinámicos. Test de reutilización de textura y orden de superficies.

Siguiente foco: reducir trabajo inicial de pavimentos (texturas de material reutilizables o rasterizado por fragmentos) y medir por separado las fachadas dinámicas. Las medidas posteriores de FPS deben tomarse en el navegador de juego con su GPU habitual.

## Corrección de picos al entrar en la zona
Nueva medición antes de esta revisión: reconstrucción máxima 200.1 ms y preparación/actualización de edificios 78.1 ms en la fase de llegada. Se sustituye el empedrado vectorial de patios y aceras por dos mosaicos pequeños preparados una sola vez, dibujados por lotes en la caché del sector. Se limita a dos la preparación de fachadas nuevas por fotograma; mientras llega su material conservan el color base y las colisiones. Los materiales ya preparados no se regeneran por mover la cámara.

Pruebas de geometría, orden de superficies, reutilización de caché y revisión en navegador. La medición headless no representa los FPS de la GPU del usuario.

Resultado final de esta revisión: reconstrucción media 83.6 ms, máxima 100 ms (antes 192.25/200.1 ms); actualización de edificios en movimiento 0.43 ms media, 2.6 ms máximo. No se observaron errores JavaScript. El intervalo global de fotogramas del entorno headless no mejoró de forma consistente, por lo que no se afirma una mejora de FPS general. Quedan picos de carga perceptibles y otros costes de renderizado/simulación por aislar.
