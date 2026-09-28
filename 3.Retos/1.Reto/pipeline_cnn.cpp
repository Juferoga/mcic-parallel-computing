/**
 * ============================================================================
 * Proyecto: Tubería CNN (Convolución + ReLU + MaxPooling) en OpenACC
 * Asignatura: Computación Paralela y Distribuida
 * Maestría en Ciencias de la Información y las Comunicaciones (MCIC)
 * Universidad Distrital Francisco José de Caldas
 * ============================================================================
 * 
 * Descripción:
 * Implementación de las tres operaciones base de una capa convolucional en modo
 * tubería (pipeline) secuencial e iterativo acelerado en GPU con OpenACC:
 *   1. Convolución 2D (Imagen 100x100, Kernel 3x3 -> Salida 98x98)
 *   2. Activación ReLU (Entrada 98x98 -> Salida 98x98)
 *   3. MaxPooling 2D (Entrada 98x98, Ventana 2x2, Stride 2 -> Salida 49x49)
 * ============================================================================
 */

#include <iostream>
#include <iomanip>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <cstring>

// ============================================================================
// 1. CONSTANTES Y DIMENSIONES DEL PROBLEMA
// ============================================================================
// Imagen de Entrada: 100x100 = 10,000 elementos
constexpr int IMG_W = 100;
constexpr int IMG_H = 100;
constexpr int IMG_SIZE = IMG_W * IMG_H;

// Filtro / Kernel Convolucional: 3x3 = 9 elementos
constexpr int KERNEL_W = 3;
constexpr int KERNEL_H = 3;
constexpr int KERNEL_SIZE = KERNEL_W * KERNEL_H;

// Salida de Convolución válida (sin padding, stride 1):
// (100 - 3 + 1) x (100 - 3 + 1) = 98x98 = 9,604 elementos
constexpr int CONV_W = IMG_W - KERNEL_W + 1; // 98
constexpr int CONV_H = IMG_H - KERNEL_H + 1; // 98
constexpr int CONV_SIZE = CONV_W * CONV_H;

// Salida de Activación ReLU: idéntica a Convolución (98x98 = 9,604 elementos)
constexpr int RELU_W = CONV_W; // 98
constexpr int RELU_H = CONV_H; // 98
constexpr int RELU_SIZE = RELU_W * RELU_H;

// Salida de MaxPooling (ventana 2x2, stride 2):
// (98 / 2) x (98 / 2) = 49x49 = 2,401 elementos
constexpr int POOL_W = RELU_W / 2; // 49
constexpr int POOL_H = RELU_H / 2; // 49
constexpr int POOL_SIZE = POOL_W * POOL_H;

// Número de iteraciones por defecto para amortizar overheads de GPU
constexpr int DEFAULT_ITERATIONS = 1000;

// ============================================================================
// 2. FUNCIONES AUXILIARES: INICIALIZACIÓN Y VERIFICACIÓN
// ============================================================================

/**
 * Inicializa la imagen y el kernel con valores deterministas.
 * Se generan valores positivos y negativos en el rango [-1.0, 1.0] para que la
 * función de activación ReLU cumpla su propósito de truncar valores negativos.
 */
void inicializar_datos(float* img, float* kernel) {
    // Inicialización de la imagen con gradiente normalizado en [-1.0, 1.0]
    for (int i = 0; i < IMG_H; ++i) {
        for (int j = 0; j < IMG_W; ++j) {
            float val = std::sin(static_cast<float>(i * 0.15f)) * 
                        std::cos(static_cast<float>(j * 0.15f));
            img[i * IMG_W + j] = val;
        }
    }

    // Kernel Laplaciano modificado (detección de bordes 3x3)
    // Permite generar respuestas tanto positivas como negativas
    const float k_template[9] = {
        -1.0f, -1.0f, -1.0f,
        -1.0f,  8.0f, -1.0f,
        -1.0f, -1.0f, -1.0f
    };
    for (int k = 0; k < KERNEL_SIZE; ++k) {
        kernel[k] = k_template[k];
    }
}

