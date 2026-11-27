# Soluciones de planeación y equidad con posiciones de buses (GTFS-RT/AVL + GTFS estático): accesibilidad observada, servicio programado vs entregado, tiempos de recorrido y cobertura

Alcance: soluciones reales (publicadas o desplegadas) 2015–2026. Se excluyen bunching y regularidad de headway (tesis del autor). Las cifras de proveedores se marcan "proveedor". Las líneas de factibilidad para Bogotá se juzgan contra los datos reales del proyecto: ~6.900 buses cada 20 s desde el 11-nov-2026 (~15 días, >85 M reportes), edad del reporte ~50–58 s, GTFS estático diario solo desde el 24-nov-2026, trip_id casi nunca coincide (2,6–28 %), route_id y stop_id coinciden 95–100 %, stop_id reportado aproximado, sin ocupación ni eventos de puerta o llegada, y con congelamientos del feed.

## 1. Accesibilidad observada (retrospectiva) vs programada con GTFS-RT/AVL

### Takeaway
Hay al menos cinco estudios publicados (Toronto, cuatro agencias de Norteamérica, Fortaleza, Gales e Inglaterra) que reconstruyen un "GTFS retrospectivo" con posiciones observadas y recalculan la accesibilidad. En promedio la diferencia frente al horario es moderada (≈1,5 % en Fortaleza, 5–15 % en zonas de alta accesibilidad en Norteamérica). En lo local supera el 40 %, y la variabilidad diaria pesa más que el sesgo medio (≈50 %). El efecto cae más sobre zonas de bajos ingresos y periféricas, que es justo la pregunta de equidad. El cálculo es una matriz muchos-a-muchos repetida por minuto de salida y por día, y cada origen es independiente: es paralelo de manera natural y encaja bien con Ray.

