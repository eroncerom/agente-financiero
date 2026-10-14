export type Currency = 'EUR' | 'USD';

export type MarketIndex = 'SP500' | 'NASDAQ' | 'IBEX35';

export interface MarketConfig {
  id: MarketIndex;
  name: string;
  country: string;
  currency: string;
  currency_symbol: string;
  badge: string;
  default_rf: number;
  default_erp: number;
  gn_terminal: number;
  universe_file: string;
}

export type StatusColor = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export interface PortfolioPosition {
  ticker: string;
  company_name: string;
  currency: Currency;
  shares: number;
  buy_price: number;
  current_price: number;
  variation_pct: number;
  profit_loss: number;
  status_color: StatusColor;
  trades_count: number;
  target_exit_price?: number | null;
  target_exit_notes?: string | null;
  fair_value?: number | null;
  mos_buy_ceiling?: number | null;
  has_reached_exit?: boolean;
  is_in_freefall?: boolean;
  freefall_reason?: string | null;
  fifty_two_week_low?: number | null;
  fifty_two_week_high?: number | null;
  sector?: string;
  weight_pct?: number;
  total_value_eur?: number;
  trades?: PortfolioTrade[];
}

export interface SectorAllocation {
  sector: string;
  weight_pct: number;
  value_eur: number;
}

export interface MarketAllocation {
  market: string;
  weight_pct: number;
  value_eur: number;
}

export interface PortfolioSummary {
  total_invested_eur: number;
  total_value_eur: number;
  total_pnl_eur: number;
  total_variation_pct: number;
  fx_eur_usd: number;
  usd_pct?: number;
  eur_pct?: number;
  market_allocations?: MarketAllocation[];
  sector_allocations?: SectorAllocation[];
}

export interface PortfolioTrade {
  id: number;
  ticker: string;
  company_name: string;
  currency: Currency;
  shares: number;
  buy_price: number;
  fees: number;
  execution_date: string;
  notes?: string;
  created_at?: string;
  status?: 'OPEN' | 'CLOSED';
  sell_price?: number;
  sell_date?: string;
  sell_fees?: number;
  realized_pnl?: number;
  realized_pnl_eur?: number;
  realized_roi_pct?: number;
  closing_notes?: string;
  target_exit_price?: number | null;
  target_exit_notes?: string | null;
  fair_value?: number | null;
  mos_buy_ceiling?: number | null;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  market_price?: number | null;
}

export interface ClosedSummary {
  total_closed_count: number;
  winning_trades_count: number;
  losing_trades_count: number;
  total_realized_pnl_eur: number;
  total_realized_roi_pct: number;
}

export interface PortfolioResponse {
  summary: PortfolioSummary;
  positions: PortfolioPosition[];
  raw_trades?: PortfolioTrade[];
  closed_trades?: PortfolioTrade[];
  closed_summary?: ClosedSummary;
}

export type ChartTimeframe = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1A' | '5A' | '1W' | '1Y';

