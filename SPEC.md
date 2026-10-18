# Especificación Técnica y Matemática (SPEC.md)

## Agente Financiero — Terminal Institucional de Análisis Cuantitativo y Gestión de Cartera
*Versión de la Especificación: 1.0.0 — Estado: Producción*

---

## 1. Fundamentos Matemáticos y Motores Cuantitativos

### 1.1. Motor de Valoración Intrínseca (Pilar 1: Gordon-Shapiro & DCF)

El motor evalúa el universo de activos mediante el modelo de descuento de flujos y dividendos a perpetuidad, combinando la doctrina de **Howard Marks** (Margen de Seguridad como colchón asimétrico de riesgo) con las restricciones macroeconómicas de **Aswath Damodaran**.

#### 1.1.1. Tasa de Descuento Exigida ($r$ - Coste de Capital Propio vía CAPM)
$$r = R_f + \beta \cdot \text{ERP}$$
Donde:
- $R_f$: Tasa libre de riesgo soberana de referencia (Bono del Tesoro de EE.UU. a 10 años, calibrado dinámicamente o $4.10\%$).
- $\beta$: Coeficiente Beta institucional frente al índice de mercado de referencia.
- $\text{ERP}$: Prima de riesgo de mercado (*Equity Risk Premium*, fijada en $4.50\% - 5.00\%$).

#### 1.1.2. Restricciones Institucionales de Ciclo de Vida y No-Divergencia
Para evitar anomalías asintóticas y valoraciones ficticias generadas por la ley matemática de Gordon-Shapiro:
1. **Diferencial Mínimo de Rentabilidad**:
   $$(r - g) \ge 2.25\%$$
   Si $(r - g) < 2.25\%$, la tasa de crecimiento $g$ se acota automáticamente para mantener el diferencial mínimo prudente y evitar divisiones irreales.
2. **Techo Macro para Empresas Maduras y Defensivas**:
   Para activos defensivos (*Consumer Staples, Utilities, Healthcare* o activos con $\beta < 0.80$), la tasa de crecimiento a perpetuidad queda estrictamente acotada al techo nominal del PIB a largo plazo:
   $$g_{\text{max}} = 3.50\%$$

#### 1.1.3. Matriz de los 3 Escenarios de Crecimiento ($g$)
A partir de la tasa pivote base seleccionada por el usuario ($g_{\text{pivote}}$, por defecto $7.0\%$):
1. **Escenario Pesimista**:
   $$g_{\text{pes}} = \max\left(1.0\%, \min\left(g_{\text{hist}}, g_{\text{pivote}} - 3.0\%\right)\right)$$
2. **Escenario Neutro**:
   $$g_{\text{neu}} = \min\left(g_{\text{pivote}}, r - 2.25\%\right)$$
3. **Escenario Optimista**:
   $$g_{\text{opt}} = \min\left(r - 1.50\%, \max\left(g_{\text{hist}}, g_{\text{pivote}} + 1.0\%\right)\right)$$

#### 1.1.4. Valor Presente Teórico ($VP$) y Escalera de Margen de Seguridad ($VP_{\text{MoS}}$)
$$VP_{\text{Teórico}} = \frac{D_1 \quad \text{o} \quad FCFA_1}{r - g}$$
$$VP_{\text{MoS}}(\text{MoS}\%) = VP_{\text{Teórico}} \times \left(1 - \frac{\text{MoS}}{100}\right)$$

La escalera de Margen de Seguridad calcula 4 niveles de protección simultáneos:
- **MoS 0% (Valor Justo / Fair Value)**: $VP \times 1.00$
- **MoS 10% (Flexible / Wide Moat)**: $VP \times 0.90$
- **MoS 20% (Estándar de Calidad)**: $VP \times 0.80$
- **MoS 30% (Graham-Buffett Defensivo)**: $VP \times 0.70$

#### 1.1.5. Criterio de Entrada y Ordenación por Discrepancia
Un activo califica para compra si y solo si:
$$(P_0 \le VP_{\text{MoS, Neutro}}) \quad \text{AND} \quad (P_0 \le VP_{\text{MoS, Optimista}})$$

El orden de selección en la interfaz se establece de mayor a menor discrepancia porcentual neutra:
$$\Delta_{\text{neu}} = \frac{VP_{\text{MoS, Neutro}} - P_0}{P_0} \times 100\%$$

---

### 1.2. Métricas de Riesgo Asimétrico y Protección de Capital

