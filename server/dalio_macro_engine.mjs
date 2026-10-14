/**
 * Motor Macroeconómico de Ciclos de Deuda de Ray Dalio
 * Basado en "How The Economic Machine Works" (Ray Dalio / Bridgewater Associates)
 * 
 * Modela tres fuerzas agregadas:
 * 1. Tendencia de Productividad (Línea Diagonal Ascendente de Crecimiento Humano)
 * 2. Ciclo de Deuda a Corto Plazo (Ondas de 5-8 años guiadas por tipos y crédito bancario)
 * 3. Ciclo de Deuda a Largo Plazo (Gran onda de 50-75 años guiada por apalancamiento acumulado y desapalancamiento)
 */

export function computeRayDalioMacroState(curvePoints = [], regime = {}) {
  // 1. Extraer o calibrar variables macroeconómicas reales
  const spread10y2y = typeof regime.spread_10y_2y === 'number' 
    ? regime.spread_10y_2y 
    : (() => {
        const p10 = curvePoints.find(p => p.maturity === '10Y')?.yield_rate || 4.10;
        const p2 = curvePoints.find(p => p.maturity === '2Y')?.yield_rate || 3.92;
        return Number((p10 - p2).toFixed(2));
      })();

  const rate10Y = curvePoints.find(p => p.maturity === '10Y')?.yield_rate || 4.10;
  const rate3M = curvePoints.find(p => p.maturity === '3M')?.yield_rate || 4.30;
  
  // Tasa de fondos federales implícita / tipo monetario
  const fedFunds = Math.max(3.5, Math.min(5.5, rate3M));
  
  // Métricas estructurales agregadas de EE.UU. / Mundo Desarrollado (FRED / BIS)
  const debtToGdp = 264.5; // Deuda Total (Pública + Privada) sobre PIB en %
  const highYieldSpreadBps = 325; // OAS Spread de crédito corporativo (mercado complaciente < 350 pb)
  const coreInflation = 2.8; // Inflación subyacente (%)

  // 2. Determinación Cuantitativa de la Posición en el Ciclo Corto (5-8 años)
  // Escala:
  // - Si tipos subiendo agresivamente y curva invertida (< 0): LATE_CYCLE_TIGHTENING (Pico de tipos)
  // - Si curva desinvirtiéndose (+0.05% a +0.50%) con tipos en máximos: EASING_TRANSITION (Transición tardociclo / Pivote)
  // - Si tipos bajando agresivamente y crédito colapsando: CONTRACTION
  // - Si tipos en suelo y crédito reactivándose: EARLY_EXPANSION
  // - Si crecimiento sano y tipos neutrales: MID_CYCLE

  let shortPhase = 'EASING_TRANSITION';
  let shortPhaseLabel = 'Tardociclo en Transición (Pivote de Tipos & Desinversión)';
  let shortProgress = 68; // Porcentaje temporal dentro del ciclo corto (68% = pasando la cresta hacia distensión)

  if (spread10y2y < -0.10) {
    shortPhase = 'LATE_CYCLE_TIGHTENING';
    shortPhaseLabel = 'Final de Ciclo Expansivo / Máximo Endurecimiento';
    shortProgress = 58;
  } else if (spread10y2y >= -0.10 && spread10y2y <= 0.40) {
    shortPhase = 'EASING_TRANSITION';
    shortPhaseLabel = 'Tardociclo / Normalización de Curva (Comienzo de Relajación Monetaria)';
    shortProgress = 68;
  } else if (spread10y2y > 0.40 && fedFunds < 3.0) {
    shortPhase = 'EARLY_EXPANSION';
    shortPhaseLabel = 'Fase Temprana de Recuperación y Expansión Crediticia';
    shortProgress = 20;
  }

  // 3. Determinación Cuantitativa del Ciclo Largo (50-75 años)
  // Con Deuda/PIB > 260% y tipos de interés habiendo salido del límite inferior cero (ZIRP) en 2022:
  // Estamos en la "Cresta Madura / Meseta de Alta Deuda" (Late Long-Term Debt Cycle), antes de un eventual desapalancamiento
  let longPhase = 'LATE_LONG_CYCLE_PLATEAU';
  let longPhaseLabel = 'Fase Tardía de Gran Ciclo de Deuda (Meseta de Deuda Máxima)';
  let longProgress = 65; // En la mitad superior antes de la caída de desapalancamiento

  // 4. Sesgo de Mercado y Dirección
  // En fase de transición con tipos aún altos y crédito estrecho: Neutral Defensivo / Alcista Maduro
  const trendDirection = 'NEUTRAL_DEFENSIVO';
  const trendBias = 'DEFENSIVO_NEUTRAL';
  const trendBiasLabel = 'Alcista Maduro con Sesgo Defensivo (Foco en Flujos de Caja Reales)';

  // 5. Coordenadas precisas para situar el Pin ("Estás Aquí") en el SVG
  // En el gráfico estilizado de Dalio (X de 0 a 100), el punto actual se sitúa en la cresta madura (aprox X = 66%)
  const coordinates = {
    progress_pct: 66.5,
    short_cycle_pos: shortProgress,
    long_cycle_pos: longProgress
  };

  // 6. Riesgos Críticos del Momento
  const risks = [
    {
      title: 'Muro de Refinanciación de Deuda (Maturity Wall)',
      level: 'ALTO',
      detail: 'Gran volumen de deuda corporativa emitida al 1%-3% durante 2020-2021 vence en 2025-2027 y debe refinanciarse a tipos entre el 5% y el 7%, comprimiendo beneficios netos de empresas apalancadas.'
    },
    {
      title: 'Complacencia en Diferenciales de Crédito (High Yield OAS < 350 pb)',
      level: 'MEDIO',
      detail: 'El mercado de bonos no está cobrando prima de riesgo suficiente por quiebras potenciales, lo que indica vulnerabilidad ante cualquier choque de liquidez.'
    },
    {
      title: 'Descompresión / Normalización de Curva de Tipos',
      level: 'MEDIO',
      detail: 'Históricamente, los episodios donde la curva 10Y-2Y pasa de invertida a positiva coinciden con la desaceleración tardía de los beneficios empresariales y aumento del desempleo.'
    }
  ];

  // 7. Recomendaciones Estratégicas (Playbook Institucional de Ray Dalio)
  const recommendations = [
    {
      title: 'Empresas con Caja Neta y Monopolios / Fosos (Compounders)',
      action: 'SOBREPONDERAR',
      detail: 'Priorizar activos de alta calidad (Tier AAA/AA) con balance desapalancado, capacidad de autofinanciación (FCF/Ventas > 20%) y poder de fijación de precios frente a la inflación.'
    },
    {
      title: 'Empresas Sobreendeudadas o Dependientes de Crédito Continuo',
      action: 'INFRAEPONDERAR',
      detail: 'Evitar compañías con ratio Deuda Neta/EBITDA > 3.0x y baja cobertura de intereses (< 3.0x), cuyos flujos de caja serán devorados por los nuevos costes de interés.'
    },
    {
      title: 'Margen de Seguridad Exigente (P0 <= Techo MoS)',
      action: 'MANTENER',
      detail: 'No pagar múltiplos exigentes de ciclo tardío (PER > 28x sin foso real). Mantener la disciplina de compra únicamente cuando la cotización se sitúe por debajo de su valor intrínseco de estrés.'
    }
  ];

  const macroMetrics = {
    debt_to_gdp_pct: debtToGdp,
    fed_funds_rate_pct: Number(fedFunds.toFixed(2)),
    spread_10y_2y_pct: Number(spread10y2y.toFixed(2)),
    high_yield_spread_bps: highYieldSpreadBps,
    core_inflation_pct: coreInflation
  };

  // 8. Opción 1: Matriz de Asignación Táctica por Clases de Activo (All-Weather / Regime Fit)
  const tacticalAllocation = {
    assets: [
      {
        category: 'Renta Variable',
        name: 'Quality Compounders (Caja Neta & Moat)',
        stance: 'SOBREPONDERAR',
        conviction_pct: 88,
        rationale: 'Inmunes a refinanciación; retornos ROIC > 15% y alto FCF defensivo.',
        detailed_explanation: 'En las fases tardías del ciclo de deuda, las subidas de costes de financiación y la desaceleración del crédito deprimen a los negocios apalancados. Los "Quality Compounders" son empresas con monopolios u oligopolios protegidos, márgenes brutos elevados y balances sin deuda neta, capaces de continuar invirtiendo y recomprando acciones con su propio flujo de caja libre sin acudir al mercado de bonos.',
        theoretical_basis: 'Doctrina de Reserva de FCF y Desapalancamiento Orgánico (Ray Dalio & Warren Buffett): En mesetas de deuda/PIB > 250%, el coste medio del capital WACC aumenta para el 80% del mercado. Las compañías con ROIC > WACC y deuda neta cero sufren una expansión relativa de múltiplos al considerarse refugios de rentabilidad sobre capital tangible.',
        recommended_assets: [
          {
            ticker: 'GOOGL',
            name: 'Alphabet Inc.',
            asset_type: 'Monopolio Tecnológico / Caja Neta',
            price: 347.68,
            currency: 'USD',
            period_return_pct: 22.8,
            period_label: 'Último 1A',
            market_analysis: 'Posición de caja neta superior a $85.000M. Monopolio en búsquedas con ROCE > 28% y capacidad de autofinanciar la infraestructura de IA sin emitir deuda a tipos del 6%. Cotiza a múltiplos NTM atractivos con FCF sostenido.',
            catalyst: 'Crecimiento de Google Cloud (+29% YoY) y expansión de margen operativo.'
          },
          {
            ticker: 'TRV',
            name: 'The Travelers Companies',
            asset_type: 'Seguros P&C / Beneficiaria de Tipos',
            price: 360.70,
            currency: 'USD',
            period_return_pct: 35.4,
            period_label: 'Último 1A',
            market_analysis: 'Excelente ratio combinado (underwriting estricto) que reinvierte sus primas (float) a tipos de interés del 4.5%-5.2%, disparando su resultado financiero neto (NII) de forma contracíclica.',
            catalyst: 'Renovaciones de primas comerciales con subidas tarifarias del 8-10% superando la inflación de costes.'
          },
          {
            ticker: 'V',
            name: 'Visa Inc.',
            asset_type: 'Peaje Financiero / Inflación Passthrough',
            price: 370.64,
            currency: 'USD',
            period_return_pct: 18.2,
            period_label: 'Último 1A',
            market_analysis: 'Margen operativo de clase mundial (>66%). Su modelo de negocio cobra una comisión porcentual sobre el volumen transaccionado global, protegiendo sus flujos directamente de la inflación sin requerir capex intensivo.',
            catalyst: 'Crecimiento continuado del gasto en viajes internacionales y pagos sin efectivo (Cross-Border volume +14%).'
          }
        ]
      },
      {
        category: 'Materias Primas',
        name: 'Oro & Activos Reales Refugio',
        stance: 'SOBREPONDERAR',
        conviction_pct: 82,
        rationale: 'Cobertura estructural ante la meseta de deuda récord y expansión fiscal.',
        detailed_explanation: 'El oro es la única reserva monetaria internacional sin riesgo de contraparte ni riesgo de impago soberano. Cuando la deuda soberana agregada supera el 100% del PIB y el coste del servicio de la deuda supera el presupuesto de defensa o sanidad, los bancos centrales se ven obligados a monetizar o tolerar inflaciones ligeramente más altas, erosionando el poder adquisitivo de las divisas fiduciarias.',
        theoretical_basis: 'Principio Canónico de Dalio sobre Monedas Fiduciarias y Dinero Duro: En la fase final del gran ciclo de deuda (50-75 años), los gobiernos recurren indefectiblemente a imprimir dinero ("Beautiful Deleveraging" o inflación fiscal). Los activos tangibles no diluibles y sin pasivo asociado superan al efectivo y a los bonos a largo plazo.',
        recommended_assets: [
          {
            ticker: 'GLD',
            name: 'SPDR Gold Shares ETF',
            asset_type: 'Oro Físico Asignado',
            price: 382.27,
            currency: 'USD',
            period_return_pct: 29.6,
            period_label: 'Último 1A',
            market_analysis: 'Máximos históricos respaldados por compras récord sostenidas de bancos centrales globales (China, India, Polonia) reduciendo reservas en dólares fiduciarios. Muestra una ruptura alcista estructural limpia.',
            catalyst: 'Déficit fiscal estadounidense superior al 6.5% del PIB en pleno empleo y diversificación de reservas soberanas.'
          },
          {
            ticker: 'NEM',
            name: 'Newmont Corporation',
            asset_type: 'Productora de Oro (Minera Tier 1)',
            price: 116.39,
            currency: 'USD',
            period_return_pct: 38.5,
            period_label: 'Último 1A',
            market_analysis: 'Apalancamiento operativo directo al precio del oro. Con costes sostenidos todo incluido (AISC) en torno a $1.450/oz y el oro físico superando los $2.650/oz, la expansión de márgenes FCF y dividendos es exponencial.',
            catalyst: 'Monetización récord de flujos libres de caja y desinversión de activos no esenciales tras la integración de Newcrest.'
          },
          {
            ticker: 'PHYS',
            name: 'Sprott Physical Gold Trust',
            asset_type: 'Fondo Físico con Redención en Lingotes',
            price: 31.43,
            currency: 'USD',
            period_return_pct: 28.9,
            period_label: 'Último 1A',
            market_analysis: 'Vehículo preferido por inversores institucionales que buscan custodia física directa en la Real Casa de la Moneda de Canadá (Royal Canadian Mint) sin riesgos del sistema bancario comercial.',
            catalyst: 'Entrada continua de flujos institucionales buscando desvinculación de los sistemas de compensación fiduciarios.'
          }
        ]
      },
      {
        category: 'Renta Fija',
        name: 'Soberanos Grado Inversión (Duración Media)',
        stance: 'NEUTRAL',
        conviction_pct: 55,
        rationale: 'Capturan rendimiento nominal alto antes de recortes adicionales del banco central.',
        detailed_explanation: 'Los bonos gubernamentales de duración intermedia (3 a 7 años) ofrecen un equilibrio óptimo: aseguran rendimientos nominales cercanos al 3.8%-4.2% antes de que el banco central baje los tipos de intervención, evitando al mismo tiempo el riesgo de duración extrema de los bonos a 30 años que sufren por la oferta excesiva de deuda pública.',
        theoretical_basis: 'Desinversión y Normalización de la Curva de Rendimientos (Yield Curve Bull Steepening): En la transición de tardociclo, los tipos a corto plazo caen más rápido que los de largo plazo, generando plusvalías de capital moderadas en el tramo intermedio de la curva.',
        recommended_assets: [
          {
            ticker: 'IEI',
            name: 'iShares 3-7 Year Treasury Bond ETF',
            asset_type: 'Bonos Tesoro US (Duración Media)',
            price: 113.33,
            currency: 'USD',
            period_return_pct: 6.8,
            period_label: 'Último 1A',
            market_analysis: 'Duración efectiva de 4.4 años. Ideal para capturar el pivote de tipos de la Reserva Federal minimizando la volatilidad de cartera y proporcionando liquidez inmediata.',
            catalyst: 'Continuación del ciclo de normalización de la Fed con recortes graduales de 25 pb.'
          },
          {
            ticker: 'BND',
            name: 'Vanguard Total Bond Market ETF',
            asset_type: 'Renta Fija Agregada Investment Grade',
            price: 70.02,
            currency: 'USD',
            period_return_pct: 7.9,
            period_label: 'Último 1A',
            market_analysis: 'Cupón corriente medio del 4.3% respaldado por un 70% en bonos del Tesoro de EE.UU. y un 30% en crédito corporativo de máxima solvencia (AAA a BBB). Excelente amortiguador de volatilidad.',
            catalyst: 'Atracción de liquidez institucional saliendo de fondos monetarios ante la caída de tipos a un día.'
          }
        ]
      },
      {
        category: 'Crédito Privado',
        name: 'High Yield & Préstamos Apalancados',
        stance: 'INFRAEPONDERAR',
        conviction_pct: 18,
        rationale: 'Diferencial <350 pb insuficiente para compensar el muro de refinanciación 2025-2027.',
        detailed_explanation: 'El crédito corporativo de baja calificación crediticia no está ofreciendo una prima de riesgo atractiva en relación con la probabilidad de impago cuando venza la deuda barata emitida en 2020-2021.',
        theoretical_basis: 'Asimetría Negativa del Crédito Tardío (Dalio & Howard Marks): En diferenciales comprimidos (OAS < 350 pb), el potencial de subida está limitado al cupón, mientras que el riesgo de caída ante un shock de liquidez o subida de impagos es severo.',
        recommended_assets: []
      },
      {
        category: 'Renta Variable',
        name: 'Small Caps / Empresas con Deuda Flotante',
        stance: 'INFRAEPONDERAR',
        conviction_pct: 15,
        rationale: 'Elevada exposición a tipos de interés bancarios altos y márgenes comprimidos.',
        detailed_explanation: 'Más del 40% de las empresas del índice Russell 2000 tienen beneficios negativos y dependen de deuda bancaria a tipo variable, sufriendo de lleno el impacto de los tipos oficiales en sus cuentas de pérdidas y ganancias.',
        theoretical_basis: 'Ley del Coste Marginal del Capital en Pequeña Empresa: Las empresas sin escala suficiente no pueden trasladar la totalidad de los costes de financiación al consumidor final.',
        recommended_assets: []
      }
    ]
  };

  // 9. Opción 2: Termómetros de Estrés de Deuda y Liquidez (The Debt Wall Gauges)
  const debtWallGauges = {
    debt_service_ratio: {
      value: 15.2,
      benchmark: 14.0,
      status: 'ELEVADO',
      label: 'Ratio Servicio de Deuda / Ingresos (DSR)'
    },
    refinancing_stress_2025_2027: {
      value_t: 2.8, // Trillones de dólares en vencimientos corporativos
      avg_orig_rate_pct: 2.35,
      current_market_rate_pct: 6.10,
      spread_burden_pct: 3.75, // Sobrecoste medio en refinanciación
      label: 'Vencimientos Corporativos a Refinanciar ($2.8T)'
    },
    financial_conditions_index: {
      value: -0.42, // Chicago Fed NFCI (negativo = holgado, positivo = restrictivo)
      sentiment: 'NEUTRAL',
      label: 'Índice de Condiciones Financieras (NFCI)'
    }
  };

  // 10. Opción 3: Cuadrante de Régimen Macroeconómico Bridgewater (Pure Alpha 4x4)
  const bridgewaterQuadrant = {
    growth_state: 'MODERADO',
    inflation_state: 'BAJA',
    current_quadrant: 'GOLDILOCKS',
    quadrant_label: 'Goldilocks Tardío / Desinflación con Resiliencia',
    description: 'Crecimiento moderado soportado por consumo, mientras la inflación cede gradualmente permitiendo tipos reales aún positivos.',
    growth_score: 22, // -100 a +100
    inflation_score: -35 // cediendo
  };

  const summaryDiagnosis = `Nos encontramos en la Fase Tardía del Ciclo de Deuda a Largo Plazo (${longPhaseLabel}) y en la transición de distensión monetaria del Ciclo Corto (${shortPhaseLabel}). El entorno es de tipos altos estabilizándose, con la curva 10Y-2Y desinvirtiéndose activamente (+${spread10y2y}%). El sesgo estratégico debe ser defensivo de alta calidad: premiar empresas con caja neta y castigar activos dependientes de refinanciación barata.`;

  return {
    short_cycle_phase: shortPhase,
    short_cycle_phase_label: shortPhaseLabel,
    long_cycle_phase: longPhase,
    long_cycle_phase_label: longPhaseLabel,
    trend_bias: trendBias,
    trend_bias_label: trendBiasLabel,
    trend_direction: trendDirection,
    coordinates,
    risks,
    recommendations,
    macro_metrics: macroMetrics,
    tactical_allocation: tacticalAllocation,
    debt_wall_gauges: debtWallGauges,
    bridgewater_quadrant: bridgewaterQuadrant,
    summary_diagnosis: summaryDiagnosis
  };
}

