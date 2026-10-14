import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  FileCheck2,
  Info,
  Calendar,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { FinancialDeepDiveData, FinancialMetric, FinancialPoint, FinancialMetricModeSummary } from '../types';

interface CompanyFinancialDeepDiveModalProps {
  isOpen: boolean;
  ticker: string | null;
  onClose: () => void;
  onSelectAnotherTicker?: (ticker: string) => void;
}

type PeriodMode = 'TTM' | 'T' | 'A';

interface MetricCardProps {
  metric: FinancialMetric;
  globalMode: PeriodMode;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric, globalMode }) => {
  // Modo local de la tarjeta, inicializado con el modo global pero permitiendo toggle individual
  const [localMode, setLocalMode] = useState<PeriodMode>(globalMode);
  const [hoveredPoint, setHoveredPoint] = useState<FinancialPoint | null>(null);
  const [showTooltipInfo, setShowTooltipInfo] = useState(false);

  useEffect(() => {
    setLocalMode(globalMode);
  }, [globalMode]);

  const summary: FinancialMetricModeSummary = metric.modes[localMode] || metric.modes.TTM;
  const points = summary.points || [];

  // Calcular escalas del gráfico
  const values = points.map(p => p.value);
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 100;
  
  // Padding vertical para que el gráfico no toque los bordes
  const range = maxVal - minVal;
  const yMin = minVal < 0 ? minVal * 1.15 : Math.max(0, minVal - (range * 0.15));
  const yMax = maxVal > 0 ? maxVal * 1.15 : 0;
  const effectiveRange = (yMax - yMin) || 1;

  const isBarChart = ['flujo_caja_operativo', 'capex', 'flujo_caja_libre'].includes(metric.key);

  const getStatusColor = (color: string) => {
    switch (color) {
      case 'positive':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'warning':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getStatusDotColor = (color: string) => {
    switch (color) {
      case 'positive':
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
      case 'warning':
        return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
      default:
        return 'bg-slate-400';
    }
  };

  // Dimensiones del SVG
  const svgWidth = 320;
  const svgHeight = 110;
  const paddingX = 16;
  const paddingY = 14;

  const getYCoord = (val: number) => {
    const norm = (val - yMin) / effectiveRange;
    return (svgHeight - paddingY) - norm * (svgHeight - paddingY * 2);
  };

  const zeroY = getYCoord(0);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all duration-200 shadow-lg relative group">
      {/* Cabecera de la tarjeta */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 relative">
            <h4 className="text-sm font-semibold text-slate-100 tracking-tight">
              {metric.title}
            </h4>
            <button
              onClick={() => setShowTooltipInfo(!showTooltipInfo)}
              onMouseEnter={() => setShowTooltipInfo(true)}
              onMouseLeave={() => setShowTooltipInfo(false)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded-full"
              title="Información de la métrica"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {/* Tooltip con explicación rigurosa de la métrica */}
            {showTooltipInfo && (
              <div className="absolute left-0 top-6 z-30 w-64 p-2.5 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl text-xs text-slate-300 pointer-events-none leading-relaxed animate-fadeIn">
                <p className="font-semibold text-slate-100 mb-1">{metric.title} ({metric.unit})</p>
                <p>{metric.description}</p>
                <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Fuente: SEC EDGAR US-GAAP</span>
                  <span className="text-emerald-400 font-mono">10-K / 10-Q</span>
                </div>
              </div>
            )}
          </div>

          {/* Segmented Control de periodo: [A] [T] [TTM] */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800/80 text-[11px] font-medium">
            <button
              onClick={() => setLocalMode('A')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                localMode === 'A'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Anual (10-K)"
            >
              A
            </button>
            <button
              onClick={() => setLocalMode('T')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                localMode === 'T'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Trimestral (10-Q)"
            >
              T
            </button>
            <button
              onClick={() => setLocalMode('TTM')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                localMode === 'TTM'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Doce meses acumulados (TTM)"
            >
              TTM
            </button>
          </div>
        </div>

        {/* Dato principal y variaciones */}
        <div className="mt-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-2xl font-bold font-mono tracking-tight ${
              summary.current != null && summary.current < 0 ? 'text-rose-400' : 'text-slate-50'
            }`}>
              {summary.current_formatted}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {summary.period_label}
            </span>
            {summary.delta_text && (
              <span className={`text-xs font-semibold font-mono ${
                summary.delta != null && summary.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {summary.delta_text}
              </span>
            )}
          </div>

          {/* Mediana histórica */}
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>Su mediana histórica</span>
            <span className="font-semibold text-slate-200 font-mono">
              {summary.median_formatted}
            </span>
            {['roe', 'roa', 'roic'].includes(metric.key) && (
              <span className="text-[11px] text-slate-400">retorno últimos 12 meses</span>
            )}
          </div>

          {/* Status Chip con punto de color */}
          {summary.status?.text && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(summary.status.color)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(summary.status.color)}`} />
                {summary.status.text}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico interactivo SVG (Barras o Línea con mediana) */}
      <div className="mt-3 relative pt-2 border-t border-slate-800/60">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-24 overflow-visible select-none"
        >
          {/* Línea horizontal del cero si hay valores negativos */}
          {minVal < 0 && (
            <line
              x1={paddingX}
              y1={zeroY}
              x2={svgWidth - paddingX}
              y2={zeroY}
              stroke="#334155"
              strokeDasharray="2,2"
              strokeWidth="1"
            />
          )}

          {/* Línea discontinua de mediana de referencia */}
          {summary.median != null && (
            <>
              <line
                x1={paddingX}
                y1={getYCoord(summary.median)}
                x2={svgWidth - paddingX}
                y2={getYCoord(summary.median)}
                stroke="#64748b"
                strokeDasharray="3,3"
                strokeWidth="1"
                opacity="0.8"
              />
              <text
                x={svgWidth - paddingX - 4}
                y={getYCoord(summary.median) - 3}
                fill="#94a3b8"
                fontSize="8"
                textAnchor="end"
                className="font-mono"
              >
                mediana {summary.median_formatted}
              </text>
            </>
          )}

          {/* Gráfico de BARRAS (Caja, CapEx, FCF) */}
          {isBarChart && points.map((p, i) => {
            const barW = Math.max(4, Math.min(12, (svgWidth - paddingX * 2) / points.length - 3));
            const x = paddingX + (i * ((svgWidth - paddingX * 2) / points.length)) + ((svgWidth - paddingX * 2) / points.length - barW) / 2;
            const y = p.value >= 0 ? getYCoord(p.value) : zeroY;
            const h = Math.abs(getYCoord(p.value) - zeroY) || 2;

            // CapEx siempre rojo/coral (salida de caja), FCF verde/rojo según signo, OCF verde
            let barColor = '#10b981'; // emerald
            if (metric.key === 'capex') {
              barColor = '#f43f5e'; // rose/coral
            } else if (p.value < 0) {
              barColor = '#ef4444'; // red
            }

            const isHovered = hoveredPoint?.date === p.date;

            return (
              <g key={p.date} className="cursor-pointer" onMouseEnter={() => setHoveredPoint(p)} onMouseLeave={() => setHoveredPoint(null)}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(2, h)}
                  fill={barColor}
                  rx="1.5"
                  opacity={hoveredPoint && !isHovered ? 0.4 : 0.9}
                  className="transition-all duration-150 hover:brightness-125"
                />
              </g>
            );
          })}

          {/* Gráfico de LÍNEA (Márgenes y Retornos ROE/ROA/ROIC) */}
          {!isBarChart && points.length > 1 && (
            <>
              {/* Path de la curva */}
              <path
                d={points.reduce((acc, p, i) => {
                  const x = paddingX + (i / (points.length - 1)) * (svgWidth - paddingX * 2);
                  const y = getYCoord(p.value);
                  return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                }, '')}
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Puntos de la curva */}
              {points.map((p, i) => {
                const x = paddingX + (i / (points.length - 1)) * (svgWidth - paddingX * 2);
                const y = getYCoord(p.value);
                const isHovered = hoveredPoint?.date === p.date;

                return (
                  <circle
                    key={p.date}
                    cx={x}
                    cy={y}
                    r={isHovered ? 4.5 : 2}
                    fill={isHovered ? '#34d399' : '#059669'}
                    stroke="#0f172a"
                    strokeWidth={isHovered ? 2 : 1}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </>
          )}
        </svg>

        {/* Tooltip flotante al hacer hover sobre un punto del gráfico */}
        {hoveredPoint && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-slate-950/95 border border-slate-700/80 rounded-lg px-2.5 py-1.5 shadow-xl text-center pointer-events-none whitespace-nowrap animate-fadeIn">
            <p className="text-[10px] font-bold text-slate-300">{hoveredPoint.periodFull}</p>
            <p className="text-xs font-mono font-bold text-emerald-400">
              {metric.unit === '$'
                ? hoveredPoint.value >= 1e9
                  ? `$${(hoveredPoint.value / 1e9).toFixed(1)} mil M`
                  : `$${(hoveredPoint.value / 1e6).toFixed(1)} M`
                : metric.unit === '%'
                ? `${hoveredPoint.value.toFixed(1)}%`
                : `${hoveredPoint.value.toFixed(2)}x`}
            </p>
            <p className="text-[9px] text-slate-400">
              Cierre: {hoveredPoint.date} · {hoveredPoint.form || 'SEC'}
            </p>
          </div>
        )}

        {/* Ejes y etiquetas inferiores */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
          <span>{points[0]?.period || ''}</span>
          <span className="text-slate-300">{summary.period_label}</span>
          <span className="font-semibold">{metric.unit === '$' ? 'USD' : metric.unit}</span>
        </div>
      </div>
    </div>
  );
};

export const CompanyFinancialDeepDiveModal: React.FC<CompanyFinancialDeepDiveModalProps> = ({
  isOpen,
  ticker,
  onClose,
  onSelectAnotherTicker
}) => {
  const [data, setData] = useState<FinancialDeepDiveData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [globalMode, setGlobalMode] = useState<PeriodMode>('TTM');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !ticker) {
      setData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/company/${encodeURIComponent(ticker)}/financial-history`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`No se encontraron estados auditados para ${ticker}`);
        }
        return res.json();
      })
      .then((json: FinancialDeepDiveData) => {
        if (isMounted) {
          setData(json);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, ticker]);

  // Escuchar tecla Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 md:p-6 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-7xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Barra superior institucional con navegación clara */}
        <div className="p-4 md:p-5 border-b border-slate-800/80 bg-slate-900/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Botón Volver prominente */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-bold text-xs shadow-sm transition group"
              title="Volver hacia atrás / Cerrar radiografía"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Volver</span>
            </button>

            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-base">
              {ticker ? ticker.slice(0, 3) : 'FIN'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-bold text-slate-100 tracking-tight">
                  {data?.company_name || ticker}
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs font-semibold">
                  {ticker}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Auditado SEC EDGAR · Cero Invención
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Radiografía Contable Oficial · Estados de Flujos y Cuenta de Resultados US-GAAP (10-K & 10-Q)
              </p>
            </div>
          </div>

          {/* Selector global de granularidad temporal y buscador rápido */}
          <div className="flex items-center gap-3 flex-wrap">
            {onSelectAnotherTicker && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    onSelectAnotherTicker(searchQuery.trim().toUpperCase());
                    setSearchQuery('');
                  }
                }}
                className="flex items-center"
              >
                <input
                  type="text"
                  placeholder="Ver otro ticker (ej. MSFT, NVDA)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 uppercase font-mono outline-none focus:border-emerald-500 w-44"
                />
              </form>
            )}

            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <span className="text-slate-400 px-2 py-1 flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Horizonte:
              </span>
              <button
                onClick={() => setGlobalMode('TTM')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  globalMode === 'TTM'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                TTM (12M Móviles)
              </button>
              <button
                onClick={() => setGlobalMode('T')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  globalMode === 'T'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Trimestral (10-Q)
              </button>
              <button
                onClick={() => setGlobalMode('A')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  globalMode === 'A'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Anual (10-K)
              </button>
            </div>

            <button
              onClick={onClose}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Cerrar ventana (ESC)"
            >
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">ESC</span>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
          {isLoading && (
            <div className="py-24 text-center">
              <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-base font-semibold text-slate-200">
                Extrayendo y contrastando estados financieros auditados de SEC EDGAR...
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Calculando series históricas trimestrales y TTM para {ticker}
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="py-16 text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-1">
                Datos no disponibles de forma inmediata
              </h3>
              <p className="text-xs text-slate-400 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Volver
              </button>
            </div>
          )}

          {data && !isLoading && (
            <>
              {/* SECCIÓN 1: RENTABILIDAD Y RETORNOS (8 MÉTRICAS) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-100 tracking-tight">
                      Rentabilidad y retornos
                    </h3>
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center">
                      8
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Márgenes brutos, operativos, netos y eficiencias de capital (ROE/ROA/ROIC)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {data.profitability_and_returns.map((metric) => (
                    <MetricCard
                      key={metric.key}
                      metric={metric}
                      globalMode={globalMode}
                    />
                  ))}
                </div>
              </div>

              {/* SECCIÓN 2: CAJA, INVERSIÓN Y CONVERSIÓN (6 MÉTRICAS) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-100 tracking-tight">
                      Caja, inversión y conversión
                    </h3>
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center">
                      6
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Flujo operativo, desembolsos en CapEx, FCF real y conversión de beneficios
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.cash_investment_and_conversion.map((metric) => (
                    <MetricCard
                      key={metric.key}
                      metric={metric}
                      globalMode={globalMode}
                    />
                  ))}
                </div>
              </div>

              {/* Pie de página de verificación de datos */}
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    Metodología de rigor institucional: Cada dato procede directamente de los informes periódicos 10-K y 10-Q depositados en la SEC de EE.UU.
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                  <span>CIK: {data.cik}</span>
                  <span>·</span>
                  <span>Último periodo: {data.latest_period}</span>
                  <span>·</span>
                  <span className="text-emerald-400">0% Invención</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Barra inferior fija de navegación institucional */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Datos 100% auditados SEC EDGAR (10-K y 10-Q) · Cero Invención</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs shadow-md border border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Volver al Análisis / Cerrar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