export interface ChartPoint {
  timestamp: number;
  date_str: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export interface ChartHistoryResponse {
  ticker: string;
  timeframe: ChartTimeframe;
  currency: Currency;
  points: ChartPoint[];
  first_price: number;
  current_price: number;
  change_pct: number;
  change_amount: number;
  min_price: number;
  max_price: number;
}

export interface YieldPoint {
  maturity: string;
  yield_rate: number;
  prev_yield_rate: number;
}

export interface MacroRegime {
  spread_10y_2y: number;
  cycle_phase: string;
  description: string;
}

export interface RayDalioCycleData {
  short_cycle_phase: 'EARLY_EXPANSION' | 'MID_CYCLE' | 'LATE_CYCLE_TIGHTENING' | 'EASING_TRANSITION' | 'CONTRACTION';
  short_cycle_phase_label: string;
  long_cycle_phase: 'LEVERAGING_PHASE' | 'LATE_LONG_CYCLE_PLATEAU' | 'DELEVERAGING';
  long_cycle_phase_label: string;
  trend_bias: 'ALCISTA_MADURO' | 'DEFENSIVO_NEUTRAL' | 'BAJISTA_CONTRACCION' | 'RECUPERACION_TEMPRANA';
  trend_bias_label: string;
  trend_direction: 'ALCISTA' | 'NEUTRAL_DEFENSIVO' | 'BAJISTA';
  // Coordenadas normalizadas sobre el gráfico (0 a 100) para situar el punto "Estás Aquí"
  coordinates: {
    progress_pct: number; // 0 a 100 en eje X (Time)
    short_cycle_pos: number; // posición relativa en onda corta
    long_cycle_pos: number; // posición relativa en onda larga
  };
  risks: {
    title: string;
    level: 'ALTO' | 'MEDIO' | 'MODERADO';
    detail: string;
  }[];
  recommendations: {
    title: string;
    action: 'SOBREPONDERAR' | 'INFRAEPONDERAR' | 'MANTENER';
    detail: string;
  }[];
  macro_metrics: {
    debt_to_gdp_pct: number;
    fed_funds_rate_pct: number;
    spread_10y_2y_pct: number;
    high_yield_spread_bps: number;
    core_inflation_pct: number;
  };
  tactical_allocation?: {
    assets: {
      category: string;
      name: string;
      stance: 'SOBREPONDERAR' | 'NEUTRAL' | 'INFRAEPONDERAR';
      conviction_pct: number;
      rationale: string;
      detailed_explanation?: string;
      theoretical_basis?: string;
      recommended_assets?: {
        ticker: string;
        name: string;
        asset_type: string;
        price: number;
        currency: string;
        period_return_pct: number;
        period_label: string;
        market_analysis: string;
        catalyst: string;
      }[];
    }[];
  };
  debt_wall_gauges?: {
    debt_service_ratio: { value: number; benchmark: number; status: 'NORMAL' | 'ELEVADO' | 'CRITICO'; label: string };
    refinancing_stress_2025_2027: { value_t: number; avg_orig_rate_pct: number; current_market_rate_pct: number; spread_burden_pct: number; label: string };
    financial_conditions_index: { value: number; sentiment: 'EXPANSIVO' | 'NEUTRAL' | 'RESTRICTIVO'; label: string };
  };
  bridgewater_quadrant?: {
    growth_state: 'ALZA' | 'BAJA' | 'MODERADO';
    inflation_state: 'ALZA' | 'BAJA' | 'MODERADA';
    current_quadrant: 'GOLDILOCKS' | 'REFLACION' | 'ESTANFLACION' | 'DESACELERACION_DESINFLACION';
    quadrant_label: string;
    description: string;
    growth_score: number; // -100 a +100
    inflation_score: number; // -100 a +100
  };
  summary_diagnosis: string;
}

export interface MacroSovereignComparison {
  us_10y_yield: number;
  es_10y_yield: number;
  spread_bps: number;
  spread_pct: number;
  risk_free_us: number;
  risk_free_es: number;
  discount_rate_impact_comment: string;
}

export interface DalioQuadrantItem {
  label: string;
  sub: string;
  value_eur: number;
  pct: number;
  assets: string[];
}

export interface PortfolioDalioQuadrantAssessment {
  q1_growth_rising: DalioQuadrantItem;
  q2_inflation_rising: DalioQuadrantItem;
  q3_growth_falling: DalioQuadrantItem;
  q4_inflation_falling: DalioQuadrantItem;
  balance_score: number;
  total_value_eur: number;
  recommendations: string[];
}

export interface MacroData {
  curve: YieldPoint[];
  regime: MacroRegime;
  dalio_cycle?: RayDalioCycleData;
  sovereign_comparison?: MacroSovereignComparison;
  portfolio_dalio?: PortfolioDalioQuadrantAssessment;
}

export interface ScenarioValuation {
  g: number;
  VP_teorico: number;
  VP_MoS_30: number;
  VP_MoS?: number;
  cumple_MoS: boolean;
}

export interface Pilar1Result {
  ticker: string;
  nombre: string;
  sector?: string;
  currency?: string;
  currency_symbol?: string;
  precio_cierre_P0: number;
  D1_o_FCFA1?: number;
  beta?: number;
  g_hist?: number;
  tasa_descuento_r: number;
  rf_utilizado?: number;
  erp_utilizado?: number;
  pivot_g?: number;
  mos_discount_pct?: number;
  tipo_descarte?: 'CALIFICADA' | 'PRECIO_ELEVADO' | 'TECHO_R_G';
  status?: string;
  precio_entrada_prudente?: number;
  g_sostenible?: number;
  vp_sostenible?: number;
  vp_mos_sostenible?: number;
  discrepancia_sostenible?: number;
  rango_52_semanas?: { low: number; high: number };
  escalera_mos?: { fair_value: number; mos_10_pct: number; mos_20_pct: number; mos_30_pct: number };
  vpMoSNeu?: number;
  vpMoSOpt?: number;
  discrepancia?: number;
  perfil_empresa?: string;
  nombre_perfil?: string;
  descripcion_perfil?: string;
  arquetipo?: string;
  nombre_arquetipo?: string;
  modelo_valoracion?: string;
  formula_valoracion?: string;
  downside_beta?: number;
  mvar_monthly_95?: number;
  tbv_per_share?: number;
  sbc_per_share?: number;
  target_exit_price?: number;
  detalles_modelo?: Record<string, any>;
  g_techo_macro?: number;
  g_efectivo_utilizado?: number;
  dividend_yield_pct?: number;
  spread_yield_vs_rf?: number;
  spread_r_g?: number;
  techo_maximo_compra?: number;
  estado_compra?: 'ZONA_COMPRA_ACTIVA' | 'ZONA_VALOR_JUSTO' | 'ZONA_SOBREPRECIO';
  descripcion_estado?: string;
  escenario_pesimista: ScenarioValuation;
  escenario_neutro: ScenarioValuation;
  escenario_optimista: ScenarioValuation;
  discrepancia_porcentual_neutra: string;
  motivo_pedagogico?: string;
  alerta_trampa_valor?: boolean;
  caida_desde_maximo_52w_pct?: number;
  distancia_minimo_52w_pct?: number;
  fair_value_estres?: number;
  techo_mos_estres?: number;
  diagnostico_trampa_valor?: string;
  health_score?: number;
  quality_tier?: 'AAA' | 'AA' | 'BBB' | 'B' | 'C';
  quality_label?: string;
  payout_eps_pct?: number;
  payout_fcf_pct?: number;
  fcf_conversion_pct?: number;
  posicion_rango_52w?: number;
  auditoria_trampas?: AuditoriaTrampasMercado;
  g_implicito_precio_pct?: number | null;
  g_fundamental_pct?: number | null;
  fair_value_teorico?: number;
  fair_value_pess?: number;
  fair_value_opt?: number;
  dispersion_valoracion_pct?: number;
  health_metrics?: HealthMetricaDetalle[];
  trampas_fundamentales?: Array<{
    tipo: string;
    severidad: string;
    titulo: string;
    detalle: string;
  }>;
  cf_base_utilizado?: number;
  roic?: number | null;
  reinvestment_rate?: number | null;
  net_debt_per_share?: number | null;
  industry?: string;
  filtro_value?: ValueFilterEvaluation;
}

export interface ValueFilterCriterion {
  id: number;
  metrica: string;
  dato_actual: string;
  objetivo_minimo: string;
  estado: 'APTO' | 'DESCARTADO';
  cumple: boolean;
  valor_numerico?: number;
  fcf_series?: Array<{ year: string; fcf_billions: number }>;
  pe_ttm?: number | null;
  pe_fwd?: number | null;
  pe_hist_5y?: number;
}

export interface ValueFilterEvaluation {
  apto: boolean;
  casi_apto: boolean;
  puntuacion: number;
  total_criterios: number;
  etiqueta_estado: string;
  veredicto: string;
  motivo_parrafo: string;
  criterios: ValueFilterCriterion[];
}

export interface HealthMetricaDetalle {
  nombre: string;
  valor: string;
  puntos: number;
  estado: string;
}

export interface AlertaTrampaMercado {
  tipo: 'CUCHILLO_CAYENDO' | 'YIELD_TRAP' | 'PICO_CICLO' | 'CALIDAD_CONTABLE' | 'SIN_SUELO';
  severidad: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
  icono: string;
  titulo: string;
  detalle: string;
}

export interface AuditoriaTrampasMercado {
  caida52wPct: number;
  distanciaMin52w: number;
  posRango52w: number;
  payoutEpsPct: number;
  payoutFcfPct: number;
  fcfConvPct: number;
  alertaCuchilloCayendo: boolean;
  alertaYieldTrap: boolean;
  alertaPicoCiclo: boolean;
  alertaCalidadContable: boolean;
  alertaSinSuelo: boolean;
  alertas: AlertaTrampaMercado[];
  healthScore: number;
  qualityTier: 'AAA' | 'AA' | 'BBB' | 'B' | 'C';
  qualityLabel: string;
}

export interface DiscardedCompanyDetail {
  status: string;
  ticker: string;
  nombre: string;
  sector?: string;
  currency?: string;
  currency_symbol?: string;
  precio_cierre_P0: number;
  D1_o_FCFA1?: number;
  beta?: number;
  g_hist?: number;
  tasa_descuento_r: number;
  rf_utilizado?: number;
  erp_utilizado?: number;
  pivot_g?: number;
  mos_discount_pct?: number;
  tipo_descarte?: 'PRECIO_ELEVADO' | 'TECHO_R_G' | 'CALIFICADA' | 'RIESGO_TRAMPA_VALOR';
  precio_entrada_prudente?: number;
  g_sostenible?: number;
  vp_sostenible?: number;
  vp_mos_sostenible?: number;
  discrepancia_sostenible?: number;
  rango_entrada_recomendado?: {
    min: number;
    max: number;
    g_sostenible_pct: number;
    g_conservador_pct: number;
  };
  vpMoSNeu?: number;
  vpMoSOpt?: number;
  discrepancia?: number;
  perfil_empresa?: string;
  nombre_perfil?: string;
  descripcion_perfil?: string;
  arquetipo?: string;
  nombre_arquetipo?: string;
  modelo_valoracion?: string;
  formula_valoracion?: string;
  downside_beta?: number;
  mvar_monthly_95?: number;
  tbv_per_share?: number;
  sbc_per_share?: number;
  target_exit_price?: number;
  detalles_modelo?: Record<string, any>;
  g_techo_macro?: number;
  g_efectivo_utilizado?: number;
  dividend_yield_pct?: number;
  spread_yield_vs_rf?: number;
  spread_r_g?: number;
  techo_maximo_compra?: number;
  estado_compra?: 'ZONA_COMPRA_ACTIVA' | 'ZONA_VALOR_JUSTO' | 'ZONA_SOBREPRECIO';
  descripcion_estado?: string;
  rango_52_semanas?: {
    low: number;
    high: number;
  };
  escalera_mos?: {
    fair_value: number;
    mos_10_pct: number;
    mos_20_pct: number;
    mos_30_pct: number;
  };
  escenario_pesimista?: ScenarioValuation;
  escenario_neutro?: ScenarioValuation;
  escenario_optimista?: ScenarioValuation;
  motivo_pedagogico?: string;
  alerta_trampa_valor?: boolean;
  caida_desde_maximo_52w_pct?: number;
  distancia_minimo_52w_pct?: number;
  fair_value_estres?: number;
  techo_mos_estres?: number;
  diagnostico_trampa_valor?: string;
  health_score?: number;
  quality_tier?: 'AAA' | 'AA' | 'BBB' | 'B' | 'C';
  quality_label?: string;
  payout_eps_pct?: number;
  payout_fcf_pct?: number;
  fcf_conversion_pct?: number;
  posicion_rango_52w?: number;
  auditoria_trampas?: AuditoriaTrampasMercado;
  g_implicito_precio_pct?: number | null;
  g_fundamental_pct?: number | null;
  fair_value_teorico?: number;
  fair_value_pess?: number;
  fair_value_opt?: number;
  dispersion_valoracion_pct?: number;
  health_metrics?: HealthMetricaDetalle[];
  trampas_fundamentales?: Array<{
    tipo: string;
    severidad: string;
    titulo: string;
    detalle: string;
  }>;
  cf_base_utilizado?: number;
  roic?: number | null;
  reinvestment_rate?: number | null;
  net_debt_per_share?: number | null;
  industry?: string;
  filtro_value?: ValueFilterEvaluation;
}

export interface DiagnosticoPedagogico {
  descartadas_techo_r: DiscardedCompanyDetail[];
  descartadas_trampa_valor?: DiscardedCompanyDetail[];
  en_zona_valor_justo?: DiscardedCompanyDetail[];
  no_calificadas_precio: DiscardedCompanyDetail[];
}

export interface Pilar1ScanResponse {
  ejecucion_fecha: string;
  market?: MarketIndex;
  market_name?: string;
  currency?: string;
  currency_symbol?: string;
  universo_analizado: number;
  empresas_descartadas_datos_insuficientes: number;
  empresas_descartadas_techo_r?: number;
  empresas_descartadas_trampa_valor?: number;
  empresas_en_zona_valor_justo?: number;
  empresas_no_calificadas_precio?: number;
  empresas_calificadas_pilar1: number;
  empresas_aptas_filtro_value?: number;
  empresas_casi_aptas_filtro_value?: number;
  pivote_g_utilizado?: number;
  mos_utilizado?: number;
  mos_pct?: number;
  mensaje_vacio?: string;
  resultados: Pilar1Result[];
  diagnostico_pedagogico?: DiagnosticoPedagogico;
}

export interface GrowthMetrics {
  ticker: string;
  rev_growth_yoy: number;
  rev_cagr_3y: number;
  eps_growth_yoy: number;
  eps_qoq_accel: number;
  efficiency_score: number;
  momentum_tier: string;
}

export interface ScreenedOpportunity {
  ticker: string;
  name: string;
  sector: string;
  currency: Currency;
  filter_badge: string;
  catalyst_label: string;
  catalyst_value: string;
  catalyst_subtext: string;
  roic: number;
  roe: number;
  roce: number;
  ev_fcf: number;
  pe_ntm: number;
  net_debt_ebitda: number;
  ebit_margin: number;
  gross_margin: number;
  fcf_conversion: number;
  capex_sales: number;
  piotroski_score: number;
  altman_z: number;
  thesis_points: string[];
}

export interface WatchlistItem {
  id: number;
  ticker: string;
  company_name: string;
  currency: Currency;
  added_price: number;
  current_price: number;
  change_since_added_amount: number;
  change_since_added_pct: number;
  day_change_pct: number;
  target_price?: number | null;
  fair_value?: number | null;
  techo_mos?: number | null;
  diff_vs_mos_pct?: number | null;
  estado_valoracion?: string;
  arquetipo?: string | null;
  notes?: string | null;
  created_at: string;
  high_52w?: number | null;
  low_52w?: number | null;
}

export interface TechnicalRiskAlert {
  nivel: 'ALTO' | 'MODERADO_ALTO' | 'ATENCIÓN' | 'MODERADO';
  titulo: string;
  detalle: string;
}

export interface TechnicalAnalysis {
  ticker: string;
  current_price: number;
  currency: string;
  timeframe: string;
  tracking_info?: {
    added_price: number;
    created_at: string;
    notes?: string;
    target_price?: number;
    change_pct: number;
    change_amount: number;
  } | null;
  tendencia: {
    regimen: string;
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    precio_vs_sma20_pct: number;
    precio_vs_sma50_pct: number;
    precio_vs_sma200_pct: number | null;
    golden_cross: boolean | null;
  };
  momentum: {
    rsi: number;
    estado_rsi: string;
    macd: {
      macd: number;
      signal: number;
      hist: number;
      cruce: 'ALCISTA' | 'BAJISTA';
      aceleracion: string;
    } | null;
  };
  volatilidad: {
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
      pctB: number;
      bandwidth: number;
      squeeze: boolean;
      posicion: string;
    } | null;
    atr: {
      atr: number;
      atr_pct: number;
    } | null;
    volatilidad_historica: {
      varianza_diaria: number;
      volatilidad_anual_pct: number;
    } | null;
  };
  niveles: {
    high_52w: number;
    low_52w: number;
    drawdown_52w_pct: number;
    distancia_minimo_52w_pct: number;
    fibonacci: {
      high52: number;
      low52: number;
      fib23: number;
      fib38: number;
      fib50: number;
      fib61: number;
      fib78: number;
      zona_actual: string;
    } | null;
    soportes: Array<{ tipo: string; nivel: number }>;
    resistencias: Array<{ tipo: string; nivel: number }>;
    soporte_inmediato: number;
    resistencia_inmediata: number;
  };
  gestion_riesgo: {
    stop_loss_sugerido: number;
    take_profit_sugerido: number;
    riesgo_unitario_usd: number;
    beneficio_unitario_usd: number;
    ratio_risk_reward: number;
    distancia_stop_pct: number;
    potencial_take_profit_pct: number;
  };
  curva_valoracion: {
    fair_value: number | null;
    techo_mos: number | null;
    estado_pilar1: string;
    sobreprecio_vs_fair_pct: number | null;
  };
  sintesis: {
    score_tecnico: number;
    recomendacion: 'ENTRAR' | 'ESPERAR' | 'DESCARTAR' | 'TOMAR_BENEFICIOS';
    badge_color: string;
    justificacion: string;
    alertas_riesgo: TechnicalRiskAlert[];
  };
}

