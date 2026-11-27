// Guion de la presentación: un bloque por pulsación de → (bloques = pasos del marco + 1).
// Va copiado tal cual dentro de guion.html. quien: "Juan Felipe" o "Carlos".
const JF = "Juan Felipe", CO = "Carlos";
const GUION = [
  { id: "portada", cap: "Inicio", quien: JF, marco: "Portada", pantalla: "portada UD: título y autores", meta: 25, bloques: [
    { t: ["Buenas, profesor y compañeros. Somos <b>Juan Felipe Rodríguez</b> y <b>Carlos Mora</b>.",
          "Nuestro proyecto final responde una pregunta concreta: <b>dónde pierden tiempo los buses de Bogotá</b>. Lo hicimos con doce días del feed de TransMilenio procesados en <b>Ray</b>."],
      haz: "Los puntos del fondo son buses reales del lunes 23, de 5 a 6:30 de la tarde.", pulsa: "va a «El problema»" },
  ]},
  { id: "problema", quien: JF, marco: "El problema", pantalla: "26,8 → 24,9 km/h · gráfico por hora", meta: 60, bloques: [
    { t: ["Los buses de Bogotá van cada año más lento. La velocidad zonal en el pico de la mañana pasó de <b>26,8 a 24,9 km/h</b> entre 2023 y 2024, y la demanda zonal también cayó.",
          "A la derecha está lo que medimos nosotros: en el pico el zonal y el alimentador andan entre <b>13 y 16 km/h</b>."], pulsa: "aparece «Sin mapa público»" },
    { t: ["El problema es que la ciudad decide dónde poner carriles exclusivos o prioridad semafórica <b>sin un mapa público</b> de dónde y a qué hora se frenan los buses."], pulsa: "aparece la pregunta" },
    { t: ["Entonces la pregunta es: ¿<b>dónde y cuándo</b> pierden tiempo los buses, y <b>cuánto hay que reservar</b> para llegar a tiempo?"], pulsa: "va a otras ciudades" },
  ]},
  { id: "ciudades", quien: JF, marco: "Otras ciudades", pantalla: "Nueva York · California · Santiago · Filadelfia", meta: 70, bloques: [
    { t: ["Esto no es nuevo en otras ciudades."], pulsa: "Nueva York" },
    { t: ["En <b>Nueva York</b> la MTA publica la velocidad por tramo y hora, y el Contralor la usa para calificar líneas: <b>186 de 332</b> sacaron D o F."], pulsa: "California" },
    { t: ["En <b>California</b>, Cal-ITP hace lo mismo solo con GTFS-Realtime archivado, como nosotros. Desde abril de 2026 es la métrica oficial para evaluar la prioridad semafórica."], pulsa: "Santiago" },
    { t: ["<b>Santiago</b> aporta lo causal: los corredores segregados y fiscalizados suben la velocidad cerca de un <b>20 %</b> en punta; la pintura sola no muestra efecto."], pulsa: "Filadelfia" },
    { t: ["Y <b>Filadelfia</b> comparó un tramo con carril rojo contra uno gemelo sin pintura.",
          "Bogotá abrió su feed el 4 de noviembre, pero nadie analiza el archivo histórico. Ese es el hueco."], pulsa: "estación 1: los datos" },
  ]},
  { id: "datos", cap: "Datos y Ray", quien: CO, marco: "Los datos y su calidad", pantalla: "mapa de calor de buses por hora", meta: 70, bloques: [
    { t: ["Usamos <b>doce días</b>, del 12 al 23 de noviembre: unas <b>27.600 capturas</b> y <b>80,9 millones</b> de posiciones.",
          "Casi un <b>30 %</b> de lo que se lee es repetido: el feed se consulta más seguido de lo que cada bus reporta, que es más o menos cada 52 segundos.",
          "Lo rayado son horas sin reportes: el feed se congeló la noche del 18 y las mañanas del 19, 20 y 23."], pulsa: "marca ①" },
    { t: ["Ojo con esto: desde el <b>18 de noviembre</b> el feed trae muchos más buses. En la hora pico de un día hábil pasamos de unos <b>6.400</b> a unos <b>8.300</b>. Es un cambio del feed, no de la ciudad."], pulsa: "marca ②" },
    { t: ["Y los sábados, domingos y el festivo del 16 se analizan aparte, por tipo de día. Los rankings usan solo días hábiles."], pulsa: "va al pipeline" },
  ]},
  { id: "pipeline", quien: JF, marco: "El pipeline en Ray", pantalla: "diagrama de cajas", meta: 90, bloques: [
    { t: ["El pipeline tiene cuatro etapas y cada una se mide por separado. Entra el archivo crudo, que nunca se toca."], pulsa: "Ray Data" },
    { t: ["Primera etapa, <b>Ray Data</b>: un archivo no depende de otro, así que es paralelismo de datos puro. Se decodifica el protobuf, se quitan los zombis y se escribe Parquet partido por día y por un hash del bus."], pulsa: "Ray Core" },
    { t: ["Segunda, la cara: <b>tareas de Ray Core</b>, una por día y partición, con las geometrías en el <b>object store</b>.",
          "Lo nuevo: cada ruta tiene un solo shape de ida y vuelta, así que el bus se empareja solo con los segmentos que van <b>en su sentido de marcha</b>. Si no, la ida y la vuelta por la misma calle se confunden."], pulsa: "tramos y confiabilidad" },
    { t: ["Tercera y cuarta: <b>tramos</b> y <b>confiabilidad</b>, una tarea por cubo de rutas. Los recorridos ya salen repartidos así, entonces no hay otro shuffle."], pulsa: "salida" },
    { t: ["Resultado: de 80,9 millones de posiciones salen <b>23 millones</b> de recorridos de tramo. La corrida completa tarda <b>57 minutos</b> con 6 CPUs."], pulsa: "va a validación" },
  ]},
  { id: "validacion", quien: JF, marco: "Validación", pantalla: "tres tarjetas", meta: 75, bloques: [
    { t: ["Antes de mostrar resultados, ¿le podemos creer a la medición? Tres pruebas."], pulsa: "error sintético" },
    { t: ["Uno: buses sintéticos de velocidad conocida, muestreados cada 52 segundos. El sesgo es de <b>medio punto</b> porcentual y el error mediano, <b>8,4 %</b> por tramo."], pulsa: "cifra oficial" },
    { t: ["Dos: contra la cifra oficial de 2024 medimos entre un <b>10 y un 18 % menos</b>. Mismo orden de magnitud, pero más bajo, y lo decimos así."], pulsa: "estabilidad" },
    { t: ["Tres: si partimos los días hábiles en dos mitades, el ranking se parece: Spearman de <b>0,63</b> en tráfico mixto y <b>0,73</b> en exclusivo. Estable, no idéntico."], pulsa: "va a speedup" },
  ]},
  { id: "speedup", quien: JF, marco: "Speedup y Amdahl", pantalla: "curva de speedup", meta: 70, bloques: [
    { t: ["Ahora la parte del curso. El speedup se mide contra el <b>mismo código en un solo proceso</b>, sin Ray. No contra Ray con un worker, que ya paga el costo de arrancar Ray."], pulsa: "aparece Amdahl" },
    { t: ["La curva de Amdahl pone el techo: si una fracción p es paralela, con n núcleos no se gana más que uno sobre (1 − p) + p/n."], pulsa: "aparece la medición" },
    { t: ["Y esta es la medición, el mismo día hábil con 1, 2, 4 y 8 workers. De ahí sale la p estimada.",
          "Si la corrida todavía no está, en pantalla dice «medición pendiente»: no inventamos la curva."], haz: "Pasa el mouse por los puntos para leer tiempo y eficiencia.", pulsa: "estación 2: el mapa" },
  ]},
  { id: "mapa", cap: "Dónde se frenan", quien: CO, marco: "Mapa: dónde se frenan", pantalla: "mapa 3D de celdas", meta: 60, bloques: [
    { t: ["Este es el atlas. Cada punto es una celda de 250 metros, coloreada por la velocidad de los buses en el pico de los días hábiles. Más rojo, más lento."], haz: "Gira el mapa con el mouse si hay tiempo.", pulsa: "se levantan las celdas" },
    { t: ["Ahora las celdas suben según las <b>bus-horas que se pierden</b> ahí cada día hábil frente al flujo libre.",
          "En tráfico mixto se pierden unas <b>31.300 bus-horas</b> al día; en carril exclusivo, unas <b>4.800</b>. Son bus-horas, no horas de pasajeros: el feed no trae pasajeros."], pulsa: "ranking mixto" },
  ]},
  { id: "ranking-mixto", quien: CO, marco: "Ranking: tráfico mixto", pantalla: "barras y minimapa", meta: 60, bloques: [
    { t: ["El ranking de tráfico mixto, zonal y alimentador. La primera celda pierde unas <b>96 bus-horas</b> cada día hábil, con 56 rutas pasando y <b>7,8 km/h</b> en el pico.",
          "A la derecha está dónde quedan las veinte primeras."], pulsa: "intervalos" },
    { t: ["Las líneas negras son el intervalo del 95 %, remuestreando días completos. Estas celdas son las candidatas a <b>carril preferencial o prioridad semafórica</b>."], pulsa: "ranking exclusivo" },
  ]},
  { id: "ranking-exclusivo", quien: CO, marco: "Ranking: carril exclusivo", pantalla: "barras y minimapa", meta: 45, bloques: [
    { t: ["Lo mismo para troncal y dual. La primera celda pierde unas <b>70 bus-horas</b> al día, con los buses a <b>5,6 km/h</b> en el pico."], pulsa: "intervalos" },
    { t: ["Aquí el bus ya tiene carril, así que estas celdas piden <b>otro tipo de intervención</b>. Por eso los dos rankings van separados."], pulsa: "carriles" },
  ]},
  { id: "carriles", quien: CO, marco: "Séptima y Carrera 13", pantalla: "barras dentro vs fuera", meta: 60, bloques: [
    { t: ["La pregunta que todos hacen: ¿y los carriles de la Séptima y la Carrera 13?",
          "Para las rutas que los usan, dentro del carril van <b>más lento</b> que en el resto de su ruta: en el pico, 14,0 contra 14,9 en la Séptima y 12,1 contra 14,1 en la Carrera 13."], pulsa: "aparece la advertencia" },
    { t: ["Pero esto es <b>descriptivo, no causal</b>. No hay datos de antes de los carriles, así que no podemos decir si funcionaron. Solo cómo andan hoy esas rutas dentro y fuera."], pulsa: "estación 3: cuánto reservar" },
  ]},
  { id: "reservar", cap: "Cuánto reservar", quien: JF, marco: "Cuánto reservar", pantalla: "BTI por sistema y tablas", meta: 70, bloques: [
    { t: ["La segunda solución mira lo que vive el usuario: si quiero llegar a tiempo <b>19 de cada 20 veces</b>, no me sirve el promedio, necesito el p95.",
          "El Buffer Time Index dice cuánto sumar al tiempo medio. En el pico, la mediana va de un <b>18 a un 25 %</b> según el sistema."], pulsa: "tabla de tráfico mixto" },
    { t: ["Pero hay pares mucho peores. En la BD237, del Rincón del Chicó a Las Ferias a las 6 de la tarde, la mediana es de 34 minutos y el p95 de <b>93</b>.",
          "Esos extremos hay que revisarlos uno por uno antes de publicarlos."], pulsa: "tabla de exclusivo" },
    { t: ["En carril exclusivo los colchones son menores. El peor par de troncal, en la F26 de la Calle 100 a Patio Bonito, va de 60 a 101 minutos."], pulsa: "walk-forward" },
  ]},
  { id: "walkforward", quien: JF, marco: "Walk-forward y horario", pantalla: "cobertura por hora", meta: 70, bloques: [
    { t: ["¿El colchón sirve en días que no vio? Lo calculamos con cuatro días hábiles y lo probamos con otros tres: seis millones de viajes."], pulsa: "el resultado" },
    { t: ["Y no cumple: cubre el <b>87 %</b>, no el 95 %. En el pico de la mañana llega al 92 %; en la tarde baja a 85 %.",
          "Lo reportamos tal cual. Antes de publicar un «reserve tantos minutos» hay que entrenarlo con más días."], pulsa: "holgura del horario" },
    { t: ["De paso, comparamos contra el horario del GTFS: según el sistema, se queda corto en una porción grande de los pares, en el dual en dos de cada tres."], pulsa: "próximo paso" },
  ]},
  { id: "accesibilidad", cap: "Cierre", quien: CO, marco: "Accesibilidad al empleo", pantalla: "barras por estrato: horario, típico y lento", meta: 70, bloques: [
    { t: ["La tercera solución pregunta a cuántos empleos llega cada barrio en una hora de bus, con el horario oficial y con la operación que medimos."], pulsa: "brecha" },
    { t: ["Primero la desigualdad de base: desde una zona de estrato 1 se alcanza el 11 % de los empleos de la ciudad; desde una de estrato 4, el 51 %. Cuatro a cinco veces menos."], pulsa: "días lentos" },
    { t: ["Y lo que agrega la operación real: el horario es conservador en un día típico, pero en un día lento los estratos 1 y 2 pierden entre 11 y 14 % de acceso y los altos solo entre 3 y 5 %. La variabilidad castiga más a la periferia, como en Fortaleza."], pulsa: "conclusiones" },
  ]},
  { id: "bogota", quien: CO, marco: "Qué puede hacer Bogotá", pantalla: "tres tarjetas y nota del curso", meta: 70, bloques: [
    { t: ["Para cerrar, qué puede hacer Bogotá con esto."], pulsa: "priorizar" },
    { t: ["<b>Priorizar</b>: empezar por las celdas del ranking de tráfico mixto. Y si se hace, hacerlo como Santiago: segregar y fiscalizar, no solo pintar."], pulsa: "informar" },
    { t: ["<b>Informar</b>: publicar cuánto reservar entre paradas, pero solo cuando el walk-forward se acerque al 95 %."], pulsa: "horario" },
    { t: ["<b>Ajustar el horario</b> donde el GTFS se queda corto o le sobra tiempo."], pulsa: "para el curso" },
    { t: ["Y para el curso: cada archivo, cada partición y cada cubo de rutas son independientes, por eso Ray. La etapa cara es el map-matching, 32 de los 57 minutos.",
          "Con doce días y sin un antes de los carriles, nada de esto es causal."], pulsa: "va a «Gracias»" },
  ]},
  { id: "cierre", quien: CO, marco: "Gracias", pantalla: "gracias", meta: 15, bloques: [
    { t: ["Muchas gracias. ¿Preguntas?"], haz: "Pulsa O para mostrar el recorrido completo mientras responden.", pulsa: "fin" },
  ]},
];
