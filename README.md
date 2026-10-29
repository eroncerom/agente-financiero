# Agente Financiero

> **Plataforma Institucional de Análisis Cuantitativo, Valoración Fundamental y Gestión de Cartera**  
> *Desarrollada con rigor financiero: Filosofía Graham-Buffett-Marks, Descuento Gordon-Shapiro, Playbook Macro de Ray Dalio, Auditoría SEC EDGAR y Copiloto Cuantitativo/IA.*

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![Status](https://img.shields.io/badge/status-Production--Ready-emerald.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20Desktop%20%2F%20Web-sky.svg)]()
[![License](https://img.shields.io/badge/license-Private-purple.svg)]()

---

## 1. Visión General y Filosofía de Producto

**Agente Financiero** es una terminal gráfica institucional concebida para la toma de decisiones de inversión con **cero saturación cognitiva**, **autonomía local total** y **rigor financiero matemático**.

A diferencia de los paneles comerciales basados en métricas superfluas o dependencias de brokers, esta herramienta integra en una **única pantalla panorámica de 3 pilares** la totalidad del ciclo de vida inversor:

1. **Rigor Cuantitativo Inflexible**: Modelo de descuento de flujos y dividendos (Gordon-Shapiro) con **3 escenarios de crecimiento** (Pesimista, Neutro, Optimista), **Escalera de Margen de Seguridad calibrable (MoS 0% al 45%)**, y una política absoluta de **Aceptación de Resultado Vacío** (evita comprar en mercados sobrecalentados).
2. **Protección de Capital Institucional**: Detección algorítmica de **Trampas de Valor (Value Traps)**, filtro contra caídas severas (>35% 52W / cuchillo cayendo), **Downside Beta** (Ang-Chen-Xing) y **Modified VaR mensual al 95%** (Cornish-Fisher).
3. **Filtro Value de 5 Criterios**: Verificación automática de foso defensivo (*Moat*), retorno sobre capital orgánico ($ROIC > 12\%$), apalancamiento prudente ($\text{Deuda Neta} / \text{EBITDA} < 3\times$), generación de caja libre continua ($FCF > 0$ en los últimos 5 años) y múltiplo $PER$ frente a su media histórica.
4. **Ciclo Macro de Ray Dalio**: Cuantificación de la curva de deuda soberana (3M a 30Y), diferencial 10Y-2Y, mapeo en los 4 cuadrantes macroeconómicos (Crecimiento vs. Inflación) y recomendaciones de asignación táctica (*All-Weather Portfolio*).
5. **Autonomía y Privacidad Absoluta**: Base de datos local SQLite (`portfolio.db`). Sin intermediarios, sin rastreo en la nube, con cotizaciones en tiempo real obtenidas directamente de mercados internacionales (S&P 500, NASDAQ 100, IBEX 35).

---

## 2. Arquitectura de Pantalla: El Dashboard de los 3 Pilares

La interfaz está construida sobre un diseño de alta densidad de información (*Dark Canvas* optimizado contra fatiga visual) distribuido en 3 columnas estratégicas:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Índices Multi-Mercado · Régimen Macro · Divisas EUR/USD · Buscador Global · Copiloto IA │
├──────────────────────┬──────────────────────────────────────────┬───────────────────────────────┤
│    PILAR IZQUIERDO   │               PILAR CENTRAL              │         MARGEN DERECHO        │
│        (25%)         │                   (47%)                  │             (28%)             │
│                      │                                          │                               │
│  • Total Invertido   │  • Barrido Multi-Mercado                 │  [Seguimiento] | [Macro Dalio]│
│  • P&L No Realizado  │  • Sliders g y MoS% en vivo              │                               │
│  • Lista "Mis        │  • 3 Escenarios (Pes / Neu / Opt)        │  • Cotización en vivo         │
│    Compras"          │  • Filtro Value (5 Criterios)            │  • Variación Hoy / Acumulada  │
│  • Trades Cerrados   │  • Gráfico OHLC (FV & Techo MoS)         │  • Alerta Entrada MoS (Zap)   │
│  • Target Exit Price │  • Radiografía SEC EDGAR (14 métricas)   │  • Análisis Técnico Completo  │
│  • Desglose Sectorial│  • Comparativa de Pares Directos         │  • Curva 10Y-2Y y Cuadrantes  │
└──────────────────────┴──────────────────────────────────────────┴───────────────────────────────┘
```

### 2.1. Pilar Izquierdo: Gestión de Cartera y BBDD Local
- **Panel de Control de Posiciones**: Control de compras con fecha, precio de adquisición, comisiones y número de acciones.
- **Métricas en Tiempo Real**: Valor actual de mercado, plusvalía/minusvalía no realizada en moneda y porcentaje, P&L total cerrado y tasa de rendimiento interno.
- **Historial Completo de Operaciones**: Modal avanzado para registrar ventas parciales o totales con cálculo automático de plusvalías realizadas en USD y EUR, notas de liquidación y registro histórico.
- **Target Exit Price**: Precio objetivo de salida configurado por operación para ejecutar tomas de beneficio disciplinadas.

### 2.2. Pilar Central: Motor Fundamental de Valor Intrínseco
- **Calibrador Dual Interactivo**: Sliders con respuesta inmediata para ajustar la tasa de crecimiento anual ($g$) y el Margen de Seguridad exigido ($MoS\%$).
- **Matriz de Valoración Gordon-Shapiro**: Desglose simultáneo de los 3 escenarios con comprobación del criterio de entrada:
  $$P_0 \le VP_{\text{MoS, Neutro}} \quad \text{AND} \quad P_0 \le VP_{\text{MoS, Optimista}}$$
- **Filtro Value (5/5)**: Cribado automático de calidad institucional con apertura de modal explicativo y puntuación detallada.
- **Herramientas de Análisis Avanzado**:
  - Gráfico interactivo de velas japonesas con líneas horizontales de *Fair Value* y *Techo MoS*.
  - Radiografía Financiera Institucional SEC EDGAR (14 métricas auditadas, TTM y series históricas).
  - Comparador cuantitativo de competidores directos (*Peer Comparison*).

### 2.3. Margen Derecho Dual: Seguimiento (Watchlist) & Macro Dalio
- **Pestaña Seguimiento (Watchlist)**:
  - Lista de activos monitorizados con precio de adición, precio actual y variación de la sesión de hoy.
  - **Banner de Alerta MoS**: Detección y notificación automática cuando una compañía monitorizada cruza a la baja su Techo de Compra MoS.
  - **Análisis Técnico Institucional**: Modal interactivo con velas japonesas, medias móviles (SMA 20, 50, 200), RSI 14, MACD y veredicto algorítmico de momentum.
- **Pestaña Macro & Ray Dalio**:
  - Monitorización de la curva de deuda estadounidense (3M, 2Y, 5Y, 10Y, 30Y) y diferencial de tipos 10Y-2Y.
  - Diagnóstico de fase de ciclo y asignación recomendada por cuadrantes.
  - Tabla de activos tácticos sugeridos por el modelo macro.

### 2.4. Interoperabilidad Drag & Drop
- **Del Pilar Central a Seguimiento**: Arrastra cualquier compañía (tarjeta principal, botones de carrusel o tarjetas pedagógicas) hacia la derecha para añadirla a seguimiento continuo. Si la pestaña Macro está activa, conmuta automáticamente a Seguimiento.
- **De Seguimiento al Pilar Central**: Arrastra cualquier activo hacia el centro para calcular su auditoría completa al instante.
- **A Mis Compras**: Arrastra cualquier activo a la columna izquierda para abrir la boleta de compra pre-cumplimentada.

---

## 3. Modos de Ejecución y Arranque

### 3.1. Acceso Directo de Escritorio (Para uso diario propio)
En el directorio del proyecto se encuentra el ejecutable nativo compilado:
- **`Agente-Financiero.exe`**: Inicia el backend en segundo plano (sin consolas negras molestas) y abre la interfaz de usuario en ventana de aplicación nativa.
- **Acceso Directo en el Escritorio**: Se ha generado el acceso directo **"Agente Financiero"** en su Escritorio de Windows con su icono institucional.
- **`Iniciar-Agente-Financiero.bat`**: Script batch alternativo de inicio rápido.
- **`Detener-Agente-Financiero.bat`**: Detiene de forma limpia los procesos y servidores de la aplicación.

### 3.2. Instalador para Otros Equipos (Distribución Limpia)
Para compartir la aplicación con otra persona en su propio PC:
- **`Agente-Financiero-Setup-v1.0.0.zip`** (o **`Instalador-Agente-Financiero.exe`**):
  - **100% Autónomo**: Contiene su propio runtime portable de Node.js v24. El destinatario **no necesita instalar Node.js ni ninguna herramienta previa**.
  - **Base de Datos Inicial Limpia**: Se inicializa sin datos de compras ("sin datos, inicial"), lista para que el nuevo usuario comience su propia cartera desde cero.
  - **Asistente Visual (Wizard)**: Permite elegir la carpeta de destino (por defecto en `%LOCALAPPDATA%\AgenteFinanciero` sin requerir permisos de administrador), crea accesos directos en el Escritorio y Menú Inicio, y genera su propio desinstalador (`Desinstalar.bat`).
  - **Descarga desde GitHub**: Para usuarios finales, descargar directamente el archivo `Agente-Financiero-Setup-v1.0.0.zip` (pulsando en el archivo y luego en el botón **Download** de GitHub), descomprimir (*Clic derecho ➔ Extraer todo...*) y ejecutar el instalador. *(Evitar el botón verde "Code ➔ Download ZIP" salvo que se desee trabajar con el código fuente).*

### 3.3. Modo Desarrollo (Programación e Iteración)
Si desea continuar desarrollando o depurando la aplicación con recarga en caliente (*Hot Module Replacement*):
```bash
# Instalar dependencias (solo primera vez)
npm install

# Compilar frontend
npm run build

# Iniciar servidor backend y frontend concurrentemente
npm run dev
```
- **Frontend Vite**: `http://localhost:5173/`
- **Backend API Express**: `http://localhost:3001/` (con proxy automático `/api`)

---

## 4. Estructura del Código Fuente

```
d:\AI\Agente financiero\
├── dist\                           # Artefactos compilados para producción (Vite React)
├── dist-package\                   # Entorno de empaquetado para distribución standalone
├── server\                         # Motor de backend, finanzas y base de datos
│   ├── api.mjs                     # Servidor Express REST API y hosting estático de producción
│   ├── db.mjs                      # Conexión SQLite nativa (node:sqlite) e inicialización de esquemas
│   ├── pilar1_engine.mjs           # Motor de valoración Gordon-Shapiro, CAPM y 3 escenarios
│   ├── value_filter_engine.mjs     # Algoritmo de los 5 criterios del Filtro Value
│   ├── dalio_macro_engine.mjs      # Motor macroeconómico de 4 cuadrantes y curva de deuda
│   ├── technical_analysis.mjs      # Indicadores técnicos (SMA, RSI, MACD, Soportes/Resistencias)
│   ├── financial_history_service.mjs # Extracción y parsing de estados financieros SEC EDGAR
│   ├── ai_assistant_service.mjs    # Copiloto de IA (Gemini API + Motor Cuantitativo Local)
│   ├── market_service.mjs          # Cotizaciones en vivo Yahoo Finance y consenso institucional
│   ├── market_indices_service.mjs  # Gestión multi-mercado (S&P 500, NASDAQ, IBEX 35)
│   ├── config\                     # Parámetros macro y mapeo de arquetipos empresariales
│   └── data\                       # Universos de compañías y cachés locales
├── src\                            # Frontend React 18 + TypeScript + Tailwind CSS
│   ├── App.tsx                     # Orquestador del Dashboard principal y gestión de estado
│   ├── components\                 # Componentes de los 3 pilares, modales y widgets
│   ├── types\                      # Definiciones de tipos TypeScript e interfaces de dominio
│   └── utils\                      # Utilidades de cálculo y formato monetario
├── Agente-Financiero.exe           # Ejecutable lanzador nativo de Windows (escritorio local)
├── Instalador-Agente-Financiero.exe# Instalador autónomo portable con asistente visual
├── Agente-Financiero-Setup-v1.0.0.zip # Paquete de instalación comprimido listo para distribución
├── portfolio.db                    # Base de datos SQLite local del usuario
├── package.json                    # Manifiesto del proyecto y scripts
├── README.md                       # Documentación general y guía de uso
└── SPEC.md                         # Especificación técnica y matemática exhaustiva
```

---

## 5. Privacidad y Seguridad de Datos

- **Sin Telemetría**: La plataforma no envía ningún dato de cartera, nombres de empresas ni balances a servidores externos.
- **Claves API de IA Seguras**: Si se configura una clave de Google Gemini para el asistente, se almacena encriptada localmente en la tabla `app_settings` de su propia base de datos SQLite y nunca se expone en el código cliente.
- **Caché Local Inteligente**: Las peticiones de mercado y SEC se almacenan en caché local para minimizar el consumo de ancho de banda y garantizar alta velocidad de respuesta.

---
*Agente Financiero v1.0.0 — Diseñado para operar con rigor, disciplina y protección de capital.*