#### 1.2.1. Downside Beta ($\beta^-$ de Ang-Chen-Xing)
Mide la sensibilidad del activo exclusivamente cuando el mercado sufre caídas ($R_m < \bar{R}_m$):
$$\beta^- = \frac{\text{Cov}(R_i, R_m \mid R_m < \bar{R}_m)}{\text{Var}(R_m \mid R_m < \bar{R}_m)}$$
- $\beta^- < \beta$: Asimetría positiva (el activo defiende mejor que el mercado durante caídas).
- $\beta^- > \beta$: Riesgo de cola bajista amplificado.

#### 1.2.2. Modified Value at Risk Mensual al 95% ($mVaR_{95\%}$ vía Cornish-Fisher)
Ajusta el VaR paramétrico clásico gaussianizado para capturar el sesgo (*Skewness*, $S$) y el exceso de curtosis (*Kurtosis*, $K$):
$$z_{\text{CF}} = z_\alpha + \frac{1}{6}(z_\alpha^2 - 1)S + \frac{1}{24}(z_\alpha^3 - 3z_\alpha)K - \frac{1}{36}(2z_\alpha^3 - 5z_\alpha)S^2$$
$$mVaR_{95\%} = -(\mu - z_{\text{CF}} \cdot \sigma)$$

#### 1.2.3. Auditoría Anti-Trampas de Valor (*Value Trap Shield*)
Detección algorítmica preventiva de cuchillos cayendo (*falling knives*):
- Condición de alerta: Caída acumulada en 52 semanas $> 35\%$.
- Factor de bloqueo: Si la compañía experimenta caída $> 35\%$ y su precio actual no supera el **Escenario de Estrés** (reducción del $30\%$ en FCF proyectado), el motor la bloquea y la clasifica en el diagnóstico pedagógico para evitar capturar valoraciones trampa generadas por disrupción tecnológica o deterioro irreversible del negocio.

---

### 1.3. Algoritmo del Filtro Value (5 Criterios Institucionales)

El motor somete a cada activo a una prueba de 5 criterios cuantitativos con veredicto estricto:

| # | Criterio | Métrica Evaluada | Umbral de Aprobación | Razón Financiera |
|:-:|:---|:---|:---|:---|
| **1** | **Foso Defensivo (*Moat*)** | Margen Bruto y Estabilidad | Margen Bruto $> 40\%$ o superior a su sector | Capacidad demostrada de fijación de precios sin perder cuota. |
| **2** | **Retorno sobre Capital** | $ROIC$ (Return on Invested Capital) | $ROIC \ge 12.0\%$ | Generación de rentabilidad sobre el capital superior al coste $WACC$. |
| **3** | **Solvencia y Deuda** | Deuda Neta / EBITDA | $\text{Deuda Neta} / \text{EBITDA} < 3.0\times$ | Cobertura de obligaciones financieras sin riesgo de estrés de liquidez. |
| **4** | **Generación de Caja** | Free Cash Flow a 5 Años | $FCF > 0$ en cada uno de los últimos 5 ejercicios | Caja libre real verificada, descartando manipulaciones contables en beneficio neto. |
| **5** | **Valoración Histórica** | Múltiplo $PER$ vs. Media 5A | $PER_{\text{actual}} \le PER_{\text{media 5A}} \times 1.05$ | Cotización a descuento o en línea con su valoración histórica razonable. |

- **Apto para Análisis Profundo**: 5/5 criterios aprobados.
- **Casi Apto (Caso Frontera)**: 4/5 criterios aprobados.
- **Descartado**: $\le 3/5$ criterios aprobados.

---

### 1.4. Motor Macroeconómico de Ray Dalio (All-Weather & 4 Cuadrantes)

El motor analiza la curva de deuda del Tesoro de EE.UU. en sus vencimientos (3M, 2Y, 5Y, 10Y, 30Y) para determinar el régimen del ciclo:
- **Diferencial Soberano Clave**:
  $$\text{Spread}_{10\text{Y}-2\text{Y}} = Y_{10\text{Y}} - Y_{2\text{Y}}$$

#### 1.4.1. Mapeo en los 4 Cuadrantes de Dalio
1. **Crecimiento Acelerado + Inflación Controlada**: Sesgo alcista hacia Renta Variable de Calidad y Crecimiento.
2. **Crecimiento Acelerado + Inflación Elevada**: Asignación prioritaria a Commodities, Oro, Metales y Bonos Indexados a Inflación (TIPS).
3. **Crecimiento en Desaceleración + Inflación Controlada**: Bonos del Tesoro de Larga Duración (TLT/EDV) y activos defensivos con dividendos estables.
4. **Estanflación (Bajo Crecimiento + Alta Inflación)**: Liquidez en divisa fuerte, metales preciosos y activos corporativos con alto poder de precios (*pricing power*).

---

### 1.5. Motor de Análisis Técnico Institucional

