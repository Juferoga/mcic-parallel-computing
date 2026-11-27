# Soluciones con datos de posición de buses: Latinoamérica, proyectos cívicos y procesamiento big data

Alcance: soluciones construidas con GPS/AVL/GTFS-RT de buses (2016–2026; lo anterior va marcado **[pre-2016]**). Se excluyen bunching y regularidad de headway (tesis del autor). La factibilidad se juzga contra el archivo abierto GTFS-RT de TransMilenio: ~6.900 buses, sondeo cada 20 s desde el 11-nov-2026 (~15 días, >85M reportes), edad del reporte ~50–58 s, cada bus reporta cada ~52 s, GTFS estático diario solo desde el 24-nov-2026, trip_id casi nunca cruza con el estático (route_id y stop_id sí), stop_id aproximado, sin ocupación/pasajeros/puertas/llegadas, con congelamientos del feed.

Nota de método: hice 20 consultas y lecturas (búsqueda y fetch). Varias fuentes clave (tesis, PDF grandes) solo se leyeron como resumen del buscador. Eso queda indicado donde aplica.

## 1. Latinoamérica: qué se construyó con GPS de buses y con qué resultados

### Takeaway
Santiago es el caso más maduro. Lleva más de una década de métodos para sacar velocidad comercial del GPS a escala de flota, y ya hay evaluación causal de infraestructura: corredores y vías exclusivas con cámaras dan +15–20 % de velocidad, y las pistas solo bus pintadas no dan efecto significativo. São Paulo y Río tienen estudios de velocidad antes/después de carriles exclusivos con decenas de millones de registros diarios. CDMX, Lima, Quito y Buenos Aires casi no tienen estudios públicos con AVL que yo pudiera verificar.

### Cited Findings

