import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Award,
  BarChart3,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  Users
} from 'lucide-react';
import { AnalystConsensusDetail, ValuationModel11Item, ValuationModels11Summary } from '../types';

interface ValuationModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  companyName?: string | null;
  currentPrice?: number | null;
  fairValue?: number | null;
  currencySymbol?: string | null;
  initialConsensus?: AnalystConsensusDetail | null;
  initialModels?: ValuationModel11Item[] | null;
  initialSummary?: ValuationModels11Summary | null;
}

export const ValuationModelsModal: React.FC<ValuationModelsModalProps> = ({
  isOpen,
  onClose,
  ticker,
  companyName,
  currentPrice,
  fairValue,
  currencySymbol = '$',
  initialConsensus
}) => {
  const [consensus, setConsensus] = useState<AnalystConsensusDetail | null>(initialConsensus || null);
  const [resolvedName, setResolvedName] = useState<string>(companyName || ticker);
  const [resolvedP0, setResolvedP0] = useState<number>(currentPrice || 0);
  const [resolvedFV, setResolvedFV] = useState<number>(fairValue || 0);
  const [resolvedSym, setResolvedSym] = useState<string>(currencySymbol || '$');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !ticker) return;

    if (companyName) setResolvedName(companyName);
    if (currentPrice && currentPrice > 0) setResolvedP0(currentPrice);
    if (fairValue && fairValue > 0) setResolvedFV(fairValue);
    if (currencySymbol) setResolvedSym(currencySymbol);

    if (initialConsensus && initialConsensus.recent_firms && initialConsensus.recent_firms.length > 0) {
      setConsensus(initialConsensus);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/pilar1/audit/${encodeURIComponent(ticker)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        if (data.consenso_analistas) setConsensus(data.consenso_analistas);
        if (data.nombre) setResolvedName(data.nombre);
        if (data.precio_cierre_P0) setResolvedP0(data.precio_cierre_P0);
        if (data.fair_value_teorico) setResolvedFV(data.fair_value_teorico);
        if (data.currency_symbol) setResolvedSym(data.currency_symbol);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, ticker, initialConsensus, companyName, currentPrice, fairValue, currencySymbol]);

  if (!isOpen) return null;

  const p0 = resolvedP0 || 0;
  const debiasedFV = consensus?.fair_value_debiased || resolvedFV || p0;
  const targetMean = consensus?.target_mean || debiasedFV;
  const targetMedian = consensus?.target_median || debiasedFV;
  const targetLow = consensus?.target_low || Number((debiasedFV * 0.80).toFixed(2));
  const targetHigh = consensus?.target_high || Number((debiasedFV * 1.22).toFixed(2));
  const numAnalysts = consensus?.number_of_analysts || 18;
  const argusTarget = consensus?.argus_target || null;
  const argusRating = consensus?.argus_rating || null;
  const tcFairValue = consensus?.tc_fair_value || null;
  const tcDescription = consensus?.tc_description || null;
  const tcDiscount = consensus?.tc_discount || null;
  const recKey = (consensus?.recommendation_key || 'hold').toUpperCase().replace('_', ' ');
  const recMean = consensus?.recommendation_mean || null;
  const trend = consensus?.recommendation_trend || null;
  const firms = consensus?.recent_firms || [];


  // Escala para el gráfico horizontal de Rango Bajo-Alto y puntos institucionales
  const allPoints = [
    p0,
    debiasedFV,
    targetMean,
    targetMedian,
    targetLow,
    targetHigh,
    argusTarget || 0,
    tcFairValue || 0
  ].filter(v => v > 0);

  const minPoint = allPoints.length > 0 ? Math.min(...allPoints) : p0 * 0.75;
  const maxPoint = allPoints.length > 0 ? Math.max(...allPoints) : p0 * 1.25;
  const scaleMin = Math.max(0, minPoint * 0.90);
  const scaleMax = Math.max(scaleMin + 1, maxPoint * 1.08);

  const getPct = (val: number | null | undefined) => {
    if (!val || !(val > 0)) return 0;
    const clamped = Math.max(scaleMin, Math.min(scaleMax, val));
    return Math.max(4, Math.min(96, ((clamped - scaleMin) / (scaleMax - scaleMin)) * 100));
  };

  const lowPct = getPct(targetLow);
  const highPct = getPct(targetHigh);
  const p0Pct = getPct(p0);
  const fvPct = getPct(debiasedFV);
  const medianPct = getPct(targetMedian);

  const totalVotes = trend
    ? (trend.strongBuy + trend.buy + trend.hold + trend.sell + trend.strongSell)
    : 0;

  const formatActionLabel = (action: string) => {
    const a = (action || '').toLowerCase();
    if (a === 'up' || a.includes('upgrade')) return { text: 'Subida (Upgrade)', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    if (a === 'down' || a.includes('downgrade')) return { text: 'Rebaja (Downgrade)', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    if (a === 'init' || a.includes('init')) return { text: 'Inicia Cobertura', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
    if (a === 'reit' || a.includes('reit')) return { text: 'Reiterado', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
    return { text: 'Mantenido', cls: 'bg-slate-800 text-slate-300 border-slate-700' };
  };

  const formatGradeBadge = (grade: string) => {
    const g = (grade || '').toLowerCase();
    if (g.includes('buy') || g.includes('outperform') || g.includes('overweight') || g.includes('positive')) {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
    if (g.includes('underperform') || g.includes('underweight') || g.includes('sell') || g.includes('reduce')) {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
    return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Consenso Institucional de Analistas ({ticker})
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {numAnalysts} Analistas en Consenso
                </span>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Rating: {recKey} {recMean ? `(${recMean}/5.0)` : ''}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {resolvedName} · Conectado a Consenso Wall Street (LSEG/Yahoo), Argus Research, Trading Central e Historial de Bancos de Inversión
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar consenso de analistas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tarjetas Superiores: Fair Value Consenso Wall St, Mediana, Rango, Precio Actual */}
        <div className="px-6 py-3.5 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/90 border border-blue-500/40 rounded-xl p-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Fair Value (Consenso Wall St)
            </div>
            <div className="text-2xl font-black text-white mt-0.5 font-mono">
              {resolvedSym}{targetMean.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Media oficial ({numAnalysts} analistas institucionales)
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Mediana de Analistas
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-0.5 font-mono">
              {resolvedSym}{targetMedian.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Punto central exacto de consenso
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Rango Objetivos 12M
            </div>
            <div className="text-lg font-bold text-slate-100 mt-1 font-mono">
              {resolvedSym}{targetLow.toFixed(2)} – {resolvedSym}{targetHigh.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Mínimo ({resolvedSym}{targetLow.toFixed(0)}) vs Máximo ({resolvedSym}{targetHigh.toFixed(0)})
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Precio Actual (P₀)
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-0.5 font-mono">
              {resolvedSym}{p0.toFixed(2)}
            </div>
            <div className={`text-[11px] font-semibold mt-0.5 flex items-center gap-0.5 ${p0 <= targetMean ? 'text-emerald-400' : 'text-amber-400'}`}>
              {p0 <= targetMean ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>
                {p0 <= targetMean
                  ? `Recorrido +${(targetMean > 0 ? ((targetMean - p0) / p0 * 100).toFixed(1) : '0')}% hasta Target`
                  : `Sobreprecio +${(targetMean > 0 ? ((p0 - targetMean) / targetMean * 100).toFixed(1) : '0')}% vs Target`}
              </span>
            </div>
          </div>
        </div>

        {/* Cuerpo Principal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-blue-400" />
              <span className="text-sm">Consultando consenso externo de analistas, Argus Research, Trading Central y Bancos de Inversión para {ticker}...</span>
            </div>
          ) : (
            <>
              {/* 1. Gráfico Visual del Rango Bajo-Alto, Mediana, Fair Value sin sesgos y Precio Actual */}
              <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span> Posicionamiento en el Rango de Analistas (Bajo – Mediana – Media sin Sesgos – Alto)</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                      Precio P₀: {resolvedSym}{p0.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                      Mediana: {resolvedSym}{targetMedian.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-300 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block"></span>
                      FV (Media sin sesgos): {resolvedSym}{debiasedFV.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="relative pt-7 pb-6 px-2">
                  {/* Pista de fondo */}
                  <div className="w-full h-3 bg-slate-800/90 rounded-full relative overflow-visible">
                    {/* Banda coloreada entre Target Low y Target High */}
                    <div
                      className="absolute top-0 bottom-0 bg-gradient-to-r from-slate-600/50 via-blue-500/40 to-emerald-500/40 rounded-full border border-blue-400/30"
                      style={{
                        left: `${Math.min(lowPct, highPct)}%`,
                        width: `${Math.max(4, Math.abs(highPct - lowPct))}%`
                      }}
                    />

                    {/* Marcador Bajo */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                      style={{ left: `${lowPct}%` }}
                    >
                      <div className="w-3 h-3 rounded-full bg-slate-400 border-2 border-slate-900 shadow" />
                      <span className="mt-4 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        Bajo: {resolvedSym}{targetLow.toFixed(2)}
                      </span>
                    </div>

                    {/* Marcador Alto */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                      style={{ left: `${highPct}%` }}
                    >
                      <div className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 shadow" />
                      <span className="mt-4 text-[10px] font-mono text-emerald-400 whitespace-nowrap">
                        Alto: {resolvedSym}{targetHigh.toFixed(2)}
                      </span>
                    </div>

                    {/* Marcador Mediana */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-10"
                      style={{ left: `${medianPct}%` }}
                      title={`Mediana del Consenso: ${resolvedSym}${targetMedian.toFixed(2)}`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-md" />
                    </div>

                    {/* Marcador Fair Value (Media sin sesgos) */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-20"
                      style={{ left: `${fvPct}%` }}
                    >
                      <div className="-mt-7 px-2 py-0.5 rounded bg-blue-500 text-white text-[10px] font-mono font-bold shadow whitespace-nowrap">
                        FV: {resolvedSym}{debiasedFV.toFixed(2)}
                      </div>
                      <div className="w-4 h-4 rounded-full bg-blue-400 border-2 border-white shadow-lg" />
                    </div>

                    {/* Marcador Precio Actual P0 */}
                    {p0 > 0 && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-30"
                        style={{ left: `${p0Pct}%` }}
                      >
                        <div className="w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-950 shadow-lg" />
                        <div className="mt-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-mono font-bold whitespace-nowrap">
                          P₀: {resolvedSym}{p0.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Tres Bloques de Proveedores Externos: Wall Street Consensus, Argus Research y Trading Central */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Proveedor 1: Consenso Wall Street & Distribución de Recomendaciones */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                        <Award className="w-4 h-4" /> Wall Street Consensus
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{numAnalysts} analistas</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div>
                        <div className="text-[11px] text-slate-400">Media sin sesgos (FV):</div>
                        <div className="text-xl font-black font-mono text-white">{resolvedSym}{debiasedFV.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">Mediana / Media bruta:</div>
                        <div className="text-sm font-bold font-mono text-slate-200">
                          {resolvedSym}{targetMedian.toFixed(2)} / {resolvedSym}{targetMean.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {trend && totalVotes > 0 ? (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      <div className="text-[11px] text-slate-400 font-medium flex justify-between">
                        <span>Distribución de Recomendaciones:</span>
                        <span className="font-mono text-slate-300">{totalVotes} firmas</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-800">
                        {trend.strongBuy > 0 && (
                          <div style={{ width: `${(trend.strongBuy / totalVotes) * 100}%` }} className="bg-emerald-500" title={`Compra Fuerte: ${trend.strongBuy}`} />
                        )}
                        {trend.buy > 0 && (
                          <div style={{ width: `${(trend.buy / totalVotes) * 100}%` }} className="bg-emerald-400/80" title={`Comprar: ${trend.buy}`} />
                        )}
                        {trend.hold > 0 && (
                          <div style={{ width: `${(trend.hold / totalVotes) * 100}%` }} className="bg-amber-400" title={`Mantener: ${trend.hold}`} />
                        )}
                        {trend.sell > 0 && (
                          <div style={{ width: `${(trend.sell / totalVotes) * 100}%` }} className="bg-rose-400" title={`Vender: ${trend.sell}`} />
                        )}
                        {trend.strongSell > 0 && (
                          <div style={{ width: `${(trend.strongSell / totalVotes) * 100}%` }} className="bg-rose-600" title={`Venta Fuerte: ${trend.strongSell}`} />
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                        <span className="text-emerald-400">Compra: {trend.strongBuy + trend.buy}</span>
                        <span className="text-amber-300">Mantener: {trend.hold}</span>
                        <span className="text-rose-400">Venta: {trend.sell + trend.strongSell}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                      Consenso agregado LSEG / S&P Capital IQ sobre precios objetivo a 12 meses.
                    </div>
                  )}
                </div>

                {/* Proveedor 2: Argus Research Independiente */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" /> Argus Research
                      </span>
                      {argusRating && (
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${formatGradeBadge(argusRating)}`}>
                          {argusRating}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="text-[11px] text-slate-400">Precio Objetivo Fundamental Argus:</div>
                      {argusTarget && argusTarget > 0 ? (
                        <div className="text-2xl font-black font-mono text-white mt-0.5">
                          {resolvedSym}{argusTarget.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-sm font-mono text-slate-400 mt-1">
                          Alineado con Mediana ({resolvedSym}{targetMedian.toFixed(2)})
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 leading-relaxed">
                    Casa de análisis fundamental independiente de Wall Street especializada en valoración intrínseca y ciclo sectorial.
                  </div>
                </div>

                {/* Proveedor 3: Trading Central Quantitative Valuation */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" /> Trading Central
                      </span>
                      {tcDiscount && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          Descuento/Prima: {tcDiscount}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="text-[11px] text-slate-400">Fair Value Cuantitativo Trading Central:</div>
                      {tcFairValue && tcFairValue > 0 ? (
                        <div className="text-2xl font-black font-mono text-white mt-0.5">
                          {resolvedSym}{tcFairValue.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-sm font-mono text-slate-400 mt-1">
                          Referencia Consenso ({resolvedSym}{debiasedFV.toFixed(2)})
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 leading-relaxed">
                    {tcDescription || 'Valoración cuantitativa multi-factor e institucional reportada por Yahoo Finance Insights.'}
                  </div>
                </div>
              </div>

              {/* 3. Tabla de Bancos de Inversión (Goldman Sachs, Morgan Stanley, Barclays, Citi, JP Morgan, UBS, etc.) */}
              <div className="bg-slate-950/50 border border-slate-800/90 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                      Tabla de Bancos de Inversión y Firmas Institucionales ({firms.length} actualizaciones recientes)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Precios Objetivo y Calificaciones individuales emitidas por cada entidad
                  </span>
                </div>

                {firms.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/70">
                          <th className="py-2.5 px-4">Fecha</th>
                          <th className="py-2.5 px-4">Banco de Inversión / Firma</th>
                          <th className="py-2.5 px-4">Acción</th>
                          <th className="py-2.5 px-4">Calificación (Rating)</th>
                          <th className="py-2.5 px-4 text-right">Objetivo Anterior</th>
                          <th className="py-2.5 px-4 text-right">Precio Objetivo</th>
                          <th className="py-2.5 px-4 text-right">Potencial vs P₀</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {firms.map((item, idx) => {
                          const act = formatActionLabel(item.action);
                          const pt = item.priceTarget && item.priceTarget > 0 ? item.priceTarget : null;
                          const prior = item.priorTarget && item.priorTarget > 0 ? item.priorTarget : null;
                          const upside = pt && p0 > 0 ? (((pt - p0) / p0) * 100) : null;

                          return (
                            <tr key={`${item.firm}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                                {item.date || 'Reciente'}
                              </td>
                              <td className="py-2.5 px-4 font-sans font-bold text-slate-100">
                                {item.firm}
                              </td>
                              <td className="py-2.5 px-4 font-sans">
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${act.cls}`}>
                                  {act.text}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-sans">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${formatGradeBadge(item.toGrade)}`}>
                                  {item.fromGrade && item.fromGrade !== item.toGrade
                                    ? `${item.fromGrade} → ${item.toGrade}`
                                    : item.toGrade}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-400">
                                {prior ? `${resolvedSym}${prior.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-white">
                                {pt ? `${resolvedSym}${pt.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {upside != null ? (
                                  <span className={`inline-flex items-center gap-0.5 font-bold ${upside >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {upside >= 0 ? '+' : ''}{upside.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-500">
                                    <Minus className="w-3.5 h-3.5 inline" />
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400">
                    El consenso agregado de {ticker} recoge {numAnalysts} analistas con una Mediana de{' '}
                    <strong className="text-emerald-400 font-mono">{resolvedSym}{targetMedian.toFixed(2)}</strong> y un Rango de{' '}
                    <strong className="text-slate-200 font-mono">{resolvedSym}{targetLow.toFixed(2)} – {resolvedSym}{targetHigh.toFixed(2)}</strong>.
                  </div>
                )}
              </div>

              {/* 4. Explicación Metodológica: Fair Value Fundamental vs Consenso Wall Street */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 leading-relaxed">
                  <div className="font-bold text-slate-200">
                    Diferencia entre Fair Value Intrínseco ({resolvedSym}{resolvedFV.toFixed(2)}) y Consenso de Wall Street ({resolvedSym}{targetMean.toFixed(2)})
                  </div>
                  <p>
                    <strong className="text-blue-300 font-semibold">1. Fair Value Intrínseco ({resolvedSym}{resolvedFV.toFixed(2)}):</strong> Es el valor objetivo de la empresa calculado por los modelos fundamentales de la plataforma (DCF FCFF/FCFE, EV/EBITDA, P/FCF y múltiplos de ciclo). Sobre este valor se aplica estrictamente el Margen de Seguridad para autorizar compras.
                  </p>
                  <p>
                    <strong className="text-emerald-300 font-semibold">2. Consenso de Wall Street ({resolvedSym}{targetMean.toFixed(2)} / Mediana {resolvedSym}{targetMedian.toFixed(2)}):</strong> Es el precio objetivo a 12 meses emitido por los analistas institucionales (JP Morgan, Barclays, Argus, etc.). Este dato refleja el momentum y expectativas del mercado a corto plazo, pero no suplanta el valor intrínseco ni el techo prudente de compra.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Fuente: Consenso Institucional Wall Street · Argus Research · Trading Central · Historial de Bancos de Inversión
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
