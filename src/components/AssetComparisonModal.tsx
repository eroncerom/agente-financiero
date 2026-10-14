import React, { useState, useEffect } from 'react';
import {
  X,
  Scale,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Award,
  ShoppingCart,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { Pilar1Result } from '../types';

interface AssetComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseTicker?: string;
  initialPeerTicker?: string;
  onSelectCompanyForCentralPillar?: (ticker: string) => void;
  onBuyTrade?: (company: Pilar1Result) => void;
  onAddToWatchlist?: (ticker: string) => void;
}

export const AssetComparisonModal: React.FC<AssetComparisonModalProps> = ({
  isOpen,
  onClose,
  baseTicker = 'AMS.MC',
  initialPeerTicker,
  onSelectCompanyForCentralPillar,
  onBuyTrade,
  onAddToWatchlist
}) => {
  const [ticker1, setTicker1] = useState(baseTicker);
  const [ticker2, setTicker2] = useState(initialPeerTicker || '');
  const [mosDiscount, setMosDiscount] = useState<number>(20);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [asset1, setAsset1] = useState<Pilar1Result | null>(null);
  const [asset2, setAsset2] = useState<Pilar1Result | null>(null);
  const [suggestedPeers, setSuggestedPeers] = useState<string[]>([]);
  const [comparisonSummary, setComparisonSummary] = useState<{ mosWinner: string | null; scoreWinner: string | null } | null>(null);

  useEffect(() => {
    if (baseTicker) {
      setTicker1(baseTicker);
    }
  }, [baseTicker]);

  const loadComparison = async (t1: string, t2?: string) => {
    if (!t1.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        ticker1: t1.trim().toUpperCase(),
        mos: mosDiscount.toString()
      });
      if (t2 && t2.trim()) {
        queryParams.append('ticker2', t2.trim().toUpperCase());
      }

      const res = await fetch(`/api/pilar1/compare?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Error en el servidor (${res.status})`);
      }
      const data = await res.json();
      setAsset1(data.asset1);
      setAsset2(data.asset2);
      setSuggestedPeers(data.suggestedPeers || []);
      setComparisonSummary(data.comparison || null);

      if (!t2 && data.suggestedPeers && data.suggestedPeers.length > 0 && !ticker2) {
        setTicker2(data.suggestedPeers[0]);
        // Cargar inmediatamente el primer par sugerido
        fetchPeerDirectly(t1, data.suggestedPeers[0]);
      }
    } catch (err: any) {
      console.error('Error al comparar activos:', err);
      setError(err.message || 'No se pudo cargar la comparación');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPeerDirectly = async (t1: string, t2: string) => {
    try {
      const queryParams = new URLSearchParams({
        ticker1: t1.trim().toUpperCase(),
        ticker2: t2.trim().toUpperCase(),
        mos: mosDiscount.toString()
      });
      const res = await fetch(`/api/pilar1/compare?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAsset1(data.asset1);
        setAsset2(data.asset2);
        setComparisonSummary(data.comparison || null);
      }
    } catch (e) {
      console.warn('Error al cargar par directo:', e);
    }
  };

  useEffect(() => {
    if (isOpen && ticker1) {
      loadComparison(ticker1, ticker2 || initialPeerTicker);
    }
  }, [isOpen, mosDiscount]);

  if (!isOpen) return null;

  const sym1 = asset1?.currency === 'EUR' ? '€' : '$';
  const sym2 = asset2?.currency === 'EUR' ? '€' : '$';

  // Cálculos de descuento sobre Techo MoS Neutro
  const mos1 = asset1 ? (asset1.escenario_neutro.VP_MoS ?? asset1.escenario_neutro.VP_MoS_30) : 0;
  const mos2 = asset2 ? (asset2.escenario_neutro.VP_MoS ?? asset2.escenario_neutro.VP_MoS_30) : 0;
  const p0_1 = asset1?.precio_cierre_P0 || 0;
  const p0_2 = asset2?.precio_cierre_P0 || 0;

  const distMoS1Pct = mos1 > 0 ? ((mos1 - p0_1) / mos1) * 100 : 0;
  const distMoS2Pct = mos2 > 0 ? ((mos2 - p0_2) / mos2) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-canvas/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-card border border-borderMedium rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-borderSubtle flex items-center justify-between bg-cardSecondary/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-accentSky/15 border border-accentSky/30 flex items-center justify-center text-accentSky">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-textPrimary">
                  Comparador Fundamental Frente a Frente
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accentSky/15 text-accentSky border border-accentSky/30 font-bold uppercase">
                  Pilar Central
                </span>
              </div>
              <p className="text-xs text-textSecondary mt-0.5">
                Evaluación simultánea de los 3 Escenarios de Crecimiento y Filtro Value
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-cardHover border border-transparent hover:border-borderSubtle transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BARRA DE SELECCIÓN DE ACTIVOS Y SUGERENCIAS */}
        <div className="p-4 border-b border-borderSubtle bg-card space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Activo 1 */}
            <div className="sm:col-span-5 flex items-center space-x-2">
              <span className="text-xs font-bold text-accentSky w-16">Activo 1:</span>
              <input
                type="text"
                value={ticker1}
                onChange={(e) => setTicker1(e.target.value.toUpperCase())}
                placeholder="Ticker 1 (ej. AMS.MC)"
                className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-textPrimary uppercase focus:outline-none focus:border-accentSky"
              />
            </div>

            {/* Separador VS y botón de cruce */}
            <div className="sm:col-span-2 flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  const temp = ticker1;
                  setTicker1(ticker2);
                  setTicker2(temp);
                  loadComparison(ticker2, temp);
                }}
                className="px-2.5 py-1 rounded-lg bg-cardSecondary hover:bg-borderSubtle text-[11px] font-bold text-textSecondary hover:text-textPrimary border border-borderSubtle transition"
                title="Intercambiar activos"
              >
                ⇄ VS
              </button>
            </div>

            {/* Activo 2 */}
            <div className="sm:col-span-5 flex items-center space-x-2">
              <span className="text-xs font-bold text-statusGreen w-16">Activo 2:</span>
              <input
                type="text"
                value={ticker2}
                onChange={(e) => setTicker2(e.target.value.toUpperCase())}
                placeholder="Ticker 2 (ej. BKNG, BBVA.MC)"
                className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-textPrimary uppercase focus:outline-none focus:border-statusGreen"
              />
            </div>
          </div>

          {/* Fila de sugerencias de competidores directos y botón de comparar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-[11px] text-textSecondary font-medium">Competidores directos sugeridos:</span>
              {suggestedPeers.map((peer) => (
                <button
                  key={peer}
                  type="button"
                  onClick={() => {
                    setTicker2(peer);
                    loadComparison(ticker1, peer);
                  }}
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono transition ${
                    ticker2 === peer
                      ? 'bg-statusGreen/20 text-statusGreen border-statusGreen/40 font-bold'
                      : 'bg-cardSecondary hover:bg-borderSubtle text-textSecondary hover:text-textPrimary border-borderSubtle'
                  }`}
                >
                  +{peer}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              {/* Selector MoS */}
              <div className="flex items-center space-x-1 bg-canvas px-2 py-1 rounded-xl border border-borderSubtle">
                <SlidersHorizontal className="w-3.5 h-3.5 text-textSecondary" />
                <span className="text-[10px] text-textSecondary font-medium">MoS:</span>
                {[20, 25, 30].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMosDiscount(val)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                      mosDiscount === val
                        ? 'bg-accentSky text-canvas'
                        : 'text-textSecondary hover:text-textPrimary'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => loadComparison(ticker1, ticker2)}
                disabled={isLoading || !ticker1.trim()}
                className="px-3.5 py-1.5 bg-accentSky hover:bg-accentSky/90 text-canvas font-bold rounded-xl text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Analizando...' : 'Comparar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* CUERPO PRINCIPAL CON SCROLL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-statusRed/10 border border-statusRed/30 text-statusRed text-xs">
              {error}
            </div>
          )}

          {/* BANNER DE VEREDICTO GANADOR */}
          {comparisonSummary && asset1 && asset2 && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-accentSky/15 via-purple-500/10 to-statusGreen/15 border border-accentSky/30 shadow-md flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Award className="w-5 h-5 text-accentYellow shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider">
                    Diagnóstico Comparativo de Oportunidad
                  </h4>
                  <p className="text-xs text-textSecondary mt-0.5">
                    Mayor Margen de Seguridad ({mosDiscount}%):{' '}
                    <strong className="text-statusGreen font-mono font-bold">
                      {comparisonSummary.mosWinner}
                    </strong>
                    {' · '}
                    Mayor Calidad del Balance (Filtro Value):{' '}
                    <strong className="text-accentSky font-mono font-bold">
                      {comparisonSummary.scoreWinner}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="text-right font-mono text-[11px] text-textSecondary">
                <span>MoS 1: {distMoS1Pct >= 0 ? `+${distMoS1Pct.toFixed(1)}%` : `${distMoS1Pct.toFixed(1)}%`}</span>
                <span className="mx-2">vs</span>
                <span>MoS 2: {distMoS2Pct >= 0 ? `+${distMoS2Pct.toFixed(1)}%` : `${distMoS2Pct.toFixed(1)}%`}</span>
              </div>
            </div>
          )}

          {/* TARJETAS COMPARATIVAS CABECERA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* COLUMNA ACTIVO 1 */}
            <div className="p-4 rounded-xl bg-cardSecondary/60 border border-accentSky/30 space-y-3">
              {asset1 ? (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-extrabold text-accentSky">{asset1.ticker}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-canvas border border-borderSubtle text-textSecondary font-mono">
                          {asset1.currency}
                        </span>
                        {asset1.filtro_value?.apto && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-statusGreen/15 text-statusGreen border border-statusGreen/30 font-bold">
                            APTO VALUE
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-textPrimary mt-0.5">{asset1.nombre}</h3>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black font-mono text-textPrimary">
                        {sym1}{asset1.precio_cierre_P0.toFixed(2)}
                      </div>
                      <span className="text-[10px] text-textSecondary">Cotización actual P₀</span>
                    </div>
                  </div>

                  {/* Resumen Métricas Clave */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-canvas border border-borderSubtle text-center font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-textSecondary block font-sans">Fair Value</span>
                      <strong className="text-textPrimary">{sym1}{(asset1.fair_value_teorico ?? asset1.precio_cierre_P0).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-textSecondary block font-sans">Techo MoS {mosDiscount}%</span>
                      <strong className={p0_1 <= mos1 ? 'text-statusGreen' : 'text-accentYellow'}>
                        {sym1}{mos1.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-textSecondary block font-sans">Filtro Value</span>
                      <strong className="text-accentSky">{asset1.filtro_value?.puntuacion ?? 0}/5</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-28 flex items-center justify-center text-xs text-textSecondary">
                  {isLoading ? 'Cargando datos...' : 'Ingresa un ticker válido para el Activo 1'}
                </div>
              )}
            </div>

            {/* COLUMNA ACTIVO 2 */}
            <div className="p-4 rounded-xl bg-cardSecondary/60 border border-statusGreen/30 space-y-3">
              {asset2 ? (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-extrabold text-statusGreen">{asset2.ticker}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-canvas border border-borderSubtle text-textSecondary font-mono">
                          {asset2.currency}
                        </span>
                        {asset2.filtro_value?.apto && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-statusGreen/15 text-statusGreen border border-statusGreen/30 font-bold">
                            APTO VALUE
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-textPrimary mt-0.5">{asset2.nombre}</h3>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black font-mono text-textPrimary">
                        {sym2}{asset2.precio_cierre_P0.toFixed(2)}
                      </div>
                      <span className="text-[10px] text-textSecondary">Cotización actual P₀</span>
                    </div>
                  </div>

                  {/* Resumen Métricas Clave */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-canvas border border-borderSubtle text-center font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-textSecondary block font-sans">Fair Value</span>
                      <strong className="text-textPrimary">{sym2}{(asset2.fair_value_teorico ?? asset2.precio_cierre_P0).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-textSecondary block font-sans">Techo MoS {mosDiscount}%</span>
                      <strong className={p0_2 <= mos2 ? 'text-statusGreen' : 'text-accentYellow'}>
                        {sym2}{mos2.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-textSecondary block font-sans">Filtro Value</span>
                      <strong className="text-accentSky">{asset2.filtro_value?.puntuacion ?? 0}/5</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-28 flex items-center justify-center text-xs text-textSecondary">
                  {isLoading ? 'Cargando datos...' : 'Ingresa o selecciona un competidor para comparar'}
                </div>
              )}
            </div>
          </div>

          {/* TABLA COMPARATIVA DE LOS 3 ESCENARIOS GORDON-SHAPIRO */}
          {asset1 && asset2 && (
            <div className="p-4 rounded-xl bg-card border border-borderSubtle space-y-3">
              <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider flex items-center space-x-1.5">
                <TrendingUp className="w-4 h-4 text-accentSky" />
                <span>Comparación de los 3 Escenarios de Crecimiento (Gordon-Shapiro)</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-borderSubtle text-[11px] text-textSecondary uppercase tracking-wider font-sans">
                      <th className="py-2 px-3">Escenario</th>
                      <th className="py-2 px-3 text-accentSky">{asset1.ticker} (g / VP / MoS)</th>
                      <th className="py-2 px-3 text-center">Cumple P₀ ≤ MoS</th>
                      <th className="py-2 px-3 text-statusGreen">{asset2.ticker} (g / VP / MoS)</th>
                      <th className="py-2 px-3 text-center">Cumple P₀ ≤ MoS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderSubtle/60">
                    {/* Escenario 1: Pesimista */}
                    <tr className="hover:bg-canvas/40 transition">
                      <td className="py-2.5 px-3 font-bold font-sans text-textPrimary">
                        1. Pesimista
                        <span className="block text-[10px] text-textSecondary font-normal">Criterio estricto de entrada</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div>g: {(asset1.escenario_pesimista.g * 100).toFixed(1)}%</div>
                        <div className="text-textSecondary">VP: {sym1}{asset1.escenario_pesimista.VP_teorico.toFixed(2)}</div>
                        <div className="font-bold text-statusGreen">
                          MoS: {sym1}{(asset1.escenario_pesimista.VP_MoS ?? asset1.escenario_pesimista.VP_MoS_30).toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {asset1.escenario_pesimista.cumple_MoS ? (
                          <span className="inline-flex items-center space-x-1 text-statusGreen font-bold font-sans text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SÍ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-statusRed font-bold font-sans text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>NO</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div>g: {(asset2.escenario_pesimista.g * 100).toFixed(1)}%</div>
                        <div className="text-textSecondary">VP: {sym2}{asset2.escenario_pesimista.VP_teorico.toFixed(2)}</div>
                        <div className="font-bold text-statusGreen">
                          MoS: {sym2}{(asset2.escenario_pesimista.VP_MoS ?? asset2.escenario_pesimista.VP_MoS_30).toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {asset2.escenario_pesimista.cumple_MoS ? (
                          <span className="inline-flex items-center space-x-1 text-statusGreen font-bold font-sans text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SÍ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-statusRed font-bold font-sans text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>NO</span>
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Escenario 2: Neutro */}
                    <tr className="hover:bg-canvas/40 transition bg-canvas/20">
                      <td className="py-2.5 px-3 font-bold font-sans text-textPrimary">
                        2. Neutro
                        <span className="block text-[10px] text-textSecondary font-normal">Valoración base central</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div>g: {(asset1.escenario_neutro.g * 100).toFixed(1)}%</div>
                        <div className="text-textSecondary">VP: {sym1}{asset1.escenario_neutro.VP_teorico.toFixed(2)}</div>
                        <div className="font-bold text-statusGreen">
                          MoS: {sym1}{mos1.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {p0_1 <= mos1 ? (
                          <span className="inline-flex items-center space-x-1 text-statusGreen font-bold font-sans text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SÍ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-statusRed font-bold font-sans text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>NO</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div>g: {(asset2.escenario_neutro.g * 100).toFixed(1)}%</div>
                        <div className="text-textSecondary">VP: {sym2}{asset2.escenario_neutro.VP_teorico.toFixed(2)}</div>
                        <div className="font-bold text-statusGreen">
                          MoS: {sym2}{mos2.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {p0_2 <= mos2 ? (
                          <span className="inline-flex items-center space-x-1 text-statusGreen font-bold font-sans text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SÍ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-statusRed font-bold font-sans text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>NO</span>
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Escenario 3: Optimista */}
                    <tr className="hover:bg-canvas/40 transition">
                      <td className="py-2.5 px-3 font-bold font-sans text-textPrimary">
                        3. Optimista
                        <span className="block text-[10px] text-textSecondary font-normal">Potencial alcista</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div>g: {(asset1.escenario_optimista.g * 100).toFixed(1)}%</div>
                        <div className="text-textSecondary">VP: {sym1}{asset1.escenario_optimista.VP_teorico.toFixed(2)}</div>
                        <div className="font-bold text-statusGreen">
                          MoS: {sym1}{(asset1.escenario_optimista.VP_MoS ?? asset1.escenario_optimista.VP_MoS_30).toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {asset1.escenario_optimista.cumple_MoS ? (
                          <span className="inline-flex items-center space-x-1 text-statusGreen font-bold font-sans text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SÍ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-statusRed font-bold font-sans text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>NO</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div>g: {(asset2.escenario_optimista.g * 100).toFixed(1)}%</div>
                        <div className="text-textSecondary">VP: {sym2}{asset2.escenario_optimista.VP_teorico.toFixed(2)}</div>
                        <div className="font-bold text-statusGreen">
                          MoS: {sym2}{(asset2.escenario_optimista.VP_MoS ?? asset2.escenario_optimista.VP_MoS_30).toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {asset2.escenario_optimista.cumple_MoS ? (
                          <span className="inline-flex items-center space-x-1 text-statusGreen font-bold font-sans text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SÍ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-statusRed font-bold font-sans text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>NO</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABLA COMPARATIVA DE SALUD FINANCIERA (FILTRO VALUE) */}
          {asset1 && asset2 && (
            <div className="p-4 rounded-xl bg-card border border-borderSubtle space-y-3">
              <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-statusGreen" />
                <span>Salud Financiera & 5 Criterios del Filtro Value</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Desglose Value 1 */}
                <div className="p-3 rounded-lg bg-canvas border border-borderSubtle space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-1 border-b border-borderSubtle">
                    <span className="font-bold text-accentSky">{asset1.ticker}</span>
                    <span className="font-bold font-mono text-textPrimary">
                      {asset1.filtro_value?.puntuacion ?? 0}/5 Criterios
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Margen Operativo &gt; 15%:</span>
                      <span>{asset1.filtro_value?.criterios?.[0]?.cumple ? '✓ Cumple' : '✗ No cumple'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">ROIC &gt; 12%:</span>
                      <span>{asset1.filtro_value?.criterios?.[1]?.cumple ? '✓ Excelente' : '✗ Bajo'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Deuda Neta / EBITDA &lt; 3.0x:</span>
                      <span>{asset1.filtro_value?.criterios?.[2]?.cumple ? '✓ Sólido' : '✗ Elevada'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Estabilidad Beneficios / FCF:</span>
                      <span>{asset1.filtro_value?.criterios?.[3]?.cumple ? '✓ Estable' : '✗ Volátil'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Margen Seguridad MoS:</span>
                      <span>{asset1.filtro_value?.criterios?.[4]?.cumple ? '✓ En Zona' : '✗ Fuera'}</span>
                    </div>
                  </div>
                </div>

                {/* Desglose Value 2 */}
                <div className="p-3 rounded-lg bg-canvas border border-borderSubtle space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-1 border-b border-borderSubtle">
                    <span className="font-bold text-statusGreen">{asset2.ticker}</span>
                    <span className="font-bold font-mono text-textPrimary">
                      {asset2.filtro_value?.puntuacion ?? 0}/5 Criterios
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Margen Operativo &gt; 15%:</span>
                      <span>{asset2.filtro_value?.criterios?.[0]?.cumple ? '✓ Cumple' : '✗ No cumple'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">ROIC &gt; 12%:</span>
                      <span>{asset2.filtro_value?.criterios?.[1]?.cumple ? '✓ Excelente' : '✗ Bajo'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Deuda Neta / EBITDA &lt; 3.0x:</span>
                      <span>{asset2.filtro_value?.criterios?.[2]?.cumple ? '✓ Sólido' : '✗ Elevada'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Estabilidad Beneficios / FCF:</span>
                      <span>{asset2.filtro_value?.criterios?.[3]?.cumple ? '✓ Estable' : '✗ Volátil'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textSecondary">Margen Seguridad MoS:</span>
                      <span>{asset2.filtro_value?.criterios?.[4]?.cumple ? '✓ En Zona' : '✗ Fuera'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER CON ACCIONES DIRECTAS */}
        <div className="p-4 border-t border-borderSubtle bg-card flex flex-wrap items-center justify-between gap-2.5">
          <div className="text-xs text-textSecondary flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accentSky" />
            <span>Datos calculados rigurosamente en tiempo real con el motor Gordon-Shapiro.</span>
          </div>

          <div className="flex items-center space-x-2">
            {asset1 && onSelectCompanyForCentralPillar && (
              <button
                type="button"
                onClick={() => {
                  onSelectCompanyForCentralPillar(asset1.ticker);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-accentSky/15 hover:bg-accentSky/25 text-accentSky border border-accentSky/30 text-xs font-bold transition flex items-center space-x-1"
                title={`Cargar ${asset1.ticker} en el Pilar Central`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Auditar {asset1.ticker}</span>
              </button>
            )}

            {asset2 && onSelectCompanyForCentralPillar && (
              <button
                type="button"
                onClick={() => {
                  onSelectCompanyForCentralPillar(asset2.ticker);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-statusGreen/15 hover:bg-statusGreen/25 text-statusGreen border border-statusGreen/30 text-xs font-bold transition flex items-center space-x-1"
                title={`Cargar ${asset2.ticker} en el Pilar Central`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Auditar {asset2.ticker}</span>
              </button>
            )}

            {asset1 && onBuyTrade && (
              <button
                type="button"
                onClick={() => {
                  onBuyTrade(asset1);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-cardSecondary hover:bg-borderSubtle text-textPrimary text-xs font-bold transition flex items-center space-x-1"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-accentSky" />
                <span>Comprar {asset1.ticker}</span>
              </button>
            )}

            {asset2 && onBuyTrade && (
              <button
                type="button"
                onClick={() => {
                  onBuyTrade(asset2);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-cardSecondary hover:bg-borderSubtle text-textPrimary text-xs font-bold transition flex items-center space-x-1"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-statusGreen" />
                <span>Comprar {asset2.ticker}</span>
              </button>
            )}

            {asset1 && onAddToWatchlist && (
              <button
                type="button"
                onClick={() => onAddToWatchlist(asset1.ticker)}
                className="px-2.5 py-1.5 rounded-xl bg-cardSecondary hover:bg-borderSubtle text-textSecondary hover:text-textPrimary text-xs font-bold transition flex items-center space-x-1"
                title={`Seguir ${asset1.ticker}`}
              >
                <Eye className="w-3.5 h-3.5 text-accentSky" />
                <span>Seguir {asset1.ticker}</span>
              </button>
            )}

            {asset2 && onAddToWatchlist && (
              <button
                type="button"
                onClick={() => onAddToWatchlist(asset2.ticker)}
                className="px-2.5 py-1.5 rounded-xl bg-cardSecondary hover:bg-borderSubtle text-textSecondary hover:text-textPrimary text-xs font-bold transition flex items-center space-x-1"
                title={`Seguir ${asset2.ticker}`}
              >
                <Eye className="w-3.5 h-3.5 text-statusGreen" />
                <span>Seguir {asset2.ticker}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-cardSecondary text-textSecondary hover:text-textPrimary text-xs font-bold transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
