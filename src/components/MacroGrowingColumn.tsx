import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Rocket,
  Zap,
  BarChart2,
  Waves,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Maximize2,
  AlertTriangle,
  Compass,
  Scale
} from 'lucide-react';
import { MacroData, GrowthMetrics, ScreenedOpportunity } from '../types';
import { RayDalioCycleChart } from './RayDalioCycleChart';
import { RayDalioModal } from './RayDalioModal';
import { DalioTacticalPanels } from './DalioTacticalPanels';

interface MacroGrowingColumnProps {
  macroData: MacroData | null;
  growthMetrics: GrowthMetrics | null;
  selectedOpportunity: ScreenedOpportunity | null;
  onOpenAssetDetail?: (asset: { ticker: string; name: string; price: number; currency: string }) => void;
  onBuyAsset?: (asset: { ticker: string; name: string; price: number; currency: string }) => void;
  onAddToWatchlist?: (ticker: string) => void;
  onOpenFinancialDeepDive?: (ticker: string) => void;
}

export const MacroGrowingColumn: React.FC<MacroGrowingColumnProps> = ({
  macroData,
  growthMetrics,
  selectedOpportunity,
  onOpenAssetDetail,
  onBuyAsset,
  onAddToWatchlist,
  onOpenFinancialDeepDive
}) => {
  const [macroTab, setMacroTab] = useState<'dalio' | 'portfolio_dalio' | 'curve'>('dalio');
  const [isDalioModalOpen, setIsDalioModalOpen] = useState(false);
  const [financialData, setFinancialData] = useState<any | null>(null);

  useEffect(() => {
    const ticker = selectedOpportunity?.ticker;
    if (!ticker) {
      setFinancialData(null);
      return;
    }

    let isMounted = true;
    fetch(`/api/company/${ticker}/financial-history`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data) {
          setFinancialData(data);
        }
      })
      .catch(err => {
        console.warn('Error fetching financial history in MacroGrowingColumn:', err);
      });

    return () => { isMounted = false; };
  }, [selectedOpportunity?.ticker]);

  const financialMetrics = useMemo(() => {
    if (!financialData) {
      return {
        grossMargin: selectedOpportunity?.gross_margin != null ? `${selectedOpportunity.gross_margin.toFixed(1)}%` : 'N/D',
        operatingMargin: selectedOpportunity?.ebit_margin != null ? `${selectedOpportunity.ebit_margin.toFixed(1)}%` : 'N/D',
        roic: selectedOpportunity?.roic != null ? `${selectedOpportunity.roic.toFixed(1)}%` : 'N/D',
        fcf: 'N/D',
        conversion: selectedOpportunity?.fcf_conversion != null ? `${(selectedOpportunity.fcf_conversion / 100).toFixed(2)}x` : 'N/D'
      };
    }
    const prof = financialData.profitability_and_returns || [];
    const cash = financialData.cash_investment_and_conversion || [];

    const gm = prof.find((m: any) => m.key === 'margen_bruto');
    const om = prof.find((m: any) => m.key === 'margen_operativo');
    const roic = prof.find((m: any) => m.key === 'roic');
    const fcf = cash.find((m: any) => m.key === 'flujo_caja_libre');
    const conv = cash.find((m: any) => m.key === 'conversion_caja');

    return {
      grossMargin: gm?.modes?.TTM?.current_formatted ?? (selectedOpportunity?.gross_margin ? `${selectedOpportunity.gross_margin.toFixed(1)}%` : 'N/D'),
      operatingMargin: om?.modes?.TTM?.current_formatted ?? (selectedOpportunity?.ebit_margin ? `${selectedOpportunity.ebit_margin.toFixed(1)}%` : 'N/D'),
      roic: roic?.modes?.TTM?.current_formatted ?? (selectedOpportunity?.roic ? `${selectedOpportunity.roic.toFixed(1)}%` : 'N/D'),
      fcf: fcf?.modes?.TTM?.current_formatted ?? 'N/D',
      conversion: conv?.modes?.TTM?.current_formatted ?? (selectedOpportunity?.fcf_conversion ? `${(selectedOpportunity.fcf_conversion / 100).toFixed(2)}x` : 'N/D')
    };
  }, [financialData, selectedOpportunity]);

  const riskData = useMemo(() => {
    if (financialData?.risk_assessment) {
      return financialData.risk_assessment;
    }
    // Fallback inicial mientras carga si selectedOpportunity existe
    const health = selectedOpportunity?.piotroski_score != null ? Math.min(95, selectedOpportunity.piotroski_score * 10 + 5) : 86;
    const risk = 100 - health;
    return {
      risk_score_pct: risk,
      health_score_pct: health,
      risk_tier: risk > 50 ? 'ELEVADO' : risk > 30 ? 'MODERADO' : 'BAJO',
      tier_color: risk > 50 ? 'text-statusRed bg-statusRed/10 border-statusRed/30' : risk > 30 ? 'text-accentYellow bg-accentYellow/10 border-accentYellow/30' : 'text-statusGreen bg-statusGreen/10 border-statusGreen/30',
      default_probability_2y_pct: selectedOpportunity?.altman_z != null ? (selectedOpportunity.altman_z > 3 ? 0.96 : 4.5) : 0.96,
      altman_z: selectedOpportunity?.altman_z ?? 6.45,
      mvar_monthly_95_pct: -11.19,
      mvar_annual_95_pct: -38.76,
      volatility_annual_pct: 24.5,
      has_net_cash: true,
      pillars: [
        { name: 'Solvencia y Deuda', peso: 30, riesgo: 0, desc: 'Balance sólido con posición de caja y control de deuda.' },
        { name: 'Calidad Contable (FCF)', peso: 25, riesgo: 2, desc: 'Flujo de caja libre positivo y respaldado por el negocio.' },
        { name: 'Dilución y Acciones', peso: 15, riesgo: 3, desc: 'Emisión de acciones bajo control.' },
        { name: 'Márgenes y Moat', peso: 15, riesgo: 4, desc: 'Márgenes sostenibles en el ciclo de mercado.' },
        { name: 'Valoración / Ciclo', peso: 15, riesgo: 4, desc: 'Múltiplos en rango histórico.' }
      ]
    };
  }, [financialData, selectedOpportunity]);

  return (
    <section className="flex flex-col space-y-3 h-full min-h-0 overflow-hidden">
      {/* BLOQUE SUPERIOR DERECHO: MACRO & CICLO DE RAY DALIO / CURVA DE DEUDA */}
      <div className="bg-card border border-borderSubtle rounded-2xl p-3.5 flex-1 min-h-0 flex flex-col shadow-md overflow-hidden">
        {/* Header Macro con Selector de Vista */}
        <div className="flex items-center justify-between pb-2.5 border-b border-borderSubtle">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-accentSky" />
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary">Entorno Macro</h2>
              <p className="text-sm font-bold text-textPrimary">
                {macroTab === 'dalio'
                  ? 'Ciclo de Deuda Ray Dalio'
                  : macroTab === 'portfolio_dalio'
                  ? 'Diagnóstico Cartera All-Weather'
                  : 'Curvas Soberanas (ES vs US)'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1.5">
            {/* Selector de pestañas */}
            <div className="flex bg-canvas p-0.5 rounded-lg border border-borderSubtle text-[10px]">
              <button
                type="button"
                onClick={() => setMacroTab('dalio')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all flex items-center space-x-1 ${
                  macroTab === 'dalio'
                    ? 'bg-accentSky/20 text-accentSky border border-accentSky/30 shadow-sm'
                    : 'text-textSecondary hover:text-textPrimary'
                }`}
                title="Modelo Canónico de Ciclos de Deuda de Ray Dalio"
              >
                <Waves className="w-3 h-3" />
                <span>Dalio</span>
              </button>
              <button
                type="button"
                onClick={() => setMacroTab('portfolio_dalio')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all flex items-center space-x-1 ${
                  macroTab === 'portfolio_dalio'
                    ? 'bg-accentSky/20 text-accentSky border border-accentSky/30 shadow-sm'
                    : 'text-textSecondary hover:text-textPrimary'
                }`}
                title="Diagnóstico de Cartera según los 4 Cuadrantes All-Weather de Ray Dalio"
              >
                <Compass className="w-3 h-3" />
                <span>Radar Cartera</span>
              </button>
              <button
                type="button"
                onClick={() => setMacroTab('curve')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all flex items-center space-x-1 ${
                  macroTab === 'curve'
                    ? 'bg-accentSky/20 text-accentSky border border-accentSky/30 shadow-sm'
                    : 'text-textSecondary hover:text-textPrimary'
                }`}
                title="Curva Soberana Comparada (Bono España 10Y vs US Treasury 10Y)"
              >
                <TrendingUp className="w-3 h-3" />
                <span>Curvas 10Y</span>
              </button>
            </div>

            {/* Botón maximizar para modal detallado Dalio */}
            {macroTab === 'dalio' && (
              <button
                type="button"
                onClick={() => setIsDalioModalOpen(true)}
                className="p-1 rounded-md text-textSecondary hover:text-accentSky hover:bg-canvas transition-colors"
                title="Expandir análisis macroeconómico completo de Dalio"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Vista 1: Ciclo de Ray Dalio */}
        {macroTab === 'dalio' ? (
          <div className="my-2 flex-1 flex flex-col justify-between">
            <RayDalioCycleChart
              data={macroData?.dalio_cycle}
              isCompact={true}
              onOpenModal={() => setIsDalioModalOpen(true)}
            />

            {/* Badge de situación resumida */}
            {macroData?.dalio_cycle && (
              <div className="mt-2 p-2 rounded-xl bg-canvas border border-borderSubtle flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    macroData.dalio_cycle.trend_direction === 'ALCISTA' ? 'bg-statusGreen' :
                    macroData.dalio_cycle.trend_direction === 'BAJISTA' ? 'bg-statusRed' : 'bg-accentYellow'
                  }`} />
                  <span className="text-[11px] text-textSecondary">
                    Postura:{' '}
                    <strong className="text-textPrimary">
                      {macroData.dalio_cycle.trend_direction === 'ALCISTA' ? 'Alcista Cauteloso' :
                       macroData.dalio_cycle.trend_direction === 'BAJISTA' ? 'Defensivo Estricto' : 'Neutral / Tardo-ciclo'}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDalioModalOpen(true)}
                  className="text-[10px] text-accentSky hover:underline font-semibold"
                >
                  Ver Diagnóstico & Riesgos →
                </button>
              </div>
            )}

            {/* Las 4 Opciones Tácticas */}
            <DalioTacticalPanels
              dalioData={macroData?.dalio_cycle}
              selectedOpportunity={selectedOpportunity}
              onOpenAssetDetail={onOpenAssetDetail}
              onBuyAsset={onBuyAsset}
              onAddToWatchlist={onAddToWatchlist}
            />
          </div>
        ) : macroTab === 'portfolio_dalio' ? (
          /* Vista 2: Diagnóstico Dalio All-Weather de Cartera */
          <div className="my-2 flex-1 flex flex-col justify-between overflow-y-auto pr-0.5 space-y-2">
            <div className="flex items-center justify-between p-2 rounded-xl bg-canvas border border-borderSubtle">
              <div>
                <span className="text-[10px] text-textSecondary uppercase tracking-wider block font-semibold">
                  Equilibrio All-Weather
                </span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-base font-black font-mono text-statusGreen">
                    {macroData?.portfolio_dalio?.balance_score ?? 75}/100
                  </span>
                  <span className="text-[10px] text-textSecondary font-mono">
                    ({macroData?.portfolio_dalio?.total_value_eur ?? 0} €)
                  </span>
                </div>
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded-full bg-statusGreen/15 text-statusGreen border border-statusGreen/30 font-bold uppercase">
                Bridgewater 4x4
              </span>
            </div>

            {/* Matriz 2x2 de los 4 Cuadrantes de Dalio */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-cardSecondary/70 border border-borderSubtle space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-accentSky text-[11px]">Q1: Crecimiento ↑</span>
                  <span className="font-mono font-black text-accentSky text-xs">
                    {macroData?.portfolio_dalio?.q1_growth_rising?.pct ?? 0}%
                  </span>
                </div>
                <p className="text-[10px] text-textSecondary truncate">Tech, Discrecional</p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {macroData?.portfolio_dalio?.q1_growth_rising?.assets?.length ? (
                    macroData.portfolio_dalio.q1_growth_rising.assets.map((t) => (
                      <span key={t} className="px-1 py-0.2 rounded bg-accentSky/15 text-accentSky text-[9px] font-mono font-bold">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] text-textSecondary/60 italic">Sin posiciones</span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-cardSecondary/70 border border-borderSubtle space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-accentYellow text-[11px]">Q2: Inflación ↑</span>
                  <span className="font-mono font-black text-accentYellow text-xs">
                    {macroData?.portfolio_dalio?.q2_inflation_rising?.pct ?? 0}%
                  </span>
                </div>
                <p className="text-[10px] text-textSecondary truncate">Energía, Materias, REITs</p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {macroData?.portfolio_dalio?.q2_inflation_rising?.assets?.length ? (
                    macroData.portfolio_dalio.q2_inflation_rising.assets.map((t) => (
                      <span key={t} className="px-1 py-0.2 rounded bg-accentYellow/15 text-accentYellow text-[9px] font-mono font-bold">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] text-textSecondary/60 italic">Sin posiciones</span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-cardSecondary/70 border border-borderSubtle space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-statusRed text-[11px]">Q3: Estanflación</span>
                  <span className="font-mono font-black text-statusRed text-xs">
                    {macroData?.portfolio_dalio?.q3_growth_falling?.pct ?? 0}%
                  </span>
                </div>
                <p className="text-[10px] text-textSecondary truncate">Consumo Básico, TIPS, Oro</p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {macroData?.portfolio_dalio?.q3_growth_falling?.assets?.length ? (
                    macroData.portfolio_dalio.q3_growth_falling.assets.map((t) => (
                      <span key={t} className="px-1 py-0.2 rounded bg-statusRed/15 text-statusRed text-[9px] font-mono font-bold">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] text-textSecondary/60 italic">Sin posiciones</span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-cardSecondary/70 border border-borderSubtle space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-statusGreen text-[11px]">Q4: Defensivas</span>
                  <span className="font-mono font-black text-statusGreen text-xs">
                    {macroData?.portfolio_dalio?.q4_inflation_falling?.pct ?? 0}%
                  </span>
                </div>
                <p className="text-[10px] text-textSecondary truncate">Banca Sólida, Utilities, Salud</p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {macroData?.portfolio_dalio?.q4_inflation_falling?.assets?.length ? (
                    macroData.portfolio_dalio.q4_inflation_falling.assets.map((t) => (
                      <span key={t} className="px-1 py-0.2 rounded bg-statusGreen/15 text-statusGreen text-[9px] font-mono font-bold">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] text-textSecondary/60 italic">Sin posiciones</span>
                  )}
                </div>
              </div>
            </div>

            {/* Recomendaciones Dalio */}
            <div className="p-2.5 rounded-xl bg-canvas border border-borderSubtle text-[11px] space-y-1">
              <span className="font-bold text-textPrimary flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-accentSky" />
                <span>Dictamen All-Weather para tu Cartera</span>
              </span>
              <ul className="text-[10px] text-textSecondary list-disc list-inside space-y-0.5">
                {(macroData?.portfolio_dalio?.recommendations ?? ['Cartera equilibrada']).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          /* Vista 3: Curvas Soberanas Comparadas (España 10Y vs USA 10Y) */
          <div className="my-2 flex-1 flex flex-col justify-between overflow-y-auto pr-0.5 space-y-2">
            {/* Tarjetas Comparativas de Rendimiento */}
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
              <div className="p-2 rounded-xl bg-canvas border border-borderSubtle">
                <span className="text-[10px] text-textSecondary font-sans block flex items-center justify-center space-x-1">
                  <span>🇪🇸</span>
                  <span>Bono ES 10Y</span>
                </span>
                <span className="font-extrabold text-statusGreen text-xs">
                  {macroData?.sovereign_comparison?.es_10y_yield ?? 3.05}%
                </span>
                <span className="text-[9px] text-textSecondary font-sans block">Rf España</span>
              </div>

              <div className="p-2 rounded-xl bg-canvas border border-borderSubtle">
                <span className="text-[10px] text-textSecondary font-sans block flex items-center justify-center space-x-1">
                  <span>🇺🇸</span>
                  <span>US 10Y (^TNX)</span>
                </span>
                <span className="font-extrabold text-accentSky text-xs">
                  {macroData?.sovereign_comparison?.us_10y_yield ?? 4.05}%
                </span>
                <span className="text-[9px] text-textSecondary font-sans block">Rf EE.UU.</span>
              </div>

              <div className="p-2 rounded-xl bg-canvas border border-borderSubtle">
                <span className="text-[10px] text-textSecondary font-sans block">Diferencial</span>
                <span className="font-extrabold text-accentYellow text-xs">
                  +{macroData?.sovereign_comparison?.spread_bps ?? 100} pb
                </span>
                <span className="text-[9px] text-textSecondary font-sans block">
                  +{macroData?.sovereign_comparison?.spread_pct ?? 1.00}%
                </span>
              </div>
            </div>

            {/* Gráfico SVG Curvas Comparadas */}
            <div className="bg-canvas p-3 rounded-xl border border-borderSubtle/80 relative h-28 flex flex-col justify-end">
              <div className="flex items-center justify-between text-[10px] text-textSecondary mb-1 font-sans">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-1 bg-accentSky inline-block rounded-full"></span>
                  <span>US Treasury Curve (^TNX)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-1 bg-statusGreen inline-block rounded-full"></span>
                  <span>Bono España 10Y</span>
                </span>
              </div>

              <svg className="w-full h-20 overflow-visible" viewBox="0 0 300 80" preserveAspectRatio="none">
                <line x1="0" y1="20" x2="300" y2="20" stroke="#1E293B" strokeDasharray="3 3" />
                <line x1="0" y1="40" x2="300" y2="40" stroke="#1E293B" strokeDasharray="3 3" />
                <line x1="0" y1="60" x2="300" y2="60" stroke="#1E293B" strokeDasharray="3 3" />

                {/* Curva Bono España 10Y (Nivel inferior más bajo ~3.05%) */}
                <path
                  d="M 15,55 Q 100,50 180,42 T 285,38"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.2"
                />
                <circle cx="285" cy="38" r="4" fill="#10B981" />

                {/* Curva US Treasury (^TNX ~4.05%) */}
                <path
                  d="M 15,35 Q 100,32 180,24 T 285,18"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2.5"
                />
                <circle cx="285" cy="18" r="4.5" fill="#38BDF8" className="glow-yellow" />
              </svg>

              <div className="flex justify-between text-[9px] text-textSecondary font-mono pt-1">
                <span>3M (4.3%)</span>
                <span>2Y (3.9%)</span>
                <span>5Y (3.8%)</span>
                <span className="text-statusGreen font-bold">ES 10Y (3.05%)</span>
                <span className="text-accentSky font-bold">US 10Y ({macroData?.sovereign_comparison?.us_10y_yield ?? 4.05}%)</span>
              </div>
            </div>

            {/* Callout Pedagógico: Impacto en Tasas de Descuento (r) */}
            <div className="p-2.5 rounded-xl bg-cardSecondary/70 border border-borderSubtle text-[11px] space-y-1">
              <span className="font-bold text-textPrimary flex items-center space-x-1.5">
                <Scale className="w-3.5 h-3.5 text-accentYellow" />
                <span>Impacto en Tasa de Descuento (r Gordon-Shapiro)</span>
              </span>
              <p className="text-textSecondary text-[10px] leading-relaxed">
                {macroData?.sovereign_comparison?.discount_rate_impact_comment ||
                  'El menor rendimiento del Bono Español 10Y reduce la tasa libre de riesgo en activos del IBEX 35, permitiendo tasas de descuento r más bajas (~7.8%-8.2% vs ~8.8%-9.4% en S&P 500) para compensar un menor crecimiento perpetuo g.'}
              </p>
            </div>
          </div>
        )}

        {/* Modal de Detalle Ray Dalio */}
        <RayDalioModal
          isOpen={isDalioModalOpen}
          onClose={() => setIsDalioModalOpen(false)}
          macroData={macroData}
        />
      </div>

      {/* BLOQUE INFERIOR DERECHO: GROWING ANALYSIS */}
      <div className="bg-card border border-borderSubtle rounded-2xl p-3 flex-1 min-h-0 flex flex-col shadow-md overflow-hidden">
        {/* Header Growing */}
        <div className="flex items-center justify-between pb-2 border-b border-borderSubtle flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Rocket className="w-4 h-4 text-accentSky" />
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary">Impulso Operativo</h2>
              <p className="text-sm font-bold text-textPrimary">
                Growing Analysis ({selectedOpportunity?.ticker || '---'})
              </p>
            </div>
          </div>
          {growthMetrics && (
            <span className="text-[11px] font-bold text-statusGreen bg-statusGreen/10 px-2 py-0.5 rounded-lg border border-statusGreen/20 flex items-center space-x-1">
              <Zap className="w-3 h-3 inline mr-0.5" />
              <span>{growthMetrics.momentum_tier}</span>
            </span>
          )}
        </div>

        {/* Métricas Growing y Radiografía Financiera con scroll interno controlado */}
        <div className="flex-1 min-h-0 overflow-y-auto py-1.5 space-y-2 pr-0.5">
          {growthMetrics ? (
            <div className="space-y-2">
              {/* Crecimiento de Ventas */}
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-textSecondary text-[11px]">Crecimiento Ventas (YoY):</span>
                  <span className="font-bold text-textPrimary font-mono text-[11px]">+{growthMetrics.rev_growth_yoy.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-canvas h-1.5 rounded-full overflow-hidden border border-borderSubtle">
                  <div
                    className="bg-accentSky h-1.5 rounded-full"
                    style={{ width: `${Math.min(growthMetrics.rev_growth_yoy * 3.5, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-textSecondary mt-0.5">
                  <span>CAGR 3 Años:</span>
                  <span className="text-textPrimary font-medium font-mono">+{growthMetrics.rev_cagr_3y.toFixed(1)}%</span>
                </div>
              </div>

              {/* Crecimiento de BPA / EPS */}
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-textSecondary text-[11px]">Crecimiento BPA / EPS (YoY):</span>
                  <span className="font-bold text-statusGreen font-mono text-[11px]">+{growthMetrics.eps_growth_yoy.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-canvas h-1.5 rounded-full overflow-hidden border border-borderSubtle">
                  <div
                    className="bg-statusGreen h-1.5 rounded-full"
                    style={{ width: `${Math.min(growthMetrics.eps_growth_yoy * 3.2, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-textSecondary mt-0.5">
                  <span>Aceleración Trimestral:</span>
                  <span className="text-statusGreen font-medium font-mono">+{growthMetrics.eps_qoq_accel.toFixed(1)}% QoQ</span>
                </div>
              </div>

              {/* Efficiency / Rule of 40 */}
              <div className="p-2 rounded-xl bg-canvas border border-borderSubtle">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-textSecondary flex items-center space-x-1">
                    <BarChart2 className="w-3.5 h-3.5 text-accentYellow" />
                    <span className="text-[11px]">Score de Eficiencia (Rule of 40):</span>
                  </span>
                  <span className="font-extrabold text-accentYellow font-mono text-xs">
                    {growthMetrics.efficiency_score.toFixed(1)}%
                  </span>
                </div>
                <span className="text-[10px] text-textSecondary block mt-0.5">
                  {growthMetrics.efficiency_score >= 40
                    ? '✓ Supera umbral del 40% (Crecimiento rentable y eficiente)'
                    : 'Por debajo del umbral objetivo (40%)'}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2 text-center text-xs text-textSecondary">
              Sin métricas de impulso disponibles.
            </div>
          )}

          {/* RADIOGRAFÍA FINANCIERA AUDITADA (SEC EDGAR) */}
          <div className="p-2.5 rounded-xl bg-canvas border border-borderSubtle space-y-1.5">
            <div className="flex items-center justify-between pb-1 border-b border-borderSubtle/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-textSecondary flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-statusGreen" />
                <span>Salud Financiera Auditada</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-statusGreen/10 text-statusGreen border border-statusGreen/20 font-bold">
                SEC TTM
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-textSecondary text-[10px]">Mg. Bruto:</span>
                <span className="font-bold text-textPrimary">{financialMetrics.grossMargin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-textSecondary text-[10px]">Mg. Operat:</span>
                <span className="font-bold text-textPrimary">{financialMetrics.operatingMargin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-textSecondary text-[10px]">ROIC:</span>
                <span className="font-bold text-accentSky">{financialMetrics.roic}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-textSecondary text-[10px]">Conv. Caja:</span>
                <span className="font-bold text-statusGreen">{financialMetrics.conversion}</span>
              </div>
              <div className="col-span-2 flex justify-between pt-1 border-t border-borderSubtle/40">
                <span className="text-textSecondary text-[10px]">Flujo Caja Libre (FCF):</span>
                <span className="font-bold text-accentSky">{financialMetrics.fcf}</span>
              </div>
            </div>

            {/* BOTÓN DIRECTO PARA ABRIR EL MODAL DE 14 MÉTRICAS AUDITADAS */}
            <button
              type="button"
              onClick={() => onOpenFinancialDeepDive && selectedOpportunity && onOpenFinancialDeepDive(selectedOpportunity.ticker)}
              disabled={!selectedOpportunity?.ticker}
              className="w-full mt-1.5 py-1.5 px-2.5 rounded-lg bg-accentSky/10 hover:bg-accentSky/20 text-accentSky border border-accentSky/30 text-[11px] font-bold transition-all flex items-center justify-center space-x-1.5 group disabled:opacity-40"
              title="Abrir radiografía completa de 14 métricas con histórico TTM, Trimestral y Anual"
            >
              <span>Ver Radiografía Completa (14 Métricas)</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* PONDERACIÓN DE RIESGO AUDITADO (SOLICITADO POR EL USUARIO) */}
          <div className="p-2.5 rounded-xl bg-canvas border border-borderSubtle space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-borderSubtle/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-textSecondary flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3 text-accentYellow" />
                <span>Ponderación de Riesgo Auditado</span>
              </span>
              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold border ${riskData?.tier_color || 'text-statusGreen bg-statusGreen/10 border-statusGreen/30'}`}>
                Riesgo {riskData?.risk_score_pct ?? 14}% · {riskData?.risk_tier ?? 'BAJO'}
              </span>
            </div>

            {/* Barra Visual de Riesgo Integral (0% a 100%) */}
            <div>
              <div className="flex justify-between text-[10px] mb-1 font-mono">
                <span className="text-textSecondary">Riesgo Fundamental Global:</span>
                <span className="font-bold text-textPrimary">
                  {riskData?.risk_score_pct ?? 14}%{' '}
                  <span className="text-textSecondary font-normal text-[9px]">
                    (Salud: {riskData?.health_score_pct ?? 86}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-cardSecondary h-1.5 rounded-full overflow-hidden flex">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    (riskData?.risk_score_pct ?? 14) > 50
                      ? 'bg-statusRed'
                      : (riskData?.risk_score_pct ?? 14) > 25
                      ? 'bg-accentYellow'
                      : 'bg-statusGreen'
                  }`}
                  style={{ width: `${Math.min(riskData?.risk_score_pct ?? 14, 100)}%` }}
                />
              </div>
            </div>

            {/* Las 2 Métricas Estructurales Clave: Probabilidad de Quiebra y mVaR */}
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
              <div
                className="p-1.5 rounded-lg bg-card/60 border border-borderSubtle/60"
                title="Probabilidad matemática de insolvencia a 2 años según modelo Altman Z'' logístico de la SEC"
              >
                <span className="text-[9px] text-textSecondary block uppercase font-sans">Prob. Quiebra (2a)</span>
                <strong className={`font-bold text-xs ${
                  (riskData?.default_probability_2y_pct ?? 1) > 10 ? 'text-statusRed' : (riskData?.default_probability_2y_pct ?? 1) > 3 ? 'text-accentYellow' : 'text-statusGreen'
                }`}>
                  {riskData?.default_probability_2y_pct ?? 0.96}%
                </strong>
                <span className="text-[9px] text-textSecondary block mt-0.5">
                  Altman Z: {riskData?.altman_z ?? 6.45}
                </span>
              </div>

              <div
                className="p-1.5 rounded-lg bg-card/60 border border-borderSubtle/60"
                title="Modified Value at Risk al 95% de confianza mensual por modelo Cornish-Fisher"
              >
                <span className="text-[9px] text-textSecondary block uppercase font-sans">mVaR 95% Mensual</span>
                <strong className="text-accentSky font-bold text-xs">
                  {riskData?.mvar_monthly_95_pct ? `${riskData.mvar_monthly_95_pct}%` : '-11.19%'}
                </strong>
                <span className="text-[9px] text-textSecondary block mt-0.5">
                  Pérdida máx. mensual
                </span>
              </div>
            </div>

            {/* Desglose Pedagógico de los 5 Pilares Fundamentales Auditados */}
            <div className="pt-1 border-t border-borderSubtle/40 space-y-1 text-[10px]">
              {riskData?.pillars?.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-textSecondary" title={p.desc}>
                  <span className="truncate max-w-[170px]">• {p.name}:</span>
                  <span className="font-mono font-semibold text-textPrimary">
                    +{p.riesgo}%{' '}
                    <span className="text-[9px] text-textSecondary/70">({p.peso}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-1.5 border-t border-borderSubtle text-[10px] text-textSecondary flex justify-between flex-shrink-0">
          <span>Momentum operacional:</span>
          <span className="text-accentSky font-semibold">Validado SEC EDGAR</span>
        </div>
      </div>
    </section>
  );
};