/**
 * Verifica la consistencia numérica entre los resultados de CPU y GPU.
 * Compara los arreglos de salida de MaxPooling elemento por elemento.
 */
bool verificar_resultados(const float* cpu_res, const float* gpu_res, int total_elementos, float tolerancia = 1e-4f) {
    float max_diff = 0.0f;
    int discrepancias = 0;

    for (int i = 0; i < total_elementos; ++i) {
        float diff = std::fabs(cpu_res[i] - gpu_res[i]);
        if (diff > max_diff) {
            max_diff = diff;
        }
        if (diff > tolerancia) {
            discrepancias++;
        }
    }

    std::cout << "\n------------------------------------------------------------\n";
    std::cout << "[VERIFICACIÓN NUMÉRICA CPU vs GPU]\n";
    std::cout << "  - Tolerancia de error: " << tolerancia << "\n";
    std::cout << "  - Máxima diferencia absoluta: " << max_diff << "\n";
    std::cout << "  - Elementos con discrepancia: " << discrepancias << " / " << total_elementos << "\n";

    if (discrepancias == 0) {
        std::cout << "  - Estado: [CORRECTO] Los resultados son idénticos dentro de la tolerancia.\n";
        std::cout << "------------------------------------------------------------\n";
        return true;
    } else {
        std::cout << "  - Estado: [FALLO] Discrepancia numérica superior a la tolerancia permitida.\n";
        std::cout << "------------------------------------------------------------\n";
        return false;
    }
}

// ============================================================================
// 3. IMPLEMENTACIÓN SECUENCIAL PURA EN CPU (LÍNEA BASE)
// ============================================================================

/**
 * Ejecuta la tubería CNN completa en CPU de forma secuencial.
 * 
 * Flujo de operaciones por iteración:
 *   1. Convolución 2D: img (100x100) + kernel (3x3) -> conv (98x98)
 *   2. Activación ReLU: conv (98x98) -> relu (98x98)
 *   3. MaxPooling 2D: relu (98x98) con ventana 2x2 stride 2 -> pool (49x49)
 */
void pipeline_cpu(const float* img, const float* kernel,
                  float* conv, float* relu, float* pool,
                  int iteraciones) {
    for (int it = 0; it < iteraciones; ++it) {
        // ETAPA 1: Convolución 2D (98x98)
        for (int i = 0; i < CONV_H; ++i) {
            for (int j = 0; j < CONV_W; ++j) {
                float sum = 0.0f;
                for (int ki = 0; ki < KERNEL_H; ++ki) {
                    for (int kj = 0; kj < KERNEL_W; ++kj) {
                        sum += img[(i + ki) * IMG_W + (j + kj)] * kernel[ki * KERNEL_W + kj];
                    }
                }
                conv[i * CONV_W + j] = sum;
            }
        }

        // ETAPA 2: Activación ReLU (98x98)
        for (int i = 0; i < RELU_H; ++i) {
            for (int j = 0; j < RELU_W; ++j) {
                float val = conv[i * RELU_W + j];
                relu[i * RELU_W + j] = (val > 0.0f) ? val : 0.0f;
            }
        }

        // ETAPA 3: MaxPooling 2D (49x49)
        // La ventana de pooling es una región espacial de lectura 2x2 con paso 2
        for (int i = 0; i < POOL_H; ++i) {
            for (int j = 0; j < POOL_W; ++j) {
                int r00 = (2 * i) * RELU_W + (2 * j);
                int r01 = (2 * i) * RELU_W + (2 * j + 1);
                int r10 = (2 * i + 1) * RELU_W + (2 * j);
                int r11 = (2 * i + 1) * RELU_W + (2 * j + 1);

                float m0 = (relu[r00] > relu[r01]) ? relu[r00] : relu[r01];
                float m1 = (relu[r10] > relu[r11]) ? relu[r10] : relu[r11];
                pool[i * POOL_W + j] = (m0 > m1) ? m0 : m1;
            }
        }
    }
}

// ============================================================================
// 4. IMPLEMENTACIÓN ACELERADA EN GPU MEDIANTE OPENACC
// ============================================================================

