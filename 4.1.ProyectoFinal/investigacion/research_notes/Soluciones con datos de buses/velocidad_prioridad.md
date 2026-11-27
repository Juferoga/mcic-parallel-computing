# Soluciones con posiciones de buses para hacerlos más rápidos (carriles, prioridad semafórica, zonas lentas, velocidades por tramo)

Alcance: soluciones reales (agencias, contraloría, academia, civic tech, proveedores) que usan posiciones de buses (AVL / GTFS-RT VehiclePositions) para priorizar o evaluar carriles bus, prioridad semafórica (TSP), detección de cuellos de botella y tableros de velocidad por tramo. Se excluye bunching y regularidad de headway (tema de tesis del autor). Periodo 2018–2026; lo anterior se marca "(antiguo)". Cifras de proveedor se marcan "(proveedor)".

Referencia de factibilidad (datos Bogotá): ~6.900 buses, consulta cada 20 s, cada bus reporta cada ~52 s, edad del reporte ~50–58 s, ~15 días desde 11-nov-2026, >85 M registros; GTFS estático (shapes, stops) diario solo desde 24-nov-2026; trip_id casi nunca casa con el estático, route_id y stop_id sí; stop_id reportado es aproximado; sin ocupación, pasajeros, puertas ni eventos de llegada; hubo congelamientos del feed; sin datos "antes" de los carriles de Carrera Séptima (may-2025) y Carrera 13 (oct-2025).

## 1. ¿Qué agencias publican o usan velocidad por tramo desde AVL/GTFS-RT y qué ganancias medidas reportan?

### Takeaway
Nueva York es el caso más completo y abierto: la MTA publica velocidades tramo a tramo (entre timepoints) por mes, día y hora, y eso alimenta auditorías externas (Contralor, IBO) y evaluaciones de cámaras y de la tarifa de congestión. Las ganancias medidas van del 2–5 % (medidas de red: tarifa de congestión, cámaras en promedio) al 10–38 % (carriles y busways en un corredor concreto). Los programas de Londres, Toronto, Chicago, LA y San Francisco usan datos AVL propios, pero publican menos detalle reproducible.

### Cited Findings