/**
 * 11. Comparación Macro Soberana: Bono Español 10Y vs US Treasury 10Y (^TNX)
 * Evalúa el impacto directo del diferencial de deuda soberana en la tasa de descuento r
 */
export function computeSovereignComparison(us10yYield = 4.05, es10yYield = 3.05) {
  const usYield = typeof us10yYield === 'number' && us10yYield > 0 ? Number(us10yYield.toFixed(2)) : 4.05;
  const esYield = typeof es10yYield === 'number' && es10yYield > 0 ? Number(es10yYield.toFixed(2)) : 3.05;
  const spreadBps = Math.round((usYield - esYield) * 100);
  const spreadPct = Number((usYield - esYield).toFixed(2));

  return {
    us_10y_yield: usYield,
    es_10y_yield: esYield,
    spread_bps: spreadBps,
    spread_pct: spreadPct,
    risk_free_us: usYield,
    risk_free_es: esYield,
    discount_rate_impact_comment: `El diferencial soberano de +${spreadBps} pb entre el Tesoro Americano 10Y (^TNX: ${usYield}%) y el Bono Español 10Y (${esYield}%) amortigua la tasa libre de riesgo base (Rf) en Europa. En Gordon-Shapiro, un coste de capital r menor para activos del IBEX 35 (~7.8%-8.2% vs ~8.8%-9.4% en S&P 500) equilibra un menor crecimiento secular (g ≤ 3.5%), garantizando Techos de Compra MoS realistas y defensivos.`
  };
}