// -------------------------------------------------------------
// RADIOGRAFÍA FINANCIERA INSTITUCIONAL (SEC EDGAR XBRL)
// -------------------------------------------------------------
export interface FinancialPoint {
  period: string;
  periodFull: string;
  date: string;
  value: number;
  unit: string;
  median?: number | null;
  filed?: string | null;
  form?: string | null;
}

export interface FinancialMetricModeSummary {
  current: number | null;
  current_formatted: string;
  period_label: string;
  previous: number | null;
  delta: number | null;
  delta_text: string;
  median: number | null;
  median_formatted: string;
  status: {
    text: string;
    color: 'positive' | 'warning' | 'neutral';
  };
  points: FinancialPoint[];
}

export interface FinancialMetric {
  key: string;
  title: string;
  unit: '%' | '$' | 'x';
  category: 'profitability' | 'cashflow';
  description: string;
  modes: {
    TTM: FinancialMetricModeSummary;
    T: FinancialMetricModeSummary;
    A: FinancialMetricModeSummary;
  };
}

export interface FinancialDeepDiveData {
  ticker: string;
  company_name: string;
  cik: number;
  currency: string;
  fuente_auditada: string;
  updated_at: string;
  latest_period: string;
  profitability_and_returns: FinancialMetric[];
  cash_investment_and_conversion: FinancialMetric[];
}

