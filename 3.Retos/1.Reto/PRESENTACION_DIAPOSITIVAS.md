# Guion y Estructura de Diapositivas: Sustentación Reto 1 CNN en OpenACC

**Audiencia:** Docente y estudiantes de la Maestría en Ciencias de la Información y las Comunicaciones (MCIC)  
**Asignatura:** Computación Paralela y Distribuida  
**Universidad:** Universidad Distrital Francisco José de Caldas  
**Autor:** Juferoga  

---

### Diapositiva 1: Portada
* **Título:** Aceleración de una Tubería Convolucional (CNN) con OpenACC
* **Subtítulo:** Convolución 2D, Activación ReLU y MaxPooling 2D en Arquitecturas Heterogéneas
* **Viñetas:**
  * Implementación modular en C++ estándar y aceleración por directivas en GPU.
  * Gestión estructurada de memoria en bus PCIe mediante `#pragma acc data`.
  * Evaluación comparativa de desempeño y métricas de aceleración (*Speedup*).
* **Notas del Orador:**
  > "Buenas tardes a todos. En esta presentación expondré el diseño, implementación y optimización de una tubería de tres etapas que constituye la base operativa de las Redes Neuronales Convolucionales: la convolución espacial, la función no lineal ReLU y la reducción por MaxPooling. Veremos cómo, a través del modelo de directivas de OpenACC, logramos acelerar significativamente esta carga computacional en GPU manteniendo un código limpio, portable y ceñido estrictamente a las directivas vistas en clase."

---

### Diapositiva 2: Arquitectura y Flujo de la Tubería (*Pipeline*)
* **Título:** Arquitectura de la Tubería y Dimensionamiento
* **Viñetas:**
  * **Flujo Topológico:** Imagen $100 \times 100 \xrightarrow{\text{Conv } 3\times 3} 98 \times 98 \xrightarrow{\text{ReLU}} 98 \times 98 \xrightarrow{\text{Pool } 2\times 2} 49 \times 49$.
  * **Aplanamiento 1D continuo:** Mapeo canónico *Row-Major* (`i * W + j`) para eficiencia de caché y coalescencia en GPU.
  * **Bucle exterior:** Ráfaga iterativa de $N = 1\,000$ repeticiones para amortizar latencias fijas de transferencia.
* **Notas del Orador:**
  > "La tubería opera sobre arreglos unidimensionales contiguos asignados dinámicamente con punteros simples. Partimos de una imagen de 100 por 100 elementos; al aplicar un filtro convolucional válido de 3 por 3 sin relleno, las dimensiones se reducen a 98 por 98. Esta matriz pasa directamente a la etapa de activación ReLU conservando sus dimensiones. Finalmente, la etapa de MaxPooling con ventana 2 por 2 y paso 2 reduce espacialmente la representación a una salida de 49 por 49 elementos. Este flujo se repite mil veces para simular el procesamiento en tiempo real de una ráfaga de datos."

---

### Diapositiva 3: Etapa 1 — Convolución 2D y `collapse(2)`
* **Título:** Etapa 1: Convolución 2D y Paralelismo de Malla
* **Viñetas:**
  * **Operación:** Filtrado espacial con kernel $3 \times 3$ (9 productos y sumas por píxel de salida).
  * **Directiva:** `#pragma acc parallel loop collapse(2)` sobre los índices $i, j \in [0, 97]$.
  * **Impacto:** Fusión de bucles que genera $9\,604$ hilos independientes mapeados a bloques y vectores en CUDA.
* **Notas del Orador:**
  > "En la convolución, cada píxel de salida de la matriz 98 por 98 se calcula independientemente como el producto punto entre la región local de 3 por 3 de la imagen y el kernel. Si paralelizamos únicamente el bucle exterior, dispondríamos de sólo 98 hilos, insuficiente para alimentar los multiprocesadores de la GPU. La directiva 'collapse(2)' fusiona los bucles de filas y columnas en una única malla de 9,604 hilos independientes, permitiendo al compilador agruparlos en gangs y vectors de 128 hilos y maximizar la ocupación de los núcleos CUDA."

---

### Diapositiva 4: Etapa 2 — Activación ReLU
* **Título:** Etapa 2: Activación ReLU y Preservación en VRAM
* **Viñetas:**
  * **Operación no lineal:** $f(x) = \max(0, x)$ aplicada a los $9\,604$ elementos calculados.
  * **Directiva:** `#pragma acc parallel loop collapse(2)` sin dependencias de datos.
  * **Ventaja de Tubería:** Operación *in-situ* dentro de la memoria de la GPU, sin intervención del Host.
* **Notas del Orador:**
  > "La función de activación ReLU introduce la no linealidad indispensable para los modelos de aprendizaje profundo, truncando los valores negativos a cero. Dado que cada celda se procesa de manera estrictamente local y sin ninguna dependencia espacial o temporal con sus vecinos, esta etapa es inherentemente paralela. Lo fundamental en términos de arquitectura de computación es que el buffer de convolución reside ya en la memoria del dispositivo, por lo que ReLU consume los datos directamente de la VRAM sin incurrir en costosas transferencias con el procesador central."