Para los activos en cartera o seguimiento, el motor calcula dinámicamente series de 60-90 días de cotización:
- **Medias Móviles Simples (SMA)**: $SMA_{20}, SMA_{50}, SMA_{200}$. Detección de Cruce Dorado (*Golden Cross*: $SMA_{50} > SMA_{200}$) y Cruce de la Muerte (*Death Cross*).
- **Índice de Fuerza Relativa (RSI 14)**:
  $$RSI = 100 - \left(\frac{100}{1 + RS}\right) \quad \text{donde} \quad RS = \frac{\overline{\text{Ganancias}}_{14}}{\overline{\text{Pérdidas}}_{14}}$$
  - $RSI < 30$: Zona de Sobreventa extrema (posible suelo técnico).
  - $RSI > 70$: Zona de Sobrecompra (resistencia técnica).
- **MACD (12, 26, 9)**:
  $$\text{MACD Line} = EMA_{12}(P) - EMA_{26}(P)$$
  $$\text{Signal Line} = EMA_9(\text{MACD Line})$$
  $$\text{Histograma} = \text{MACD Line} - \text{Signal Line}$$
- **Soportes y Resistencias**: Cálculo de mínimos y máximos locales de 52 semanas y rangos de consolidación de precios.

---

## 2. Esquema y Modelo de Datos (SQLite)

La persistencia de la plataforma reside en un único archivo SQLite local (`portfolio.db`) gestionado mediante el motor nativo `node:sqlite` de Node.js v24.

### 2.1. Tabla `portfolio_trades` (Transacciones de Compra y Venta)
```sql
CREATE TABLE portfolio_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  currency TEXT NOT NULL CHECK(currency IN ('EUR', 'USD')),
  shares REAL NOT NULL,
  buy_price REAL NOT NULL,
  fees REAL DEFAULT 0,
  execution_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'OPEN',          -- 'OPEN' | 'CLOSED'
  sell_price REAL,
  sell_date TEXT,
  sell_fees REAL DEFAULT 0,
  realized_pnl REAL,                   -- Plusvalía en divisa original
  realized_pnl_eur REAL,               -- Plusvalía normalizada en EUR
  realized_roi_pct REAL,               -- Retorno % de la operación cerrada
  closing_notes TEXT,
  target_exit_price REAL,              -- Precio objetivo de venta (Target Exit)
  target_exit_notes TEXT
);
```