/**
 * Ejecuta la tubería CNN en GPU utilizando directivas OpenACC.
 * 
 * Directivas OpenACC aplicadas:
 *   - #pragma acc data: Delimita el ciclo de vida de los datos en la memoria del
 *     dispositivo (VRAM). Minimiza las transferencias Host <-> Device al mantener
 *     las matrices intermedias (conv, relu) en GPU a lo largo de las N iteraciones.
 *   - #pragma acc parallel loop collapse(2): Aplana la topología bidimensional de
 *     las etapas (i, j) en una malla 1D masiva de hilos para maximizar la ocupación
 *     de los Streaming Multiprocessors (SMs) de la GPU.
 * 
 * @param img Matriz de entrada 100x100 (Host)
 * @param kernel Filtro convolucional 3x3 (Host)
 * @param conv Buffer intermedio de convolución 98x98
 * @param relu Buffer intermedio de activación 98x98
 * @param pool Matriz de salida final 49x49 (Host)
 * @param iteraciones Número de repeticiones del pipeline
 * @param out_t_kernel Variable de salida para el tiempo neto de cómputo GPU (ms)
 * @param out_t_total Variable de salida para el tiempo total GPU con transferencias (ms)
 */
void pipeline_gpu_openacc(const float* img, const float* kernel,
                          float* conv, float* relu, float* pool,
                          int iteraciones,
                          double& out_t_kernel, double& out_t_total) {

    // Inicio de medición de tiempo total GPU (incluye transferencias Host -> Device)
    auto t_total_start = std::chrono::high_resolution_clock::now();

    // Región de datos estructurada OpenACC:
    //   copyin: Transfiere img y kernel del Host al Device al entrar a la región.
    //   create: Asigna espacio en VRAM para conv y relu sin transferencias de datos.
    //   copyout: Transfiere pool del Device al Host al salir de la región.
    #pragma acc data copyin(img[0:IMG_SIZE], kernel[0:KERNEL_SIZE]) \
                     create(conv[0:CONV_SIZE], relu[0:RELU_SIZE]) \
                     copyout(pool[0:POOL_SIZE])
    {
        // Inicio de medición de tiempo neto de cómputo en GPU
        auto t_kernel_start = std::chrono::high_resolution_clock::now();

        // Bucle exterior de iteraciones para ráfagas continuas de procesamiento
        for (int it = 0; it < iteraciones; ++it) {

            // ETAPA 1: Convolución 2D en GPU
            // collapse(2) fusiona los bucles i y j en 98x98 = 9,604 hilos paralelos
            #pragma acc parallel loop collapse(2)
            for (int i = 0; i < CONV_H; ++i) {
                for (int j = 0; j < CONV_W; ++j) {
                    float sum = 0.0f;
                    for (int ki = 0; ki < KERNEL_H; ++ki) {
                        for (int kj = 0; kj < KERNEL_W; ++kj) {
                            sum += img[(i + ki) * IMG_W + (j + kj)] * kernel[ki * KERNEL_W + kj];
                        }
                    }
                    conv[i * CONV_W + j] = sum;
                }
            }

            // ETAPA 2: Activación ReLU en GPU
            // collapse(2) distribuye los 9,604 elementos entre los núcleos de la GPU
            #pragma acc parallel loop collapse(2)
            for (int i = 0; i < RELU_H; ++i) {
                for (int j = 0; j < RELU_W; ++j) {
                    float val = conv[i * RELU_W + j];
                    relu[i * RELU_W + j] = (val > 0.0f) ? val : 0.0f;
                }
            }

            // ETAPA 3: MaxPooling 2D en GPU
            // collapse(2) colapsa 49x49 = 2,401 ventanas de reducción espacial
            #pragma acc parallel loop collapse(2)
            for (int i = 0; i < POOL_H; ++i) {
                for (int j = 0; j < POOL_W; ++j) {
                    int r00 = (2 * i) * RELU_W + (2 * j);
                    int r01 = (2 * i) * RELU_W + (2 * j + 1);
                    int r10 = (2 * i + 1) * RELU_W + (2 * j);
                    int r11 = (2 * i + 1) * RELU_W + (2 * j + 1);

                    float m0 = (relu[r00] > relu[r01]) ? relu[r00] : relu[r01];
                    float m1 = (relu[r10] > relu[r11]) ? relu[r10] : relu[r11];
                    pool[i * POOL_W + j] = (m0 > m1) ? m0 : m1;
                }
            }
        }

        // Fin de medición de tiempo neto de cómputo en GPU
        auto t_kernel_end = std::chrono::high_resolution_clock::now();
        out_t_kernel = std::chrono::duration<double, std::milli>(t_kernel_end - t_kernel_start).count();
    } // Fin de #pragma acc data: aquí se ejecuta la transferencia Device -> Host de 'pool'

    // Fin de medición de tiempo total GPU
    auto t_total_end = std::chrono::high_resolution_clock::now();
    out_t_total = std::chrono::duration<double, std::milli>(t_total_end - t_total_start).count();
}

