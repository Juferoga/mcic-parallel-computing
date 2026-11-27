# 👻  **COMPUTACIÓN PARALELA**

<p align="right">
	<img src="https://www.udistrital.edu.co/themes/custom/versh/images/default/preloader.png" width="128" height="128" alt="UDistrital" />
</p>

[![Autor: Juferoga](https://img.shields.io/badge/Autor-Juferoga-0a66c2?style=flat-square)](https://github.com/Juferoga) [![License: GPL2](https://img.shields.io/badge/License-GPL2-blue?style=flat-square)](LICENSE)

Repositorio de la asignatura *Computación Paralela* (Maestría). Aquí se conservan los talleres, retos y el proyecto final desarrollados durante el semestre.

**Contenido rápido**

- **Estado:** En curso — semestre 2026-3
- **Autor:** Juan Felipe Rodríguez Galindo (Juferoga)
- **Docente:** Nelson Enrique Vera Parra
- **Licencia:** GPL2 — ver archivo `LICENSE`

**Tabla de contenidos**

- Avance
- Estructura del repositorio
- Licencia

## Avance

| Entrega | Tema | Carpeta |
|---|---|---|
| Taller Dask | Brecha digital en Colombia: procesamiento distribuido con Dask sobre datasets de Datos Abiertos Colombia | [`2.Talleres/1.Taller_Dask/`](2.Talleres/1.Taller_Dask/) |
| Reto 1 | Tubería CNN (convolución 2D + ReLU + MaxPooling) acelerada en GPU con OpenACC; speedup medido frente a CPU, documentación técnica y presentación Beamer | [`3.Retos/1.Reto/`](3.Retos/1.Reto/) |
| Reto 2 | Pipeline NLP en GPU con CUDA + Numba (tokenización, BoW, TF-IDF, bigramas, sentimiento) sobre un corpus real de 6 libros en español (~60k documentos, 1,2 M palabras); validación completa contra CPU y medición de speedup | [`3.Retos/2.Reto/`](3.Retos/2.Reto/) |
| Proyecto final (v1) | Analítica de 14 días del GTFS-Realtime de TransMilenio con Ray; presentación interactiva y evaluación de calidad de los datos | [`4.ProyectoFinal/`](4.ProyectoFinal/) |
| Proyecto final 4.1 | Dónde pierden tiempo los buses de Bogotá: atlas de velocidad y retraso por tramo, tiempo de viaje confiable entre paradas y brecha de accesibilidad al empleo, con Ray sobre 80,9 M posiciones; presentación en `/4.1/` | [`4.1.ProyectoFinal/`](4.1.ProyectoFinal/) |

Detalle del Reto 1 (compilación, ejecución y resultados): [`3.Retos/1.Reto/README.md`](3.Retos/1.Reto/README.md).

## Estructura del repositorio

- `0.Bibliografia/` — Material de referencia y recursos bibliográficos.
- `1.Tareas/` — Entregas formales por actividad.
- `2.Talleres/` — Ejercicios prácticos y pequeñas aplicaciones.
- `3.Retos/` — Retos de corte propuestos por el docente.
- `4.ProyectoFinal/` — Código y documentación del proyecto final.
- `README.md` — Este archivo.
- `LICENSE` — Licencia del repositorio.

Los paquetes de entrega (`*.zip`) y el binario compilado no se versionan: se regeneran con el `Makefile` de cada reto.

**Contacto**

- Juan Felipe Rodríguez Galindo — https://github.com/Juferoga

**Licencia**

Este repositorio está bajo la licencia GPL V2. Consulta el archivo `LICENSE` para más detalles.
