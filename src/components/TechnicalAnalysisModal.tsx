import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Compass,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ShoppingCart
} from 'lucide-react';
import { TechnicalAnalysis, Currency } from '../types';
import { StockPriceChart } from './StockPriceChart';

interface TechnicalAnalysisModalProps {
  isOpen: boolean;
  ticker: string | null;
  onClose: () => void;
  onBuyTrade?: (tradeData: { ticker: string; companyName: string; buyPrice: number; fairValue: number; currency: Currency }) => void;
  onRemoveFromWatchlist?: (ticker: string) => void;
}

export const TechnicalAnalysisModal: React.FC<TechnicalAnalysisModalProps> = ({
  isOpen,
  ticker,
  onClose,
  onBuyTrade,
  onRemoveFromWatchlist
}) => {
  const [data, setData] = useState<TechnicalAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !ticker) {
      setData(null);
      setError(null);
      return;
    }

    const fetchTechnicalData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/technical/${encodeURIComponent(ticker)}?timeframe=1A`);
        if (!res.ok) {
          throw new Error(`No se pudo obtener el análisis técnico para ${ticker}`);
        }
        const json: TechnicalAnalysis = await res.json();
        setData(json);
      } catch (err: any) {
        console.error('Error fetching technical data:', err);
        setError(err.message || 'Error al cargar análisis técnico');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTechnicalData();
  }, [isOpen, ticker]);

  if (!isOpen || !ticker) return null;

  const addedPrice = data?.tracking_info?.added_price;
  const currentPrice = data?.current_price || 0;
  const changePct = addedPrice && addedPrice > 0 ? ((currentPrice - addedPrice) / addedPrice) * 100 : 0;
  const changeAmount = addedPrice ? currentPrice - addedPrice : 0;
  const isPositive = changePct >= 0;

  const rec = data?.sintesis?.recomendacion || 'ESPERAR';
  const recBadgeClass =
    rec === 'ENTRAR'
      ? 'bg-statusGreen/20 text-statusGreen border-statusGreen/40'
      : rec === 'DESCARTAR'
      ? 'bg-statusRed/20 text-statusRed border-statusRed/40'
      : rec === 'TOMAR_BENEFICIOS'
      ? 'bg-accentYellow/20 text-accentYellow border-accentYellow/40'
      : 'bg-accentSky/20 text-accentSky border-accentSky/40';

  const recLabel =
    rec === 'ENTRAR'
      ? 'ENTRAR / COMPRAR TÉCNICAMENTE'
      : rec === 'DESCARTAR'
      ? 'DESCARTAR / EVITAR'
      : rec === 'TOMAR_BENEFICIOS'
      ? 'TOMAR BENEFICIOS / SOBRECOMPRA'
      : 'ESPERAR / OBSERVAR RETROCESO';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-borderSubtle rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* HEADER */}
        <div className="p-4 border-b border-borderSubtle flex items-center justify-between bg-canvas/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-accentSky/10 border border-accentSky/30 flex items-center justify-center text-accentSky font-bold">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-textPrimary tracking-tight">{ticker}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-canvas border border-borderSubtle text-textSecondary uppercase">
                  {data?.currency || 'USD'}
                </span>
                {data?.tracking_info && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accentSky/15 text-accentSky border border-accentSky/30">
                    En Seguimiento
                  </span>
                )}
              </div>
              <p className="text-xs text-textSecondary">
                Análisis Técnico Cuantitativo & Evolución de Cotización
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Cotización Actual y Variación desde Seguimiento */}
            <div className="text-right">
              <div className="text-base font-extrabold text-textPrimary font-mono">
                ${currentPrice.toFixed(2)}
              </div>
              {addedPrice ? (
                <div className={`text-xs font-semibold flex items-center justify-end space-x-1 ${isPositive ? 'text-statusGreen' : 'text-statusRed'}`}>
                  {isPositive ? <TrendingUp className="w-3.5 h-3.5 inline" /> : <TrendingDown className="w-3.5 h-3.5 inline" />}
                  <span>
                    {isPositive ? '+' : ''}${changeAmount.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
                  </span>
                  <span className="text-[10px] text-textSecondary ml-1 font-normal">desde adición (${addedPrice.toFixed(2)})</span>
                </div>
              ) : (
                <span className="text-[10px] text-textSecondary">Cotización de mercado en vivo</span>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-canvas transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="h-96 flex flex-col items-center justify-center space-y-3">
              <Activity className="w-8 h-8 text-accentSky animate-pulse" />
              <p className="text-sm text-textSecondary">Calculando osciladores técnicos, volatilidad y niveles empíricos...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-statusRed bg-statusRed/10 border border-statusRed/30 rounded-xl">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-statusRed" />
              <p className="font-semibold">{error}</p>
            </div>
          ) : data ? (
            <>
              {/* 1. GRÁFICO INTERACTIVO DE COTIZACIÓN */}
              <div className="bg-canvas/50 border border-borderSubtle rounded-xl p-3">
                <StockPriceChart
                  ticker={ticker}
                  currency={(data.currency as Currency) || 'USD'}
                  buyPrice={data.tracking_info?.added_price || null}
                  fairValue={data.curva_valoracion?.fair_value || null}
                  mosCeiling={data.curva_valoracion?.techo_mos || null}
                  currentPrice={currentPrice}
                  initialTimeframe="1M"
                  initialMode="candles"
                />
              </div>

              {/* 2. RECOMENDACIÓN TÉCNICA SINTÉTICA Y SCORE MULTIDIMENSIONAL */}
              <div className="bg-card border border-borderSubtle rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                      Veredicto Técnico Cuantitativo:
                    </span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-lg border flex items-center space-x-1.5 ${recBadgeClass}`}>
                      {rec === 'ENTRAR' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Compass className="w-3.5 h-3.5" />}
                      <span>{recLabel}</span>
                    </span>
                  </div>
                  <p className="text-xs text-textSecondary leading-relaxed">
                    {data.sintesis.justificacion}
                  </p>
                </div>

                <div className="flex items-center space-x-6 border-t md:border-t-0 md:border-l border-borderSubtle pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-center">
                    <span className="text-[10px] text-textSecondary block font-medium">Score Técnico</span>
                    <span className="text-2xl font-black font-mono text-accentSky">
                      {data.sintesis.score_tecnico}
                      <span className="text-xs text-textSecondary font-normal">/100</span>
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-[10px] text-textSecondary block font-medium">Ratio R:R Sugerido</span>
                    <span className={`text-2xl font-black font-mono ${data.gestion_riesgo.ratio_risk_reward >= 2.0 ? 'text-statusGreen' : 'text-accentYellow'}`}>
                      {data.gestion_riesgo.ratio_risk_reward.toFixed(1)}x
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. CONTEXTO DE LA CURVA DE VALORACIÓN VS COTIZACIÓN */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-canvas border border-borderSubtle rounded-xl p-3">
                  <span className="text-[10px] font-semibold text-textSecondary uppercase block">Precio al Añadir</span>
                  <div className="text-sm font-bold font-mono text-textPrimary mt-0.5">
                    ${addedPrice ? addedPrice.toFixed(2) : '---'}
                  </div>
                  <span className="text-[10px] text-textSecondary">
                    {data.tracking_info?.created_at ? new Date(data.tracking_info.created_at).toLocaleDateString('es-ES') : 'No registrado'}
                  </span>
                </div>

                <div className="bg-canvas border border-borderSubtle rounded-xl p-3">
                  <span className="text-[10px] font-semibold text-textSecondary uppercase block">Fair Value Pilar 1</span>
                  <div className="text-sm font-bold font-mono text-accentSky mt-0.5">
                    ${data.curva_valoracion.fair_value ? data.curva_valoracion.fair_value.toFixed(2) : 'N/A'}
                  </div>
                  <span className="text-[10px] text-textSecondary">
                    {data.curva_valoracion.sobreprecio_vs_fair_pct != null
                      ? `${data.curva_valoracion.sobreprecio_vs_fair_pct > 0 ? '+' : ''}${data.curva_valoracion.sobreprecio_vs_fair_pct}% vs P0`
                      : 'Valor intrínseco'}
                  </span>
                </div>

                <div className="bg-canvas border border-borderSubtle rounded-xl p-3">
                  <span className="text-[10px] font-semibold text-textSecondary uppercase block">Techo MoS Prudente</span>
                  <div className="text-sm font-bold font-mono text-statusGreen mt-0.5">
                    ${data.curva_valoracion.techo_mos ? data.curva_valoracion.techo_mos.toFixed(2) : 'N/A'}
                  </div>
                  <span className="text-[10px] text-textSecondary">
                    {currentPrice <= (data.curva_valoracion.techo_mos || 0)
                      ? '✓ En Zona de Entrada MoS'
                      : 'Por encima del techo'}
                  </span>
                </div>

                <div className="bg-canvas border border-borderSubtle rounded-xl p-3">
                  <span className="text-[10px] font-semibold text-textSecondary uppercase block">Rango 52 Semanas</span>
                  <div className="text-xs font-bold font-mono text-textPrimary mt-0.5 flex justify-between">
                    <span>${data.niveles.low_52w?.toFixed(2)}</span>
                    <span className="text-textSecondary">|</span>
                    <span>${data.niveles.high_52w?.toFixed(2)}</span>
                  </div>
                  <span className={`text-[10px] font-semibold block mt-0.5 ${data.niveles.drawdown_52w_pct <= -25 ? 'text-accentYellow' : 'text-textSecondary'}`}>
                    Drawdown: {data.niveles.drawdown_52w_pct}%
                  </span>
                </div>
              </div>

              {/* 4. GRID DE INDICADORES TÉCNICOS EMPÍRICOS (TENDENCIA, MOMENTUM, VOLATILIDAD) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* BLOQUE A: TENDENCIA & MEDIAS MÓVILES */}
                <div className="bg-card border border-borderSubtle rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b border-borderSubtle text-xs font-bold text-textPrimary">
                    <TrendingUp className="w-4 h-4 text-accentSky" />
                    <span>Tendencia & Estructura</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-textSecondary">Régimen Técnico:</span>
                      <span className="font-bold text-accentSky text-[11px] bg-accentSky/10 px-2 py-0.5 rounded border border-accentSky/20">
                        {data.tendencia.regimen}
                      </span>
                    </div>

                    <div className="flex justify-between items-center font-mono">
                      <span className="text-textSecondary font-sans">Media SMA 20:</span>
                      <span>${data.tendencia.sma20 ? data.tendencia.sma20.toFixed(2) : '---'} ({data.tendencia.precio_vs_sma20_pct > 0 ? '+' : ''}{data.tendencia.precio_vs_sma20_pct}%)</span>
                    </div>

                    <div className="flex justify-between items-center font-mono">
                      <span className="text-textSecondary font-sans">Media SMA 50:</span>
                      <span>${data.tendencia.sma50 ? data.tendencia.sma50.toFixed(2) : '---'} ({data.tendencia.precio_vs_sma50_pct > 0 ? '+' : ''}{data.tendencia.precio_vs_sma50_pct}%)</span>
                    </div>

                    <div className="flex justify-between items-center font-mono">
                      <span className="text-textSecondary font-sans">Media SMA 200:</span>
                      <span className={data.tendencia.precio_vs_sma200_pct != null && data.tendencia.precio_vs_sma200_pct < 0 ? 'text-statusRed font-bold' : 'text-statusGreen font-bold'}>
                        ${data.tendencia.sma200 ? data.tendencia.sma200.toFixed(2) : '---'} ({data.tendencia.precio_vs_sma200_pct != null ? `${data.tendencia.precio_vs_sma200_pct > 0 ? '+' : ''}${data.tendencia.precio_vs_sma200_pct}%` : '---'})
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-borderSubtle">
                      <span className="text-textSecondary">Cruce SMA 50/200:</span>
                      <span className="font-semibold text-[11px]">
                        {data.tendencia.golden_cross === true ? '✓ Golden Cross (Alcista)' : data.tendencia.golden_cross === false ? '⚠ Death Cross (Bajista)' : 'En evaluación'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* BLOQUE B: MOMENTUM & OSCILADORES (RSI, MACD) */}
                <div className="bg-card border border-borderSubtle rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b border-borderSubtle text-xs font-bold text-textPrimary">
                    <Activity className="w-4 h-4 text-accentYellow" />
                    <span>Momentum & Osciladores</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* RSI */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-textSecondary">RSI (14 periodos):</span>
                        <span className={`font-mono font-bold ${data.momentum.rsi <= 32 ? 'text-statusGreen' : data.momentum.rsi >= 68 ? 'text-statusRed' : 'text-accentYellow'}`}>
                          {data.momentum.rsi.toFixed(1)} ({data.momentum.estado_rsi})
                        </span>
                      </div>
                      <div className="w-full bg-canvas h-1.5 rounded-full overflow-hidden border border-borderSubtle relative">
                        {/* Marcadores 30 y 70 */}
                        <div
                          className={`h-full ${data.momentum.rsi <= 32 ? 'bg-statusGreen' : data.momentum.rsi >= 68 ? 'bg-statusRed' : 'bg-accentYellow'}`}
                          style={{ width: `${Math.min(100, Math.max(0, data.momentum.rsi))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-textSecondary mt-0.5 font-mono">
                        <span>0 Sobreventa</span>
                        <span>50</span>
                        <span>100 Sobrecompra</span>
                      </div>
                    </div>

                    {/* MACD */}
                    {data.momentum.macd && (
                      <div className="pt-2 border-t border-borderSubtle space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-textSecondary font-sans">Línea MACD:</span>
                          <span>{data.momentum.macd.macd.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-textSecondary font-sans">Línea Señal:</span>
                          <span>{data.momentum.macd.signal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-textSecondary font-sans">Cruce e Impulso:</span>
                          <span className={`font-bold font-sans ${data.momentum.macd.cruce === 'ALCISTA' ? 'text-statusGreen' : 'text-statusRed'}`}>
                            {data.momentum.macd.cruce} ({data.momentum.macd.hist > 0 ? '+' : ''}{data.momentum.macd.hist.toFixed(2)})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* BLOQUE C: VOLATILIDAD, BOLLINGER & ATR */}
                <div className="bg-card border border-borderSubtle rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b border-borderSubtle text-xs font-bold text-textPrimary">
                    <Zap className="w-4 h-4 text-statusGreen" />
                    <span>Volatilidad, Varianza & Rango</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Bollinger Bands */}
                    {data.volatilidad.bollinger && (
                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-textSecondary font-sans">Bollinger Superior:</span>
                          <span>${data.volatilidad.bollinger.upper.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-textSecondary font-sans">Bollinger Inferior:</span>
                          <span>${data.volatilidad.bollinger.lower.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-textSecondary font-sans">Bandwidth (Ancho %):</span>
                          <span className="font-bold">
                            {data.volatilidad.bollinger.bandwidth.toFixed(1)}% {data.volatilidad.bollinger.squeeze && '⚠ Squeeze'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ATR y Volatilidad Histórica */}
                    <div className="pt-2 border-t border-borderSubtle space-y-1 text-[11px]">
                      <div className="flex justify-between font-mono">
                        <span className="text-textSecondary font-sans">ATR (14 días):</span>
                        <span>${data.volatilidad.atr?.atr.toFixed(2)} ({data.volatilidad.atr?.atr_pct.toFixed(1)}% diario)</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-textSecondary font-sans">Volatilidad Anual (σ):</span>
                        <span className="font-bold text-accentSky">
                          {data.volatilidad.volatilidad_historica?.volatilidad_anual_pct.toFixed(1)}% anual
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. GESTIÓN DE RIESGO CUANTITATIVA Y MATRIZ DE RIESGOS DETALLADA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Plan Operativo de Stop Loss & Niveles */}
                <div className="bg-canvas border border-borderSubtle rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b border-borderSubtle text-xs font-bold text-textPrimary">
                    <ShieldCheck className="w-4 h-4 text-statusGreen" />
                    <span>Plan Operativo & Dimensionamiento de Riesgo</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-card border border-borderSubtle">
                      <span className="text-[10px] text-textSecondary uppercase font-semibold block">Stop Loss Técnico (2x ATR)</span>
                      <span className="text-base font-extrabold font-mono text-statusRed">
                        ${data.gestion_riesgo.stop_loss_sugerido.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-statusRed block mt-0.5 font-mono">
                        -{data.gestion_riesgo.distancia_stop_pct}% de riesgo
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-card border border-borderSubtle">
                      <span className="text-[10px] text-textSecondary uppercase font-semibold block">Take Profit Sugerido</span>
                      <span className="text-base font-extrabold font-mono text-statusGreen">
                        ${data.gestion_riesgo.take_profit_sugerido.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-statusGreen block mt-0.5 font-mono">
                        +{data.gestion_riesgo.potencial_take_profit_pct}% de recorrido
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] space-y-1 text-textSecondary pt-1">
                    <div className="flex justify-between">
                      <span>Soporte Inmediato más Fuerte:</span>
                      <strong className="text-textPrimary font-mono">${data.niveles.soporte_inmediato.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Resistencia Inmediata:</span>
                      <strong className="text-textPrimary font-mono">${data.niveles.resistencia_inmediata.toFixed(2)}</strong>
                    </div>
                    {data.niveles.fibonacci && (
                      <div className="flex justify-between">
                        <span>Golden Pocket Fib (61.8%):</span>
                        <strong className="text-accentYellow font-mono">${data.niveles.fibonacci.fib61.toFixed(2)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Alertas Detalladas de Riesgo */}
                <div className="bg-canvas border border-borderSubtle rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b border-borderSubtle text-xs font-bold text-textPrimary">
                    <ShieldAlert className="w-4 h-4 text-statusRed" />
                    <span>Análisis Detallado de Riesgos de Inversión</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {data.sintesis.alertas_riesgo.length > 0 ? (
                      data.sintesis.alertas_riesgo.map((alerta, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border text-xs ${
                            alerta.nivel === 'ALTO'
                              ? 'bg-statusRed/10 border-statusRed/30 text-statusRed'
                              : alerta.nivel === 'MODERADO_ALTO'
                              ? 'bg-accentYellow/10 border-accentYellow/30 text-accentYellow'
                              : 'bg-card border-borderSubtle text-textSecondary'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold flex items-center space-x-1">
                              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                              <span>{alerta.titulo}</span>
                            </span>
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold border border-current">
                              {alerta.nivel}
                            </span>
                          </div>
                          <p className="text-[11px] leading-tight text-textSecondary">{alerta.detalle}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 rounded-lg bg-statusGreen/10 border border-statusGreen/30 text-statusGreen text-xs flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>Sin alertas críticas de sobreextensión técnica o rotura de soporte.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* FOOTER CON ACCIONES */}
        <div className="p-4 border-t border-borderSubtle bg-canvas/60 flex items-center justify-between">
          <div>
            {data?.tracking_info && onRemoveFromWatchlist && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar ${ticker} de las empresas en seguimiento?`)) {
                    onRemoveFromWatchlist(ticker);
                    onClose();
                  }
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-statusRed hover:bg-statusRed/10 border border-statusRed/30 transition-colors flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Dejar de Seguir</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-textSecondary hover:text-textPrimary hover:bg-canvas transition-colors"
            >
              Cerrar
            </button>

            {onBuyTrade && (
              <button
                type="button"
                onClick={() => {
                  onBuyTrade({
                    ticker,
                    companyName: data?.tracking_info ? ticker : ticker,
                    buyPrice: currentPrice,
                    fairValue: data?.curva_valoracion?.fair_value || currentPrice,
                    currency: (data?.currency as Currency) || 'USD'
                  });
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-accentSky text-canvas hover:bg-accentSky/90 shadow-md transition-all flex items-center space-x-1.5"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Ejecutar Compra en Mis Compras</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