// ============================================================================
// 5. FUNCIÓN PRINCIPAL Y GENERACIÓN DE REPORTES DE RENDIMIENTO
// ============================================================================
int main(int argc, char* argv[]) {
    int num_iteraciones = DEFAULT_ITERATIONS;
    if (argc > 1) {
        num_iteraciones = std::atoi(argv[1]);
        if (num_iteraciones <= 0) {
            std::cerr << "Iteraciones invalidas. Usando valor por defecto: " << DEFAULT_ITERATIONS << "\n";
            num_iteraciones = DEFAULT_ITERATIONS;
        }
    }

    std::cout << "============================================================\n";
    std::cout << "  RETO 1: TUBERIA CNN EN OPENACC (CONV + RELU + MAXPOOLING)\n";
    std::cout << "============================================================\n";
    std::cout << "  Dimensiones:\n";
    std::cout << "    - Imagen de Entrada:  " << IMG_W << "x" << IMG_H << " (" << IMG_SIZE << " elementos)\n";
    std::cout << "    - Kernel Convolucion: " << KERNEL_W << "x" << KERNEL_H << " (" << KERNEL_SIZE << " elementos)\n";
    std::cout << "    - Salida Convolucion: " << CONV_W << "x" << CONV_H << " (" << CONV_SIZE << " elementos)\n";
    std::cout << "    - Salida ReLU:        " << RELU_W << "x" << RELU_H << " (" << RELU_SIZE << " elementos)\n";
    std::cout << "    - Salida MaxPooling:  " << POOL_W << "x" << POOL_H << " (" << POOL_SIZE << " elementos)\n";
    std::cout << "  Iteraciones de Pipeline: " << num_iteraciones << "\n";
    std::cout << "============================================================\n";

    // Asignación de memoria dinámica continua según restricciones de clase
    float* img         = new float[IMG_SIZE];
    float* kernel      = new float[KERNEL_SIZE];
    float* conv_cpu    = new float[CONV_SIZE];
    float* relu_cpu    = new float[RELU_SIZE];
    float* pool_cpu    = new float[POOL_SIZE];

    float* conv_gpu    = new float[CONV_SIZE];
    float* relu_gpu    = new float[RELU_SIZE];
    float* pool_gpu    = new float[POOL_SIZE];

    // Inicialización de datos
    inicializar_datos(img, kernel);
    std::memset(pool_cpu, 0, POOL_SIZE * sizeof(float));
    std::memset(pool_gpu, 0, POOL_SIZE * sizeof(float));

    // ------------------------------------------------------------------------
    // Ejecución Secuencial CPU
    // ------------------------------------------------------------------------
    std::cout << "\n[1/2] Ejecutando version secuencial en CPU (" << num_iteraciones << " iteraciones)...\n";
    auto t_cpu_start = std::chrono::high_resolution_clock::now();
    pipeline_cpu(img, kernel, conv_cpu, relu_cpu, pool_cpu, num_iteraciones);
    auto t_cpu_end = std::chrono::high_resolution_clock::now();
    double t_cpu = std::chrono::duration<double, std::milli>(t_cpu_end - t_cpu_start).count();
    std::cout << "      -> Tiempo CPU finalizado: " << std::fixed << std::setprecision(3) << t_cpu << " ms\n";

    // ------------------------------------------------------------------------
    // Ejecución Acelerada en GPU (OpenACC)
    // ------------------------------------------------------------------------
    std::cout << "\n[2/2] Ejecutando version acelerada OpenACC en GPU (" << num_iteraciones << " iteraciones)...\n";
    double t_gpu_kernel = 0.0;
    double t_gpu_total = 0.0;
    pipeline_gpu_openacc(img, kernel, conv_gpu, relu_gpu, pool_gpu, num_iteraciones, t_gpu_kernel, t_gpu_total);
    std::cout << "      -> Tiempo GPU (Kernel): " << std::fixed << std::setprecision(3) << t_gpu_kernel << " ms\n";
    std::cout << "      -> Tiempo GPU (Total):  " << std::fixed << std::setprecision(3) << t_gpu_total << " ms\n";

    // ------------------------------------------------------------------------
    // Verificación de Resultados
    // ------------------------------------------------------------------------
    verificar_resultados(pool_cpu, pool_gpu, POOL_SIZE);

    // ------------------------------------------------------------------------
    // Cálculo de Métricas y Speedups
    // ------------------------------------------------------------------------
    double speedup_total   = (t_gpu_total > 0.0)  ? (t_cpu / t_gpu_total)  : 0.0;
    double speedup_computo = (t_gpu_kernel > 0.0) ? (t_cpu / t_gpu_kernel) : 0.0;
    double t_transferencia = t_gpu_total - t_gpu_kernel;
    double pct_transfer    = (t_gpu_total > 0.0)  ? (t_transferencia / t_gpu_total) * 100.0 : 0.0;

    std::cout << "\n============================================================\n";
    std::cout << "                 TABLA RESUMEN DE RENDIMIENTO               \n";
    std::cout << "============================================================\n";
    std::cout << std::left << std::setw(38) << "  Metrica" 
              << std::right << std::setw(20) << "Valor" << "\n";
    std::cout << "------------------------------------------------------------\n";
    std::cout << std::left << std::setw(38) << "  Tiempo CPU Secuencial (T_CPU)" 
              << std::right << std::setw(16) << std::fixed << std::setprecision(3) << t_cpu << " ms\n";
    std::cout << std::left << std::setw(38) << "  Tiempo GPU Neto Kernel (T_GPU_Kernel)" 
              << std::right << std::setw(16) << std::fixed << std::setprecision(3) << t_gpu_kernel << " ms\n";
    std::cout << std::left << std::setw(38) << "  Tiempo GPU Total con E/S (T_GPU_Total)" 
              << std::right << std::setw(16) << std::fixed << std::setprecision(3) << t_gpu_total << " ms\n";
    std::cout << std::left << std::setw(38) << "  Overhead Transferencias PCIe" 
              << std::right << std::setw(16) << std::fixed << std::setprecision(3) << t_transferencia << " ms (" 
              << std::setprecision(1) << pct_transfer << "%)\n";
    std::cout << "------------------------------------------------------------\n";
    std::cout << std::left << std::setw(38) << "  Speedup Computo (T_CPU / T_Kernel)" 
              << std::right << std::setw(17) << std::fixed << std::setprecision(2) << speedup_computo << "x\n";
    std::cout << std::left << std::setw(38) << "  Speedup Total   (T_CPU / T_Total)" 
              << std::right << std::setw(17) << std::fixed << std::setprecision(2) << speedup_total << "x\n";
    std::cout << "============================================================\n";
    std::cout << "  Tiempo promedio por iteracion en CPU: " 
              << std::setprecision(4) << (t_cpu / num_iteraciones) << " ms\n";
    std::cout << "  Tiempo promedio por iteracion en GPU: " 
              << std::setprecision(4) << (t_gpu_kernel / num_iteraciones) << " ms\n";
    std::cout << "============================================================\n\n";

    // Liberación de memoria dinámica
    delete[] img;
    delete[] kernel;
    delete[] conv_cpu;
    delete[] relu_cpu;
    delete[] pool_cpu;
    delete[] conv_gpu;
    delete[] relu_gpu;
    delete[] pool_gpu;

    return 0;
}