**Nueva York: MTA "Bus Route Segment Speeds" (dataset abierto)**
- Hay datasets abiertos "MTA Bus Route Segment Speeds: 2023–2024" (data.ny.gov/d/58t6-89vi) y "Beginning 2025" (data.ny.gov/d/kufs-yh3x). Dan velocidad media en mph entre pares de timepoints, tiempo de viaje, distancia vial y número de viajes por mes, día de la semana y hora, con tipo de viaje (Local, Limited, SBS, Express, School), distrito y coordenadas de timepoints — [data.gov catálogo 2025](https://catalog.data.gov/dataset/mta-bus-route-segment-speeds-beginning-2025); [data.gov 2023–2024](https://catalog.data.gov/dataset/mta-bus-route-segment-speeds-2023-2024)
- Método según la MTA: el GPS a bordo registra cuándo el bus pasa por sus paradas principales (timepoints). Las trazas se asocian a rutas con Dynamic Time Warping y la velocidad sale del tiempo entre timepoints consecutivos dividido por la distancia vial. No descuenta el tiempo en parada: incluye abordaje, semáforos, relevos, cierres, vehículos de carga y tráfico. Se publica solo a nivel timepoint para que el volumen sea manejable, y se pondera por número de viajes para agregar rutas — [MTA, "Beyond the route"](https://www.mta.info/article/beyond-route-introducing-granular-mta-bus-speed-data)
- Escala: ~4.900 buses en 327 rutas por día hábil y ~1,3 M pasajeros. En el ejemplo del M7 (6th Ave, timepoints 16th–34th St) la velocidad de mediodía es unas 3 veces menor que la nocturna. La MTA dice que 1–2 mph de diferencia convierten un viaje de 40 min en uno de 60 min. Usos declarados: encontrar los corredores más lentos y apoyar decisiones de carriles bus y abordaje más rápido — [MTA](https://www.mta.info/article/beyond-route-introducing-granular-mta-bus-speed-data)
- También hay "MTA Central Business District Bus Speeds: Beginning 2023" (data.ny.gov/d/r6db-kkzj), que separa los tramos según su relación con la zona de cobro por congestión — [data.gov](https://catalog.data.gov/dataset/mta-central-business-district-bus-speeds-beginning-2023)

**Nueva York: evaluación de la tarifa de congestión (desde 5-ene-2025)**
- La MTA reportó un aumento medio de 3,2 % en la velocidad de buses dentro de la Congestion Relief Zone, con algunas rutas hasta +25 % (balance de seis meses) — [MTA press release](https://www.mta.info/press-release/icymi-six-months-governor-hochul-highlights-success-of-congestion-pricing-traffic)
- Con el dataset CBD, Streetsblog reporta 5,96 mph (ene-2024) frente a 6,1 mph (ene-2025), cerca de +2,3 %, y una mejora mucho menor en noviembre (5,71 a 5,73 mph). Las cifras de la MTA (CRZ) y de Streetsblog (CBD, otro periodo) no son comparables directamente — [Streetsblog NYC, ene-2026](https://nyc.streetsblog.org/2026/01/05/how-congestion-pricing-proved-the-haters-wrong-and-is-changing-new-york-for-the-better)

**Nueva York: Contralor (report card) e IBO**
- "Life in the Slow Lane" (Contralor NYC, 4-sep-2025) califica de A a F las 332 líneas: 186 sacan D o F y en Manhattan el 73 % de las rutas sacan D o F. Propone subir la velocidad 15 % en toda la ciudad, lo que llevaría el 90 % de las líneas C a B o mejor — [Contralor NYC](https://comptroller.nyc.gov/reports/life-in-the-slow-lane); [Notas de prensa del Contralor](https://comptroller.nyc.gov/newsroom/comptroller-lander-doles-out-a-d-grade-or-lower-for-more-than-half-of-nyc-bus-lines)
- El informe "Behind Schedule" del Contralor da 8,17 mph de media urbana en 2024. Manhattan es el único distrito más rápido que en 2015 (+3 %). La meta de DOT de 2018 (Better Buses: +25 %, de ~8 a ~10 mph) no se cumplió — [Contralor NYC, Behind Schedule](https://comptroller.nyc.gov/reports/behind-schedule-how-new-york-citys-bus-system-slow-rolls-riders)
- IBO NYC, "Speeding Up Slowly" (feb-2025): la velocidad de dic-2024 casi no cambió respecto a ene-2019. Solo se construyeron ~9,6 millas de carriles protegidos desde 2022, frente a las 150 millas que exige la ley para 2026. El informe recomienda más fiscalización y más TSP. Incluye mapas interactivos de velocidad y carriles — [Streetsblog resumiendo IBO](https://nyc.streetsblog.org/2025/02/07/report-efforts-to-speed-up-bus-speeds-have-stalled-like-bus-speeds); [amNY](https://www.amny.com/news/nyc-buses-slow-city-falls-short-bus-lane-goals) (no abrí el PDF completo del IBO)

**Nueva York: cámaras a bordo para fiscalizar carriles (ACE)**
- Según la MTA (feb-2026), las rutas con ACE subieron su velocidad un 5 % en promedio, además de lo que ya aportaba el carril bus, con corredores de hasta +30 %. También reporta 20 % menos colisiones y 54 rutas fiscalizadas — [MTA press release](https://www.mta.info/press-release/automated-camera-enforcement-fines-begin-friday-feb-6-three-brooklyn-and-manhattan) (cifra tomada del resumen de búsqueda de la serie de comunicados ACE)
- Streetsblog (con cifras de la MTA): con cámaras, la velocidad sube ~10 % en carriles bus y ~20 % en busways. En el Bx35 subió otro 20 % al llegar las cámaras en abr-2023 — [Streetsblog NYC, mar-2025](https://nyc.streetsblog.org/2025/03/25/freeze-frame-bus-mounted-cameras-are-speeding-up-buses-in-and-out-of-bus-lanes)

**Nueva York: busway de la 14th St (2019, frontera del periodo)**
- Tiempo 3rd a 8th Ave: de ~15,1 min (sep-2018) a ~10,6 min, cerca de −30 %. Otra versión de la MTA dice −38 % (17 a 10,3 min, desde nov-2018). La puntualidad pasó de ~45 % a ~68 % y la ridership de día hábil subió ~15 % — [MTA M14 SBS](https://newwest.mta.info/M14SBS); [MTA project](https://www.mta.info/project/m14-sbs). Las cifras varían entre fuentes (22–47 % según City Hall) — [Streetsblog](https://nyc.streetsblog.org/2019/12/18/mayor-finally-takes-his-busway-victory-lap-highlighting-need-for-more-car-free-transit-routes)

**Toronto: RapidTO Eglinton East**
- 8,5 km de carriles en Eglinton Ave E, Kingston Rd y Morningside Ave, instalados entre sep y nov de 2020 — [TTC](https://www.ttc.ca/about-the-ttc/projects-and-plans/RapidTO-Eglinton-East-Bus-Lanes)
- El dashboard oficial (ene-2022 a mar-2023) reporta reducciones de hasta 2 min en tiempo de viaje frente a la semana previa a la apertura. Hay dashboards por tramo desde la línea base — [Toronto dashboard](https://www.toronto.ca/wp-content/uploads/2025/07/964b-RapidTO-Eglinton-East-Dashboard-Jan-2022-to-Mar-2023Dec5v2r.pdf); [Toronto dashboard jul-2021](https://www.toronto.ca/wp-content/uploads/2021/07/9794-RapidTO-DashboardJuly21.pdf). La prensa habló de ~6 min, cifra no verificada contra el dashboard — [Daily Hive](https://dailyhive.com/toronto/eglinton-bus-lanes-reduce-travel-time-six-minutes)
- Análisis cívico independiente (Steve Munro, con datos de vehículos de la TTC): los tiempos bajaron en algunos periodos del día pero no en todos (ruta 86, ene-2024) — [stevemunro.ca](https://stevemunro.ca/2024/02/07/travel-times-on-rapidto-corridors-part-ii-january-2024/)

**San Francisco: Muni Forward / carriles temporales de emergencia (TETL, 2020–2022)**
- SFMTA reporta ahorros de tiempo de hasta 31 % y mejor confiabilidad en líneas que llevan al 40 % de los usuarios de Muni. Seis de siete corredores TETL quedaron permanentes — [SFMTA blog](https://www.sfmta.com/blog/emergency-response-transit-lanes-program-shows-long-term-success)
- Van Ness BRT (evaluación final, abr-2025): tiempo de viaje de transporte público hasta −36 % en el área del proyecto — [SFMTA](https://www.sfmta.com/media/41987/download) (según el resumen de búsqueda)
- (Antiguo, 2015) Piloto de Church St con datos GPS de Muni: tiempo hasta −14 % (~1 min) y variabilidad hasta −27 % — [SFMTA vía NACTO](https://nacto.org/wp-content/uploads/3-9_SFMTA-Church-Street-Pilot-Report_2015.pdf)

**Chicago: Better Streets for Buses / Bus Priority Zones**
- El plan CTA/CDOT (nov-2023) es un marco con 19 tratamientos y no asigna proyectos por corredor. El programa Bus Priority Zones ataca "slow zones" (congestión, espacio de abordaje, intersecciones) — [CTA BSB](https://transitchicago.com/betterstreetsforbuses/); [CTA BPZ](https://www.transitchicago.com/newsprojects/bpz/)
- Cifras reportadas: carriles bus que aceleraron 12–21 %, y velocidad media de la CTA −9 % en 20 años. No encontré la evaluación formal por slow zone — [Mass Transit](https://www.masstransitmag.com/bus/infrastructure/press-release/53079608/cta-cdot-launch-chicagos-first-better-streets-for-buses-plan); críticas en [Streetsblog Chicago](https://chi.streetsblog.org/2023/12/03/will-chicagos-better-streets-for-buses-plan-result-in-real-brt-this-time)

**Los Ángeles**
- (2019) Piloto del carril de Flower St: hasta +20 % en tiempo de viaje (preliminar) — [LA Metro](https://libraryarchives.metro.net:443/DPGTL/studies/before-after/2019-flower-street-bus-lane-evaluation-october.pdf)
- Un editorial (2023) cita ~40 millas de carriles nuevos desde 2019 y "hasta 30 %" de mejora de velocidad. Es opinión, no una evaluación formal — [LA Times vía Yahoo](https://news.yahoo.com/editorial-finally-bus-lane-building-120017335.html)

**Londres (TfL)**
- Todos los buses llevan iBus (AVL GPS) desde 2009, y TfL lo usa para prioridad semafórica selectiva. Un estudio para TfL usó velocidades medias iBus por franja horaria para localizar "hot spots" — [TfL FOI, Bus Priority Study](https://foi.tfl.gov.uk/FOI-0751-2122/Bus%20Priority%20Study_ISSUE_Short-Medium%20Term_Redacted.pdf); [JCT/TfL](https://jctconsultancy.co.uk/Symposium/Symposium2017/PapersForDownload/Improving%20the%20bus%20network%20in%20London%20through%20traffic%20signalling%20Henry%20Axon%20TfL.pdf)
- La velocidad media de buses bajó de 10,27 mph (2020/21) a 9,17 mph (2024/25). TfL sostiene que cada 1 % de cambio en el tiempo de viaje mueve ~0,6 % la demanda — [London Assembly](https://www.london.gov.uk/who-we-are/what-london-assembly-does/london-assembly-work/london-assembly-current-investigations/bus-journey-times)

**Bogotá (contexto local, no es evaluación con AVL)**
- Carril preferencial de la Séptima (calles 28–100, ambos sentidos): comparendos desde el 26-may-2025. El balance de la Secretaría de Movilidad a un mes habla de ~5 min ahorrados por trayecto y 123 comparendos. El Distrito afirma que la invasión reduce hasta 30 % la velocidad. No encontré la metodología ni los datos detrás — [El Espectador](https://www.elespectador.com/bogota/restriccion-en-carril-preferencial-de-la-septima-mejoro-tiempos-de-viaje-en-transporte-publico/); [Bogotá.gov.co](https://bogota.gov.co/mi-ciudad/movilidad/de-que-se-trata-medida-en-carril-preferencial-carrera-septima-bogota)
- Carrera 13: control reforzado del carril preferencial en oct-2025 — [Bogotá.gov.co](https://bogota.gov.co/mi-ciudad/movilidad/bogota-refuerza-el-control-al-carril-preferencial-del-sitp-carrera-13)

### Inferences
- El patrón que se repite (MTA, Contralor, IBO) es el mismo: un dataset abierto de velocidad por tramo × hora × día, del que salen rankings de rutas lentas y evaluaciones de política. Es el producto más replicable para Bogotá: una tabla velocidad[route_id, tramo, hora, tipo_día] con p20/p50/p80 y conteo de viajes.
- **Factibilidad Bogotá (tablero de velocidad por tramo): ALTA.** Hay route_id y shapes (desde el 24-nov). Con un reporte cada ~52 s y buses a ~15–20 km/h hay unos 200–300 m entre puntos, así que conviene usar tramos de ~500 m–1 km o tramos parada a parada interpolados, y no timepoint a timepoint como la MTA. Para fechas anteriores al 24-nov hay que asumir que los shapes del 24-nov siguen vigentes (supuesto que se debe documentar). Hay que deduplicar: con consulta cada 20 s y reporte cada ~52 s, ~60 % de las filas repiten la posición. Se usa el timestamp del vehículo y no el del encabezado, y se excluyen las ventanas de congelamiento del feed.
- **Factibilidad Bogotá (evaluar Séptima / Cra 13 antes vs después): NO** con estos datos (no hay "antes"). Lo que sí se puede hacer es comparar en el mismo periodo tramos con carril y tramos sin carril de las mismas rutas, como Filadelfia con Chestnut East vs West (ver sección 3), y contrastar con la cifra del Distrito (~5 min por trayecto).
- **Por qué Ray:** con >85 M puntos, proyectar cada punto sobre el shape de su ruta (referencia lineal) es embarrassingly parallel por (route_id, día). La agregación por tramo × hora es un shuffle/groupby distribuido, y los intervalos de confianza por bootstrap (miles de remuestreos por tramo) multiplican el cómputo.

### Gaps
- No obtuve cifras medidas y publicadas de Seúl, Singapur (LTA), Helsinki (HSL) ni París en el periodo 2018–2026. No las investigué a fondo por límite de búsquedas.
- No pude abrir el PDF completo del IBO ni la evaluación de Van Ness. Las cifras vienen de resúmenes.
- No encontré la metodología detrás de los ~5 min ahorrados en la Séptima (¿datos de flota SITP? ¿muestreo manual?).

## 2. ¿Qué métodos identifican dónde un carril bus o TSP ahorraría más? ¿Hay metodologías publicadas que usen solo posiciones GTFS-RT (sin pasajeros)?

### Takeaway
Sí. Hay al menos dos líneas reproducibles que usan solo posiciones: (a) Aemmer, Ranjbari y MacKenzie (2022), que calculan el retraso por segmento contra una velocidad de flujo libre (percentil 95 del ritmo) a partir de GTFS-RT de Seattle, y (b) los California Transit Speed Maps de Cal-ITP/Caltrans, que calculan p20/p50/p80 por tramo parada a parada desde GTFS-RT VehiclePositions y se usan como métrica oficial de TSP en California. El ranking por persona-retraso (pasajeros × retraso) necesita pasajeros, que Bogotá no tiene. Se puede sustituir por bus-retraso (viajes × retraso).

### Cited Findings

**Aemmer, Ranjbari y MacKenzie (2022), "Measurement and classification of transit delays using GTFS-RT data", *Public Transport* 14:263–285 (Univ. of Washington)**
- Problema: crear una herramienta de cribado para toda la red que diga dónde conviene quitar holgura del horario y dónde conviene infraestructura (carriles bus, TSP). El marco sirve para cualquier red que publique GTFS-RT y el código es abierto — [preprint UW](https://mic.comotion.uw.edu/wp-content/uploads/2022/03/Aemmer-Ranjbari-MacKenzie-GTFS-RT-Transit-Delay.pdf); [DOI 10.1007/s12469-022-00291-7](https://ideas.repec.org/a/spr/pubtra/v14y2022i2d10.1007_s12469-022-00291-7.html)
- Método: el ritmo (s/milla) entre actualizaciones consecutivas es Δ lastLocationUpdateTime / Δ lastKnownDistanceAlongTrip. El retraso total entre i−1 e i es (ritmo medido − ritmo p95 del segmento, tomado como flujo libre) × distancia. El retraso estocástico sale de la variable scheduleDeviation, y el sistemático es total − estocástico. Cada punto se asigna al segmento vial más cercano (TIGER, filtrado con un buffer alrededor de las rutas del GTFS) por vecino más cercano y no por map-matching completo — [preprint UW](https://mic.comotion.uw.edu/wp-content/uploads/2022/03/Aemmer-Ranjbari-MacKenzie-GTFS-RT-Transit-Delay.pdf)
- Resultados en King County Metro: ~27 M posiciones de ~6.000 viajes. Medianas: retraso estocástico −19 s, sistemático 95 s y total 72 s. El retraso sistemático domina y se concentra en el CBD; algunos tramos de autopista (I-5) muestran adelantos de 1–2 min. Conclusión: un segmento con alto retraso sistemático es candidato a TSP o carril bus, y uno con alto estocástico, a ajustar la holgura — [preprint UW](https://mic.comotion.uw.edu/wp-content/uploads/2022/03/Aemmer-Ranjbari-MacKenzie-GTFS-RT-Transit-Delay.pdf)
- Los autores advierten que con más frecuencia de muestreo se localiza mejor el retraso, pero sube el cómputo, y que asignar puntos a segmentos se vuelve costoso al crecer los datos. Citan trabajo de "big data" GTFS-RT (Barbeau et al., 2020) — [preprint UW](https://mic.comotion.uw.edu/wp-content/uploads/2022/03/Aemmer-Ranjbari-MacKenzie-GTFS-RT-Transit-Delay.pdf)

**Cal-ITP / Caltrans: California Transit Speed Maps**
- Usa GTFS-RT VehiclePositions archivado más GTFS Schedule. La velocidad por segmento sale del tiempo y la distancia entre reportes, con la distancia medida a lo largo de la ruta, interpolando los dos reportes más cercanos. Publica el p20 por segmento y periodo, y mide la variación como p80/p20. Periodos: AM 07–10, mediodía 10–15, PM 15–20 y noche 20–24. Los segmentos son parada a parada, con cortes extra cada 1 km si las paradas están más lejos. Se actualiza al menos trimestralmente (con un día representativo; van hacia un promedio móvil) y se descarga en GeoJSON — [California Transit Speed Maps](https://analysis.dds.dot.ca.gov/rt/); [Caltrans ArcGIS Speeds by Stop Segments](https://gisdata.dot.ca.gov/arcgis/rest/services/CHrailroad/Speeds_by_Stop_Segments/FeatureServer)
- Uso oficial para TSP: las "California Open TSP Performance Metrics" (v1.0, abr-2026) usan Trip Segment Speed p50 y p80 por ruta en el corredor, calculados con la herramienta Speedmaps sobre GTFS-RT del Caltrans Data Warehouse. Advierten que el resultado depende de factores ajenos a la TSP, como el tráfico general — [Caltrans Cal-ITP TSP metrics](https://dot.ca.gov/cal-itp/tsp-performance-metrics)
- El código está en github.com/cal-itp/data-analyses (carpetas `rt_segment_speeds`, `ca_transit_speed_maps`). Hay notebooks de proyección de posiciones, interpolación, remuestreo y "dask_notes", lo que sugiere procesamiento paralelo con Dask (no confirmado en el README) — [GitHub cal-itp/data-analyses](https://github.com/cal-itp/data-analyses/tree/main/rt_segment_speeds)

**Otros métodos de priorización**
- Redelmeier, Victoriano-Habit, Crumley y El-Geneidy (2025), "Bit by bit", *J. Public Transportation* 27: método de punta a punta para pasar de datos AVL-APC a un diseño conceptual de prioridad en un corredor (Portland). Usa APC, así que necesita pasajeros — [McGill TRAM](https://tram.mcgill.ca/Research/Publications/Bus%20priority%20methodology.pdf); [ANID](https://investigadores.anid.cl//en/public_search/work?id=833865)
- Imperial College RTSC (2017, antiguo): revisión internacional de cómo identificar y seleccionar esquemas de prioridad, con el caso de Nueva York — [RTSC](https://t4awstest.cc.ic.ac.uk/media/imperial-college/research-centres-and-groups/centre-for-transport-studies/rtsc/The-Identification-and-Management-of-Bus-Priority-Schemes---RTSC-April-2017_ISBN-978-1-5262-0693-0.pdf)
- (Proveedor) Swiftly Speed Map: Capital Metro (Austin) usó Speed Map + Remix para planear un carril bus de 2 millas en East Riverside y proyectó ahorros de 5 min (AM) y 4 min (PM). Es una proyección, no una medición. En VTA (2018) un solo segmento añadía ~5 min al horario — [Swiftly blog](https://www.goswift.ly/blog/prioritizing-transit-with-a-collaborative-data-approach-webinar-recap); [Swiftly VTA](https://www.goswift.ly/blog/speeding-up-transit-and-project-timelines-at-santa-clara-vta)
- (Antiguo, 2015) Golub y Chavis estiman el retraso por parada con GTFS + GTFS-RT en Boston para un análisis de brechas de servicio — [UMD NTC](https://mti.umd.edu/sites/mti.umd.edu/files/documents/NTC2015-MU-R-1%20Golub%20Chavis.pdf)

### Inferences
- **Factibilidad Bogotá (Aemmer: retraso vs flujo libre por segmento): ALTA para el retraso total, NO para el split estocástico/sistemático.** El split necesita scheduleDeviation y un trip_id que case con el horario, y el feed de Bogotá no tiene ninguno de los dos. Como sustituto se puede usar la variabilidad (p80/p20 de Cal-ITP o la desviación estándar entre días del mismo tramo y hora) como "retraso impredecible", y el retraso medio frente al p95 de ritmo (o la velocidad nocturna) como "retraso sistemático". La distancia a lo largo del viaje no viene en el feed: hay que calcularla proyectando el punto sobre el shape del route_id.
- **Ranking de hotspots sin pasajeros:** retraso_bus_horas[tramo] = Σ viajes × (t_observado − t_flujo_libre). Pondera por frecuencia de buses en lugar de pasajeros. Se puede afinar priorizando tramos con alto retraso, mucha variabilidad y muchas rutas compartidas (troncales del SITP). Se debe decir de forma explícita que no es persona-retraso.
- **Separar retraso en parada vs en vía:** sin eventos de puerta ni llegada, y con puntos cada ~52 s, la separación es débil. Una aproximación es contar los puntos con desplazamiento casi nulo cerca de un stop_id (≤30 m) frente a los que están lejos de paradas (cola o semáforo). Es útil para sugerir TSP (retraso cerca de intersecciones semaforizadas) frente a carril (retraso distribuido por el tramo), pero con baja resolución.
- **Por qué Ray:** calcular el p95 por tramo exige ver todos los pares de puntos de los 15 días (cuantiles exactos o aproximados con t-digest por partición y luego fusión). La proyección sobre shapes (~cientos de route_id) es un map por partición, y el ranking con bootstrap es otro map paralelo.

### Gaps
- No encontré una metodología publicada que use solo VehiclePositions con un muestreo tan escaso (~52 s) y valide el error de interpolación. Aemmer muestrea a ~cada 30 s o menos vía API OneBusAway; Cal-ITP no publica el error.
- No encontré un artículo de "person-delay ranking" con fórmula citable en el tiempo disponible.
- No verifiqué el texto de "Bit by bit" más allá del resumen.

## 3. Evaluaciones antes/después de carriles bus (y TSP) con datos AVL y sus resultados

### Takeaway
Las evaluaciones descriptivas de agencias reportan entre 5 y 38 % de ahorro en el tramo tratado. Un estudio causal grande en Santiago (diferencias en diferencias con GPS de 500 rutas) encuentra que los carriles pintados dan una ganancia pequeña y no significativa, mientras que los corredores segregados dan ~+20 % en hora punta. La TSP suele dar 3–15 % en tiempo de recorrido y más en retraso en intersección y variabilidad. La fiscalización (cámaras) aparece como una variable de primer orden.

### Cited Findings

**Santiago de Chile: Gonzalez et al. (2025), "Efficiency of bus priority infrastructure", *Journal of Urban Economics* (JUE Insight)**
- Usa datos GPS de buses de 500 rutas y diferencias en diferencias. Los carriles bus dan un aumento de velocidad positivo pero pequeño y estadísticamente no significativo; los corredores (BRT segregado) suben la velocidad ~20 % en hora punta. Incluye además un DiD con emparejamiento para una calle solo-bus nueva en Santiago. Hay paquete de replicación en openICPSR — [PDF UC](https://economia.uc.cl/wp-content/uploads/2026/08/1-s2.0-S0094119025000166-main.pdf); [openICPSR replicación](https://www.openicpsr.org/openicpsr/project/218041/view); [UC Ingeniería](https://researching.investigacion.ing.uc.cl/publication/3406)

**Filadelfia: Chestnut St, carril bus rojo (evaluación de la ciudad, publicada 2025)**
- Diseño: compara Chestnut East (Broad a 2nd, con pintura roja) con Chestnut West (23rd a Broad, sin pintura) como control, por tener igual ancho, mismas rutas SEPTA (9, 21, 38, 42) y largo, ridership y comercio similares. Se promedian martes a jueves de octubre de 2019 frente a octubre de 2023, en punta PM (15–18 h), con un mapa de calor de tiempo parada a parada — [City of Philadelphia](https://www.phila.gov/media/20251030130304/Chestnut_RedBusLaneEvaluation.pdf)
- Resultado: 12,3 % más rápido en Chestnut East frente a 35,8 % más lento en Chestnut West. Son ~30 s por bus y hasta 35,2 h-persona por día. La mejora se concentra entre las calles 10th y 6th. En la parte oeste, casi todo el aumento de retraso está en cuadras con giro a la derecha compartido. El estacionamiento en doble fila bajó 53 % tras la pintura (jun-2022 a sep-2022) y en el oeste sin pintar los bloqueos subieron más de 250 %. Las otras rutas de Center City se volvieron ~4 % más lentas en el mismo periodo — [City of Philadelphia](https://www.phila.gov/media/20251030130304/Chestnut_RedBusLaneEvaluation.pdf)

**Otros antes/después**
- Cambridge, MA (ene-2023): los buses de entrada son 31 % más rápidos en promedio tras el carril de North Mass Ave (datos MBTA, descriptivo) — [City of Cambridge](https://www.cambridgema.gov/Departments/trafficparkingandtransportation/News/2023/01/northmassavebuslanes)
- Shenzhen, Shennan East Rd (Zhong y Sun, 2022): regresión discontinua en el horario de activación del carril con GPS de buses; la velocidad media sube 8,2 % después de la hora de apertura — [RePEc](https://ideas.repec.org/h/spr/sprchp/978-981-16-8016-8_4.html)
- Boston, Huntington Ave (2023): la evaluación del BTD mide la confiabilidad como brecha entre el p90 y la mediana del tiempo de viaje — [Boston.gov](https://content.boston.gov/sites/default/files/file/2023/05/Huntington%20Bus%20Lanes%20Eval%20for%20BTD_Outbound%20%281%29.pdf)
- Portland/PSU (Glick y Figliozzi): antes/después con velocidades AVL; mejoras significativas en los percentiles 10–25 de velocidad (los viajes más lentos), sin una cifra única — [TREC PSU póster 2018](https://trec.pdx.edu/sites/default/files/Glick_TRB_Poster_2018.pdf)

**TSP con datos AVL (mayormente antiguo)**
- (Antiguo) San Mateo, TSP adaptativa: −5 % en tiempo de recorrido y −18 a −32 % en retraso en intersección, sin efecto significativo sobre el tráfico general — [ITS JPO KRS](https://www.itskrs.its.dot.gov/2013-b00819)
- (Antiguo) Chicago, Western Ave (rutas 49/X49): −4 a −15 % en tiempo de viaje y −51 a −54 % en varianza; separa el efecto de reprogramar semáforos del de la TSP — [ITS JPO KRS](https://www.itskrs.its.dot.gov/2016-l00729)
- (Antiguo, 2006) Virginia (Rakha y Ahn): extensión de verde da 3–6 % de ahorro y hasta −23 % en retraso en intersección; paradas antes del cruce (near-side) empeoran, paradas después del cruce (far-side) mejoran — [VTRC](https://vtrc.virginia.gov/reports/all-reports/06-cr6/)
- NYC M15 SBS (2017, antiguo): con GPS de buses, ahorro de <1 % a 25 % según ubicación y hora — [NYC DOT](https://www.nyc.gov/html/brt/downloads/pdf/brt-transit-signal-priority-july2017.pdf)
- Cal-ITP define desde 2026 métricas abiertas de TSP basadas solo en GTFS-RT (duración de viaje y velocidad por tramo p50/p80) — [Caltrans](https://dot.ca.gov/cal-itp/tsp-performance-metrics)

### Inferences
- El hallazgo de Santiago (carriles pintados con efecto no significativo; corredores +20 %) es la referencia latinoamericana más sólida y la más cercana a Bogotá. Además ofrece un diseño (DiD con muchas rutas y GPS) que se podría replicar si hubiera ventana "antes".
- **Factibilidad Bogotá (antes/después de la Séptima / Cra 13): NO.** No hay datos previos a may-2025 ni a oct-2025.
- **Factibilidad Bogotá (comparación transversal tipo Chestnut East vs West): MEDIA-ALTA.** Se comparan, en los mismos 15 días, los tramos de las mismas rutas (mismo route_id) dentro y fuera del carril preferencial, normalizando por la velocidad nocturna o de flujo libre de cada tramo para descontar geometría y semáforos. No es causal y se debe decir así.
- **Cuasi-experimentos posibles en la ventana de 15 días:** (a) horario de activación del carril, si tiene hora de inicio y fin (diseño de regresión discontinua en el tiempo como en Shenzhen); (b) festivos frente a días hábiles (control de demanda de tráfico); (c) eventos puntuales (cierres, manifestaciones). Cada uno requiere verificar el calendario y la operación real.
- **Por qué Ray:** un DiD o una regresión discontinua por tramo × hora con errores estándar por bootstrap por bloques (por día o por bus) implica miles de reestimaciones independientes, paralelizables como tareas Ray. Los placebos, con tramos falsos o fechas falsas, son otro barrido paralelo.

### Gaps
- No encontré evaluaciones con AVL publicadas para TransMilenio/SITP (zonales) en carriles preferenciales.
- No verifiqué el horario operativo exacto de los carriles de la Séptima y la Cra 13 (necesario para el diseño de discontinuidad).
- Las cifras de TSP son mayormente anteriores a 2018. No encontré evaluaciones recientes de TSP solo con GTFS-RT con resultados numéricos, más allá de la definición de métricas de Cal-ITP.

## 4. Herramientas abiertas que calculan velocidad por tramo desde GTFS-RT (o similares)

### Takeaway
La herramienta abierta más madura para velocidad por tramo desde GTFS-RT VehiclePositions a escala estatal es el pipeline de Cal-ITP (`cal-itp/data-analyses`, Python, aparentemente con Dask). Aemmer et al. también publican su código. Las librerías GTFS genéricas (`gtfs_segments`, `gtfs_functions`) trabajan sobre el horario estático, no sobre posiciones reales, y Swiftly es comercial.

### Cited Findings
- **Cal-ITP `rt_segment_speeds` / `ca_transit_speed_maps`** (Caltrans, abierto): agrega velocidades por ruta, dirección y par de paradas para cada operador. Publica medianas en punta, valle, hábil y fin de semana (abr y oct de 2023 en el README), y mapas p20/p50/p80. Tiene notebooks de vectores de dirección, remuestreo de posiciones y "dask_from_map" — [GitHub cal-itp/data-analyses](https://github.com/cal-itp/data-analyses/tree/main/rt_segment_speeds); [Speed Maps](https://analysis.dds.dot.ca.gov/rt/)
- **Aemmer et al. (UW)**: código y datos abiertos según el artículo. Archivo GTFS-RT en base relacional, asignación por vecino más cercano a segmentos TIGER — [preprint UW](https://mic.comotion.uw.edu/wp-content/uploads/2022/03/Aemmer-Ranjbari-MacKenzie-GTFS-RT-Transit-Delay.pdf)
- **`gtfs_segments` (UTEL-UIUC, JOSS)**: genera segmentos y espaciamiento entre paradas desde el GTFS estático. Útil para segmentar shapes parada a parada, pero no procesa posiciones — [JOSS](https://joss.theoj.org/papers/10.21105/joss.06306.pdf); [PyPI](https://pypi.org/project/gtfs-segments/2.1.5/)
- **`gtfs_functions`**: `feed.avg_speeds` da velocidades programadas (horario) por segmento, no observadas — [GitHub Bondify](https://github.com/Bondify/gtfs_functions)
- **Paquete R `gtfsrealtime`**: lee VehiclePositions; en la viñeta con datos de NYC el campo speed viene vacío (NA). Hay que calcular la velocidad desde posiciones — [CRAN vignette](https://cran.r-project.org/web/packages/gtfsrealtime/vignettes/positions.html)
- (Antiguo, ~2015) **BusVis (NYU CUSP + TransitCenter)**: visualización de velocidades medias desde el archivo histórico de MTA Bus Time (posiciones cada 30 s, sep–dic 2014). La MTA advirtió que Bus Time no corrige errores de operador ni caídas del feed — [TransitCenter](https://transitcenter.org/bus-vis/)
- (Proveedor) **Swiftly Speed Map**: mapas de velocidad de alta resolución desde AVL/GTFS-RT, integrados con Remix para planear carriles y TSP. Swiftly dice que en un proyecto TSP detectó "hasta 12 h de retraso latente diario" — [Swiftly Speed Map](https://www.goswift.ly/blog/data-is-power-introducing-the-speed-map-module); [Swiftly hi-res](https://www.goswift.ly/blog/swiftlys-speed-map-goes-hi-res); [Swiftly TSP](https://www.goswift.ly/blog/enabling-tsp)
- **Archivos abiertos de VehiclePositions de otros sistemas** (útiles para comparar): Transport for NSW publica bundles históricos diarios de GTFS-R Vehicle Positions de buses — [data.nsw.gov.au](https://data.nsw.gov.au/data/dataset/2-historical-gtfs-bundles-and-timetables/resource/b90510d4-b64a-40b0-96c6-26ea36774e53)

### Inferences
- **Factibilidad Bogotá: ALTA, adaptando Cal-ITP.** La cadena sería: deduplicar → proyectar sobre el shape del route_id (sin trip_id; elegir el shape de la ruta por cercanía y dirección del movimiento cuando haya varios por ruta) → interpolar el instante de paso por cada parada o corte de 1 km → velocidad por tramo → p20/p50/p80 por hora y tipo de día. `gtfs_segments` puede servir solo para cortar los shapes en tramos parada a parada.
- Riesgo propio de Bogotá: con ~52 s entre reportes la interpolación lineal subestima las detenciones cortas en semáforos y paradas. Las métricas de tramo (≥500 m) son robustas; las de intersección individual, no.
- **Por qué Ray (no Dask):** el curso exige Ray. El patrón Cal-ITP ("dask_from_map": map por operador o día y luego agregación) se traduce directamente a `ray.data` (map_batches por route_id/día, groupby por tramo × hora) o a tareas Ray por partición.

### Gaps
- No verifiqué si existen paquetes "busspeeds" o un "Bus Turnaround toolkit" de TransitCenter con código de velocidad por tramo. La búsqueda no los encontró.
- No revisé OpenTransitTools ni el código exacto de Aemmer (URL del repositorio no extraída del preprint).
- No confirmé el método exacto de interpolación de Cal-ITP (el README no lo detalla; la descripción viene de su sitio de metodología).
