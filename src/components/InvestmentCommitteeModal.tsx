import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  Award,
  Search
} from 'lucide-react';

interface SubagentReport {
  id: string;
  name: string;
  subtitle: string;
  conviction: number;
  vote: string;
  badge: 'emerald' | 'amber' | 'red';
  report: string;
}

interface CommitteeData {
  ticker: string;
  company_name: string;
  sector: string;
  archetype: string;
  quality_tier: string;
  currency: string;
  currency_symbol: string;
  p0: number;
  fair_value: number;
  mos_ceiling: number;
  mos_pct: number;
  r_pct: number;
  gn_pct: number;
  spread_r_g_pct: number;
  g_fundamental_pct: number;
  g_implicito_pct: number;
  execution_mode: string;
  timestamp: string;
  agents: SubagentReport[];
  cio: {
    conviction: number;
    verdict: string;
    badge: 'emerald' | 'amber' | 'red';
    vetoes: {
      price_ceiling_veto: boolean;
      value_trap_veto: boolean;
      falling_knife_veto: boolean;
    };
    tranches: {
      label: string;
      price: number;
      detail: string;
    }[];
  };
  markdown_report: string;
}

interface InvestmentCommitteeModalProps {
  isOpen: boolean;
  ticker: string | null;
  mosDiscount?: number;
  onClose: () => void;
}

