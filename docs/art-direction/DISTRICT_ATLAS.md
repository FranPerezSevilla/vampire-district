# ViceBlood — Atlas de barrios

Propuesta de dirección artística · 17 septiembre 2026 · revisión 1

## Estado y alcance

Los 14 distritos y los lugares indicados como existentes proceden de `phaser/src/data/generated/city-topology-v2.js`, expuestos por `district.js`. El compilador de ciudad sigue siendo la autoridad de geometría. Los perfiles ambientales actuales se encuentran en `tools/city-compiler/district-streaming.js`.

Este atlas propone su identidad visual y nuevos lugares; no confirma interiores, misiones ni accesos jugables implementados. Los conceptos son ilustraciones de intención, no capturas del motor ni planos exactos. Los edificios catalogados pueden tener una representación provisional. La adscripción de edificios usa su districtId actual; el ayuntamiento está cerca del límite cívico y debe conservarse como excepción conocida al revisar parcelas.

## Lenguaje común

- Cámara cenital con fachadas proyectadas y paralaje; tejado, fachada y huella deben compartir geometría.
- Siluetas negras angulares, piedra hueso, metal y ladrillo envejecidos. La textura acompaña al volumen; no lo sustituye.
- Luces prácticas localizadas y contraste legible. Oscuridad no equivale a bajar el brillo de todo.
- Lo gótico viene de masa, verticalidad y arquitectura; lo punk, de ocupación, reparación, carteles y usos sociales.
- Cada barrio se reconoce por silueta, trazado y un hito, incluso en escala de grises. No basta cambiar colores.
- Rojo como acento excepcional. Sin luna roja repetida, alfombra de neones ni símbolos gigantes en todos los tejados.
- Calles transitables y personaje legible; decoración concentrada junto a bordes. Cubiertas altas con rutas identificables.

## Mapa de referencia

El mundo actual mide 4800 × 3600. Esquema orientativo; anchos de esta tabla no representan medidas.

| Franja | Oeste | Centro oeste | Centro este | Este |
|---|---|---|---|---|
| Norte | Hospital Ward | Civic Centre | Cathedral Hill | North Harbor |
| Centro | West Market | Old Quarter | Glasshouse | University District |
| Sur | Canal West | Foundry Ward | Canal East | Harbor North |
| Extremo sur | Blackwater Industrial | Blackwater Industrial | Blackwater Industrial | South Harbor |

**Nombres portuarios:** `north-harbor` y `harbor-north` son distritos distintos ya existentes. Usamos «Acceso norte al puerto» y «Muelles administrativos» como alias editoriales, sin renombrar sus identificadores. No se asignan facciones nuevas ni se modifica la autoridad territorial de campaña.

## Índice

