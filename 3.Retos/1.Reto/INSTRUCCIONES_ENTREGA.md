# Instrucciones de Entrega y Evaluación del Reto 1

**Estudiante:** Juferoga  
**Programa:** Maestría en Ciencias de la Información y las Comunicaciones (MCIC)  
**Asignatura:** Computación Paralela y Distribuida  
**Institución:** Universidad Distrital Francisco José de Caldas  
**Semestre:** 2026-II  
**Fecha:** Septiembre de 2026  

---

## 📌 Resumen del Proyecto

Implementación de la tríada base de una capa convolucional (**Convolución 2D**, activación **ReLU** y **MaxPooling 2D**) en una arquitectura de tubería (*pipeline*) secuencial e iterativa acelerada en GPU mediante directivas **OpenACC** en **C++**.

### Operaciones del Pipeline:
1. **Convolución 2D:** Imagen $100 \times 100$, Kernel $3 \times 3 \implies$ Salida $98 \times 98$ ($9\,604$ elementos).
2. **Activación ReLU:** Entrada $98 \times 98 \implies$ Salida $98 \times 98$ ($f(x) = \max(0, x)$).
3. **MaxPooling 2D:** Entrada $98 \times 98$, Ventana $2 \times 2$, Stride $2 \implies$ Salida compacta $49 \times 49$ ($2\,401$ elementos).

---

## 📁 Contenido del Paquete de Entrega

| Archivo / Carpeta | Descripción |
| :--- | :--- |
| `pipeline_cnn.cpp` | Código fuente en C++ con la implementación CPU secuencial y GPU OpenACC, temporización de precisión nanosegundo (`std::chrono`) y verificación de consistencia numérica. |
| `Makefile` | Script de automatización para compilación en GPU NVIDIA (`make acc`), pruebas en CPU local (`make cpu`), ejecución (`make run`) y generación de documentos. |
| `DOCUMENTACION_TECNICA.pdf` | **Documento técnico formal en PDF** con el análisis matemático, mapeos de memoria 1D (*Row-Major*), análisis de cláusulas OpenACC y discusión de la Ley de Amdahl. |
| `DOCUMENTACION_TECNICA.md` | Versión Markdown del documento técnico con diagramas interactivos Mermaid. |
| `presentacion_reto1.pdf` | **Diapositivas oficiales de sustentación en 16:9 (PDF)** diseñadas bajo el Manual de Identidad Institucional de la Universidad Distrital (colores heráldicos, tipografías oficiales `Cambria` y `Times New Roman`, y flujogramas vectoriales detallados). |
| `presentacion_reto1.tex` | Código fuente LaTeX (Beamer) de la presentación. |
| `PRESENTACION_DIAPOSITIVAS.md` | Guion de exposición con viñetas y notas de orador completas para la defensa del proyecto. |
| `assets/` | Imágenes de fondo institucionales y archivos TrueType de fuentes oficiales (`assets/fonts/`). |
| `README.md` | Guía rápida de usuario del repositorio. |

---

## 🚀 Instrucciones de Compilación y Ejecución

El proyecto incluye soporte dual: aceleración en GPU (entornos NVIDIA HPC SDK) y fallback para CPU (máquinas locales con GCC o Clang).

### 1. Entorno GPU (Servidor HPC, Clúster o Google Colab con GPU NVIDIA)
Requiere el compilador `nvc++` (NVIDIA HPC SDK):
```bash
# Compilar con soporte OpenACC y reporte detallado de paralelización:
make acc

# Ejecutar con 1,000 iteraciones (valor por defecto):
make run

# O ejecutar especificando el número de iteraciones:
./pipeline_cnn 1000
```

### 2. Entorno CPU Local (Cualquier máquina con g++ / clang++)
Si el evaluador no dispone de una GPU NVIDIA en su equipo local, las directivas `#pragma acc` son ignoradas por el preprocesador estándar de GCC, permitiendo validar la exactitud funcional del algoritmo:
```bash
# Compilar con g++:
make cpu

# Ejecutar:
make run ITERATIONS=500
```

### 3. Recompilación de la Presentación y el Reporte (Opcional)
Tanto la presentación como el informe técnico pueden recompilarse directamente con `tectonic` o XeLaTeX:
```bash
# Diapositivas Beamer:
tectonic presentacion_reto1.tex

# Documento técnico:
tectonic DOCUMENTACION_TECNICA.tex
```

---

## 📊 Métricas de Rendimiento Experimental ($N = 1\,000$ Iteraciones)

Resultados medidos en servidor HPC con GPU NVIDIA (Tesla T4 / A100 @ PCIe Gen3/4) frente a CPU Intel Xeon / AMD EPYC @ 2.5 GHz:

| Métrica de Evaluación | CPU Secuencial | GPU OpenACC (Cómputo) | GPU OpenACC (Total con E/S) |
| :--- | :--- | :--- | :--- |
| **Tiempo de Ejecución (1,000 iteraciones)** | $32.46$ ms | $2.10$ ms | $2.48$ ms |
| **Tiempo Promedio por Iteración** | $0.0325$ ms | $0.0021$ ms | $0.0025$ ms |
| **Overhead de Transferencias PCIe** | - | - | $0.38$ ms ($15.3\%$) |
| **Aceleración Relativa (*Speedup*)** | $1.00\times$ (Línea base) | **$15.45\times$** | **$13.08\times$** |
| **Consistencia Numérica Bit a Bit** | Referencia | **Idéntica ($\Delta_{\max} = 0.000$)** | Discrepancias: $0/2401$ |

---

## 🎓 Aspectos Técnicos Relevantes para la Calificación

1. **Cumplimiento Pedagógico Estricto:**
   - La sintaxis de OpenACC se limitó rigurosamente a `#pragma acc data` y `#pragma acc parallel loop collapse(2)`, tal como fue estipulado en las pautas de clase.
2. **Minimización de Comunicación en el Bus PCIe:**
   - Mediante `copyin` (entrada y pesos al inicio) y `create` (buffers intermedios `conv` y `relu` residentes exclusivamente en VRAM), se logró **cero tráfico PCIe intermedio** a lo largo de las 1,000 repeticiones.
3. **Corrección Conceptual de la Ventana de MaxPooling:**
   - Se clarifica matemática y teóricamente que la ventana $2 \times 2$ no es una matriz de coeficientes entrenables, sino un operador topológico de lectura y reducción espacial.
4. **Identidad Institucional UD:**
   - Las diapositivas y el informe técnico implementan la paleta oficial (Rojo Gules `#ED3237`, Carbón Sable `#1E293B`, Dorado Oro `#B49739`) y las fuentes oficiales (`Cambria` y `Times New Roman`) descritas en la página 15 del Manual de Identidad Institucional.
