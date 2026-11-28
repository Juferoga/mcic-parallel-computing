// Guion de la presentación: un bloque por pulsación de → (bloques = pasos del marco + 1).
// Va copiado tal cual dentro de guion.html. quien: "Juan Felipe" o "Carlos".
const JF = "Juan Felipe", CO = "Carlos";
const GUION = [
  { id: "portada", cap: "El problema", quien: JF, marco: "Portada", pantalla: "portada UD: título y autores", meta: 20, bloques: [
    { t: ["Buenas, profesor y compañeros. Somos <b>Juan Felipe Rodríguez</b> y <b>Carlos Mora</b>.",
          "Nuestra pregunta es sencilla: si Bogotá tiene plata para unos pocos kilómetros de carril bus, <b>¿dónde los pone para recuperar más tiempo?</b> La respondemos con doce días del GPS de TransMilenio procesados en <b>Ray</b>."],
      haz: "Los puntos del fondo son buses reales del lunes 23, de 5 a 6:30 de la tarde.", pulsa: "va a «El problema»" },
  ]},
  { id: "problema", quien: JF, marco: "El problema", pantalla: "32 minutos de cada hora · velocidad por hora", meta: 60, bloques: [
    { t: ["El problema en una frase: de cada hora que opera un bus zonal, <b>32 minutos</b> son retraso.",
          "Retraso es lo que tarda el bus en un tramo de 500 metros menos lo que tarda ahí cuando va libre. Sumando todos los sistemas son unas <b>35.900 horas de bus</b> perdidas cada día hábil. Incluso la troncal, que tiene carril propio, pierde el 40 % de su tiempo.",
          "A la derecha, la velocidad por hora: el valle de las horas pico."], pulsa: "aparece «Un bus lento sale caro»" },
    { t: ["¿Y por qué importa? Porque un bus lento sale caro: para dar la misma frecuencia hacen falta más buses y más conductores, y el pasajero que pierde tiempo se va. La demanda zonal cayó 7,7 % en un semestre."], pulsa: "va a «Cuánto cuesta»" },
  ]},
  { id: "costo", quien: JF, marco: "Cuánto cuesta", pantalla: "la cuenta en pesos", meta: 70, bloques: [
    { t: ["Pongámosle precio. Primero la operación: 35.868 horas de bus por <b>$201 mil</b>, que es lo que cuesta en promedio operar un bus una hora: el costo del SITP, 6,9 billones al año, dividido entre sus horas de servicio. Son <b>$7,2 mil millones</b> al día."], pulsa: "el tiempo de la gente" },
    { t: ["Después la gente. Con el IPK de TransMilenio y viajes de 10 km, van unos 14 pasajeros a bordo en un zonal y 45 en una troncal: <b>651 mil horas de pasajeros</b> al día. A la mitad del salario mínimo por hora, $4.200, son otros <b>$2,7 mil millones</b>."], pulsa: "el total" },
    { t: ["En total, <b>$9,9 mil millones por día hábil</b>, unos <b>2,5 billones al año</b>. Solo la parte de operación es la cuarta parte de lo que cuesta el SITP."], pulsa: "aparece «Es un techo»" },
    { t: ["Ojo: es un techo. Ningún bus va libre todo el día, así que esto no se recupera completo. La pregunta útil es <b>dónde se recupera más por cada peso</b>.",
          "Y los supuestos están ahí abajo con su fuente: si se cambian, cambia la cifra, no el orden de las calles."], pulsa: "va a «Cómo lo resolvemos»" },
  ]},
  { id: "plan", quien: JF, marco: "Cómo lo resolvemos", pantalla: "el modelo y los cuatro pasos", meta: 80, bloques: [
    { t: ["Eso es un problema de optimización. Partimos la ciudad en celdas de 250 metros. Queremos elegir qué celdas tratar, x sub i igual a uno, para <b>maximizar las horas recuperadas</b> sin pasarnos del presupuesto."], pulsa: "la solución es una lista" },
    { t: ["Es un problema de la mochila, pero fácil: todas las celdas miden lo mismo, así que cuestan lo mismo. Entonces la solución óptima, para cualquier presupuesto, es <b>ordenar las celdas por ahorro</b> y tratarlas en ese orden hasta que se acabe la plata."], pulsa: "paso 1" },
    { t: ["Lo difícil es tener el ahorro de cada celda. Paso uno: <b>medirlo</b>, con 81 millones de posiciones GPS. Ese es el trabajo pesado y por eso Ray."], pulsa: "paso 2" },
    { t: ["Paso dos: <b>estimar cuánto ahorra un carril</b>. Eso no lo podemos medir nosotros, lo tomamos de Bogotá y de otras ciudades: entre 10 y 20 % más de velocidad."], pulsa: "paso 3" },
    { t: ["Paso tres: <b>ordenar y valorar</b>, cuántas horas y cuántos pesos devuelve cada kilómetro."], pulsa: "paso 4" },
    { t: ["Y con los mismos datos respondemos dos preguntas más: <b>cuánto tiempo reservar</b>, que es el horario, y <b>a quién le cuesta más</b>, que es la equidad."], pulsa: "estación 1: los datos" },
  ]},
  { id: "datos", cap: "Cómo lo medimos", quien: CO, marco: "Los datos", pantalla: "mapa de calor de buses por hora", meta: 55, bloques: [
    { t: ["Los datos: el feed abierto de TransMilenio, guardado cada 20 segundos del 12 al 23 de noviembre. <b>27.600 capturas</b>, <b>80,9 millones</b> de posiciones. Cada fila es un día; lo rayado son horas en que el feed se congeló."], pulsa: "marca ①" },
    { t: ["Cada bus reporta más o menos cada 52 segundos, y casi un <b>30 %</b> de lo que se lee es repetido. Eso se limpia antes de medir."], pulsa: "marca ②" },
    { t: ["Y las listas usan solo días hábiles; sábados, domingos y el festivo van aparte."], pulsa: "va al pipeline" },
  ]},
  { id: "pipeline", quien: CO, marco: "El pipeline en Ray", pantalla: "diagrama de cajas", meta: 80, bloques: [
    { t: ["¿Cómo pasamos de puntos GPS a minutos perdidos por calle? Cuatro etapas. Entra el archivo crudo, que nunca se toca."], pulsa: "Ray Data" },
    { t: ["Primera, <b>Ray Data</b>: cada captura se procesa sola. Se decodifica el protobuf, se quitan duplicados y reportes viejos, y sale Parquet por día y por grupo de buses."], pulsa: "Ray Core" },
    { t: ["Segunda, la cara: <b>ubicar cada bus en su ruta</b>. Una tarea de Ray por día y grupo de buses, con las geometrías compartidas en el object store. Se lleva más de la mitad del tiempo."], pulsa: "medir el retraso" },
    { t: ["Tercera y cuarta: <b>medir el retraso</b> en cada tramo de 500 metros, y lo mismo entre paradas para el horario. Una tarea por grupo de rutas."], pulsa: "salida" },
    { t: ["Salen <b>23 millones</b> de pasos por tramo. Los doce días toman <b>57 minutos</b> con 6 CPUs."], pulsa: "speedup" },
  ]},
  { id: "speedup", quien: CO, marco: "Speedup", pantalla: "curva de speedup", meta: 60, bloques: [
    { t: ["La parte del curso. Medimos el speedup contra el <b>mismo código en un solo proceso</b>, sin Ray, sobre el mismo día hábil."], pulsa: "Amdahl" },
    { t: ["Amdahl pone el techo: solo una parte del trabajo es paralela."], pulsa: "la medición" },
    { t: ["Y esta es la medición: con 8 workers, <b>2,8 veces más rápido</b>. La fracción paralela estimada es 0,73: lo que no escala es arrancar Ray, leer del disco y escribir Parquet."], haz: "Pasa el mouse por los puntos para leer tiempo y eficiencia.", pulsa: "validación" },
  ]},
  { id: "validacion", quien: CO, marco: "Validación", pantalla: "tres tarjetas", meta: 55, bloques: [
    { t: ["¿Le podemos creer a la medición? Tres pruebas."], pulsa: "error" },
    { t: ["Uno: buses simulados de velocidad conocida, con un reporte cada 52 segundos. Sesgo de medio punto; error mediano de 8 % por tramo. Sirve para comparar calles, no un tramo aislado."], pulsa: "cifra oficial" },
    { t: ["Dos: medimos entre 10 y 18 % por debajo de la velocidad oficial de 2024. Mismo orden de magnitud."], pulsa: "estabilidad" },
    { t: ["Tres: la lista de la primera mitad de los días se parece a la de la segunda, Spearman 0,63, pero la mitad del top 20 cambia. Sirve para priorizar, y antes de invertir conviene medir más días."], pulsa: "estación 2: dónde invertir" },
  ]},
  { id: "mapa", cap: "Dónde invertir", quien: JF, marco: "Dónde se frenan", pantalla: "mapa 3D de celdas", meta: 45, bloques: [
    { t: ["Este es el mapa. Cada punto es una celda de 250 metros, coloreada por la velocidad en el pico. Más rojo, más lento."], haz: "Gira el mapa con el mouse si hay tiempo.", pulsa: "se levantan las celdas" },
    { t: ["La altura es lo que se pierde ahí cada día. El <b>87 %</b> de las horas perdidas está en tráfico mixto, zonal y alimentador: ahí es donde un carril cambia algo."], pulsa: "cuánto ahorra un carril" },
  ]},
  { id: "efecto", quien: JF, marco: "Cuánto ahorra un carril", pantalla: "cuatro ciudades", meta: 50, bloques: [
    { t: ["¿Cuánto ahorra un carril? En Bogotá, la Secretaría reporta <b>+11 %</b> de velocidad en la Séptima con cámaras, 17 % en el pico. Nueva York, +8 %. Filadelfia, +12 %. Santiago, +20 % con corredores segregados y fiscalizados; la pintura sola no sirvió."], pulsa: "el rango" },
    { t: ["Entonces usamos dos escenarios: <b>+10 %</b>, pesimista, y <b>+20 %</b>, optimista. Y nunca dejamos que el bus quede más rápido que su tiempo libre."], pulsa: "la curva" },
  ]},
  { id: "optimo", quien: JF, marco: "Cuánto devuelve cada km", pantalla: "curva km → horas y tabla", meta: 70, bloques: [
    { t: ["Esta curva es la solución óptima. En el eje horizontal, kilómetros tratados en orden de ahorro; en el vertical, horas de bus recuperadas al día.",
          "Los primeros <b>10 km</b> devuelven entre <b>355 y 651 horas</b> al día. La curva se aplana: el kilómetro uno rinde más que el cien. Por eso importa el orden."], pulsa: "la tabla" },
    { t: ["En pesos: 10 km valen entre <b>23 y 42 mil millones al año</b>. Si un kilómetro segregado con cámaras cuesta mil millones, cuatro veces lo que costó la Séptima en 2014, la inversión <b>se paga en 3 a 5 meses</b>. Con 50 km, en 4 a 7."], pulsa: "la lista" },
  ]},
  { id: "ranking", quien: JF, marco: "Por dónde empezar", pantalla: "barras y minimapa", meta: 45, bloques: [
    { t: ["Y esta es la lista: las celdas por donde empezar. La primera está en Usme: <b>96 horas de bus</b> perdidas al día, 56 rutas zonales y 7,8 km/h en el pico."], pulsa: "intervalos" },
    { t: ["Las líneas negras son el intervalo del 95 %, remuestreando días completos."], pulsa: "estación 3: horario y equidad" },
  ]},
  { id: "reservar", cap: "Horario y equidad", quien: CO, marco: "Cuánto reservar", pantalla: "BTI y tabla de pares", meta: 55, bloques: [
    { t: ["El retraso también tiene otro costo: la incertidumbre. Para llegar a tiempo 19 de cada 20 veces hay que salir con el p95, no con el promedio.",
          "En el pico eso es entre <b>18 y 25 %</b> más de tiempo según el sistema: en un viaje de 40 minutos, de 7 a 10 minutos extra, todos los días."], pulsa: "los peores" },
    { t: ["Y hay viajes mucho peores: en la BD237, del Rincón del Chicó a Las Ferias a las 6 de la tarde, la mediana es de 34 minutos y el p95 de <b>93</b>."], pulsa: "el horario" },
  ]},
  { id: "horario", quien: CO, marco: "El horario", pantalla: "barras de holgura y cobertura por hora", meta: 55, bloques: [
    { t: ["El horario oficial también está mal repartido. En el zonal se queda corto en el <b>37 %</b> de los pares de paradas por hora, y en el dual en el <b>60 %</b>: el bus llega tarde. En otros tramos le sobra, y el bus espera.",
          "Mover tiempo de donde sobra a donde falta es otra optimización, y no exige comprar un bus."], pulsa: "el colchón" },
    { t: ["Y si publicamos cuánto reservar, ¿sirve en días que no vio? Con 4 días cubre el <b>87,5 %</b>, no el 95 %. Hace falta medir más días antes de publicarlo."], pulsa: "accesibilidad" },
  ]},
  { id: "accesibilidad", quien: CO, marco: "A quién le cuesta más", pantalla: "barras por estrato", meta: 60, bloques: [
    { t: ["¿A quién le cuesta más? Calculamos a cuántos empleos se llega en una hora de bus desde cada zona, con el horario y con los tiempos medidos."], pulsa: "brecha" },
    { t: ["Desde una zona de estrato 1 se llega al <b>11 %</b> de los empleos; desde una de estrato 4, al <b>51 %</b>. Cuatro a cinco veces menos."], pulsa: "días lentos" },
    { t: ["Y en un día lento, los estratos 1 y 2 pierden entre 11 y 14 % del acceso; los altos, entre 3 y 5 %. Por eso, a igual ahorro, un carril en el sur rinde más."], pulsa: "conclusiones" },
  ]},
  { id: "bogota", cap: "Cierre", quien: JF, marco: "Qué recomendamos", pantalla: "tres tarjetas y nota del curso", meta: 60, bloques: [
    { t: ["Para cerrar, qué le recomendamos a Bogotá."], pulsa: "invertir" },
    { t: ["<b>Invertir en orden</b>: los primeros 10 km de la lista devuelven entre 355 y 651 horas de bus al día, unos 23 a 42 mil millones al año. Segregado y fiscalizado, no solo pintura."], pulsa: "horario" },
    { t: ["<b>Rehacer el horario</b>: mover tiempo de donde sobra a donde falta, sin comprar un bus más."], pulsa: "sur" },
    { t: ["<b>Empezar por el sur</b>: ahí se pierde más acceso al empleo en un día lento."], pulsa: "para el curso" },
    { t: ["Y para el curso: cada captura, cada grupo de buses y cada grupo de rutas es independiente, por eso Ray; con 8 workers, 2,8 veces más rápido.",
          "Con doce días y sin un antes de los carriles, nada de esto es causal: es una lista para priorizar."], pulsa: "va a «Gracias»" },
  ]},
  { id: "cierre", quien: JF, marco: "Gracias", pantalla: "gracias", meta: 15, bloques: [
    { t: ["Muchas gracias. ¿Preguntas?"], haz: "Pulsa O para mostrar el recorrido completo mientras responden.", pulsa: "fin" },
  ]},
];