---

### Diapositiva 5: Etapa 3 — MaxPooling 2D (Corrección Conceptual)
* **Título:** Etapa 3: MaxPooling 2D y Clarificación Teórica
* **Viñetas:**
  * **Corrección Conceptual:** La 'ventana 2x2' es un rango de índices espaciales, **no una matriz de pesos ni variables aleatorias**.
  * **Submuestreo con paso 2:** La salida $(i, j)$ evalúa el bloque $\{ (2i, 2j), (2i, 2j+1), (2i+1, 2j), (2i+1, 2j+1) \}$.
  * **Directiva:** `#pragma acc parallel loop collapse(2)` que genera $2\,401$ hilos para la matriz final $49 \times 49$.
* **Notas del Orador:**
  > "Es vital realizar una precisión conceptual: en la literatura informal a veces se grafica la ventana de pooling como si fuera una matriz con pesos que deba inicializarse. En realidad, MaxPooling es un operador de reducción espacial sin parámetros entrenables ni almacenamiento en memoria. Simplemente define un marco de lectura 2 por 2 con paso 2. El hilo correspondiente a la posición de salida (i, j) lee directamente las 4 coordenadas en la matriz ReLU y selecciona el valor supremo, generando la matriz compacta de 49 por 49 elementos."

---

### Diapositiva 6: Estrategia de Datos en OpenACC (`#pragma acc data`)
* **Título:** Estrategia de Gestión de Memoria en GPU
* **Viñetas:**
  * **`copyin(img, kernel)`:** Envío de imagen y filtro a VRAM una sola vez al inicio.
  * **`create(conv, relu)`:** Asignación de buffers intermedios en GPU con **cero tráfico PCIe**.
  * **`copyout(pool)`:** Retorno del resultado final a la CPU únicamente al culminar las $N$ iteraciones.
* **Notas del Orador:**
  > "El mayor cuello de botella en cómputo con aceleradores es el bus PCIe. Si hubiésemos transferido los arreglos en cada iteración, el programa sería más lento que la versión secuencial en CPU. Gracias a la directiva estructurada '#pragma acc data', la imagen y el kernel se envían una sola vez al inicio con 'copyin'. Los buffers de convolución y ReLU se alojan directamente en la GPU con la cláusula 'create', eliminando cualquier transferencia intermedia. Y con 'copyout', sólo el arreglo resultante de 49 por 49 floats viaja de regreso a la CPU al terminar la ráfaga de 1,000 repeticiones."

---

### Diapositiva 7: Resultados Experimentales y Ley de Amdahl
* **Título:** Resultados de Rendimiento y Análisis de Speedup
* **Viñetas:**
  * **Aceleración Obtenida:** Speedup de cómputo neto $\approx 15.4\times$ y Speedup total de sistema $\approx 13.1\times$.
  * **Amortización:** El bucle de $N = 1\,000$ reduce el impacto del overhead PCIe al $15\%$ del tiempo total.
  * **Ley de Amdahl:** Matrices de $100 \times 100$ tienen baja intensidad aritmética; el Speedup crece exponencialmente con matrices más grandes ($1024 \times 1024$).
* **Notas del Orador:**
  > "En nuestras pruebas comparativas, la versión secuencial en CPU requirió 32.46 milisegundos para completar las mil iteraciones, mientras que la GPU completó el cómputo puro en apenas 2.10 milisegundos, arrojando un Speedup de cómputo de 15.4x y un Speedup total de 13.1x considerando transferencias. La ley de Amdahl nos explica por qué una matriz relativamente pequeña de 100 por 100 no satura completamente una GPU moderna: la latencia de lanzamiento de kernels y el bus PCIe imponen un costo fijo que se mitiga justamente gracias a la ejecución iterativa de la tubería."

---

### Diapositiva 8: Conclusiones y Trabajo Futuro
* **Título:** Conclusiones y Próximos Pasos
* **Viñetas:**
  * **Conclusión:** OpenACC permite aceleraciones de orden superior a $10\times$ con un número mínimo de directivas no invasivas.
  * **Lección Clave:** La gestión explícita de datos (`acc data create`) es tan crítica como la paralelización de los bucles de cálculo.
  * **Trabajo Futuro:** Fusión de kernels (combinar Conv + ReLU en un solo paso) y extensión a múltiples canales convolucionales (RGB / tensores 4D).
* **Notas del Orador:**
  > "Como conclusión principal, OpenACC demuestra ser un paradigma sumamente eficaz: con apenas tres directivas 'parallel loop collapse(2)' y una directiva estructurada 'data', transformamos un código puramente secuencial en una tubería acelerada en GPU que es 13 veces más rápida y numéricamente idéntica a la línea base. Como trabajo futuro, podríamos explorar la técnica de fusión de kernels para calcular ReLU inmediatamente después de acumular la convolución en registros, evitando escrituras intermedias a memoria global, y extender la arquitectura a tensores multicanal típicos de arquitecturas como ResNet o VGG. Muchas gracias; quedo atento a sus preguntas."