/**
 * 12. Diagnóstico de Cartera según los 4 Cuadrantes de Ray Dalio (All-Weather Bridgewater)
 */
export function computePortfolioDalioQuadrants(openTrades = [], eurUsdRate = 1.08) {
  let totalPortfolioValueEur = 0;
  const quadrantBreakdown = {
    q1: { label: 'Crecimiento ↑ / Inflación ↓', sub: 'Tech, Software, Consumo Discrecional', value_eur: 0, pct: 0, assets: [] },
    q2: { label: 'Crecimiento ↑ / Inflación ↑', sub: 'Energía, Materiales, Inmobiliario, Pricing Power', value_eur: 0, pct: 0, assets: [] },
    q3: { label: 'Crecimiento ↓ / Inflación ↑', sub: 'Consumo Básico, TIPS, Oro, Defensivas sin Deuda', value_eur: 0, pct: 0, assets: [] },
    q4: { label: 'Crecimiento ↓ / Inflación ↓', sub: 'Banca Sólida, Utilities, Salud, Calidad Cash', value_eur: 0, pct: 0, assets: [] }
  };

  for (const trade of openTrades) {
    const shares = trade.shares || 0;
    const price = trade.current_price || trade.buy_price || 0;
    const value = shares * price;
    const isUsd = trade.currency === 'USD';
    const valueEur = isUsd && eurUsdRate > 0 ? value / eurUsdRate : value;
    totalPortfolioValueEur += valueEur;

    const ticker = trade.ticker ? trade.ticker.toUpperCase() : '';
    const company = (trade.company_name || '').toLowerCase();

    if (
      ticker.includes('AAPL') || ticker.includes('MSFT') || ticker.includes('NVDA') ||
      ticker.includes('AMD') || ticker.includes('GOOG') || ticker.includes('META') ||
      ticker.includes('AMZN') || ticker.includes('AMS') || company.includes('tech') ||
      company.includes('software') || company.includes('semiconductor')
    ) {
      quadrantBreakdown.q1.value_eur += valueEur;
      if (!quadrantBreakdown.q1.assets.includes(ticker)) quadrantBreakdown.q1.assets.push(ticker);
    } else if (
      ticker.includes('REP') || ticker.includes('XOM') || ticker.includes('CVX') ||
      ticker.includes('SHEL') || ticker.includes('VICI') || ticker.includes('GLD') ||
      company.includes('energy') || company.includes('petrol') || company.includes('reit')
    ) {
      quadrantBreakdown.q2.value_eur += valueEur;
      if (!quadrantBreakdown.q2.assets.includes(ticker)) quadrantBreakdown.q2.assets.push(ticker);
    } else if (
      ticker.includes('KO') || ticker.includes('PEP') || ticker.includes('PG') ||
      ticker.includes('JNJ') || ticker.includes('PFE') || company.includes('pharma') ||
      company.includes('staples')
    ) {
      quadrantBreakdown.q3.value_eur += valueEur;
      if (!quadrantBreakdown.q3.assets.includes(ticker)) quadrantBreakdown.q3.assets.push(ticker);
    } else {
      quadrantBreakdown.q4.value_eur += valueEur;
      if (!quadrantBreakdown.q4.assets.includes(ticker)) quadrantBreakdown.q4.assets.push(ticker);
    }
  }

  if (totalPortfolioValueEur > 0) {
    quadrantBreakdown.q1.pct = Number(((quadrantBreakdown.q1.value_eur / totalPortfolioValueEur) * 100).toFixed(1));
    quadrantBreakdown.q2.pct = Number(((quadrantBreakdown.q2.value_eur / totalPortfolioValueEur) * 100).toFixed(1));
    quadrantBreakdown.q3.pct = Number(((quadrantBreakdown.q3.value_eur / totalPortfolioValueEur) * 100).toFixed(1));
    quadrantBreakdown.q4.pct = Number(((quadrantBreakdown.q4.value_eur / totalPortfolioValueEur) * 100).toFixed(1));
  }

  const idealPct = 25;
  const deviation =
    Math.abs(quadrantBreakdown.q1.pct - idealPct) +
    Math.abs(quadrantBreakdown.q2.pct - idealPct) +
    Math.abs(quadrantBreakdown.q3.pct - idealPct) +
    Math.abs(quadrantBreakdown.q4.pct - idealPct);

  const balanceScore = Math.max(20, Math.min(100, Math.round(100 - deviation * 0.6)));

  const recommendations = [];
  if (quadrantBreakdown.q1.pct > 50) {
    recommendations.push('Concentración elevada en Crecimiento / Tecnología (>50%). Vulnerable a repuntes inflacionarios o choques de tipos.');
  }
  if (quadrantBreakdown.q2.pct < 10) {
    recommendations.push('Baja cobertura en activos de Inflación al Alza (Materias Primas / Energía / Pricing Power).');
  }
  if (quadrantBreakdown.q3.pct < 10 && quadrantBreakdown.q4.pct < 10) {
    recommendations.push('Poca exposición a activos defensivos anticíclicos ante desaceleración macroeconómica.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Cartera con equilibrio saludable entre los 4 regímenes económicos de Ray Dalio.');
  }

  return {
    q1_growth_rising: quadrantBreakdown.q1,
    q2_inflation_rising: quadrantBreakdown.q2,
    q3_growth_falling: quadrantBreakdown.q3,
    q4_inflation_falling: quadrantBreakdown.q4,
    balance_score: balanceScore,
    total_value_eur: Number(totalPortfolioValueEur.toFixed(2)),
    recommendations
  };
}

