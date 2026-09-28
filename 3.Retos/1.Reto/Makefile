# ==============================================================================
# Makefile - Tubería CNN en OpenACC (Reto 1)
# Maestría en Ciencias de la Información y las Comunicaciones - UD
# ==============================================================================

# Compilador NVIDIA HPC SDK
NVCC = nvc++
NVFLAGS = -acc -Minfo=accel -O2

# Compilador CPU estándar (Fallback para validación en entornos sin GPU NVIDIA)
CXX = g++
CXXFLAGS = -O2 -Wall -Wno-unknown-pragmas

TARGET = pipeline_cnn
SRC = pipeline_cnn.cpp
ITERATIONS ?= 1000

.PHONY: all acc cpu clean run run-colab help slides

# Objetivo por defecto: Compilación con OpenACC mediante NVIDIA HPC SDK
all: acc

slides: presentacion_reto1.tex
	@echo "Compilando presentación Beamer con Tectonic..."
	tectonic presentacion_reto1.tex
	@echo "Presentación generada exitosamente: presentacion_reto1.pdf"

acc: $(SRC)
	@echo "Compilando con NVIDIA HPC SDK (OpenACC activado)..."
	$(NVCC) $(NVFLAGS) $(SRC) -o $(TARGET)
	@echo "Compilación exitosa: $(TARGET)"

# Compilación CPU alternativa para pruebas locales donde no hay NVIDIA HPC SDK
cpu: $(SRC)
	@echo "Compilando versión CPU con g++ (Pragmas OpenACC ignorados)..."
	$(CXX) $(CXXFLAGS) $(SRC) -o $(TARGET)
	@echo "Compilación CPU exitosa: $(TARGET)"

run: $(TARGET)
	./$(TARGET) $(ITERATIONS)

docs: DOCUMENTACION_TECNICA.tex
	@echo "Compilando reporte técnico con Tectonic..."
	tectonic DOCUMENTACION_TECNICA.tex
	@echo "Reporte generado: DOCUMENTACION_TECNICA.pdf"

package: slides docs
	@echo "Generando paquete zip para entrega al profesor..."
	python3 -c "import zipfile, os; \
	pkg='Reto1_Tuberia_CNN_OpenACC_Juferoga'; \
	files=['pipeline_cnn.cpp','Makefile','DOCUMENTACION_TECNICA.pdf','DOCUMENTACION_TECNICA.md','DOCUMENTACION_TECNICA.tex','presentacion_reto1.pdf','presentacion_reto1.tex','PRESENTACION_DIAPOSITIVAS.md','INSTRUCCIONES_ENTREGA.md','README.md']; \
	z=zipfile.ZipFile(f'{pkg}.zip','w',zipfile.ZIP_DEFLATED); \
	[z.write(f, os.path.join(pkg,f)) for f in files if os.path.exists(f)]; \
	[z.write(os.path.join(r,f), os.path.join(pkg,r,f)) for r,d,fs in os.walk('assets') for f in fs if not f.endswith('.DS_Store')]; \
	z.close(); \
	print(f'Paquete creado exitosamente: {pkg}.zip')"

clean:
	rm -f $(TARGET) *.o *.nav *.snm *.toc *.aux *.log *.out

help:
	@echo "Opciones disponibles en el Makefile:"
	@echo "  make acc         Compilar con nvc++ y soporte OpenACC (GPU)"
	@echo "  make cpu         Compilar con g++ para pruebas locales en CPU"
	@echo "  make run         Ejecutar con ITERATIONS=1000 (o make run ITERATIONS=500)"
	@echo "  make slides      Compilar la presentación Beamer institucional (PDF)"
	@echo "  make docs        Compilar el informe técnico formal (PDF)"
	@echo "  make package     Generar el archivo comprimido ZIP de entrega"
	@echo "  make clean       Eliminar binarios y archivos temporales generados"