### 2.2. Tabla `watchlist` (Empresas en Seguimiento)
```sql
CREATE TABLE watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  added_price REAL NOT NULL,           -- Precio exacto en el momento de adición
  target_price REAL,                   -- Precio objetivo de entrada MoS
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3. Tabla `market_quotes` (Caché de Cotizaciones en Vivo)
```sql
CREATE TABLE market_quotes (
  ticker TEXT PRIMARY KEY,
  current_price REAL NOT NULL,
  currency TEXT NOT NULL,
  change_pct REAL DEFAULT 0,
  fifty_two_week_low REAL,
  fifty_two_week_high REAL,
  target_mean REAL,
  target_median REAL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4. Tablas Macroeconómicas y Parámetros
- `macro_yield_curve`: Rendimientos soberanos por vencimiento (`3M`, `2Y`, `5Y`, `10Y`, `30Y`).
- `macro_regime`: Fase del ciclo económico detectada y descripción cualitativa.
- `screened_opportunities`: Catálogo de activos fundamentales pre-cribados con ratios de calidad.
- `growth_metrics`: Tasa YoY, CAGR 3 años, aceleración EPS y Tier de momentum.
- `fx_rates`: Tipo de cambio de referencia de divisas (`EUR_USD`).
- `app_settings`: Claves y configuración local (API Key de Gemini, parámetros de interfaz).

---

## 3. Catálogo de Endpoints de la API REST

Todos los endpoints responden en formato JSON y están alojados en el backend Express (`http://localhost:3001/api`).

### 3.1. Gestión de Cartera
- **`GET /api/portfolio`**: Devuelve el resumen consolidado de cartera (total invertido, valor de mercado, P&L no realizado, posiciones abiertas agrupadas por ticker, operaciones cerradas y desglose de asignación por mercado y sector).
  - Parámetro opcional: `?sync=true` (fuerza actualización en vivo de cotizaciones).
- **`POST /api/portfolio/trade`**: Registra una nueva compra en `portfolio_trades`.
- **`PUT /api/portfolio/trade/:id`**: Modifica una transacción existente o actualiza su precio objetivo de salida.
- **`DELETE /api/portfolio/trade/:id`**: Elimina una transacción del registro.
- **`POST /api/portfolio/close-trade`**: Cierra o liquida (parcial o totalmente) una posición abierta, calculando P&L y ROI realizado.
- **`POST /api/portfolio/direct-closed-trade`**: Inserta directamente una operación histórica ya cerrada.
- **`POST /api/portfolio/reopen-trade`**: Reabre una transacción cerrada previamente.
- **`DELETE /api/portfolio/clear-all`**: Purga la totalidad de las operaciones de cartera.

### 3.2. Valoración Fundamental y Multi-Mercado (Pilar 1)
- **`GET /api/pilar1/scan`**: Ejecuta el barrido fundamental sobre el universo seleccionado.
  - Parámetros: `market` (`SP500` | `NASDAQ` | `IBEX35`), `pivot_g` (ej. `0.07`), `mos` (ej. `0.20`), `sync` (`true` | `false`).
- **`POST /api/pilar1/run`**: Dispara un barrido forzado o simula un régimen de resultado vacío.
- **`GET /api/pilar1/audit/:ticker`**: Genera la auditoría cuantitativa en vivo de cualquier activo bajo demanda (cotización en tiempo real, cálculo de 3 escenarios, escalera de MoS, métricas de riesgo y los 5 criterios del Filtro Value).

### 3.3. Seguimiento (Watchlist) y Análisis Técnico
- **`GET /api/watchlist`**: Obtiene las empresas en seguimiento con su cotización actual, variación acumulada y variación de la sesión de hoy.
- **`POST /api/watchlist`**: Añade un activo a seguimiento consultando su precio en vivo en el instante de inserción.
- **`DELETE /api/watchlist/:ticker`**: Elimina un activo de la lista de seguimiento.
- **`GET /api/technical/:ticker`**: Genera el análisis técnico completo con velas japonesas históricas, SMA 20/50/200, RSI 14, MACD y veredicto algorítmico.

### 3.4. Radiografía Institucional SEC EDGAR & Macro
- **`GET /api/sec/financial-deep-dive/:ticker`**: Extrae y procesa los 14 hechos financieros auditados de los informes 10-K y 10-Q de la SEC EDGAR (balances, flujos y cuentas de resultados históricos).
- **`GET /api/macro`**: Devuelve el estado de la curva soberana de deuda, spread 10Y-2Y y cuadrante de Dalio.
- **`POST /api/market/batch-live-quotes`**: Sincronización por lotes en segundo plano de un conjunto de tickers sin saturar la red.

### 3.5. Copiloto de IA y Auditoría
- **`POST /api/ai/chat`**: Endpoint para conversar con el Copiloto Cuantitativo (soporta Gemini API o motor cuantitativo local de reserva con contexto integral de cartera inyectado).
- **`POST /api/ai/audit-portfolio`**: Genera un informe cuantitativo completo de auditoría de salud y diversificación de la cartera.
- **`POST /api/ai/config`** / **`DELETE /api/ai/key`**: Gestión segura de la clave API de Google Gemini en la base de datos local.

---

## 4. Arquitectura de Empaquetado y Distribución

### 4.1. Lanzador Nativo de Escritorio (`Agente-Financiero.exe`)
- **Compilador**: C# (.NET Framework 4.0/4.8 `csc.exe`) con `/target:winexe`.
- **Comportamiento**:
  1. Verifica si el servidor backend en `http://localhost:3001` ya está respondiendo.
  2. Si está inactivo, localiza `node.exe` (portable en su propia carpeta o en el sistema) y arranca `server/api.mjs` de forma invisible (`CreateNoWindow = true`).
  3. Realiza un sondeo activo cada 500ms hasta confirmar disponibilidad.
  4. Lanza la interfaz gráfica en modo aplicación de escritorio nativa (`msedge.exe --app=http://localhost:3001` o Chrome en modo App sin barras de navegador).

### 4.2. Instalador Autónomo (`Instalador-Agente-Financiero.exe`)
- **Tipo**: Asistente gráfico interactivo (Windows Forms) con payload comprimido embebido (`app_package.zip`).
- **Características**:
  - Incorpora el motor Node.js v24.13.1 completo y portable dentro del propio ejecutable.
  - No requiere permisos de administrador (se instala por defecto en `%LOCALAPPDATA%\AgenteFinanciero`).
  - No requiere que el usuario final tenga instalado Git, Node ni dependencias de desarrollo.
  - Despliega la base de datos en estado inicial limpio ("sin datos"), lista para la introducción de nuevas compras.
  - Crea accesos directos en el Escritorio y en el Menú Inicio de Windows.
  - Incluye script de desinstalación limpia (`Desinstalar.bat`).

---
*Fin de la Especificación Técnica — Agente Financiero v1.0.0*
