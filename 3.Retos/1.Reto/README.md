# Reto 1: Tubería CNN (Convolución + ReLU + MaxPooling) en OpenACC

**Programa:** Maestría en Ciencias de la Información y las Comunicaciones (MCIC)  
**Asignatura:** Computación Paralela y Distribuida  
**Institución:** Universidad Distrital Francisco José de Caldas  
**Autor:** Juferoga  

---

## 📌 Descripción General
Implementación acelerada en GPU mediante **OpenACC** de las tres operaciones cardinales de una capa convolucional en modo **tubería secuencial e iterativa**:
1. **Convolución 2D:** Imagen $100 \times 100$, Kernel $3 \times 3 \rightarrow$ Salida $98 \times 98$.
2. **Activación ReLU:** Entrada $98 \times 98 \rightarrow$ Salida $98 \times 98$ ($f(x) = \max(0, x)$).
3. **MaxPooling 2D:** Entrada $98 \times 98$, Ventana $2 \times 2$, Stride $2 \rightarrow$ Salida $49 \times 49$.

El pipeline se ejecuta de forma iterativa ($N = 1\,000$ repeticiones) para amortizar la latencia fija del bus PCIe y medir el **Speedup** frente a una versión secuencial pura en CPU.

---

## 📁 Estructura del Entregable

* 📄 **[pipeline_cnn.cpp](pipeline_cnn.cpp):** Código fuente C++ con OpenACC, medición con `std::chrono`, validación numérica CPU vs GPU y cálculo de métricas de aceleración.
* 📄 **[DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md):** Reporte técnico formal que cubre:
  - Portada y formulación del problema.
  - Corrección conceptual de la ventana de MaxPooling.
  - Mapeo bidimensional a memoria contigua 1D (*Row-Major*).
  - Análisis detallado de directivas OpenACC (`#pragma acc data`, `#pragma acc parallel loop collapse(2)`).
  - Reporte `-Minfo=accel`, resultados empíricos y análisis con la Ley de Amdahl.
* 📊 **[presentacion_reto1.pdf](presentacion_reto1.pdf)** / **[presentacion_reto1.tex](presentacion_reto1.tex):** Presentación oficial en Beamer 16:9 con la identidad visual institucional de la Universidad Distrital (portada, diapositivas de contenido respetando la franja roja y cierre institucional).
* 📄 **[PRESENTACION_DIAPOSITIVAS.md](PRESENTACION_DIAPOSITIVAS.md):** Guion de diapositivas con viñetas y notas de orador completas para sustentación oral.
* 📄 **[Makefile](Makefile):** Automatización de compilación de código OpenACC (`make acc`), pruebas en CPU (`make cpu`) y generación de diapositivas en PDF (`make slides`).
* 📁 **[presentacion-template-inicial (falla)](presentacion-template-inicial%20%28falla%29/):** Carpeta con la plantilla base corregida para compilar con `tectonic` / XeLaTeX / LuaLaTeX.

---

## 🚀 Compilación y Ejecución

### 1. Compilación del Código C++ / OpenACC
```bash
# En servidor HPC / GPU NVIDIA:
make acc
make run ITERATIONS=1000

# En máquina local CPU (fallback con g++):
make cpu
make run ITERATIONS=500
```

### 2. Generación de las Diapositivas (PDF)
```bash
# Compilar las diapositivas Beamer institucionales:
make slides
# O directamente:
tectonic presentacion_reto1.tex
```

---

## 📊 Resumen de Rendimiento Experimental

| Métrica | CPU Secuencial | GPU OpenACC (Cómputo) | GPU OpenACC (Total con E/S) |
| :--- | :--- | :--- | :--- |
| **Tiempo (1,000 iter)** | $32.46$ ms | $2.10$ ms | $2.48$ ms |
| **Tiempo por iteración** | $0.0325$ ms | $0.0021$ ms | $0.0025$ ms |
| **Speedup Relativo** | $1.00\times$ (Línea base) | **$15.45\times$** | **$13.08\times$** |
| **Consistencia Numérica** | - | Idéntica ($\Delta_{\max} = 0.000$) | - |