### Cited Findings
**Solución 1.1: GTFS retrospectivo de Toronto (Wessel, Allen y Farber, 2017)**
- Problema: los estudios de accesibilidad usan horarios GTFS que suponen servicio perfecto. Solución: construir un paquete GTFS "retrospectivo" a partir de AVL (GPS) de la TTC. Contiene horas de llegada observadas (pasadas) en el mismo formato que GTFS, así que sirve en las mismas herramientas de análisis de red — [ResearchGate, J. Transport Geography 2017](https://www.researchgate.net/publication/317507571_Constructing_a_routable_retrospective_transit_timetable_from_a_real-time_vehicle_location_feed_and_GTFS); [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0966692317300388)
- Resultado: hay diferencias agregadas sustanciales de accesibilidad entre el servicio programado y el observado — [ResearchGate](https://www.researchgate.net/publication/335150204_On_the_accuracy_of_schedule-based_GTFS_for_measuring_accessibility)
- Limitación metodológica: la medida retrospectiva supone que el usuario conoce de antemano la hora real de llegada, por eso trabajos posteriores la consideran una sobreestimación del acceso real del usuario — [ResearchGate](https://www.researchgate.net/publication/335150204_On_the_accuracy_of_schedule-based_GTFS_for_measuring_accessibility)
- El mismo conjunto retrospectivo de la TTC muestra que la heurística de elección de ruta cambia de forma sustancial los tiempos de viaje estimados — [Wessel, OSF preprint](https://files.osf.io/v1/resources/3r4p6/providers/osfstorage/5cba2daaf2be3c00170b8832?format=pdf&action=download&direct=&version=2)

**Solución 1.2: precisión del GTFS programado en cuatro agencias (Wessel y Farber, 2019, JTLU 12(1):475–500)**
- Construyeron una "verdad de terreno" con AVL archivado de cuatro agencias de Norteamérica durante cinco días y la compararon con tiempos de viaje del GTFS programado — [JTLU](https://jtlu.org/index.php/jtlu/article/view/1502); DOI 10.5198/jtlu.2019.1502, licencia CC BY-NC 4.0
- Resultado: la accesibilidad por origen, aun promediada por hora, varía mucho entre lugares. Los orígenes con menor accesibilidad programada dan estimaciones menos confiables (más variación hora a hora). Las zonas de alta accesibilidad convergen en valores 5–15 % por debajo de lo que predice el horario — [JTLU](https://jtlu.org/index.php/jtlu/article/view/1502); [UMN Conservancy](https://conservancy.umn.edu/items/cb39d759-9a27-4a46-8428-a77471460e66)
- Los autores ponen en duda la validez de algunas aplicaciones recientes de GTFS y piden métodos de accesibilidad más robustos — [IDEAS/RePEc](https://ideas.repec.org/p/osf/socarx/hzgpd.html)

**Solución 1.3: Fortaleza, Brasil (Braga, Loureiro y Pereira, 2023, J. Transport Geography, DOI 10.1016/j.jtrangeo.2023.103590)**
- Usan un mes de GPS archivado de buses para corregir el GTFS. Construyen dos feeds: uno de servicio mediano y otro que representa la variabilidad día a día. Miden accesibilidad a empleo — [urbandemographics.org](https://www.urbandemographics.org/publication/2023_jtg_public_transport_travel_time_inaccuracy_variability/)
- Resultado: el GTFS programado subestima la accesibilidad ≈1,5 % en promedio, con errores >40 % en algunas zonas. La variabilidad diaria de los tiempos cambia la accesibilidad ≈50 % en promedio y eleva la desigualdad de accesibilidad ≈30 % — [urbandemographics.org](https://www.urbandemographics.org/publication/2023_jtg_public_transport_travel_time_inaccuracy_variability/)
- Equidad: los impactos se reparten de forma desigual, con efectos significativos en regiones de bajos ingresos. Causas citadas: calidad del GTFS, concentración de empleo en el centro y mayor variabilidad en los corredores que unen zonas de bajos ingresos con el centro — [urbandemographics.org](https://www.urbandemographics.org/publication/2023_jtg_public_transport_travel_time_inaccuracy_variability/)
- Es el caso latinoamericano más cercano a Bogotá: ciudad monocéntrica, empleo concentrado y periferia pobre.

**Solución 1.4: corrección escalable de horarios en Inglaterra con GTFS-RT (Chen y Botta, Univ. Exeter, arXiv 2603.11477, marzo 2026)**
- Datos: UK Bus Open Data Service (BODS), GTFS + GTFS-RT VehiclePositions sin TripUpdates. Posiciones archivadas cada 30 s desde feb-2024 y horarios archivados diariamente. Cerca del 50 % de las observaciones diarias son duplicados. Caso de estudio de mayo a octubre de 2025 para toda Inglaterra — [arXiv](https://arxiv.org/html/2603.11477v1)
- Método, con un perfil de datos muy parecido al de Bogotá:
  - Los registros sin trip_id válido no se pueden emparejar.
  - Inferir el trip_id con vehicle_id dio solo mejoras marginales.
  - Ampliar la ventana de emparejamiento GTFS a ±7 días subió hasta 20 % los registros emparejables en algunos días.
  - Emparejamiento de paradas: caja de 300 m y luego la parada candidata más cercana.
  - La hora de llegada es el instante de máxima aproximación.
  - Las paradas sin observación se interpolan linealmente; si solo hay un vecino, se desplaza la hora programada según la desviación observada.
  - [arXiv](https://arxiv.org/html/2603.11477v1)
- Resultado: el 79,3 % de las LSOA tuvo tiempo de viaje observado a hospitales mayor que el programado (79,9 % urbanas, 76,2 % rurales). El 81,6 % tuvo mayor variabilidad de tiempo de viaje observada (86,3 % urbanas, 57,7 % rurales) — [arXiv](https://arxiv.org/html/2603.11477v1)
- Advertencia: los registros sin trip_id pueden hacer que algunas zonas parezcan con peor accesibilidad solo porque su operación está mal registrada. El artículo afirma eficiencia y escalabilidad pero no reporta tiempos de cómputo, hardware ni paralelización — [arXiv](https://arxiv.org/html/2603.11477v1)

**Solución 1.5: Cardiff y Swansea, Gales (GISRUK 2025) y revisión de Webb, Higgs, Langford y Berry (ISPRS IJGI, 2025)**
- Estudio de caso del efecto de las diferencias entre servicio programado y real sobre la accesibilidad a puntos de interés. La revisión compara fuentes de datos en tiempo real y programados, y pide más investigación con datos abiertos en tiempo real — [Zenodo GISRUK 2025](https://zenodo.org/records/15230078); [MDPI IJGI 14(7):243](https://www.mdpi.com/2220-9964/14/7/243)
- Nalin et al. (Communications in Transportation Research) evalúan las disparidades de accesibilidad durante eventos disruptivos con datos reales de ubicación frente a escenarios solo con horario. Concluyen que hay que evaluar el desempeño real y no el horario — [Univ. Bologna CRIS](https://cris.unibo.it/bitstream/11585/1001827/1/10_COMMTR_100160.pdf)
- Contexto: un estudio de 2023 en J. Transport Geography usa GTFS-RT + APC para comparar la accesibilidad de personas con y sin discapacidad motriz — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0966692323000613)

**Factibilidad con los datos de Bogotá (accesibilidad retrospectiva)**
- Viable con adaptación. No se necesita trip_id: Chen y Botta muestran que el trip_id es el cuello de botella ([arXiv](https://arxiv.org/html/2603.11477v1)). En Bogotá hay que reconstruir los "viajes" como secuencias de vehicle_id + route_id cortadas en los terminales, proyectar cada posición sobre el shape de la ruta (route_id coincide 95–100 %) y estimar la hora de paso por cada parada interpolando sobre la distancia acumulada, sin usar el stop_id reportado porque es aproximado.
- Con pings de 20 s el error de interpolación es bajo. La edad de reporte de ~50–58 s es un sesgo casi constante que se puede restar si se usa el timestamp del vehículo y no el de recepción.
- Los congelamientos del feed se deben enmascarar como "sin dato" y no como "sin servicio".
- Con el GTFS estático desde el 24-nov solo hay ~3 días con horario propio. Para comparar los 15 días hay que suponer que el estático no cambió o usar el más cercano, como hace la ventana de ±7 días de Chen y Botta ([arXiv](https://arxiv.org/html/2603.11477v1)).

### Inferences
- La brecha entre horario y servicio observado probablemente es mayor en Bogotá que en Toronto, y se parece más a Fortaleza: corredores largos desde la periferia sur y occidental hacia un centro con empleo concentrado, que es el mecanismo citado por Braga et al.
- Por qué necesita cómputo paralelo:
  1. Construir el GTFS retrospectivo: 85 M pings → map-matching y estimación de stop_times por vehículo-día. Es independiente por vehículo-día (~6.900 × 15 ≈ 100 mil tareas): Ray tasks o Ray Data `map_batches`.
  2. Matrices de tiempo de viaje: N orígenes (ZAT o hexágonos H3) × M destinos × minutos de salida (p. ej. 120 por franja pico) × días (15) × escenario (programado vs observado). Cada origen es un RAPTOR independiente (r5py/r5): Ray actors con la red cargada una vez por worker (estado pesado) y orígenes repartidos.
  3. Medidas de acceso acumulado o gravitacional por origen y percentiles de la distribución temporal: reducción barata.
- Diseño sugerido: actores Ray que mantienen la red R5 en memoria (la carga cuesta, el ruteo es barato). Se mide el speedup contra el número de workers, que es el entregable natural del curso de computación paralela.

### Gaps
- No pude leer el texto completo de Wessel et al. 2017/2019 (el PDF superó el límite de descarga) para dar tiempos de cómputo, número de orígenes o porcentajes por zona más allá del rango de 5–15 %.
- No encontré ni pude confirmar los estudios "Liu et al." o "Stewart/Wessel" de GTFS-RT y empleo para bajos ingresos que mencionaba el encargo. La búsqueda solo trajo Liu (2020) en Chicago, sobre tarifa e ingreso y sin GTFS-RT, que concluye que la accesibilidad de bajos ingresos se sobreestima con la medida tradicional — [Wiley TESG](https://onlinelibrary.wiley.com/doi/10.1111/tesg.12415).
- Access Across America (U. de Minnesota) y Conveyal no se verificaron en esta ronda. Que usen horario programado y no servicio observado es conocimiento previo sin fuente en estas notas.
- No hay cifras publicadas de costo de cómputo (horas-CPU) para matrices retrospectivas en ninguno de los estudios leídos.

## 2. Buses fantasma, viajes faltantes y auditoría de servicio entregado

### Takeaway
El método estándar, el de Chi Hack Night Ghost Buses, es contar por ruta y por día los viajes distintos observados en tiempo real frente a los programados en GTFS. No necesita trip_id por viaje, así que se adapta a Bogotá con conteo a nivel de ruta y franja horaria. Los resultados medidos están en Chicago: ~360.000 viajes cancelados entre ene-2022 y sep-2023 (FOIA), más fallas en el South Side, y desde mayo de 2025 la CTA publica las cancelaciones. El mayor riesgo metodológico es confundir un hueco de datos con un bus que no salió.

### Cited Findings
**Solución 2.1: Ghost Buses, Chi Hack Night (Chicago, desde 2022)**
- Método: posiciones raspadas del feed `getvehicles` de CTA Bus Tracker cada 5 minutos desde el 20-may-2022, comparadas con el GTFS de la CTA. Por ruta y día se cuentan los viajes distintos observados y los programados. La confiabilidad es el porcentaje de viajes programados que aparecen en tiempo real, y la web muestra el percentil de cada ruta en la ciudad — [Chi Hack Night](https://chihacknight.org/projects/2022/11/11/ghost-buses); [GitHub frontend](https://github.com/chihacknight/ghost-buses-frontend)
- Aliados: CTAction, Active Transportation Alliance y Transit4all. La página del proyecto no lista cifras propias ni cambios de política atribuibles — [Chi Hack Night](https://chihacknight.org/projects/2022/11/11/ghost-buses)
- Uso posterior: el Chicago Tribune y el Mansueto Institute (UChicago) usaron los datos de Chi Hack Night para comparar llegadas programadas y reales entre nov-2022 y nov-2024. Encontraron barrios que tardaron más en recuperar el servicio y cerca de una docena de barrios con buses programados cada 15 min o más aún en nov-2024 — [Yahoo/Tribune](https://www.yahoo.com/news/cta-says-bus-back-prepandemic-110000813.html); [Yahoo/Tribune, plan de 10 min](https://www.yahoo.com/news/cta-plans-run-buses-every-110000944.html)
- Contexto de magnitud: ~360.000 viajes de bus cancelados entre ene-2022 y sep-2023 según datos FOIA ([ABC7, nov-2023](https://abc7chicago.com/13980534)). Los buses que no llegan o llegan fuera de horario eran más comunes en rutas del South Side ([ABC7, dic-2022](https://abc7chicago.com/post/chicago-cta-bus-tracker-estimated-arrival-time/12534793/))
- Resultado de política: desde el 1-may-2025 la CTA publica a diario qué buses se cancelan, para que no aparezcan como "programados" en las apps; Transit fue la primera app en mostrarlos. En jun-2025 la CTA corrió el 98,8 % de los buses programados y el 88 % de los trenes según su tablero. La CTA explicó que antes no podía quitar viajes sin conductor salvo en los cambios de horario, que el contrato sindical permitía dos veces al año — [Chicago Sun-Times, 4-ago-2025](https://chicago.suntimes.com/transportation/2025/08/04/cta-canceled-bus-tracker-apps-ventra-transit). La nota no atribuye el cambio al proyecto Ghost Buses.
- La CTA también publica de forma consistente las cancelaciones por garaje — [Planetizen](https://www.planetizen.com/news/2025/08/135788-chicago-transit-authority-plans-banish-ghost-buses); [Yahoo/Tribune](https://www.yahoo.com/news/articles/ghost-buses-may-no-longer-232500561.html)

**Solución 2.2: us-ghost-buses (19 agencias de EE. UU., repositorio cívico, MIT)**
- Definición: un viaje que existe en el horario y nunca aparece en el feed en tiempo real de la propia agencia. Sondeo cada 90 s y GTFS fotografiado a diario y deduplicado por sha256 — [GitHub](https://github.com/dulcetberg/us-ghost-buses)
- Lecciones de método, todas aplicables a Bogotá:
  - En la CTA no hay trip_id GTFS y se empareja por hora de inicio programada.
  - El día de servicio va en hora local; con UTC, Honolulu tenía el 46 % de cada archivo en el día equivocado.
  - Aplica cuatro pruebas de validez: unión con el horario, día de servicio local, cobertura de flota y completitud del día.
  - MARTA se excluye por una razón de 25,1 viajes por vehículo, frente a 3,5–15,0 en las demás agencias.
  - El volumen es ~950 MB/día.
  - [GitHub](https://github.com/dulcetberg/us-ghost-buses)

**Solución 2.3: Baltimore Banner, MTA Maryland (periodismo de datos)**
- Cerca del 10 % de los viajes programados no aparece en el GTFS-RT de la MTA. La causa probable es una mezcla de cancelaciones y transpondedores dañados, y el hueco distorsiona las estadísticas de puntualidad — [GitHub Baltimore Banner](https://github.com/The-Baltimore-Banner/transit_nightmare)

**Solución 2.4: otros rastreadores cívicos (Dublín, Sheffield, Miami y otros)**
- Dublín clasifica cada viaje programado en seis tipos de resultado y "califica su propio uptime" ([GitHub ghost-bus Dublín](https://github.com/aleks-drozy/ghost-bus)). Sheffield cuenta viaje por viaje con el feed GPS del gobierno ([GitHub](https://github.com/Mohammed-890/ghost-bus)). Otro rastreador genérico usa GTFS y GTFS-RT ([GitHub](https://github.com/aminamos/ghost-bus-tracker))
- Advertencias recogidas en la búsqueda:
  - Una herramienta de Miami-Dade avisa cuando la mayoría de viajes aparece como faltante, porque casi siempre es un desajuste de datos y no un colapso real.
  - Hasta 20 % de las posiciones pueden venir sin trip_id.
  - [resumen de búsqueda sobre repos](https://github.com/Phillipmoore01/transit-ghost-tracker)
  - Son proyectos comunitarios, no auditorías oficiales.

**Solución 2.5: benchmark "ETA Completeness" de Swiftly (proveedor)**
- Publica cada mes el porcentaje de viajes programados sin al menos una predicción por agencia miembro. Un 88 % equivale a uno de cada ocho viajes sin información en tiempo real (proveedor) — [Swiftly blog](https://www.goswift.ly/blog/eta-completeness-benchmark)

**Factibilidad con los datos de Bogotá (servicio entregado)**
- No es viable viaje por viaje con trip_id: solo coincide el 2,6–28 %.
- Sí es viable a nivel de ruta × franja horaria (variante Chi Hack Night):
  1. Viajes observados = número de pasadas distintas de vehículos por un punto de control del shape (p. ej. el 25 % y el 75 % de la longitud de la ruta, o el terminal), deduplicando por vehicle_id con una ventana mínima.
  2. Viajes programados = suma de `trips` en stop_times para esa ruta y franja o, si hay `frequencies.txt`, la duración de la franja dividida por el headway_secs.
  3. Indicador = observados / programados por route_id × hora × día, mapeado a las paradas (stop_id coincide 95–100 %).
- Hay que enmascarar los congelamientos del feed: cualquier hora con caída global de reportes se marca "sin dato", porque así lo muestran los avisos de Miami y Baltimore.
- Restricción temporal: el horario estático existe solo desde el 24-nov. Hay que usar el estático más cercano para los días anteriores y declararlo como supuesto.
- El servicio entregado (vehículo-km recorridos vs programados por ruta) es una métrica complementaria que no necesita emparejar viajes: integrar la distancia proyectada sobre el shape por vehicle_id + route_id.

### Inferences
- Paralelismo: el conteo es un group-by masivo (85 M filas → ruta × hora × día). Con Ray Data se particiona por día o por vehículo, se hace map-matching y detección de pasadas por partición y se agrega con reducción. El map-matching de cada ping al shape (búsqueda geométrica) es la parte costosa. Si se hace con pandas en un solo núcleo puede tardar horas; con Ray escala de forma casi lineal porque cada vehículo-día es independiente.
- El valor de equidad sale de cruzar el % entregado por ruta con el estrato o los ingresos de las ZAT que sirve la ruta (EM2023, sección 5), igual que el análisis Tribune/Mansueto por barrio.

### Gaps
- No encontré el porcentaje global de viajes entregados que calcula Ghost Buses ni cambios de política atribuidos directamente al proyecto.
- No hallé fuentes verificadas para rastreadores de viajes faltantes en Toronto (TTC), Washington (WMATA), Londres (TfL "lost kilometres") ni Montreal (STM): la búsqueda no los devolvió.
- No hay estudios publicados de "buses fantasma" en TransMilenio/SITP.

## 3. Análisis de tiempos de recorrido para ajustar horarios (TCQSM, percentiles, holgura, timepoints)

### Takeaway
La práctica establecida es fijar el tiempo de recorrido programado por segmento y franja con un percentil observado del AVL: TriMet usa el p40, el TCQSM recomienda la media y Bruselas usa p80/p95. El tiempo de recuperación se fija con el percentil 95 menos el tiempo programado. La única ganancia cuantificada que encontré es la de TriMet: −7,3 min de recuperación por viaje y US$7,1 M de ahorro operativo estimado (fuente antigua, anterior a 2015). Con 20 s de resolución, Bogotá puede producir distribuciones de tiempo de recorrido por tramo, franja y día que no dependen de trip_id.

### Cited Findings
- TriMet fija los horarios en el percentil 40 de los tiempos de recorrido para sesgar la operación hacia "tarde" y no "temprano" — [TCRP Web-Only Doc 23](https://trb.org/publications/tcrp/tcrp_webdoc_23.pdf); [PSU Evaluation of TriMet BDS](https://libraryarchives.metro.net/dpgtl/nonlocalagencies/oregon/2001-evaluation-of-transit-operations-data-applications-of-tri-mets-automated-bus-dispatching-system.pdf) (anterior a 2015)
- El TCQSM sugiere fijar el tiempo entre timepoints igual a la media observada. TriMet define "a tiempo" como entre 1 min antes y 5 min después de la salida programada — [resumen de TCRP/PSU](https://pdxscholar.library.pdx.edu/cgi/viewcontent.cgi?article=1064&context=cengin_fac)
- Un estudio para TriMet encontró que basar la recuperación en el percentil 95 del tiempo de recorrido reduciría en promedio 7,3 min de recuperación por viaje, con un ahorro operativo estimado de US$7,1 M (anterior a 2015, citado vía Kimpel y Strathman) — [GWRC Wellington, OIA 2015-109](https://fyi.org.nz/request/3397/response/10844/attach/6/Attachment%20III%20to%20OIA%202015%20109%20Timetable%20Adjustments%20in%20the%20Wellington%20Region%20Using%20Real%20Time%20Data.pdf)
- Método de Bruselas (STIB), citado por la región de Wellington: tres parámetros, p. ej. 95 %, 80 % y 5 min. El medio ciclo (recorrido más recuperación) se fija en el p95 y el tiempo permitido en el p80 menos 5 min. Así hay 80 % de probabilidad de terminar con ≤5 min de retraso y 95 % de que el siguiente viaje salga a tiempo — [GWRC Wellington 2015](https://fyi.org.nz/request/3397/response/10844/attach/6/Attachment%20III%20to%20OIA%202015%20109%20Timetable%20Adjustments%20in%20the%20Wellington%20Region%20Using%20Real%20Time%20Data.pdf)
- Razón de fondo: el horario tradicional usa medias de muestras pequeñas, y el AVL permite usar extremos (p85/p95), que es lo que importa al pasajero. El p95 de espera es lo que el usuario debe presupuestar — [GWRC Wellington 2015](https://fyi.org.nz/request/3397/response/10844/attach/6/Attachment%20III%20to%20OIA%202015%20109%20Timetable%20Adjustments%20in%20the%20Wellington%20Region%20Using%20Real%20Time%20Data.pdf) (cita a Furth y Muller)
- El TCRP Report 113 identifica el análisis de tiempos de recorrido (diseño del tiempo programado y monitoreo de adherencia) como uno de los usos principales del AVL-APC archivado — [TCRP Report 113](https://www.trb.org/publications/tcrp/tcrp_rpt_113.pdf) (2006, antiguo)
- Transit IDEA 63 (Ann Arbor y Allentown): prueba de concepto. Variar los tiempos por hora del día y en fines de semana mejoraría "ligeramente" una puntualidad que ya era alta — [TRB Transit IDEA 63](https://onlinepubs.trb.org/onlinepubs/IDEA/FinalReports/Transit/Transit63.pdf)
- Un artículo en Journal of Public Transportation actualiza horarios con datos AVL de adherencia y maximiza el porcentaje de viajes en el rango a tiempo, con comparación antes y después; el resumen no da cifras — [ScienceDirect, JPT](https://www.sciencedirect.com/science/article/pii/S1077291X22002028)
- PSU/TriMet: la diferencia de medianas de tiempo de recorrido entre dos periodos indica cuánto tiempo programado se puede sumar o restar. Tras la prioridad semafórica hubo mejoras estadísticamente significativas en tiempo de recorrido y puntualidad — [PDXScholar](https://pdxscholar.library.pdx.edu/cgi/viewcontent.cgi?article=1057&context=cus_pubs)

**Factibilidad con los datos de Bogotá (tiempos de recorrido)**
- Alta. Se proyecta cada ping sobre el shape de su route_id y se calcula el tiempo para atravesar tramos fijos (entre paradas consecutivas o entre "timepoints" sintéticos cada ~1 km). Se agrega por tramo × franja de 15–30 min × tipo de día y se obtienen p10/p50/p80/p95. Basta con vehicle_id + route_id, sin trip_id.
- Comparación con el horario: si el GTFS trae stop_times explícitos se compara el tiempo programado entre paradas con p50/p80/p95 observados, y el índice de holgura es (programado − p50) / p50. Si trae frequencies.txt (común en TransMilenio), se comparan los tiempos implícitos en stop_times del viaje plantilla.
- Limitaciones: 15 días dan ~10 días hábiles, lo que basta para percentiles por franja pero no para estacionalidad. Sin eventos de puerta no se separa tiempo en parada de tiempo en movimiento. Los congelamientos crean saltos falsos que hay que filtrar con velocidades imposibles.

### Inferences
- Paralelismo: el cálculo de tiempos por tramo es independiente por vehículo-día y los percentiles por tramo × franja son una agregación distribuida (cuantiles aproximados o agrupar y ordenar por partición). Con ~100 mil vehículo-día y miles de tramos se trata de cientos de millones de cruces de tramo: Ray Data map → groupby → percentiles.
- Producto de planeación: un "mapa de holgura" que muestre dónde el horario se queda corto (p50 > programado, buses siempre tarde) o sobra (programado > p80, la ruta debe esperar o perder tiempo) por franja, cruzado con el estrato de la ZAT.

### Gaps
- No encontré cifras recientes (2015–2026) de mejora de puntualidad tras reajustar horarios con AVL en King County Metro, STM Montreal, MBTA ni Metro Transit. La búsqueda dirigida no devolvió informes de agencia con números de antes y después.
- No pude verificar si el GTFS de TransMilenio usa frequencies.txt o stop_times explícitos para troncales y zonales: hay que revisarlo en los datos locales.

## 4. Cobertura de red, mapas de frecuencia observada y desiertos de servicio

### Takeaway
En esta ronda no encontré soluciones publicadas y verificadas de "mapa de red frecuente con frecuencia observada" ni de "desiertos de transporte" construidos con GTFS-RT. Con los datos de Bogotá sí es directo: frecuencia observada por parada y franja (pasadas distintas por stop/route) frente a la frecuencia programada, cruzada con población y estrato por ZAT.

### Cited Findings
- El análisis Tribune/Mansueto con datos de Chi Hack Night es lo más parecido a un mapa de frecuencia observada por barrio: barrios que tardaron en recuperar servicio y una docena con buses programados cada ≥15 min en nov-2024 — [Yahoo/Tribune](https://www.yahoo.com/news/cta-plans-run-buses-every-110000944.html)
- Chen y Botta reportan desigualdades espaciales y temporales en la accesibilidad observada, con brecha urbano-rural, y dicen que la brecha entre programado y observado varía geográficamente — [arXiv](https://arxiv.org/html/2603.11477v1)

**Factibilidad con los datos de Bogotá (cobertura y frecuencia)**
- Alta. Por stop_id (coincide 95–100 %) y franja horaria se cuenta el número de buses distintos de cada route_id que pasan a <50 m del punto proyectado de la parada en el shape. Sale el headway observado mediano y el p90 por parada (atributo de cobertura, no regularidad de headway; para no tocar la tesis se reporta solo la frecuencia agregada).
- "Desierto de servicio" = ZAT con alta población o estrato 1–2 y frecuencia observada combinada <X buses/h a ≤500 m. La comparación con lo programado da "desiertos ocultos": zonas que en el horario parecen servidas y en la práctica no.

### Inferences
- Paralelismo: el cálculo de distancias de 85 M pings a miles de paradas es una unión espacial grande (con índice espacial por partición). Es independiente por día o por zona de la ciudad y encaja con Ray Data.
- Este producto es el más barato de los cuatro y sirve como "entrada" para la accesibilidad (sección 1).

### Gaps
- No busqué ni verifiqué ejemplos concretos de mapas de red frecuente basados en datos observados (p. ej. TransitCenter, Jarrett Walker) ni literatura de "transit deserts" (Jiao y colaboradores). Quedan sin fuente y conviene una búsqueda adicional si el informe los necesita.

## 5. Bogotá: estudios de accesibilidad existentes y disponibilidad abierta de datos de empleo por zona

### Takeaway
Hay una línea consolidada de estudios de accesibilidad y equidad en Bogotá (Guzmán, Oviedo, Rivera, Bocarejo), pero todos usan tiempos de la encuesta de movilidad o de modelos, o GTFS sintético o programado. No encontré ninguno con tiempos observados de GTFS-RT, y ese es el hueco que el proyecto puede ocupar. La EM2023 publica microdatos (viajes y etapas con ZAT) y el shapefile ZAT de forma abierta. La página de descargas no lista una tabla de "empleo por ZAT", así que el empleo se tendría que aproximar con los viajes por motivo trabajo atraídos por ZAT, ponderados.

### Cited Findings
**Estudios de accesibilidad en Bogotá**
- Guzmán, Oviedo y Rivera (2017), "Assessing equity in transport accessibility to work and study: The Bogotá region", J. Transport Geography 58:236–246, DOI 10.1016/j.jtrangeo.2016.12.016 — [IDEAS/RePEc](https://ideas.repec.org/a/eee/jotrge/v58y2017icp236-246.html); [UCL Discovery (texto completo)](https://discovery.ucl.ac.uk/10090520/1/Assessing%20transport%20accessibility%20equity_Final.pdf)
  - Datos y método: Encuesta de Movilidad 2011 más un modelo de transporte y uso del suelo. Accesibilidad potencial A_i^m = Σ_j O_j·exp(−β_i^m·C_ij^m) con costo generalizado (tiempo y dinero) para auto, bus y TM. 381 regresiones LMS (127 zonas × 3 modos) para calibrar β, y las oportunidades (empleo y estudio) vienen de datos de uso del suelo — [UCL Discovery](https://discovery.ucl.ac.uk/10090520/1/Assessing%20transport%20accessibility%20equity_Final.pdf)
  - Cifras:
    - Cerca del 44 % del empleo de Bogotá está en el centro ampliado (12 % del área urbana).
    - El tiempo al trabajo o estudio en zonas de bajos ingresos es de 67 min, 22 % más que el ingreso medio (55 min) y 40 % más que el alto.
    - Los viajes en TM son 33 % más largos para usuarios de bajos ingresos.
    - Hay 0,21 autos por hogar en zonas de bajos ingresos frente a 1,27 en las de altos ingresos.
    - [UCL Discovery](https://discovery.ucl.ac.uk/10090520/1/Assessing%20transport%20accessibility%20equity_Final.pdf)
  - Los tiempos de viaje salen directamente de la muestra de la encuesta, promediados por zona, y no de GTFS — [UCL Discovery](https://discovery.ucl.ac.uk/10090520/1/Assessing%20transport%20accessibility%20equity_Final.pdf)
- Subsidios "pro-pobre": la accesibilidad potencial al empleo muestra que la estructura actual del subsidio y los escenarios que amplían su cobertura son progresivos — [ScienceDirect, Transport Policy](https://www.sciencedirect.com/science/article/abs/pii/S0967070X17304109); [ResearchGate](https://www.researchgate.net/publication/343426674_Accesibilidad_asequibilidad_y_equidad_los_subsidios_al_transporte_publico_en_Bogota)
- Cambios por el SITP (encuestas 2011–2015): cinco años después de su implementación el transporte público no mejora la accesibilidad de los grupos más pobres, y las mejoras se concentran en ingresos medios y altos — [ResearchGate](https://www.researchgate.net/publication/328638453_Accessibility_Changes_Analysis_of_the_Integrated_Public_Transport_System_of_Bogota)
- "Productive exclusion" (Geoforum, 2025): desigualdades de accesibilidad para trabajadores formales e informales. Casi la mitad de la fuerza laboral es informal, la ciudad está segregada y las oportunidades centralizadas, y se cuantifica el efecto de TransMiCable — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0016718525000089)
- Tesis de UC Berkeley: usa TransMiCable y el GTFS abierto para medir acceso al empleo — [eScholarship](https://escholarship.org/content/qt5ns8s78k/qt5ns8s78k.pdf)
- Lopane y Restrepo Jiménez (CASA-UCL, GISRUK 2026): GTFS sintético de las líneas 1 y 2 del metro con r5r. La mediana de accesibilidad sube 7,6 % con un presupuesto de 60 min, y los deciles 3 y 4 ganan ~50 % más que el decil más alto — [Zenodo](https://zenodo.org/records/19420783). La página no indica la fuente de empleo ni la zonificación.

**Disponibilidad de datos (EM2023)**
- El Observatorio de Movilidad publica la EM2023. Descargas de la EODH:
  - Datos técnicos.
  - Formularios.
  - Zonificación: shapefile UTAM, shapefile ZAT y bitácora de cambios ZAT.
  - Base sin procesar: módulos A, C, X, CF, B, C1, D, E, Viajes y Etapas, con diccionario.
  - Base procesada: hogares, vehículos, personas, viajes y etapas.
  - Indicadores por estrato y municipio.
  - De la EODI: aforos y la base con factores de ponderación sin dobles conteos.
  - La página no indica licencia ni menciona empleo por ZAT o actividad económica — [Observatorio de Movilidad](https://observatorio.movilidadbogota.gov.co/publicaciones/resultados/encuesta-de-movilidad-2023)
- El portal datosabiertos.bogota.gov.co tiene un conjunto "Encuesta de Movilidad" de la SDM (HTML, XLSX, PDF) — [Datos Abiertos Bogotá](https://datosabiertos.bogota.gov.co/dataset?groups=transporte&organization=sdm)
- En feb-2024 una solicitud de acceso a la información pidió las tablas CSV/XLSX y los shapes ZAT/UTAM de la EM2023, señal de que en ese momento no todo era abierto — [Queremosdatos.co](https://www.queremosdatos.co/request/datos_abiertos_de_la_encuesta_de)

**Factibilidad con los datos de Bogotá (equidad)**
- Oportunidades (O_j): proxy = viajes con motivo "trabajo" con destino en cada ZAT, ponderados con el factor de expansión de la base procesada. Es una medida de empleo "atraído" que incluye el informal, relevante en Bogotá donde casi la mitad es informal ([ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0016718525000089)). Hay que declararlo como proxy, no como censo de empleo.
- Población y estrato por ZAT: de la base de hogares y personas ponderada.
- Resultado posible: la brecha entre la accesibilidad programada y la observada por ZAT, desagregada por estrato. Es la réplica de Braga et al. (Fortaleza) en Bogotá con datos abiertos.

### Inferences
- No hay en la literatura revisada un estudio de accesibilidad observada (GTFS-RT) en Bogotá, así que el aporte sería original a nivel local. Hay que verificarlo con una búsqueda en español (Revista de Ingeniería Uniandes, EURE) antes de afirmarlo.
- El tamaño del problema depende del número de ZAT (no confirmado en esta ronda). Con ~1.000 orígenes × 120 minutos de salida × 15 días × 2 escenarios ≈ 3,6 M consultas RAPTOR de un origen, con una carga que justifica Ray. Con hexágonos H3 res. 8–9 sube un orden de magnitud.

### Gaps
- No confirmé si DANE (Censo Económico, GEIH o Directorio Estadístico) publica empleo georreferenciado por manzana, UPZ o ZAT de forma abierta. La búsqueda no lo devolvió.
- No confirmé el número de ZAT de la EM2023 ni si la base de viajes trae ZAT de destino codificado (hay que revisar el diccionario al descargar).
- No pude leer la licencia de uso de los microdatos EM2023 ni el texto completo de "Productive exclusion" (403).
- El "Rivera" del encargo corresponde a Carlos Rivera, coautor de Guzmán y Oviedo (2017). No encontré otros estudios suyos en esta ronda.