**Santiago (DTPM / Red, U. de Chile, PUC)**
- **[pre-2016] Diagnóstico de velocidad comercial con GPS (Cortés et al., 2011, *Transportation Research Part C*).** Problema: monitorear la velocidad comercial por tramo y hora. Autores: U. de Chile. Datos: >6.000 buses, >700 rutas, un pulso cada 30 s, >40 millones de posiciones asignadas a rutas en una semana. Los autores señalan que el GPS resuelve la disponibilidad de datos pero obliga a procesar volúmenes enormes de forma sistemática. — [SWOV ficha](https://swov.nl/nl/publicatie/bus-commercial-speed-diagnosis-based-gps-monitored-data); [Repositorio U. de Chile](https://repositorio.uchile.cl/handle/2250/125465)
- **Indicadores con GPS + tarjeta bip! (Beltrán, Cortés, Gschwender, Ibarra, Munizaga, Palma).** Estiman velocidad comercial del sistema con desagregación espacial y temporal. En la presentación de Gschwender (2016): ~90 millones de registros de posición, error estimado ≈1 %, 100 % de la flota con GPS. — [Gschwender, CIMS3/UBA](https://cims3.dc.uba.ar/CIMS3/Gschwender.pdf) (leído solo vía resumen del buscador)
- **Evaluación causal de infraestructura (Silva y González, PUC, *Journal of Urban Economics*).** Datos GPS de ~100 millones de viajes de bus, >500 rutas, 2016–2019. Método: rutas tratadas (corredor nuevo, vía exclusiva con cámara, pista solo bus) contra rutas de control, con enfoque econométrico. Resultado: corredores y vías exclusivas fiscalizadas con cámaras suben la velocidad ~15–20 % (hasta 30 min/día de ahorro por pasajero). Las pistas solo bus sin separación física no muestran mejora significativa. Un corredor cuesta hasta US$10M/km. — [Noticia UC](https://www.uc.cl/noticias/estudio-vias-exclusivas-fiscalizadas-con-camaras-pueden-mejorar-hasta-en-un-20-la-velocidad-de-los-buses/)
- **Tesis U. de Chile sobre prioridad vial.** Modela el tiempo de viaje como el inverso de la velocidad comercial (método de Cortés et al.) con pulsos GPS y bip!, y reporta 30,3 km/h en un corredor. — [Repositorio U. de Chile](https://repositorio.uchile.cl/handle/2250/130354) (vía resumen del buscador)
- **Pago a operadores / indicadores DTPM.** DIPRES reporta indicadores de "cumplimiento de frecuencia" y "cumplimiento de regularidad" para los buses de Santiago, calculados como mediciones que cumplen el Programa de Operación sobre el total de mediciones (valores de regularidad de 82,74 %, 84,95 % y 84,48 %, sin año claro en el extracto). — [DIPRES](https://www.dipres.gob.cl/597/articles-218416_doc_pdf.pdf). *La regularidad es headway, así que queda excluida. Cumplimiento de frecuencia (oferta programada vs. realizada) sí está en alcance.*
- **Selección de rutas para buses eléctricos (ICCT/ZEBRA, nov-2020).** Usa datos operacionales de rutas de Santiago para priorizar la electrificación. — [ICCT](https://theicct.org/wp-content/uploads/2021/06/ZEBRA-seleccion-rutas-stgo-nov2020.pdf) (no leí el detalle de qué datos GPS usa)

**São Paulo (SPTrans)**
- **Velocidades antes/después de faixas exclusivas (revista *Transportes*, ANPET, 2016).** Estima tiempos de viaje y velocidades desde el GPS embarcado. El intervalo de reporte pasó de 85 s (2013) a 40 s (2015), y el volumen de ~12 M a ~24 M registros GPS diarios. — [ANPET](https://anpet.emnuvens.com.br/anpet/article/download/1008/613/5988)
- **Acceso a datos.** Una tesis USP indica que solo el GTFS estático es abierto y que el AVL crudo hubo que pedirlo a SPTrans. La API Olho Vivo entrega posición procesada en tiempo real. — [Teses USP](https://teses.usp.br/teses/disponiveis/3/3138/tde-12032018-134651/publico/ErickSobreiroGoncalvesCorr18.pdf)
- **Variabilidad de velocidad con lluvia (tesis USP).** Datos de operación SPTrans de 2014 más lluvia INMET, con CHAID, kriging y SIG. Concluye que el enfoque geográfico es clave para entender la variabilidad. — [BDTA USP](https://bdta.abcd.usp.br/directbitstream/01883d79-3fbc-41d5-bf3d-af33b13ed8ad/LUKAS%20NAOTO%20NEVES%20HOSHINA...) (vía resumen del buscador)
- **Producto público "De Olho na Via"** (dentro de Olho Vivo): velocidad media y tiempo de viaje de buses en los corredores principales. — [TecMundo](https://www.tecmundo.com.br/transportes/234480-olho-vivo-sptrans-acompanhar-localizacao-onibus.htm)

**Río de Janeiro**
- **Datos abiertos.** La Prefeitura publica por web service la posición GPS de todos los buses, actualizada ~cada minuto, más la geometría de rutas y las paradas. — [PUC-Rio / Casanova, MDM 2016](https://www-di.inf.puc-rio.br/~casanova/Publications/Papers/2016-Papers/2016-MDM-Nasser.pdf)
- **[pre-2016 / 2015] "Processando 6 bilhões de posições" (CEFET-RJ).** ~6.200 millones de posiciones GPS de buses. Filtros: duplicados, velocidades imposibles, buses sin línea, en garaje y fuera de ruta. La velocidad media se calcula con la distancia en línea recta entre puntos consecutivos. — [CEFET-RJ](https://eic.cefet-rj.br/portal/wp-content/uploads/2015/10/Processando-6-bilhoes-de-posicoes.pdf) (PDF >10 MB, no pude leerlo; datos del resumen del buscador; no confirmé el stack técnico)
- **Velocidad en 4 vías antes/durante Río-2016 (Rojas y Lanzillotti, UERJ).** Datos GPS de IPLANRIO. — [Cadernos de Informática UERJ](https://www.e-publicacoes.uerj.br/cadinf/article/view/37992)
- **Carriles exclusivos en Río y Curitiba (Queiroz et al., 2019, SBC).** Velocidad antes/después de los carriles con datos de movimiento de flota. — [SBC](https://sol.sbc.org.br/index.php/dsw/article/download/25502/25322)
- **Consistencia GPS vs. GTFS en Curitiba y Río (SBC).** Reportan inconsistencias en el cruce de datos y proponen cómo mejorar el emparejamiento. — [SBC SEMISH](https://sol.sbc.org.br/index.php/semish/article/download/9515/9413)
- **BusesInRio (PUC-Rio).** Herramienta para almacenar y visualizar GPS de buses (disertación de B. Guberfain do Amaral). — [Maxwell PUC-Rio](https://www.maxwell.vrac.puc-rio.br/28415/28415.PDF)
- **Central municipal (oct-2026).** La Prefeitura creó en el Centro de Operações una central que monitorea buses en tiempo real (GPS, datos de tarifa Jaé, cámaras) para fiscalizar a las empresas. — [Diário do Rio](https://diariodorio.com/rio-de-janeiro/2026/10/01/prefeitura-do-rio-cria-central-para-monitorar-onibus-em-tempo-real-e-fiscalizar-empresas.html)
- Dataset académico CRAWDAD coppe-ufrj/RioBuses. — [IEEE DataPort](https://ieee-dataport.org/node/10272)

**Ciudad de México (Metrobús / SEMOVI)**
- Datos abiertos estáticos (líneas, estaciones, unidades) y estado del servicio en tiempo real, actualizado cada 30 s y con registro previo. ~20 % de la flota de las líneas 1, 2, 4, 5 y 6 no tenía GPS. Un desarrollador hizo un mapa público con estos datos. — [Chilango](https://www.chilango.com/noticias/horarios-del-metrobus-en-tiempo-real/); [Chilango, mapa](https://www.chilango.com/noticias/transporte/mapa-del-metrobus-avance-de-cada-linea-en-tiempo-real-musica-de-organillo/)
- Tesis UNAM con 6 meses de datos de Metrobús (histogramas de velocidad, actividad vehicular). No pude confirmar los resultados. — [UNAM](https://ru.dgb.unam.mx/bitstream/20.500.14330/TES01000813382/3/0813382.pdf)
- Evaluación de desempeño de buses eléctricos en CDMX (ICCT/ZEBRA, dic-2022). — [ICCT](https://theicct.org/wp-content/uploads/2022/12/Mexico-hvs-ZEBRA-analisis-desempeno-buses-electricos-cdmx-dec22.pdf) (no leído en detalle)

### Inferences
- **Factibilidad en Bogotá, velocidad comercial por tramo y franja (estilo Cortés et al.):** alta. Basta posición, hora, route_id y geometría de ruta. Con un reporte cada ~52 s se obtiene velocidad media por tramo de cientos de metros, no velocidad puntual. Caveat: la edad de 50–58 s obliga a usar el timestamp del vehículo, no el del sondeo. Necesita paralelismo porque son >85M puntos y cada bus-día se procesa de forma independiente (map-matching o proyección a la ruta, deduplicación y segmentación). Encaja con Ray: una tarea por bus-día o por ruta.
- **Antes/después de infraestructura (estilo Silva y González o São Paulo):** baja con 15 días. Haría falta una intervención fechada dentro de la ventana y un grupo de control. Como prueba de concepto sirve un diseño transversal (troncal vs. zonal en vías compartidas).
- **Cumplimiento de oferta (programado vs. realizado, como el indicador DTPM o la central de Río):** media-alta por route_id. Obstáculos: trip_id no cruza y el estático solo existe desde el 24-nov, así que la comparación por viaje solo es posible en ~2 días y por ruta (buses activos o km recorridos vs. programados). Ya lo hace transmilenio-mcp (ver sección 2), así que el valor añadido estaría en hacerlo de forma histórica y masiva.
- **Velocidad vs. lluvia (estilo USP):** factible si se cruza con estaciones IDEAM o de la SDA para los 15 días. Requiere una fuente externa no verificada aquí.
- El precedente regional (Santiago con ~40M posiciones/semana, Río con 6.200M) muestra que el volumen bogotano (~85M en 15 días) es moderado. El argumento de paralelismo se sostiene por el costo por punto (map-matching, búsquedas espaciales) más que por el volumen bruto.

### Gaps
- No encontré estudios AVL públicos verificables para **Lima, Quito, Curitiba (aparte de Queiroz et al.) ni Buenos Aires**. Tampoco informes BID, CAF, WRI o ITDP con números de velocidad derivados de AVL en LatAm (la búsqueda los devolvió vacíos).
- No encontré la definición formal de los indicadores de pago a operadores de la Red (Santiago) ni cuánto pesa el GPS en el pago.
- No pude verificar el stack técnico (Hadoop, Spark, BD) del procesamiento de 6.200M posiciones en Río.
- La fecha exacta del paper de Silva y González no aparece en la noticia.

## 2. Bogotá: qué existe ya sobre el feed GTFS-RT (nov-2026) y estudios previos de GPS/SIRCI

### Takeaway
En las tres semanas desde la apertura del feed han salido varios proyectos cívicos: mapas en vivo, ETA, un veedor de oferta programada vs. real y recolectores. Ninguno publica un análisis histórico y masivo del archivo (velocidades por tramo, confiabilidad del tiempo de viaje, cobertura o calidad del feed a escala). No encontré estudios académicos publicados que usen el AVL/SIRCI de TransMilenio. Ese es el hueco principal.

### Cited Findings
- **transmilenio-mcp (PRestrepo2312, MIT, proyecto personal sin afiliación).** Servidor MCP con mapa local y un "veedor" de "lo programado contra lo que sale a la calle". Resultados que publica:
  - 5-nov 19:11: 7.730 buses en calle vs. 8.624 programados (90 %). Zonal 86 %, troncal 112 %, alimentador 95 %, dual 119 %. Algunas rutas zonales tenían menos de la mitad (K904, L810, A516, D122).
  - 10-nov 13:00: 5.866 de 81.378 viajes programados cancelados (7,2 %). Zonal 11,1 %, alimentador 2,8 %, troncal 0,5 %.
  - ETA corregida con buses como sensores: tras 35 min de feed, el error medio bajó de 2,1 a 1,7 min (de 3,6 a 2,8 min para buses a 10–20 min). El autor advierte que una sola muestra no basta.
  - Sobre el feed: se regenera ~1 vez por minuto, tiene apagones (herramienta `salud_feed`) y excluye buses con más de 5 min sin reportar. Desde el 10-nov el feed ya no trae una parada coherente con la posición, así que ubica los buses por geometría (segmento más cercano de la ruta) e infiere el sentido por el movimiento.
  — [GitHub transmilenio-mcp](https://github.com/PRestrepo2312/transmilenio-mcp)
- **Fecha de apertura.** transmilenio-mcp sitúa el anuncio oficial el 4-nov-2026. — [GitHub transmilenio-mcp](https://github.com/PRestrepo2312/transmilenio-mcp). *Nuestro archivo empieza el 11-nov.*
- **Congelamiento reportado.** Un PR de geoai-latam/terranova reporta posiciones y viajes congelados en la fuente desde el 6-nov-2026 00:11 UTC (7.730 buses, ninguno con menos de 15 min) y HTTP 403 desde su IP. — [PR #449 terranova](https://github.com/geoai-latam/terranova/pull/449). *Coincide con los congelamientos de nuestro archivo. Que nuestro archivo tenga datos desde el 11-nov sugiere que fue temporal o que el 403 era un bloqueo por IP.*
- **tm-gtfsrt (bsalarconm).** Recolector que consulta positions.pb cada 20 s. Advierte de buses "fantasma" con posiciones de días de antigüedad y recomienda filtrar por poll_ts − vehicle_ts. — [GitHub tm-gtfsrt](https://github.com/bsalarconm/tm-gtfsrt)
- **bus-tracking (dieramirezma).** Mapa en tiempo real de los buses troncales (Next.js + MapLibre + OpenFreeMap, backend Fastify en Render). — [GitHub bus-tracking](https://github.com/dieramirezma/bus-tracking)
- **Chiva / Colombia Move.** App no oficial con ETA "en vivo" calculada desde la posición real, planificador "Cómo llegar", temporizador de transbordo TuLlave y consulta por WhatsApp. Declara 143 estaciones, 7.557 paradas y 656 rutas. Parte del código viene de **Paradero (Croma)**, licencia MIT. No menciona velocidades ni puntualidad. — [Colombia Move](https://colombiamove.com/transporte)
- **Contenido del feed** según un archivo de datos de terceros: trip_id, route_id, stop_id, current_stop_sequence, etiqueta, placa, posición y hora. Sin velocidad ni ocupación. ~7.000 vehículos por captura en hora pico. — [resumen de búsqueda sobre repos de GitHub](https://github.com/bsalarconm/tm-gtfsrt)
- **Estudios previos (no AVL de TransMilenio):**
  - **[pre-2016] SITYMUR (Uniandes, 2013).** Prototipo de información de tráfico con taxis que reportan GPS cada 10 s (Bocarejo, Rodríguez-Valencia et al.). — [Revista de Ingeniería Uniandes](https://revistas.uniandes.edu.co/index.php/rdi/article/download/7333/7656/32014)
  - Microsimulación de troncales (U. Militar): velocidad de operación media de 38 km/h. — [Redalyc](https://www.redalyc.org/journal/2570/257077761002/257077761002.pdf) (vía resumen del buscador)
  - Banco Mundial (DIME): repositorio para analizar transacciones de la tarjeta TuLlave, no GPS. — [ecosyste.ms dime-worldbank/colombiatransmilenio](https://awesome.ecosyste.ms/projects/github.com%2Fdime-worldbank%2Fcolombiatransmilenio)

### Inferences
- **Ya cubierto (no duplicar):** mapa en vivo (bus-tracking, Chiva), ETA en tiempo real (Chiva, transmilenio-mcp) y foto instantánea de oferta vs. programación y cancelaciones (transmilenio-mcp).
- **Huecos factibles con nuestro archivo y que justifican Ray:**
  1. **Atlas de velocidad comercial por tramo × franja horaria × tipo de servicio** (troncal / zonal / dual) sobre los 15 días completos. Proyectar >85M puntos a la geometría de ruta es embarazosamente paralelo por bus-día. Nadie lo ha publicado para Bogotá.
  2. **Confiabilidad del tiempo de viaje** (percentiles p50/p95 e índice de buffer entre pares de paradas por route_id). No es headway, así que no choca con la tesis. Requiere reconstruir pasos por parada con interpolación, porque no hay eventos de llegada.
  3. **Oferta realizada histórica** (bus-km y horas en servicio por ruta y día, km "fantasma" o fuera de ruta). Es la versión masiva y longitudinal del veedor. La comparación con la programación solo es posible desde el 24-nov y por route_id.
  4. **Auditoría de calidad del feed a escala:** congelamientos, latencia (edad del reporte), buses fantasma, stop_id incoherente y cobertura por operador. Es útil para la comunidad y se valida contra lo que ya reportan transmilenio-mcp, tm-gtfsrt y terranova.
  5. **Puntos lentos o cuellos de botella** (tramos con velocidad < umbral persistente). Es un insumo directo para priorizar carriles, siguiendo el hallazgo de Santiago de que solo la segregación fiscalizada funciona.
- **Emisiones:** posibles solo de forma aproximada (perfil velocidad → factor de emisión por tipo de bus). Hace falta mapear placa → tecnología (diésel, gas, eléctrico) con una fuente externa. Con un reporte cada ~52 s no hay aceleraciones finas.
- **Accesibilidad isócrona con tiempos reales:** factible combinando las velocidades observadas con GTFS estático y la red. Es costosa (miles de orígenes × horas) y paralelizable en Ray por origen.

### Gaps
- No encontré el repo de **croma-labs/paradero** ni el mapa de **datosdecolombia.com** directamente. Solo sé de Paradero por el crédito en Colombia Move.
- No encontré estudios publicados de Uniandes (grupo SUR), U. Nacional o Javeriana que usen el AVL/SIRCI de TransMilenio. Puede haber tesis no indexadas.
- No verifiqué la documentación oficial del feed (portal gtfs.transmilenio.gov.co ni la nota de la Alcaldía).
- Hay una contradicción por resolver: transmilenio-mcp dice que desde el 10-nov el feed no trae una parada coherente, y nuestro archivo tiene un stop_id "aproximado". Conviene medir la coherencia stop_id–posición en el archivo.

## 3. Proyectos cívicos y open data en el mundo sobre archivos GTFS-RT/AVL: qué los hizo impactantes

### Takeaway
Los proyectos con impacto comparten tres rasgos. Archivan el feed de forma continua porque la agencia no lo hace. Miden algo simple y entendible, como el porcentaje de viajes programados que realmente corren o la velocidad media de una línea. Y lo publican como "boletín" con aliados de incidencia y prensa. El caso Ghost Buses (Chicago) coincide con un cambio de política: la CTA empezó a publicar sus viajes cancelados. No encontré una atribución causal formal.

### Cited Findings
- **Ghost Buses (Chi Hack Night, Chicago, lanzado nov-2022).**
  - Método: scraping del feed `getvehicles` de CTA Bus Tracker cada 5 min desde el 20-may-2022. Cuenta viajes distintos observados por ruta y día contra los programados en el GTFS, y calcula un % de confiabilidad. La web muestra un ranking por percentil de rutas. — [Chi Hack Night](https://chihacknight.org/projects/2022/11/11/ghost-buses)
  - Arquitectura: AWS serverless (Lambda + buckets S3 público y privado), script `update_data` incremental por rutas. El archivo desde may-2022 lo mantiene ahora el Mansueto Institute. El repo dejó de mantenerse en sep-2024. — [GitHub chn-ghost-buses](https://github.com/chihacknight/chn-ghost-buses)
  - Origen: un análisis de Streetsblog de 2022 encontró que solo ~la mitad de los viajes de la Línea Azul (tren) estaba corriendo. — [Streetsblog Chicago](https://chi.streetsblog.org/2022/04/25/data-analysis-found-cta-has-only-been-running-about-half-its-schedule-blue-line-runs/)
  - Contexto e impacto: casi 360.000 viajes de bus cancelados entre ene-2022 y sep-2023, frente a >15.000 viajes programados por día. — [ABC7](https://abc7chicago.com/cta-bus-tracker-app-estimated-arrival-times-chicago/13995684/). Las interrupciones son más comunes en rutas del South Side. — [ABC7](https://abc7chicago.com/post/chicago-cta-bus-tracker-estimated-arrival-time/12534793/). La CTA comenzó a publicar datos de viajes cancelados y la app Transit los usa para alertar. — [Yahoo/Tribune](https://www.yahoo.com/news/articles/ghost-buses-may-no-longer-232500561.html). En jul-2025 la CTA reportó haber corrido el 96 % de los viajes de bus programados. — [Fox32](https://www.fox32chicago.com/news/buses-trains-still-ghosting-commuters-in-chicago)
  - Aliados de incidencia: CTAction, Active Transportation Alliance, Transit4all. — [Chi Hack Night](https://chihacknight.org/projects/2022/11/11/ghost-buses)
- **TransitMatters Data Dashboard (Boston).** Funciona como boletín del MBTA: niveles de servicio, slow zones, ridership y velocidades de las 4 líneas rápidas y de rutas de bus clave, a partir de los datos abiertos de ubicación. — [Streetsblog Mass](https://mass.streetsblog.org/2023/07/18/transitmatters-releases-new-data-dashboard). El MBTA publica GTFS-RT VehiclePositions y TripUpdates en Protobuf y JSON. — [MBTA docs](https://github.com/mbta/gtfs-documentation/blob/master/reference/gtfs-realtime.md)
- **MTA Bus Performance Dashboard (NY, 2018, agencia).** Velocidad media de bus por distrito y mes, entre otras métricas. — [Streetsblog NYC](https://nyc.streetsblog.org/2018/03/20/is-bus-service-getting-better-or-worse-new-mta-dashboard-makes-it-easier-to-track); [Mass Transit](https://www.masstransitmag.com/home/press-release/12403668/metropolitan-transportation-authority-ny-mta-mta-launches-new-firstofitskind-bus-performance-dashboard)
- **Seattle (2022).** Dashboard con velocidad media de bus entre paradas para que los funcionarios localicen las ralentizaciones. — [Route Fifty](https://www.route-fifty.com/digital-government/2022/04/open-bus-data-makes-transit-schedules-more-reliable/364005/)
- **Bus Observatory (Cornell Tech, Jacobs Urban Tech Hub, A. Townsend).** API de archivo de buses concebida como "instalación de investigación compartida". Townsend reconoce que scrapear el bus de NYC fue fácil de prototipar y difícil de sostener y escalar. Inspiró **GTFS-Realtime-Capsule** (Two Sigma Data Clinic), una CLI para scrapear, normalizar y archivar feeds en tiempo real, ya sin mantenimiento. — [ecosyste.ms gtfs-realtime-capsule](https://awesome.ecosyste.ms/projects/github.com%2Ftsdataclinic%2Fgtfs-realtime-capsule); [Medium Townsend](https://medium.com/p/822111845e54)
- **Herramientas abiertas:** paquete R `gtfsrealtime` para leer archivos históricos de vehicle positions (incluye zips multiarchivo). — [CRAN vignette](https://cran.r-project.org/web/packages/gtfsrealtime/vignettes/positions.html); [Findings](https://findingspress.org/article/168472-gtfsrealtime-a-package-for-working-with-gtfs-realtime-transit-data-in-r). MBTA `transit-performance` es un sistema abierto para medir el servicio en tiempo real. — [GitHub MBTA](https://www.github.com/mbta). NSW (Australia) publica históricos de GTFS-R Vehicle Positions. — [data.nsw](https://data.nsw.gov.au/data/dataset/2-historical-gtfs-bundles-and-timetables/resource/7093b0a9-fbab-4d96-8638-bf2c12249c71)
- **Presentación IBI Group / APTA (A. Lew, 2018):** proceso y retos de diseñar un dashboard de desempeño con GTFS-RT. — [APTA](https://www.apta.com/wp-content/uploads/Resources/mc/revenue/presentations/Presentations/Visualizing%20GTFS-realtime%20data%20process%20and%20challenges%20of%20designing%20a%20transit%20performance%20dashboard%20%E2%80%93%20Alex%20Lew.pdf)

### Inferences
- El análogo bogotano de Ghost Buses (servicio entregado vs. programado) ya existe en forma de foto instantánea (transmilenio-mcp). La versión histórica por ruta y día, con mapa de equidad por localidad (como el hallazgo del South Side en Chicago), es factible por route_id desde el 24-nov. Antes de esa fecha se puede medir la oferta realizada absoluta (buses y km).
- Velocidades por línea al estilo TransitMatters y slow zones al estilo Seattle son factibles y no duplican nada en Bogotá.
- La lección de Townsend y Ghost Buses es que lo difícil es sostener el archivo, no hacer el prototipo. Un archivo bien particionado (Parquet por día/ruta) y documentado tiene valor por sí mismo.
- No encontré pruebas de que los proyectos cívicos usaran cómputo paralelo pesado. Ghost Buses trabaja con agregados simples (conteo de trip_id) en Lambda. El paralelismo se justifica cuando hay geometría (map-matching, proyección a ruta, velocidades por tramo) o accesibilidad, no para contar viajes.

### Gaps
- No encontré material de **TransitCenter "Bus Turnaround"** ni números de su boletín.
- No encontré la documentación ni la escala (GB, años) de **Bus Observatory**.
- No consulté Transitland, las herramientas de MobilityData (gtfs-realtime-validator) ni tidytransit (la búsqueda no los trajo).
- No encontré cifras de Ghost Buses en sí (porcentajes por ruta) ni una atribución causal clara entre el proyecto y la decisión de la CTA de publicar cancelaciones.

## 4. Procesamiento big data de archivos AVL/GTFS-RT: Spark, Dask, Ray, GPU y escala

### Takeaway
La literatura de escala usa casi siempre **Spark** para map-matching masivo: GeoMatch se evaluó hasta 3.780 millones de puntos y un estudio de Maryland procesó 1.400 millones de waypoints. La partición es por trayectoria o vehículo, más un índice espacial difundido a los nodos. No encontré trabajos publicados con **Ray o Dask** sobre archivos GTFS-RT, ni speedups GPU cuantificados para map-matching de buses. Eso deja espacio para una contribución de curso: un pipeline Ray particionado por bus-día con medición de escalabilidad fuerte y débil.

### Cited Findings
- **GeoMatch (Lancaster, IEEE BigData).** Extensión de Spark para map-matching a gran escala. Evaluada con datasets de 166.253 a 3.780 millones de mediciones. Los autores dicen que escala y supera a otras técnicas en requisitos de recursos y precisión. Motivación: hay datasets de millones o miles de millones de puntos de taxis, buses y flotas. — [GeoMatch preprint](https://eprints.lancs.ac.uk/129165/1/GeoMatch_IEEE_BigData_preprint.pdf); [ficha](https://eprints.lancs.ac.uk/id/eprint/129165) (no obtuve los speedups exactos)
- **Framework de map-matching paralelo en Spark (Griffith, *Distributed and Parallel Databases*, 2019).** Map-matching offline. Los algoritmos clásicos se enfocan en precisión y no en escala. El framework reporta eficiencia y escalabilidad manteniendo precisión con bajo uso de memoria. — [Springer](https://link.springer.com/content/pdf/10.1007/s10619-018-7254-0.pdf); [Griffith](https://research-repository.griffith.edu.au/items/3ad080f8-4126-40a8-992e-b61b0b43e5bd)
- **VMT con GPS masivo (ORNL, Maryland).** Spark sobre 19,8 millones de viajes y ~1.400 millones de waypoints GPS (4 meses de 2015). El reto principal fue escalar el procesamiento y el map-matching a una red estatal de miles de segmentos. — [ORNL](https://impact.ornl.gov/en/publications/using-big-gps-trajectory-data-analytics-for-vehicle-miles-travele/); [NSF PAR](https://par.nsf.gov/servlets/purl/10286816)
- **[pre-2016] GPSInsights (SoICT 2015).** Spark + k-d tree para map-matching. Probado con solo ~12 millones de registros. — [SlideShare](https://www.slideshare.net/slideshow/papersoict2015-gpsinsights-towards-a-scalable-framework-for-mining-massive-transportation-data/56676985)
- **CheetahVIS (VLDB 2020).** Sistema de analítica visual sobre Spark para datos de buses urbanos (incluye inferencia de paradas de bajada). — [PVLDB](https://www.vldb.org/pvldb/vol13/p2805-ning.pdf)
- **Streaming de feeds masivos de tránsito (arXiv 1706.04722).** Diseño de un flujo analítico en streaming para feeds de tránsito masivos. — [arXiv](https://arxiv.org/pdf/1706.04722) (no leído en detalle)
- **Predicción de retrasos a escala ciudad (arXiv 2601.18521, 2026).** Empareja vehicle positions con viajes programados por vehículo, ruta, dirección y timestamp, y convierte el flujo crudo en un registro por viaje realizado. Ese paso es paralelizable por viaje o día de servicio, aunque el paper no nombra framework. — [arXiv 2601.18521](https://arxiv.org/pdf/2601.18521) (vía resumen del buscador)
- **GPU:**
  - Auer et al. (TUM, 2017) adaptan pasos de map-matching a GPU y reportan que supera a las implementaciones open source, sin cifra de speedup en el abstract. — [TUM](https://portal.fis.tum.de/en/publications/boosting-performance-of-map-matching-algorithms-by-parallelizatio/)
  - Dogramadzi y Khan (IEEE T-ITS 2022) presentan un map-matching HMM acelerado más eficiente que el HMM tradicional con precisión similar. — [TRID](https://trid.trb.org/View/1948146)
  - RAPIDS cuSpatial acelera operaciones espaciales y espacio-temporales (punto en polígono, distancias entre trayectorias). Su ejemplo es clustering de trayectorias con Hausdorff (>10.000 trayectorias), no map-matching. — [RAPIDS Medium](https://medium.com/rapids-ai/releasing-cuspatial-to-accelerate-geospatial-and-spatiotemporal-processing-b686d8b32a9)
- **Dask/Ray:** la búsqueda específica no devolvió trabajos ni benchmarks de Dask o Ray sobre archivos GTFS-RT. — [resultado de búsqueda; ver arXiv 2601.18521](https://arxiv.org/pdf/2601.18521)

### Inferences
- **Escala relativa:** el archivo bogotano (~85M reportes; deduplicado por bus ≈ 85M × 20/52 ≈ 33M posiciones únicas, estimación propia) es 1–2 órdenes de magnitud menor que GeoMatch (3.780M) o Maryland (1.400M). Cabe en una sola máquina con Ray. El argumento de paralelismo debe apoyarse en el **costo por punto** (map-matching HMM o proyección sobre polilíneas de ~600+ rutas, interpolación de pasos por parada, percentiles por tramo) y en el **reprocesamiento repetido** (barridos de parámetros, varias franjas), no en "big data" por volumen.
- **Arquitectura recomendada a partir de la literatura:**
  1. Ingesta de protobuf a Parquet particionado por día/hora.
  2. Shuffle a **bus-día**, porque GeoMatch y el framework de la Griffith particionan por trayectoria.
  3. `ray.put` de las geometrías de ruta y de un índice espacial (STRtree o KD-tree) compartido en el object store, que es el equivalente al broadcast de Spark.
  4. Tareas Ray por bus-día: deduplicar por timestamp del vehículo, filtrar fantasmas por edad, filtrar saltos imposibles (como los filtros de Río), proyectar a la ruta (route_id) y calcular velocidad por tramo.
  5. Reducción por tramo × franja para medianas y percentiles (t-digest o sketch, o groupby en Ray Data).
- **Métricas de curso:** speedup y eficiencia con 1..N workers (escalabilidad fuerte), escalabilidad débil (días ↑ con workers ↑) y balanceo de carga, ya que los buses troncales tienen más puntos que los zonales y la granularidad bus-día evita la cola larga. Comparar contra la línea base secuencial de pandas/GeoPandas.
- **GPU:** opcional. No hay speedups publicados que lo justifiquen para este volumen. Si se usa, que sea para la búsqueda espacial (punto-a-segmento) en lotes, no para HMM.

### Gaps
- No encontré speedups numéricos concretos (×N) en GeoMatch, en el framework de la Griffith ni en los trabajos GPU. Los PDF no se leyeron completos.
- No encontré trabajos publicados con Ray o Dask sobre AVL/GTFS-RT, ni benchmarks de Ray Data contra Spark en trayectorias.
- No verifiqué la escala ni la arquitectura de los archivos de Ghost Buses, Bus Observatory o TransitMatters en GB/día.