export const InvestmentCommitteeModal: React.FC<InvestmentCommitteeModalProps> = ({
  isOpen,
  ticker,
  mosDiscount = 20,
  onClose
}) => {
  const [activeTicker, setActiveTicker] = useState<string>(ticker || 'MSFT');
  const [inputTicker, setInputTicker] = useState<string>(ticker || 'MSFT');
  const [data, setData] = useState<CommitteeData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticker) {
      setActiveTicker(ticker.toUpperCase());
      setInputTicker(ticker.toUpperCase());
    }
  }, [ticker]);

  const runCommittee = async (targetTicker: string) => {
    const clean = (targetTicker || 'MSFT').trim().toUpperCase();
    setIsLoading(true);
    setError(null);
    setLoadingStep(1);

    const stepTimer1 = setTimeout(() => setLoadingStep(2), 650);
    const stepTimer2 = setTimeout(() => setLoadingStep(3), 1300);

    try {
      const res = await fetch(`/api/ai/committee/${encodeURIComponent(clean)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mos: mosDiscount })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `No se pudo auditar ${clean}`);
      }
      const json: CommitteeData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error al ejecutar el Comité Multi-Agente');
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  useEffect(() => {
    if (isOpen && activeTicker) {
      runCommittee(activeTicker);
    }
  }, [isOpen, activeTicker, mosDiscount]);

  if (!isOpen) return null;

  const badgeColors = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    red: 'bg-red-500/15 text-red-400 border-red-500/40'
  };

  const formatSimpleLines = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-1" />;
      if (trimmed.startsWith('#### ')) {
        return (
          <h5 key={idx} className="text-[11px] font-extrabold text-accentSky uppercase tracking-wider mt-2 mb-1">
            {trimmed.slice(5)}
          </h5>
        );
      }
      const cleaned = trimmed.replace(/^[-*]\s+/, '');
      const parts = cleaned.split(/(\*\*.*?\*\*)/g);
      return (
        <div key={idx} className="flex items-start space-x-1.5 text-[11px] text-textSecondary leading-relaxed my-0.5">
          {trimmed.startsWith('-') || trimmed.startsWith('*') ? (
            <span className="text-accentSky mt-0.5">•</span>
          ) : null}
          <span className="flex-1">
            {parts.map((p, i) =>
              p.startsWith('**') && p.endsWith('**') ? (
                <strong key={i} className="text-textPrimary font-bold">
                  {p.slice(2, -2)}
                </strong>
              ) : (
                p
              )
            )}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-card border border-borderMedium rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header del Comité */}
        <div className="px-5 py-3.5 bg-cardSecondary/80 border-b border-borderSubtle flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-accentSky/20 to-purple-500/20 border border-accentSky/40 text-accentSky">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-black text-textPrimary uppercase tracking-wider">
                  Comité de Inversión Multi-Agente (Fan-Out / Fan-In)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-accentSky/15 text-accentSky border border-accentSky/30">
                  3 Subagentes Paralelos + Juez CIO
                </span>
              </div>
              <p className="text-[11px] text-textSecondary">
                Fase 1: Extracción Determinista · Fase 2: Deliberación Aislada (Value, Macro Dalio, Timing) · Fase 3: Síntesis y Reglas de Veto
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputTicker.trim()) {
                  setActiveTicker(inputTicker.trim().toUpperCase());
                }
              }}
              className="flex items-center space-x-1.5"
            >
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-textSecondary absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inputTicker}
                  onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
                  placeholder="Ticker (ej. MSFT)"
                  className="w-28 sm:w-32 h-8 pl-8 pr-2 rounded-lg bg-canvas border border-borderSubtle text-xs font-mono font-bold text-textPrimary focus:outline-none focus:border-accentSky"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="h-8 px-3 rounded-lg bg-accentSky hover:bg-accentSky/90 text-canvas font-bold text-xs flex items-center space-x-1 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Convocar</span>
              </button>
            </form>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-borderSubtle hover:bg-card hover:text-textPrimary text-textSecondary transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accentSky/15 border border-accentSky/40 flex items-center justify-center text-accentSky">
                <Sparkles className="w-7 h-7 animate-pulse" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-sm font-bold text-textPrimary">
                  Ejecutando Comité Multi-Agente sobre <span className="text-accentSky font-mono">{activeTicker}</span>...
                </h3>
                <div className="space-y-1 text-xs font-mono text-textSecondary">
                  <p className={loadingStep >= 1 ? 'text-emerald-400 font-bold' : ''}>
                    {loadingStep > 1 ? '✓' : '1.'} Fase 1: Extrayendo DCF, SEC EDGAR, Ciclo Dalio y Volatilidad ATR...
                  </p>
                  <p className={loadingStep === 2 ? 'text-accentSky font-bold' : loadingStep > 2 ? 'text-emerald-400 font-bold' : 'opacity-60'}>
                    {loadingStep > 2 ? '✓' : '2.'} Fase 2: Deliberación en paralelo de 3 Subagentes Especialistas...
                  </p>
                  <p className={loadingStep === 3 ? 'text-purple-400 font-bold' : 'opacity-60'}>
                    3. Fase 3: Aplicando Reglas de Veto Simbólicas del Presidente (CIO)...
                  </p>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30 text-center space-y-2">
              <ShieldAlert className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-xs font-bold text-red-400">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* 1. Banner de Ecuación de Decisión Determinista */}
              <div className="p-3.5 rounded-xl bg-canvas border border-borderSubtle flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-black text-textPrimary">{data.company_name}</span>
                  <span className="px-2 py-0.5 rounded bg-accentSky/15 text-accentSky border border-accentSky/30 font-mono text-xs font-bold">
                    {data.ticker}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[11px] font-bold">
                    Tier {data.quality_tier}
                  </span>
                  <span className="text-xs text-textSecondary hidden md:inline">({data.sector})</span>
                </div>

                <div className="flex items-center space-x-4 font-mono text-xs flex-wrap gap-y-1">
                  <div>
                    <span className="text-textSecondary">P₀: </span>
                    <strong className="text-textPrimary">
                      {data.currency_symbol}{data.p0.toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-textSecondary">Fair Value: </span>
                    <strong className="text-accentSky">
                      {data.currency_symbol}{data.fair_value.toFixed(2)}
                    </strong>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <span className="text-textSecondary">Techo Compra MoS ({data.mos_pct}%): </span>
                    <strong className="text-emerald-400">
                      {data.currency_symbol}{data.mos_ceiling.toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-textSecondary">(r - gₙ): </span>
                    <strong className="text-textPrimary">{data.spread_r_g_pct}%</strong>
                  </div>
                </div>
              </div>

              {/* 2. Grid de los 3 Subagentes Especialistas (Fan-Out en Paralelo) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                {data.agents.map((ag, idx) => (
                  <div
                    key={ag.id}
                    className="p-3.5 rounded-xl bg-cardSecondary/60 border border-borderSubtle flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2 border-b border-borderSubtle pb-2">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            {idx === 0 && <ShieldCheck className="w-4 h-4 text-accentSky flex-shrink-0" />}
                            {idx === 1 && <Activity className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                            {idx === 2 && <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                            <h4 className="text-xs font-extrabold text-textPrimary">{ag.name}</h4>
                          </div>
                          <p className="text-[10px] text-textSecondary mt-0.5">{ag.subtitle}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-canvas border border-borderSubtle font-mono text-[11px] font-bold text-accentSky flex-shrink-0">
                          {ag.conviction}/100
                        </span>
                      </div>

                      <div className="py-1">{formatSimpleLines(ag.report)}</div>
                    </div>

                    <div className="pt-2 border-t border-borderSubtle/60 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-textSecondary">Voto Subagente:</span>
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${badgeColors[ag.badge]}`}>
                        {ag.vote}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 3. Panel del Presidente del Comité (CIO - Fan-In, Vetos y Tramos Operativos) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-cardSecondary via-card to-cardSecondary border-2 border-accentSky/40 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-borderSubtle pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Award className="w-5 h-5 text-accentSky" />
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-textPrimary uppercase tracking-wider">
                        Fase 3: Resolución del Presidente del Comité (CIO) & Guardarraíles de Veto
                      </h3>
                      <p className="text-[10px] text-textSecondary">
                        Síntesis dialéctica ponderada (Convicción Global: <strong>{data.cio.conviction}/100</strong>)
                      </p>
                    </div>
                  </div>

                  <div className={`px-3 py-1 rounded-xl border font-mono text-xs font-black ${badgeColors[data.cio.badge]}`}>
                    🎯 VEREDICTO: {data.cio.verdict}
                  </div>
                </div>

                {/* Estado de los 3 Vetos Inquebrantables */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                  <div className={`p-2.5 rounded-xl border flex items-center space-x-2 ${data.cio.vetoes.price_ceiling_veto ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                    {data.cio.vetoes.price_ceiling_veto ? <XCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                    <div>
                      <span className="font-bold block text-[11px]">Veto 1: Regla Techo MoS (P₀ ≤ VP_MoS)</span>
                      <span className="text-[10px] opacity-90">
                        {data.cio.vetoes.price_ceiling_veto
                          ? `Activado: P₀ (${data.currency_symbol}${data.p0.toFixed(2)}) > Techo (${data.currency_symbol}${data.mos_ceiling.toFixed(2)}). Prohibido comprar a mercado.`
                          : `Superado: P₀ cotiza dentro del Techo Máximo Admisible.`}
                      </span>
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-xl border flex items-center space-x-2 ${data.cio.vetoes.value_trap_veto ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                    {data.cio.vetoes.value_trap_veto ? <XCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                    <div>
                      <span className="font-bold block text-[11px]">Veto 2: Trampa de Valor Forense</span>
                      <span className="text-[10px] opacity-90">
                        {data.cio.vetoes.value_trap_veto
                          ? 'Activado: Se detectan banderas rojas de solvencia o devengos.'
                          : `Superado: Solvencia limpia y (r - gₙ) = ${data.spread_r_g_pct}% ≥ 2.25%.`}
                      </span>
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-xl border flex items-center space-x-2 ${data.cio.vetoes.falling_knife_veto ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                    {data.cio.vetoes.falling_knife_veto ? <XCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                    <div>
                      <span className="font-bold block text-[11px]">Veto 3: Protección Cuchillo Cayendo</span>
                      <span className="text-[10px] opacity-90">
                        {data.cio.vetoes.falling_knife_veto
                          ? 'Activado: Desplome vertical sin soporte confirmado.'
                          : 'Superado: Sin capitulación estructural descontrolada.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Plan de Ejecución por Tramos */}
                <div className="pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accentSky block mb-1.5">
                    Mapa Operativo de Órdenes Limitadas Aprobado por el Comité:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono text-xs">
                    {data.cio.tranches.map((tr, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-canvas border border-borderSubtle flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-textPrimary block">{tr.label}</span>
                          <span className="text-[10px] text-textSecondary font-sans">{tr.detail}</span>
                        </div>
                        <span className="text-sm font-black text-emerald-400 ml-2">
                          {data.currency_symbol}{tr.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