1. [Hospital Ward · Distrito hospitalario](#hospital-district) — La caridad convertida en industria de la sangre
2. [Civic Centre · Centro cívico](#civic-center) — El poder te observa
3. [Cathedral Hill · Colina de la catedral](#cathedral-hill) — La ciudad se construyó sobre sus muertos
4. [North Harbor · Acceso norte al puerto](#north-harbor) — El cuello de botella
5. [West Market · Mercado oeste](#west-market) — La ciudad que aún respira
6. [Old Quarter · Casco antiguo](#old-quarter) — Tu refugio entre ruinas y depredadores
7. [Glasshouse · Distrito del cristal](#glasshouse) — La ostentación es otra forma de violencia
8. [University District · Barrio universitario](#university-district) — El conocimiento también tiene hambre
9. [Canal West · Canal oeste](#canal-west) — La humedad se come las casas
10. [Foundry Ward · Distrito de la fundición](#foundry) — Una catedral construida para las máquinas
11. [Canal East · Canal este](#canal-east) — La ciudad esconde aquí lo que consume
12. [Harbor North · Muelles administrativos](#harbor-north) — Todo tiene dueño y registro
13. [Blackwater Industrial · Blackwater](#blackwater) — Aquí la ciudad deja de fingir
14. [South Harbor · Puerto sur](#harbor-south) — El fin de la ciudad

<a id="hospital-district"></a>

## 01 · Hospital Ward · Distrito hospitalario

**Idea:** La caridad convertida en industria de la sangre.

**Identificador existente:** `hospital-district`.

![Concepto de Hospital Ward · Distrito hospitalario](concepts/hospital-district-v1.png)

- **Base existente:** Saint Vesper Hospital; Emergency Wing.
- **Lugares propuestos:** Banco de sangre anexo; morgue; antigua capilla hospitalaria.
- **Arquitectura y densidad:** Pabellones de ladrillo ennegrecido y piedra marfil, galerías cerradas, patios de ambulancias; ampliaciones utilitarias que invaden el antiguo hospital.
- **Paleta e iluminación:** Marfil sucio, verde quirófano apagado y carbón; luz blanca localizada en urgencias, ámbar en la capilla.
- **Sonido propuesto:** Ventilación, ruedas de camillas y ambulancias lejanas.
- **Recorridos y verticalidad propuestos:** Patio de servicio, pasos cubiertos y cubierta técnica; contraste entre entrada pública y acceso de suministros.

<a id="civic-center"></a>

## 02 · Civic Centre · Centro cívico

**Idea:** El poder te observa.

**Identificador existente:** `civic-center`.

![Concepto de Civic Centre · Centro cívico](concepts/civic-center-v1.png)

- **Base existente:** Central Police Headquarters; City Hall.
- **Lugares propuestos:** Archivo judicial; patio de detenidos; monumento cívico deteriorado.
- **Arquitectura y densidad:** Comisaría monumental de piedra oscura, contrafuertes verticales y torre de comunicaciones; ayuntamiento de escala autoritaria y explanadas vigiladas.
- **Paleta e iluminación:** Piedra ceniza, azul tinta, latón envejecido; entradas iluminadas con rigor, callejones negros.
- **Sonido propuesto:** Radio policial amortiguada, motores al ralentí, banderas al viento.
- **Recorridos y verticalidad propuestos:** Acceso frontal expuesto y recorridos de servicio laterales; azoteas institucionales separadas por vacíos peligrosos.

<a id="cathedral-hill"></a>

## 03 · Cathedral Hill · Colina de la catedral

**Idea:** La ciudad se construyó sobre sus muertos.

**Identificador existente:** `cathedral-hill`.

![Concepto de Cathedral Hill · Colina de la catedral](concepts/cathedral-hill-v1.png)

- **Base existente:** Cathedral of the Last Dawn.
- **Lugares propuestos:** Cementerio urbano; claustro; escalinata de peregrinos.
- **Arquitectura y densidad:** Catedral asimétrica con arbotantes coherentes, cubiertas de pizarra y patios funerarios encajados entre viviendas; desniveles y muros de contención.
- **Paleta e iluminación:** Caliza hueso, pizarra violeta grisácea, cobre oxidado; pequeñas luces votivas.
- **Sonido propuesto:** Campanas distantes, viento y pasos sobre piedra.
- **Recorridos y verticalidad propuestos:** Escalinatas, pasajes junto al cementerio y continuidad entre cubiertas; el recinto se reconoce sin ver una cruz gigante.

<a id="north-harbor"></a>

## 04 · North Harbor · Acceso norte al puerto

**Idea:** El cuello de botella.

**Identificador existente:** `north-harbor`.

![Concepto de North Harbor · Acceso norte al puerto](concepts/north-harbor-v1.png)

- **Base existente:** Bloques de almacén, industria y ocio existentes.
- **Lugares propuestos:** Control de acceso portuario; vieja estación de bombeo; pensión de estibadores.
- **Arquitectura y densidad:** Franja estrecha de naves y edificios de servicio, portones, muros altos y una vía de acceso dominante.
- **Paleta e iluminación:** Verde petróleo apagado, hormigón salino y hierro oscuro; lámparas de seguridad.
- **Sonido propuesto:** Cadenas, viento costero y bocinas de barcos.
- **Recorridos y verticalidad propuestos:** Pasos comprimidos junto al control y cubiertas longitudinales; anticipa los muelles sin repetirlos.

<a id="west-market"></a>

## 05 · West Market · Mercado oeste

**Idea:** La ciudad que aún respira.

**Identificador existente:** `west-market`.

![Concepto de West Market · Mercado oeste](concepts/west-market-v1.png)

- **Base existente:** Night Market; Market Shops; Tenement.
- **Lugares propuestos:** Lonja cubierta; casa de empeños; patio de vecinos.
- **Arquitectura y densidad:** Manzanas densas de viviendas sobre comercios; toldos desiguales, persianas pintadas, puestos agrupados y escaleras exteriores.
- **Paleta e iluminación:** Ocre, ladrillo, verde botella y negro; luz cálida de puestos, sin neón generalizado.
- **Sonido propuesto:** Persianas, conversaciones, radio vieja y carros.
- **Recorridos y verticalidad propuestos:** Calle comercial legible con atajos por patios y tejados bajos encadenados; puestos fuera de la ruta principal.

<a id="old-quarter"></a>

## 06 · Old Quarter · Casco antiguo

**Idea:** Tu refugio entre ruinas y depredadores.

**Identificador existente:** `old-quarter`.

![Concepto de Old Quarter · Casco antiguo](concepts/old-quarter-v1.png)

- **Base existente:** Rooftop Refuge; Club; Old Block; torres de 26, 32 y 38 plantas.
- **Lugares propuestos:** Acceso del Vesper como identidad propuesta para Club; imprenta ocupada; patio de servicio.
- **Arquitectura y densidad:** Casas antiguas comprimidas entre torres posteriores, medianeras, hierro y cubiertas habitadas; choque claro entre poder vertical y vida a ras de suelo.
- **Paleta e iluminación:** Ladrillo vino apagado, piedra hueso y pizarra; faroles cálidos, rojo reservado a pequeños acentos.
- **Sonido propuesto:** Música amortiguada, tuberías, conversaciones y tráfico distante.
- **Recorridos y verticalidad propuestos:** Ruta de tejados hacia el refugio, patios y accesos traseros; torres con bases y cubiertas coherentes.

<a id="glasshouse"></a>

## 07 · Glasshouse · Distrito del cristal

**Idea:** La ostentación es otra forma de violencia.

**Identificador existente:** `glasshouse`.

![Concepto de Glasshouse · Distrito del cristal](concepts/glasshouse-v1.png)

- **Base existente:** Glass Arcade; Saint Orison Hotel; Neon Court; Parish of Ash.
- **Lugares propuestos:** Salón privado; patio de limusinas; galería comercial cerrada.
- **Arquitectura y densidad:** Hotel art déco oscuro y pasaje acristalado junto a una parroquia pequeña atrapada por ampliaciones; lujo selectivo, no ciudad futurista.
- **Paleta e iluminación:** Obsidiana, latón, cristal verdoso y burdeos; vestíbulos cálidos sobre calle fría.
- **Sonido propuesto:** Música filtrada, tacones, motores caros y ventilación.
- **Recorridos y verticalidad propuestos:** Entradas ceremoniales y servicio oculto; pasarelas y terrazas de alturas distintas.

<a id="university-district"></a>

## 08 · University District · Barrio universitario

**Idea:** El conocimiento también tiene hambre.

**Identificador existente:** `university-district`.

![Concepto de University District · Barrio universitario](concepts/university-district-v1.png)

- **Base existente:** Vesper City University.
- **Lugares propuestos:** Biblioteca nocturna; facultad de anatomía; residencia ocupada.
- **Arquitectura y densidad:** Claustros académicos, bibliotecas de piedra y anexos de ladrillo, residencias intervenidas con carteles y telas.
- **Paleta e iluminación:** Piedra arena, azul pizarra, verde hiedra; luz de lectura concentrada.
- **Sonido propuesto:** Hojas, bicicletas, discusión lejana y ventilación de laboratorios.
- **Recorridos y verticalidad propuestos:** Patios conectados, galerías, pasos entre biblioteca y residencia; cubiertas escalonadas.

<a id="canal-west"></a>

## 09 · Canal West · Canal oeste

**Idea:** La humedad se come las casas.

**Identificador existente:** `canal-west`.

![Concepto de Canal West · Canal oeste](concepts/canal-west-v1.png)

- **Base existente:** Canal Warehouse.
- **Lugares propuestos:** Esclusa vieja; lavandería; embarcadero de barrio.
- **Arquitectura y densidad:** Almacenes reconvertidos y viviendas obreras pegadas al canal; pasarelas bajas, muros húmedos y patios estrechos.
- **Paleta e iluminación:** Verde musgo, ladrillo marrón y agua negra; ventanas domésticas ámbar.
- **Sonido propuesto:** Goteo, agua contra piedra, tuberías y una radio.
- **Recorridos y verticalidad propuestos:** Recorrido ribereño estrecho, puentes cortos y conexión con alcantarillas; densidad residencial.

<a id="foundry"></a>

## 10 · Foundry Ward · Distrito de la fundición

**Idea:** Una catedral construida para las máquinas.

**Identificador existente:** `foundry`.

![Concepto de Foundry Ward · Distrito de la fundición](concepts/foundry-v1.png)

- **Base existente:** North Machine Shop; West Works; East Loading; West Yard; East Works.
- **Lugares propuestos:** Nave de hornos; comedor obrero ocupado; subestación.
- **Arquitectura y densidad:** Cubiertas en diente de sierra, chimeneas, vigas y patios de carga; la verticalidad nace de estructuras industriales.
- **Paleta e iluminación:** Óxido, carbón y hierro; pequeños resplandores de horno, no lava ni naranja por todas partes.
- **Sonido propuesto:** Golpes metálicos, ventiladores, cadenas y vibración grave.
- **Recorridos y verticalidad propuestos:** Pasajes entre naves, corredores de carga y cubiertas dentadas; siluetas industriales distinguibles.

<a id="canal-east"></a>

## 11 · Canal East · Canal este

**Idea:** La ciudad esconde aquí lo que consume.

**Identificador existente:** `canal-east`.

![Concepto de Canal East · Canal este](concepts/canal-east-v1.png)

- **Base existente:** Manzanas residenciales y mixtas existentes.
- **Lugares propuestos:** Viaducto sobre canal; almacén frigorífico; acceso de mantenimiento.
- **Arquitectura y densidad:** Infraestructura más dura que al oeste: viaductos, hormigón, cámaras frigoríficas y viviendas encerradas entre vías de servicio.
- **Paleta e iluminación:** Hormigón azulado, metal verdoso y negro; fluorescentes puntuales y ámbar bajo puentes.
- **Sonido propuesto:** Tráfico elevado, compresores, eco y agua.
- **Recorridos y verticalidad propuestos:** Recorridos superpuestos y accesos bajo el puente; lectura clara de qué se puede cruzar y qué queda por encima.

<a id="harbor-north"></a>

## 12 · Harbor North · Muelles administrativos

**Idea:** Todo tiene dueño y registro.

**Identificador existente:** `harbor-north`.

![Concepto de Harbor North · Muelles administrativos](concepts/harbor-north-v1.png)

- **Base existente:** Harbor Registry.
- **Lugares propuestos:** Aduana; depósito de mercancía intervenida; muelle de inspección.
- **Arquitectura y densidad:** Edificio de registro portuario de mampostería austera, patios reglados y almacenes numerados; el poder civil llega al agua.
- **Paleta e iluminación:** Piedra gris verdosa, azul sucio y latón; iluminación de inspección.
- **Sonido propuesto:** Sellos y puertas metálicas sugeridos en interiores, motores, cabos y sirenas de buques.
- **Recorridos y verticalidad propuestos:** Patio de aduana, edificios de oficinas y borde de muelle; accesos controlados y rutas de servicio.

<a id="blackwater"></a>

## 13 · Blackwater Industrial · Blackwater

**Idea:** Aquí la ciudad deja de fingir.

**Identificador existente:** `blackwater`.

![Concepto de Blackwater Industrial · Blackwater](concepts/blackwater-v1.png)

- **Base existente:** Blackwater Terminal; manzanas industriales existentes.
- **Lugares propuestos:** Planta de tratamiento; depósitos; depósito ferroviario abandonado.
- **Arquitectura y densidad:** Grandes huellas industriales y franjas de servicio, terminal, tanques y estructuras de acero; vacíos con función, no solares sin intención.
- **Paleta e iluminación:** Negro aceitoso, óxido profundo, hormigón ceniza; luces de balizamiento muy escasas.
- **Sonido propuesto:** Zumbido eléctrico, golpes lejanos, agua industrial y viento.
- **Recorridos y verticalidad propuestos:** Trayectos largos interrumpidos por maquinaria y patios; torres técnicas como referencias verticales.

<a id="harbor-south"></a>

## 14 · South Harbor · Puerto sur

**Idea:** El fin de la ciudad.

**Identificador existente:** `harbor-south`.

![Concepto de South Harbor · Puerto sur](concepts/harbor-south-v1.png)

- **Base existente:** Manzanas portuarias y logísticas existentes.
- **Lugares propuestos:** Grúa principal; patio de contenedores; dique de reparación.
- **Arquitectura y densidad:** Naves extensas, grúas de silueta reconocible, contenedores apilados y borde de agua; la escala humana se reduce.
- **Paleta e iluminación:** Azul petróleo, metal salino y ocre apagado; focos de trabajo aislados.
- **Sonido propuesto:** Grúas, bocinas, camiones y metal golpeando.
- **Recorridos y verticalidad propuestos:** Laberinto de carga a nivel de suelo y pasos elevados de mantenimiento; claros para maniobras.

## Transiciones entre barrios

Hospital → mercado: pabellones separados pasan a viviendas sobre comercio. Centro cívico → casco antiguo: alineaciones ceremoniales se comprimen en patios. Casco antiguo → Glasshouse: reparación visible se convierte en lujo restaurado. Catedral → universidad: recinto funerario se transforma en claustro académico. Canal oeste → fundición: vivienda ribereña cede a naves; fundición → canal este: maquinaria cede a viaductos. Muelles administrativos → puerto sur: control y oficinas se convierten en carga a gran escala. Blackwater conecta industria y puerto con terminales y servicios.

Estas son transiciones artísticas, no nuevas conexiones del grafo vial. El acceso norte mantiene su franja costera propia.

## Traducción al juego

1. Construir una manzana piloto del casco antiguo con fachada, cubierta, calle y luz coherentes.
2. Validar personaje oculto, silueta de oclusión, colisiones y uniones al mover cámara; después validar a altura de azotea.
3. Preparar familias de módulos: residencial, institucional, comercial, industrial y ribereño. Variantes por barrio, hitos específicos por lugar.
4. Conservar la abstracción de la intro reduciendo ornamentación y detalle fino de los conceptos. Son dirección de masas, luz y materiales, no una obligación de reproducir cada textura.
5. Usar detalles estáticos cacheados y variaciones deterministas. Reservar animación para pocos elementos útiles; medir carga y coste de fotograma con tráfico real.
6. Expandir tras aprobar la manzana, conservando rutas, accesos, capas y fuente del compilador. Cada incorporación de un lugar propuesto requiere implementación separada.

### Criterios de aceptación de esta propuesta

- Los 14 IDs actuales están documentados una vez cada uno y tienen una imagen propia.
- Hospital, comisaría, catedral, universidad, mercado y terminal conservan su asociación actual.
- Los añadidos y alias están marcados como propuesta.
- Los barrios vecinos comparten lenguaje visual, pero no repiten una misma composición recoloreada.

## Archivos de revisión

- [Galería visual](index.html).
- [Prompts completos y modo de generación](PROMPTS.md).
- [Datos editoriales](districts.json).

Generación mediante herramienta integrada de imágenes, con la propuesta aprobada como referencia de cámara y estilo. No se ha usado CLI de generación.

