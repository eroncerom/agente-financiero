import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  TrendingUp,
  Sparkles,
  RefreshCw,
  BarChart3,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  Users,
  Layers,
  Calculator
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
  initialConsensus,
  initialModels,
  initialSummary
}) => {
  const [consensus, setConsensus] = useState<AnalystConsensusDetail | null>(initialConsensus || null);
  const [models, setModels] = useState<ValuationModel11Item[]>(initialModels || []);
  const [summary, setSummary] = useState<ValuationModels11Summary | null>(initialSummary || null);
  const [intrinsicFV, setIntrinsicFV] = useState<number>(initialSummary?.fair_value_multimodelo || 0);
  const [resolvedName, setResolvedName] = useState<string>(companyName || ticker);
  const [resolvedP0, setResolvedP0] = useState<number>(currentPrice || 0);
  const [resolvedFV, setResolvedFV] = useState<number>(fairValue || 0);
  const [resolvedSym, setResolvedSym] = useState<string>(currencySymbol || '$');
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'models' | 'consensus'>('all');

  useEffect(() => {
    if (!isOpen || !ticker) return;

    if (companyName) setResolvedName(companyName);
    if (currentPrice && currentPrice > 0) setResolvedP0(currentPrice);
    if (fairValue && fairValue > 0) setResolvedFV(fairValue);
    if (currencySymbol) setResolvedSym(currencySymbol);

    if (initialModels && initialModels.length > 0) {
      setModels(initialModels);
    }
    if (initialSummary) {
      setSummary(initialSummary);
      if (initialSummary.fair_value_multimodelo > 0) {
        setIntrinsicFV(initialSummary.fair_value_multimodelo);
      }
    }

    if (initialConsensus && initialConsensus.recent_firms && initialConsensus.recent_firms.length > 0 && initialModels && initialModels.length > 0) {
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
        if (data.modelos_valoracion_11) setModels(data.modelos_valoracion_11);
        if (data.resumen_valoracion_11) setSummary(data.resumen_valoracion_11);
        if (data.valor_intrinseco || data.resumen_valoracion_11?.fair_value_multimodelo) {
          setIntrinsicFV(data.valor_intrinseco || data.resumen_valoracion_11.fair_value_multimodelo);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, ticker, initialConsensus, initialModels, initialSummary, companyName, currentPrice, fairValue, currencySymbol]);

  if (!isOpen) return null;

  const p0 = resolvedP0 || 0;
  const targetMean = consensus?.target_mean || resolvedFV || p0;
  const targetMedian = consensus?.target_median || targetMean;
  const targetLow = consensus?.target_low || Number((targetMean * 0.80).toFixed(2));
  const targetHigh = consensus?.target_high || Number((targetMean * 1.22).toFixed(2));
  const numAnalysts = consensus?.number_of_analysts || 9;
  const argusTarget = consensus?.argus_target || null;
  const tcFairValue = consensus?.tc_fair_value || null;
  const tcDescription = consensus?.tc_description || null;
  const tcDiscount = consensus?.tc_discount || null;
  const recKey = (consensus?.recommendation_key || 'buy').toUpperCase().replace('_', ' ');
  const recMean = consensus?.recommendation_mean || null;
  const firms = consensus?.recent_firms || [];

  const finalIntrinsic = intrinsicFV > 0 ? intrinsicFV : (summary?.fair_value_multimodelo || resolvedFV || p0);

  // Escala para el gráfico horizontal de Rango Bajo-Alto y puntos institucionales
  const allPoints = [
    p0,
    finalIntrinsic,
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
  const intrinsicPct = getPct(finalIntrinsic);
  const medianPct = getPct(targetMedian);

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
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Auditoría de Valoración: Valor Intrínseco vs Consenso Wall Street ({ticker})
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {numAnalysts} Analistas Wall St
                </span>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Rating: {recKey} {recMean ? `(${recMean}/5.0)` : ''}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {resolvedName} · Comparativa entre Modelos Fundamentales Intrínsecos (DCF) y Objetivos de Wall Street a 12M
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Tarjetas Superiores */}
        <div className="px-6 py-3.5 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Tarjeta 1: Valor Intrínseco Fundamental */}
          <div className="bg-slate-900/90 border border-blue-500/50 rounded-xl p-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Valor Intrínseco (DCF)
            </div>
            <div className="text-2xl font-black text-white mt-0.5 font-mono">
              {resolvedSym}{finalIntrinsic.toFixed(2)}
            </div>
            <div className="text-[11px] text-blue-300/80 mt-0.5 font-mono">
              Rango: {resolvedSym}{(summary?.min_limpio || finalIntrinsic * 0.85).toFixed(0)} – {resolvedSym}{(summary?.max_limpio || finalIntrinsic * 1.15).toFixed(0)}
            </div>
          </div>

          {/* Tarjeta 2: Consenso Wall Street a 12M */}
          <div className="bg-slate-900/90 border border-emerald-500/50 rounded-xl p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Consenso Wall St (12M)
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-0.5 font-mono">
              {resolvedSym}{targetMean.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
              Mediana: {resolvedSym}{targetMedian.toFixed(2)} ({numAnalysts} firmas)
            </div>
          </div>

          {/* Tarjeta 3: Trading Central */}
          <div className="bg-slate-900/90 border border-purple-500/40 rounded-xl p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Trading Central
            </div>
            <div className="text-2xl font-bold text-purple-300 mt-0.5 font-mono">
              {tcFairValue && tcFairValue > 0 ? `${resolvedSym}${tcFairValue.toFixed(2)}` : '—'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {tcDescription || 'Cuantitativo'} {tcDiscount ? `(${tcDiscount})` : ''}
            </div>
          </div>

          {/* Tarjeta 4: Precio Actual */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Precio Actual (P₀)
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-0.5 font-mono">
              {resolvedSym}{p0.toFixed(2)}
            </div>
            <div className={`text-[11px] font-semibold mt-0.5 flex items-center gap-0.5 ${p0 <= finalIntrinsic ? 'text-emerald-400' : 'text-amber-400'}`}>
              {p0 <= finalIntrinsic ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>
                {p0 <= finalIntrinsic
                  ? `Descuento -${(((finalIntrinsic - p0) / finalIntrinsic) * 100).toFixed(1)}% vs Intrínseco`
                  : `Prima +${(((p0 - finalIntrinsic) / finalIntrinsic) * 100).toFixed(1)}% sobre Intrínseco`}
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Pestañas */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Todas las Fuentes</span>
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'models'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-blue-400" />
              <span>Modelos de Valor Intrínseco ({models.filter(m => m.aplicable).length || 9})</span>
            </button>
            <button
              onClick={() => setActiveTab('consensus')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'consensus'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Consenso Wall Street ({firms.length || numAnalysts} Firmas)</span>
            </button>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Intrínseco: <strong className="text-blue-300">{resolvedSym}{finalIntrinsic.toFixed(2)}</strong> · Wall St: <strong className="text-emerald-300">{resolvedSym}{targetMean.toFixed(2)}</strong>
          </div>
        </div>

        {/* Cuerpo Principal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-blue-400" />
              <span className="text-sm">Consultando modelos cuantitativos y consenso en vivo para {ticker}...</span>
            </div>
          ) : (
            <>
              {/* SECCIÓN 1: TABLA DE MODELOS DE VALOR INTRÍNSECO (DCF, MÚLTIPLOS) */}
              {(activeTab === 'all' || activeTab === 'models') && (
                <div className="bg-slate-950/50 border border-slate-800/90 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        Desglose de Modelos de Valor Intrínseco Fundamental (DCF, Múltiplos y Flujos)
                      </h4>
                    </div>
                    <span className="text-[11px] text-blue-300 font-mono">
                      Valor Intrínseco Central: <strong>{resolvedSym}{finalIntrinsic.toFixed(2)}</strong> (Mediana: {resolvedSym}{(summary?.mediana_limpia || finalIntrinsic).toFixed(2)})
                    </span>
                  </div>

                  {models && models.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/70">
                            <th className="py-2.5 px-4">Modelo Fundamental</th>
                            <th className="py-2.5 px-4">Categoría</th>
                            <th className="py-2.5 px-4 text-right">Valor Intrínseco</th>
                            <th className="py-2.5 px-4 text-right">Diferencia vs P₀</th>
                            <th className="py-2.5 px-4 text-center">Estado</th>
                            <th className="py-2.5 px-4">Cálculo / Justificación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {models.map((m) => {
                            const val = m.valor;
                            const diff = m.diferencia_vs_p0_pct;
                            return (
                              <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-2.5 px-4 font-sans font-bold text-slate-100">
                                  {m.nombre}
                                </td>
                                <td className="py-2.5 px-4 font-sans text-slate-400 text-[11px]">
                                  {m.categoria}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-white">
                                  {val != null ? `${resolvedSym}${val.toFixed(2)}` : '—'}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  {diff != null ? (
                                    <span className={`inline-flex items-center gap-0.5 font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="py-2.5 px-4 text-center font-sans">
                                  {m.aplicable ? (
                                    m.incluido_en_media ? (
                                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                        Incluido
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        Outlier
                                      </span>
                                    )
                                  ) : (
                                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-800 text-slate-400 border border-slate-700">
                                      No aplicable
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 font-sans text-slate-300 text-[11px]">
                                  {m.explicacion_pedagogica?.calculo_empresa || m.formula_resumen}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Calculando modelos intrínsecos de valoración para {ticker}...
                    </div>
                  )}
                </div>
              )}

              {/* SECCIÓN 2: GRÁFICO VISUAL COMPARATIVO */}
              {(activeTab === 'all' || activeTab === 'consensus') && (
                <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-400" />
                      <span>Posicionamiento Visual: Cotización vs Valor Intrínseco vs Consenso Wall Street</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                        Precio P₀: {resolvedSym}{p0.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1.5 text-blue-300 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block"></span>
                        Intrínseco (DCF): {resolvedSym}{finalIntrinsic.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                        Target Wall St: {resolvedSym}{targetMean.toFixed(2)}
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

                      {/* Marcador Bajo Wall St */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${lowPct}%` }}
                      >
                        <div className="w-3 h-3 rounded-full bg-slate-400 border-2 border-slate-900 shadow" />
                        <span className="mt-4 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                          Bajo: {resolvedSym}{targetLow.toFixed(2)}
                        </span>
                      </div>

                      {/* Marcador Alto Wall St */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${highPct}%` }}
                      >
                        <div className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 shadow" />
                        <span className="mt-4 text-[10px] font-mono text-emerald-400 whitespace-nowrap font-bold">
                          Alto: {resolvedSym}{targetHigh.toFixed(2)}
                        </span>
                      </div>

                      {/* Marcador Mediana Wall St */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-10"
                        style={{ left: `${medianPct}%` }}
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 shadow ring-1 ring-emerald-400" />
                        <span className="absolute -bottom-6 text-[10px] font-mono text-emerald-300 font-semibold whitespace-nowrap bg-slate-900 px-1 py-0.5 rounded border border-emerald-500/30">
                          Mediana Wall St: {resolvedSym}{targetMedian.toFixed(2)}
                        </span>
                      </div>

                      {/* Marcador Valor Intrínseco (Azul) */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-20"
                        style={{ left: `${intrinsicPct}%` }}
                      >
                        <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg ring-2 ring-blue-500/50" />
                        <span className="absolute -top-6 text-[11px] font-mono text-blue-300 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-blue-500/50 whitespace-nowrap shadow-sm">
                          Intrínseco: {resolvedSym}{finalIntrinsic.toFixed(2)}
                        </span>
                      </div>

                      {/* Marcador Precio Actual (Ámbar) */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-30"
                        style={{ left: `${p0Pct}%` }}
                      >
                        <div className="w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-950 shadow-lg ring-2 ring-amber-400/50 animate-pulse" />
                        <span className="mt-4 text-[11px] font-mono text-amber-300 font-bold whitespace-nowrap bg-slate-900 px-1.5 py-0.5 rounded border border-amber-400/40">
                          P₀: {resolvedSym}{p0.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN 3: TABLA DE BANCOS DE INVERSIÓN (WALL STREET) */}
              {(activeTab === 'all' || activeTab === 'consensus') && (
                <div className="bg-slate-950/50 border border-slate-800/90 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400" />
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
              )}

              {/* SECCIÓN 4: EXPLICACIÓN METODOLÓGICA */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 leading-relaxed">
                  <div className="font-bold text-slate-200">
                    Diferencia entre Valor Intrínseco Fundamental ({resolvedSym}{finalIntrinsic.toFixed(2)}) y Consenso de Wall Street ({resolvedSym}{targetMean.toFixed(2)})
                  </div>
                  <p>
                    <strong className="text-blue-300 font-semibold">1. Valor Intrínseco Fundamental ({resolvedSym}{finalIntrinsic.toFixed(2)}):</strong> Valora la generación real de caja libre (DCF FCFF/FCFE), la rentabilidad del capital (ROIC) y los múltiplos operativos normalizados de ciclo. Es la referencia base sobre la que se calcula el Margen de Seguridad (MoS) para compras prudentes de estilo Value Investing.
                  </p>
                  <p>
                    <strong className="text-emerald-300 font-semibold">2. Consenso de Wall Street ({resolvedSym}{targetMean.toFixed(2)} / Mediana {resolvedSym}{targetMedian.toFixed(2)}):</strong> Agrega las proyecciones de precio objetivo a 12 meses emitidas por los bancos de inversión (JP Morgan, Barclays, Argus, etc.). Este dato refleja el momentum y la expectativa de mercado a corto plazo.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Fuentes: DCF Multi-etapas · Múltiplos EV/EBITDA/FCF · Consenso Wall Street · Argus Research · Trading Central
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
