# Hospital y pavimentos — 17 septiembre 2026

## Objetivo y alcance
Aproximar el hospital y el suelo peatonal al mockup cenital aprobado. Autoridad visual: CitySurfacePresentationPolicy, UrbanMaterialDetail y BuildingIdentity. La geometría y colisiones siguen perteneciendo al compilador actual.

## Cambios
- Losas grises con juntas alternadas, variación tonal y desgaste contenido para aceras rectangulares.
- Losas oscuras de mayor formato para el suelo abierto, cubiertas después por calles y edificios según el orden existente.
- Hospital: cubierta verde con faldones, nervios, cornisa hueso, equipos y marca médica pequeña. Urgencias: cubierta técnica y marquesina dibujada dentro de la huella.
- Fachadas hospitalarias con remates apuntados y detalle de entrada clínica, siguiendo la misma proyección del paralaje.
- Patrones anclados a coordenadas mundiales, construidos al redibujar el sector; ninguna textura regenerada cada fotograma.

## Límites
No se añaden interiores, ambulancias ni patios nuevos; el mockup orienta materiales y dibujo. Las piezas poligonales de acera conservan relleno gris liso y los bordillos existentes; las losas detalladas se aplican a tramos rectangulares. No se modifica mapa, navegación ni lógica del juego.

## Aceptación
Juntas estables al cambiar de sector, losas recortadas a límites, tejado limitado a la huella, paralaje conservado. Pruebas focalizadas de superficies, geometría de fachada y materiales, más revisión visual local.

## Revisión de acabado
Empedrado de 11 × 8 unidades en patios y piezas de 16 × 12 en aceras, juntas alternadas con anchura variable y esquinas desconchadas. Polígonos recortados exactamente al sector; variación determinista, sin costuras al desplazarse. Fachadas con plantas estables por tipo de edificio y ocultación de detalle en paredes de proyección casi nula, ventanas dentro de sus módulos, planta baja con huecos propios y cornisa continua. Se eliminan los triángulos añadidos sobre ventanas y la bajante que atravesaba los huecos.

## Materiales y proyección
Hospital oscurecido con juntas de pizarra, manchas minerales y aparejo discreto en fachada. Cartel HOSPITAL dibujado sobre la franja superior frontal, con coordenadas de la misma pared. La proyección añade escala a las cubiertas y proyecta los vértices de las fachadas hacia el mismo punto de fuga; la anchura deja de determinar una inclinación independiente. El anexo de urgencias tiene menos altura visual. Bases y colisiones permanecen fijas. Prueba nueva: un vértice compartido por edificios de igual altura se proyecta igual aunque tengan anchuras distintas.
