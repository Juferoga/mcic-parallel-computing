// Guion de la presentación: un bloque por pulsación de → (bloques = pasos del marco + 1).
// scripts/armar_guion.py lo inserta en guion.html. quien: "Juan Felipe" o "Carlos".
const JF = "Juan Felipe", CO = "Carlos";
const GUION = [
  { id: "portada", cap: "Inicio", quien: JF, marco: "Portada", pantalla: "portada UD: título y autores", meta: 30, bloques: [
    { t: ["Buenas, profesor y compañeros. Somos <b>Juan Felipe Rodríguez</b> y <b>Carlos Mora</b>, y les vamos a contar nuestro proyecto final de Computación Paralela.",
          "Tomamos <b>catorce días de TransMilenio</b>, los buses de Bogotá reportando su posición, y los procesamos en paralelo con <b>Ray</b>."],
      haz: "Las líneas del fondo son las troncales reales: si preguntan, sale del GTFS estático.", pulsa: "va a «El caso»" },
  ]},
  { id: "pregunta", quien: JF, marco: "El caso", pantalla: "5.359 buses", meta: 70, bloques: [
    { t: ["Cada treinta segundos, más o menos, TransMilenio publica dónde está cada bus. A las siete de la mañana de un martes son <b>más de cinco mil buses</b> al tiempo."], pulsa: "aparece «El problema»" },
    { t: ["El problema es que ese feed es <b>solo en vivo</b>. TransMilenio no guarda histórico público: lo que nadie captura, se pierde."], pulsa: "aparece «Lo que hicimos»" },
    { t: ["Por eso lo empezamos a guardar el 11 de noviembre. Hoy son <b>más de 44 mil capturas</b> y unos <b>4 GB</b>. Hasta donde sabemos, es la única copia de esos días."], pulsa: "aparece la pregunta" },
    { t: ["Con eso nos hicimos dos preguntas. Una de movilidad: <b>¿cómo anda la red de verdad?</b> Y la del curso: <b>¿cuánto ganamos al procesar ese volumen en paralelo</b> frente a hacerlo en un solo núcleo?"], pulsa: "va a «La ruta»" },
  ]},
  { id: "agenda", quien: JF, marco: "La ruta", pantalla: "4 estaciones", meta: 35, bloques: [
    { t: ["La presentación es un recorrido con cuatro estaciones."], pulsa: "estación 1" },
    { t: ["Primero, <b>los datos</b>: qué guardamos y cómo."], pulsa: "estación 2" },
    { t: ["Segundo, <b>la calidad</b>: encontramos tres problemas que no estaban documentados."], pulsa: "estación 3" },
    { t: ["Tercero, <b>Ray</b>: el pipeline y qué parte del problema es paralela."], pulsa: "estación 4" },
    { t: ["Cuarto, <b>los resultados</b>: un replay de la red y las métricas."], pulsa: "cierre" },
    { t: ["Y cerramos con límites y lecciones. La barra de abajo es la misma ruta: el triángulo rojo marca dónde vamos."], pulsa: "vuela a la estación 1" },
  ]},
  { id: "c1", cap: "Estación 1 · Los datos", quien: CO, marco: "Los datos", pantalla: "44.363 · 4,07 · 14 · 85 M", meta: 30, bloques: [
    { t: ["Estación uno. Tenemos <b>44 mil capturas</b>, <b>4 GB</b> comprimidos y <b>catorce días</b>.",
          "Al procesarlo todo salen <b>85 millones de reportes</b>; después de quitar zombis y repetidos quedan <b>60,8 millones</b>. Cada bus da un dato nuevo cada 52 segundos, más o menos."],
      haz: "Espera a que terminen los contadores.", pulsa: "va a la foto 3D" },
  ]},
  { id: "foto", quien: CO, marco: "Bogotá a las 7:00", pantalla: "mapa 3D de una captura", meta: 60, bloques: [
    { t: ["Esta es <b>una sola captura</b>: el martes 17 a las 7:00:44. Cada punto es un bus que reportó en los últimos cinco minutos.",
          "Rojo es troncal, azul es zonal del SITP, verde alimentador y amarillo dual. Casi todo es azul: la mayoría de la flota es zonal."],
      haz: "Arrastra el mapa para girarlo.", pulsa: "suben las columnas" },
    { t: ["Si agrupamos por celdas de un kilómetro, como hexágonos H3, se ven las zonas con más buses. Esto ya es una <b>agregación espacial</b>, uno de los cálculos del pipeline."], pulsa: "solo troncales" },
    { t: ["Y si dejamos solo las troncales, quedan menos de novecientos buses dibujando los corredores exclusivos."], pulsa: "va a «Así se ve un reporte»" },
  ]},
  { id: "mensaje", quien: CO, marco: "Un reporte por dentro", pantalla: "protobuf de un bus", meta: 55, bloques: [
    { t: ["Cada captura es un mensaje de <b>protobuf</b> comprimido con gzip. Este es un bus real del 18 de noviembre a las 8:07."], pulsa: "resalta el viaje" },
    { t: ["Trae el <b>viaje</b>: el identificador, la hora de salida y la ruta."], pulsa: "resalta la posición" },
    { t: ["Trae <b>dónde y cuándo</b>: latitud, longitud, la parada y la hora del reporte."], pulsa: "resalta el vehículo" },
    { t: ["Y <b>quién</b>: el vehículo. Lo importante es lo que <b>no</b> trae: ni velocidad ni ocupación. La velocidad la tenemos que calcular nosotros, y eso es lo que hace caro el problema."], pulsa: "va al archivador" },
  ]},
  { id: "archivador", quien: CO, marco: "Cómo se guardó", pantalla: "diagrama del archivador", meta: 60, bloques: [
    { t: ["El archivador son unas ochenta líneas de bash en un servidor de la universidad. <b>cron</b> lo arranca cada minuto y <b>flock</b> garantiza una sola copia: si se cae, vuelve solo."], pulsa: "el ciclo de descarga" },
    { t: ["Cada diez segundos baja las posiciones, las compara con la última guardada y, si cambiaron, las comprime y las escribe de forma atómica: primero un .part y luego se renombra."], pulsa: "la subida a GitHub" },
    { t: ["Una vez al día, después del cierre del servicio, sube lo nuevo a GitHub."], pulsa: "el punto ciego" },
    { t: ["Pero tiene un punto ciego: compara <b>bytes</b>, no buses. Esto lo vamos a ver en la estación dos."], pulsa: "va a «Capturas por día»" },
  ]},
  { id: "pordia", quien: CO, marco: "Capturas por día", pantalla: "barras por día", meta: 40, bloques: [
    { t: ["Son unos <b>300 MB por día</b>. Los amarillos son fin de semana y el <b>16, que fue festivo</b>: se comporta como un domingo.",
          "Con ese ritmo no tiene sentido meter los datos dentro del repositorio del curso: git no es un almacén de datos. El código va en el repo y los datos se bajan aparte."], pulsa: "vuela a la estación 2" },
  ]},
  { id: "c2", cap: "Estación 2 · Calidad", quien: JF, marco: "Calidad", pantalla: "16 h · 16,8 % · 2,6 %", meta: 30, bloques: [
    { t: ["Estación dos: ¿podemos confiar en los datos? Encontramos tres cosas que no estaban documentadas: <b>dieciséis horas de buses zombis</b>, <b>casi un 17 % de reportes repetidos</b> y un cruce con el horario que <b>casi no cuadra</b>."], pulsa: "va al mapa de huecos" },
  ]},
  { id: "calor", quien: JF, marco: "Mapa de huecos", pantalla: "mapa de calor día × hora", meta: 75, bloques: [
    { t: ["Cada fila es un día y cada columna media hora, en hora de Bogotá. El color es cuántos buses estaban reportando. Se ven los picos de la mañana y la tarde, y los fines de semana más claros."], haz: "Pasa el mouse por una celda para ver el número.", pulsa: "marca ①" },
    { t: ["Primero: desde el 18 a las cinco y media de la tarde hasta el 19 a las diez de la mañana, el feed entregó <b>siempre los mismos siete buses</b>. Son dieciséis horas, incluido un pico, y no aparecía en la documentación del archivo."], pulsa: "marca ②" },
    { t: ["Segundo: el 20 y el 23 el feed se <b>congeló</b> en la madrugada y no volvió hasta pasado el pico de la mañana."], pulsa: "marca ③" },
    { t: ["Con eso, los días hábiles completos son el <b>12, el 13 y el 17</b>. Esos son la base del análisis."], pulsa: "va a «Buses zombis»" },
  ]},
  { id: "zombis", quien: JF, marco: "Buses zombis", pantalla: "Z40-4217", meta: 55, bloques: [
    { t: ["Este es uno de los zombis: el 19 a las seis de la mañana aparece un bus cuyo viaje empezó el <b>6 de noviembre</b>. Su reporte tiene trece días."], pulsa: "por qué no se detectó" },
    { t: ["El archivador no lo notó porque compara bytes: el encabezado cambia en cada captura, así que para él el feed estaba vivo."], pulsa: "la regla" },
    { t: ["La regla de limpieza es simple: un reporte vale si tiene <b>menos de cinco minutos</b> respecto a la captura. Y deduplicamos por vehículo y hora del reporte. Eso va en el primer paso del pipeline."], pulsa: "va a «Duplicados»" },
  ]},
  { id: "duplicados", quien: JF, marco: "Duplicados", pantalla: "barras de duplicados", meta: 45, bloques: [
    { t: ["Leer más no es tener más. Consultamos cada diez o veinte segundos, pero cada bus da un dato nuevo cada <b>52 segundos</b>. En hora y media del pico, casi el <b>17 % de lo leído es repetido</b>.",
          "Y deduplicar necesita ver capturas vecinas juntas: es una operación que cruza archivos, no se puede hacer archivo por archivo. Eso va a importar en Ray."], pulsa: "va al cruce con el GTFS" },
  ]},
  { id: "union", quien: JF, marco: "El cruce que no cuadra", pantalla: "trip_id vs route_id", meta: 60, bloques: [
    { t: ["Para comparar contra el horario hay que cruzar con el GTFS estático. Medimos qué porcentaje de reportes encuentra su identificador en el GTFS de hoy."], pulsa: "barras de trip_id" },
    { t: ["Por viaje, el <b>trip_id</b>: del 12 al 17 solo cruza el <b>2,6 %</b>. TransMilenio renombra los viajes cada día."], pulsa: "barras de route_id" },
    { t: ["Por ruta, en cambio, cruza entre el <b>95 y el 100 %</b>. Decisión: el análisis va por <b>ruta y parada</b>. El horario solo sirve con el GTFS del mismo día, y ese se guarda desde el 24.",
          "Y encontramos otro cambio el mismo día 18: antes de esa fecha el feed <b>no actualizaba la parada</b> de cada bus. Por eso los intervalos entre buses los medimos en <b>puntos de control cada kilómetro</b> sobre la ruta, usando la distancia del map-matching."], pulsa: "va a «Qué días usamos»" },
  ]},
  { id: "dias", quien: JF, marco: "Qué días usamos", pantalla: "4 grupos de días", meta: 45, bloques: [
    { t: ["Con todo eso, clasificamos los días."], pulsa: "hábiles" },
    { t: ["Los hábiles completos, 12, 13 y 17, son la base."], pulsa: "fin de semana" },
    { t: ["Fines de semana y el festivo sirven para comparar."], pulsa: "parciales" },
    { t: ["Los parciales sí entran al benchmark: para medir velocidad de cómputo no importa que el día esté incompleto."], pulsa: "bordes" },
    { t: ["Y el 11 y el 24 son los bordes del archivo."], pulsa: "vuela a la estación 3" },
  ]},
  { id: "c3", cap: "Estación 3 · Ray", quien: JF, marco: "Ray", pantalla: "28.958 · 85 M · 45 MB", meta: 30, bloques: [
    { t: ["Estación tres: ¿qué parte del problema es paralela? Tres cifras: casi <b>29 mil archivos</b> independientes, <b>85 millones</b> de reportes que hay que reordenar por bus, y <b>45 MB de geometrías</b> contra las que se compara cada punto."], pulsa: "va a «Tres costos»" },
  ]},
  { id: "porque", quien: JF, marco: "Tres costos", pantalla: "parsear · reordenar · emparejar", meta: 75, bloques: [
    { t: ["Cada cifra es un tipo de paralelismo distinto."], pulsa: "parsear" },
    { t: ["<b>Parsear</b>: los archivos no dependen entre sí. Es paralelismo de datos puro, tareas sin comunicación."], pulsa: "reordenar" },
    { t: ["<b>Reordenar</b>: cada archivo es una foto de todos los buses, pero para la velocidad necesitamos la película de cada bus. Eso es un <b>shuffle</b>: lo hacemos al escribir, repartiendo por un hash del bus."], pulsa: "emparejar" },
    { t: ["<b>Emparejar</b>: proyectar cada punto sobre la ruta. Es el kernel más caro, con un dato grande compartido."], pulsa: "Amdahl" },
    { t: ["Y la <b>ley de Amdahl</b> nos dice que el speedup tiene techo: la parte que no escala, leer del disco y el shuffle, lo limita."], pulsa: "va a «Las piezas de Ray»" },
  ]},
  { id: "modelo", quien: JF, marco: "Las piezas de Ray", pantalla: "tareas · object store · Ray Data · actores", meta: 70, bloques: [
    { t: ["Usamos cuatro piezas de Ray."], pulsa: "tareas" },
    { t: ["<b>Tareas</b>: funciones sin estado que corren en cualquier worker."], pulsa: "object store" },
    { t: ["El <b>object store</b>: memoria compartida. Subimos las geometrías una vez y todas las tareas las leen sin copiarlas."], pulsa: "Ray Data" },
    { t: ["<b>Ray Data</b>: datasets en bloques con streaming, así no necesitamos que los 85 millones de filas quepan en memoria."], pulsa: "actores" },
    { t: ["Y <b>actores</b>, procesos con estado, solo para lo que tiene estado de verdad. Descartamos la idea de un actor por estación: serían miles de actores coordinándose para hacer muy poco."], pulsa: "va al pipeline" },
  ]},
  { id: "pipeline", quien: JF, marco: "El pipeline", pantalla: "diagrama del pipeline", meta: 80, bloques: [
    { t: ["El pipeline arranca de las capturas tal como quedaron. Nunca se modifican."], pulsa: "parseo" },
    { t: ["Ray Data lee cada archivo como un bloque, y <b>map_batches</b> pasa de protobuf a tablas Arrow y aplica la regla de los cinco minutos."], pulsa: "shuffle" },
    { t: ["El Parquet se escribe partido por día y por un <b>hash del vehículo</b>, en 64 partes: cada parte ya trae la película completa de sus buses. Una <b>tarea de Ray</b> por parte la ordena, deduplica y calcula diferencias de tiempo y distancia.",
          "Primero lo intentamos con el groupby de Ray Data y un pool de actores, pero los actores acaparaban los núcleos y el shuffle se quedaba esperando: pasó de un minuto a más de diez. Partir al escribir fue más simple y más rápido."], pulsa: "map-matching" },
    { t: ["Las geometrías van al object store con <b>ray.put</b> y el map-matching las usa. Es la etapa más cara."], pulsa: "agregados" },
    { t: ["Al final, agregados por tramo y hora: velocidad, headway y bunching. Esta presentación lee esas salidas."], pulsa: "va a «Workers»" },
  ]},
  { id: "workers", quien: JF, marco: "Workers", pantalla: "animación de workers", meta: 45, bloques: [
    { t: ["Así se ve el parseo con <b>un worker</b>: los lotes pasan uno por uno."], pulsa: "4 workers" },
    { t: ["Con <b>cuatro</b>, en paralelo."], pulsa: "16 workers" },
    { t: ["Con <b>dieciséis</b>, el tiempo ideal se divide entre dieciséis. Es ilustrativo: en la práctica el disco y el arranque de tareas ponen un piso."], pulsa: "va a «Map-matching»" },
  ]},
  { id: "mapmatch", quien: JF, marco: "Map-matching", pantalla: "código del kernel", meta: 55, bloques: [
    { t: ["¿Cuánto avanzó el bus? La línea recta entre dos reportes miente en las curvas, así que proyectamos cada punto sobre la geometría de su ruta."], pulsa: "por qué es caro" },
    { t: ["Son 60,8 millones de puntos contra los segmentos de su ruta. Es CPU pura y los buses no dependen entre sí: escala con los núcleos."], pulsa: "por qué el object store" },
    { t: ["Y sin el object store cada tarea copiaría las geometrías. Con <b>ray.put</b> se copian una vez por nodo."], pulsa: "va a «Speedup»" },
  ]},
  { id: "speedup", quien: JF, marco: "Speedup", pantalla: "curvas de speedup y tabla", meta: 80, bloques: [
    { t: ["Ahora, la medición. Corrimos el pipeline sobre el <b>martes 17 completo</b>, 2.268 capturas, en una máquina de Colab con 8 núcleos. El speedup se mide contra el <b>mismo código sin Ray</b>, en un solo proceso: eso es la línea base honesta."], pulsa: "Amdahl" },
    { t: ["La curva azul es <b>Amdahl</b> con la fracción paralela que despejamos de la medición: <b>p ≈ 0,90</b>. Es decir, alrededor del 10 % del trabajo no se paraleliza."], pulsa: "la medición" },
    { t: ["Y la roja es lo medido: el secuencial tarda <b>9 minutos y medio</b>; con 8 workers, <b>poco más de 2 minutos</b>. <b>4,7 veces</b> más rápido.",
          "Por etapa: el map-matching, que es el 94 % del trabajo, escala <b>5,2 veces</b>. El ETL solo 1,9: está limitado por leer del disco. Y Ray con un solo worker es un 5 % más lento que el secuencial: es el costo de arrancar Ray.",
          "Con 8 workers procesamos los <b>14 días completos</b>, 3,7 GB, en <b>21 minutos</b>."],
      haz: "Pasa el mouse por los puntos para mostrar tiempo y eficiencia.", pulsa: "vuela a la estación 4" },
  ]},
  { id: "c4", cap: "Estación 4 · Resultados", quien: CO, marco: "Resultados", pantalla: "portada del capítulo", meta: 15, bloques: [
    { t: ["Estación cuatro: ¿cómo anda la red de verdad?"], pulsa: "va al replay" },
  ]},
  { id: "replay", quien: CO, marco: "Replay", pantalla: "replay 3D", meta: 70, bloques: [
    { t: ["Esto es hora y media del martes 17, de 6:15 a 7:45, en 45 segundos. Son mil seiscientos buses con su trayectoria real, interpolada entre reportes.",
          "El reloj arriba a la izquierda marca la hora real. Se ve cómo se llena la ciudad en el pico."], haz: "Gira el mapa; el botón pausa congela el reloj.", pulsa: "solo troncales" },
    { t: ["Dejando solo las troncales se ven los corredores exclusivos: la Caracas, la Autonorte, la 80. Y no depende de que el feed esté en línea hoy."], pulsa: "va a «Métricas»" },
  ]},
  { id: "metricas", quien: CO, marco: "Métricas", pantalla: "15,2 km/h · 10,7 min · 12,5 %", meta: 60, bloques: [
    { t: ["Del pipeline salen tres métricas del gemelo digital, en los días hábiles completos."], pulsa: "velocidad" },
    { t: ["<b>Velocidad comercial</b>: distancia sobre la ruta entre tiempo, con paradas y semáforos. En el pico de la mañana, <b>15,2 km/h</b> en promedio para toda la red."], pulsa: "headway" },
    { t: ["<b>Headway real</b>: cada cuánto cruza un bus de la misma ruta por un mismo punto. La mediana es <b>10,7 minutos</b>."], pulsa: "bunching" },
    { t: ["Y <b>bus bunching</b>: un bus que llega menos de un cuarto del intervalo normal después del anterior. Pasa en el <b>12,5 %</b> de los intervalos, y sube a 14 % a las 8 y a 15 % a las 7 de la noche."], pulsa: "va a «Velocidad por hora»" },
  ]},
  { id: "velocidad", quien: CO, marco: "Velocidad por hora", pantalla: "líneas por tipo de servicio", meta: 55, bloques: [
    { t: ["Por hora y tipo de servicio: la troncal va a unos <b>19 km/h</b> a las 7 y a casi 22 al mediodía, porque tiene carril exclusivo. El zonal, que comparte la calle, va a <b>12</b>, y a las 5 de la tarde baja a <b>10 km/h</b>."], pulsa: "velocidad por día" },
    { t: ["Y por día: entre semana la red anda a unos <b>13,5 km/h</b>; el domingo y el festivo, a <b>17</b>. El festivo del 16 se comporta igual que un domingo."], pulsa: "va a «Dónde se frena»" },
  ]},
  { id: "tramos", quien: CO, marco: "Dónde se frena", pantalla: "mapa 3D de tramos", meta: 55, bloques: [
    { t: ["Esto es el gemelo digital: cada columna es un tramo de 500 metros de una ruta troncal en el pico de la mañana. Más rojo, más lento."], haz: "Gira el mapa.", pulsa: "suben los tramos lentos" },
    { t: ["Los tramos lentos se levantan. Los peores van a entre <b>4 y 6 km/h</b>, por ejemplo en la H15 hacia el Portal Tunal o la A60 por la Calle 72. Esto solo se puede decir porque cada punto se proyectó sobre su ruta."], pulsa: "va a «Límites y lecciones»" },
  ]},
  { id: "limites", cap: "Cierre", quien: CO, marco: "Límites y lecciones", pantalla: "límites y lecciones", meta: 50, bloques: [
    { t: ["Para cerrar, lo que aprendimos."], pulsa: "1" },
    { t: ["Dependemos de un solo servidor. Lección: validar el <b>contenido</b>, no los bytes."], pulsa: "2" },
    { t: ["Los viajes cambian de nombre cada día. Lección: <b>medir el cruce</b> antes de diseñar el análisis."], pulsa: "3" },
    { t: ["Y el benchmark corrió en una máquina de 8 núcleos: con más nodos, el shuffle costaría más. Lección: paralelizar cada etapa <b>según su tipo</b>: datos, shuffle o kernel."], pulsa: "va a «Gracias»" },
  ]},
  { id: "cierre", quien: CO, marco: "Gracias", pantalla: "gracias", meta: 15, bloques: [
    { t: ["Muchas gracias. ¿Preguntas?"], haz: "Pulsa O para mostrar el recorrido completo mientras responden.", pulsa: "fin" },
  ]},
];
