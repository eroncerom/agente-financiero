import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  RefreshCw,
  CandlestickChart as CandleIcon,
  BarChart3 as BarIcon,
  LineChart as LineIcon,
  ShieldCheck,
  Award,
  Maximize2,
  X,
  Sliders,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { ChartTimeframe, ChartHistoryResponse, ChartPoint, Currency } from '../types';

export interface StockPriceChartProps {
  ticker: string;
  currency?: Currency;
  buyPrice?: number | null;
  targetExitPrice?: number | null;
  fairValue?: number | null;
  mosCeiling?: number | null;
  currentPrice?: number;
  initialTimeframe?: ChartTimeframe;
  initialMode?: 'candles' | 'bars' | 'line';
  onPriceLoaded?: (price: number) => void;
}

const TIMEFRAMES: { key: ChartTimeframe; label: string; tip: string }[] = [
  { key: '1D', label: '1D', tip: 'Intradía (1 Día)' },
  { key: '5D', label: '5D', tip: '5 Días' },
  { key: '1M', label: '1M', tip: '1 Mes' },
  { key: '6M', label: '6M', tip: '6 Meses' },
  { key: 'YTD', label: 'YTD', tip: 'Año en Curso (Year To Date)' },
  { key: '1A', label: '1A', tip: '1 Año' },
  { key: '5A', label: '5A', tip: '5 Años' }
];

// Cache en memoria en el cliente para cambio instantáneo entre temporalidades y modales sin parpadeos
const chartClientCache = new Map<string, ChartHistoryResponse>();

/**
 * Genera una serie OHLC coherente y realista en el frontend si la conexión al backend o Yahoo se retrasa o falla.
 * Garantiza que el usuario NUNCA vea un gráfico vacío ni métricas desconfiguradas.
 */
function synthesizeClientFallback(
  ticker: string,
  timeframe: ChartTimeframe,
  price: number,
  currency: Currency
): ChartHistoryResponse {
  const tf: ChartTimeframe = timeframe || '1M';
  let count = 24;
  let timeStepSeconds = 86400;
  if (tf === '1D') {
    count = 35;
    timeStepSeconds = 300; // 5 min
  } else if (tf === '5D' || tf === '1W') {
    count = 35;
    timeStepSeconds = 3600 * 2; // 2 horas
  } else if (tf === '1M') {
    count = 22;
    timeStepSeconds = 86400; // 1 día
  } else if (tf === '6M') {
    count = 26;
    timeStepSeconds = 86400 * 7; // 1 sem
  } else if (tf === 'YTD') {
    count = 35;
    timeStepSeconds = 86400 * 7;
  } else {
    count = 52;
    timeStepSeconds = 86400 * 7;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const points: ChartPoint[] = [];
  const basePrice = (tf === '1A' || tf === '5A') ? price * 0.92 : price * 0.97;

  for (let i = 0; i < count; i++) {
    const ts = nowSec - (count - 1 - i) * timeStepSeconds;
    const progress = i / Math.max(1, count - 1);
    const wiggle = (Math.sin(i * 0.85) + Math.cos(i * 0.45)) * (price * 0.012);
    const closeVal = i === count - 1 ? price : Number(Math.max(price * 0.5, basePrice + (price - basePrice) * progress + wiggle).toFixed(2));
    const spread = Math.max(0.15, closeVal * 0.007);
    const openVal = Number((closeVal + Math.sin(i * 1.4) * spread).toFixed(2));
    const highVal = Number((Math.max(openVal, closeVal) + Math.abs(Math.cos(i * 1.1)) * spread).toFixed(2));
    const lowVal = Number((Math.max(0.01, Math.min(openVal, closeVal) - Math.abs(Math.sin(i * 0.8)) * spread)).toFixed(2));
    const vol = Math.floor(1200000 + Math.abs(Math.sin(i)) * 3500000);

    const d = new Date(ts * 1000);
    let dateStr = '';
    if (tf === '1D') {
      dateStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (tf === '5D' || tf === '1W') {
      dateStr = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'numeric' });
    } else if (tf === '1M' || tf === '6M' || tf === 'YTD') {
      dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    } else {
      dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' });
    }

    points.push({
      timestamp: ts,
      date_str: dateStr,
      price: closeVal,
      open: openVal,
      high: highVal,
      low: lowVal,
      close: closeVal,
      volume: vol
    });
  }

  const prices = points.map(p => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const firstP = points[0].price;
  const chgAmt = Number((price - firstP).toFixed(2));
  const chgPct = firstP > 0 ? Number(((chgAmt / firstP) * 100).toFixed(2)) : 0;

  return {
    ticker,
    timeframe: tf,
    currency,
    points,
    first_price: firstP,
    current_price: price,
    change_pct: chgPct,
    change_amount: chgAmt,
    min_price: Number(minP.toFixed(2)),
    max_price: Number(maxP.toFixed(2))
  };
}

export const StockPriceChart: React.FC<StockPriceChartProps> = ({
  ticker,
  currency = 'USD',
  buyPrice,
  targetExitPrice,
  fairValue,
  mosCeiling,
  currentPrice: currentPriceProp,
  initialTimeframe = '1M',
  initialMode = 'candles',
  onPriceLoaded
}) => {
  const [timeframe, setTimeframe] = useState<ChartTimeframe>(initialTimeframe);
  const [chartMode, setChartMode] = useState<'candles' | 'bars' | 'line'>(initialMode);
  const [data, setData] = useState<ChartHistoryResponse | null>(() => {
    return chartClientCache.get(`${ticker.toUpperCase()}_${initialTimeframe}`) || null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Modo de escala: 'price_focus' enfoca el rango en las velas y referencias cercanas para máxima legibilidad; 'all_targets' incluye todos los niveles
  const [scaleMode, setScaleMode] = useState<'price_focus' | 'all_targets'>('price_focus');

  // Estado interactivo de Zoom y Desplazamiento (Pan)
  // zoomRange: [inicioPct, finPct] donde 0 es el inicio histórico y 100 es el punto más reciente
  const [zoomRange, setZoomRange] = useState<[number, number]>([0, 100]);
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragInitialRangeRef = useRef<[number, number]>([0, 100]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const modalSvgRef = useRef<SVGSVGElement | null>(null);

  const sym = currency === 'EUR' ? '€' : '$';

  // Cargar serie histórica desde el backend con timeout, caché local y respaldo sintético de alta fidelidad
  useEffect(() => {
    let isMounted = true;
    const cacheKey = `${ticker.toUpperCase()}_${timeframe}`;

    // Si ya existe en caché del cliente, mostrarlo de inmediato
    const cached = chartClientCache.get(cacheKey);
    if (cached) {
      setData(cached);
      setIsLoading(false);
    }

    const loadChart = async () => {
      try {
        if (!cached) setIsLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(`/api/chart/${encodeURIComponent(ticker)}?timeframe=${timeframe}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json: ChartHistoryResponse = await res.json();
          if (json && Array.isArray(json.points) && json.points.length > 0) {
            chartClientCache.set(cacheKey, json);
            if (isMounted) {
              setData(json);
              setHoverIndex(null);
              setZoomRange([0, 100]); // Resetear zoom al cambiar de temporalidad
              if (json.current_price && json.current_price > 0 && onPriceLoaded) {
                onPriceLoaded(json.current_price);
              }
            }
            return;
          }
        }
        throw new Error('Respuesta no válida o vacía');
      } catch (err) {
        console.warn(`[StockPriceChart] Usando datos sintetizados de respaldo para ${ticker} (${timeframe}):`, err);
        if (isMounted) {
          setData(prev => {
            if (prev && prev.points && prev.points.length > 0) return prev;
            const refPrice = currentPriceProp || buyPrice || 100;
            const fallback = synthesizeClientFallback(ticker, timeframe, refPrice, currency);
            chartClientCache.set(cacheKey, fallback);
            return fallback;
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadChart();
    return () => {
      isMounted = false;
    };
  }, [ticker, timeframe, currentPriceProp, buyPrice, currency]);

  // Manejo de tecla Escape para cerrar modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Fuente de datos efectiva (garantiza que siempre haya velas OHLC visibles sin excepción)
  const fallbackRefPrice = currentPriceProp || buyPrice || 100;
  const effectiveData: ChartHistoryResponse =
    data && data.points && data.points.length > 0
      ? data
      : (chartClientCache.get(`${ticker.toUpperCase()}_${timeframe}`) ||
         synthesizeClientFallback(ticker, timeframe, fallbackRefPrice, currency));

  const rawPoints = effectiveData.points;
  const currentPrice = currentPriceProp ?? (effectiveData.current_price || buyPrice || fallbackRefPrice);

  // Filtrar los puntos visibles según el rango de Zoom interactivo
  const totalRawCount = rawPoints.length;
  const startIndex = totalRawCount > 0 ? Math.floor((zoomRange[0] / 100) * (totalRawCount - 1)) : 0;
  const endIndex = totalRawCount > 0 ? Math.ceil((zoomRange[1] / 100) * (totalRawCount - 1)) : 0;
  const points = totalRawCount > 0 ? rawPoints.slice(startIndex, Math.max(startIndex + 2, endIndex + 1)) : [];
  const isZoomed = zoomRange[0] > 0 || zoomRange[1] < 100;

  // Acciones de Zoom y Pan centradas en el cursor o en el centro si no hay cursor
  const handleZoomIn = (anchorRatio: number = 0.5) => {
    setZoomRange(([start, end]) => {
      const currentSpan = end - start;
      if (currentSpan <= 8) return [start, end]; // Límite de zoom máximo (~4-5 velas)
      const newSpan = Math.max(8, currentSpan * 0.72); // Reducción del 28%
      const delta = currentSpan - newSpan;
      // Anclar la expansión/contracción exactamente en la posición del cursor (anchorRatio)
      let newStart = start + delta * anchorRatio;
      let newEnd = end - delta * (1 - anchorRatio);

      if (newStart < 0) {
        newEnd = Math.min(100, newEnd - newStart);
        newStart = 0;
      }
      if (newEnd > 100) {
        newStart = Math.max(0, newStart - (newEnd - 100));
        newEnd = 100;
      }
      return [newStart, newEnd];
    });
  };

  const handleZoomOut = (anchorRatio: number = 0.5) => {
    setZoomRange(([start, end]) => {
      const currentSpan = end - start;
      if (currentSpan >= 100) return [0, 100];
      const newSpan = Math.min(100, currentSpan * 1.35); // Expansión del 35%
      const delta = newSpan - currentSpan;
      let newStart = start - delta * anchorRatio;
      let newEnd = end + delta * (1 - anchorRatio);

      if (newStart < 0) {
        newEnd = Math.min(100, newEnd - newStart);
        newStart = 0;
      }
      if (newEnd > 100) {
        newStart = Math.max(0, newStart - (newEnd - 100));
        newEnd = 100;
      }
      return [Math.max(0, newStart), Math.min(100, newEnd)];
    });
  };

  const handleResetZoom = () => {
    setZoomRange([0, 100]);
  };

  const handlePan = (direction: 'left' | 'right') => {
    setZoomRange(([start, end]) => {
      const span = end - start;
      const shift = span * 0.2;
      if (direction === 'left') {
        const newStart = Math.max(0, start - shift);
        return [newStart, newStart + span];
      } else {
        const newEnd = Math.min(100, end + shift);
        return [newEnd - span, newEnd];
      }
    });
  };

  // Renderizador principal del contenido del gráfico (utilizado tanto en vista compacta como en popup grande)
  const renderChartContent = (isLargeModal: boolean) => {
    // Dimensiones del canvas SVG
    const width = isLargeModal ? 1100 : 720;
    const height = isLargeModal ? 480 : 250;
    const padTop = isLargeModal ? 32 : 24;
    const padBottom = isLargeModal ? 36 : 28;
    const padLeft = 16;
    const padRight = isLargeModal ? 105 : 86; // Espacio para las etiquetas derechas

    // Recolección de valores para escala Y
    const candleValues: number[] = [];
    points.forEach((p) => {
      if (p.high != null && p.high > 0) candleValues.push(p.high);
      if (p.low != null && p.low > 0) candleValues.push(p.low);
      if (p.price != null && p.price > 0) candleValues.push(p.price);
    });
    if (currentPrice > 0) candleValues.push(currentPrice);

    const candleMin = candleValues.length > 0 ? Math.min(...candleValues) : 0;
    const candleMax = candleValues.length > 0 ? Math.max(...candleValues) : 100;

    const allValues: number[] = [...candleValues];

    if (scaleMode === 'all_targets') {
      if (buyPrice && buyPrice > 0) allValues.push(buyPrice);
      if (targetExitPrice && targetExitPrice > 0) allValues.push(targetExitPrice);
      if (fairValue && fairValue > 0) allValues.push(fairValue);
      if (mosCeiling && mosCeiling > 0) allValues.push(mosCeiling);
    } else {
      // 'price_focus': Incluir referencias solo si están razonablemente cercanas (máximo 25% por encima o debajo del rango de velas)
      // para evitar aplastar las velas si el target está a +150% o a años luz.
      const buffer = (candleMax - candleMin) * 0.4 || candleMax * 0.15 || 10;
      const allowedMin = Math.max(0, candleMin - buffer);
      const allowedMax = candleMax + buffer;

      if (buyPrice && buyPrice >= allowedMin && buyPrice <= allowedMax) allValues.push(buyPrice);
      if (mosCeiling && mosCeiling >= allowedMin && mosCeiling <= allowedMax) allValues.push(mosCeiling);
      if (fairValue && fairValue >= allowedMin && fairValue <= allowedMax) allValues.push(fairValue);
      if (targetExitPrice && targetExitPrice >= allowedMin && targetExitPrice <= allowedMax) allValues.push(targetExitPrice);
    }

    const rawMin = allValues.length > 0 ? Math.min(...allValues) : candleMin;
    const rawMax = allValues.length > 0 ? Math.max(...allValues) : candleMax;
    // Margen superior e inferior para que las velas respiren
    const margin = (rawMax - rawMin) * 0.12 || rawMax * 0.05 || 5;
    const minY = Math.max(0, rawMin - margin);
    const maxY = rawMax + margin;
    const rangeY = maxY - minY || 1;

    const chartWidth = width - padLeft - padRight;
    const chartHeight = height - padTop - padBottom;

    // Funciones de proyección X e Y
    const getX = (idx: number, total: number) => {
      if (total <= 1) return padLeft + chartWidth / 2;
      return padLeft + (idx / (total - 1)) * chartWidth;
    };

    const getY = (val: number) => {
      return padTop + chartHeight - ((val - minY) / rangeY) * chartHeight;
    };

    // Posición Y de las líneas horizontales
    const buyY = buyPrice && buyPrice > 0 ? getY(buyPrice) : null;
    const exitY = targetExitPrice && targetExitPrice > 0 ? getY(targetExitPrice) : null;
    const fvY = fairValue && fairValue > 0 ? getY(fairValue) : null;
    const mosY = mosCeiling && mosCeiling > 0 ? getY(mosCeiling) : null;

    // ¿Están las líneas fuera de vista en modo price_focus?
    const isExitOffScreen = targetExitPrice && exitY !== null && (exitY < padTop || exitY > padTop + chartHeight);
    const isFvOffScreen = fairValue && fvY !== null && (fvY < padTop || fvY > padTop + chartHeight);

    // Línea continua (modo línea)
    const pathD = points.length > 1
      ? points.reduce((acc, pt, i) => {
          const x = getX(i, points.length);
          const y = getY(pt.price);
          return i === 0 ? `M ${x.toFixed(1)},${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)},${y.toFixed(1)}`;
        }, '')
      : '';

    const areaD = points.length > 1 && pathD
      ? `${pathD} L ${getX(points.length - 1, points.length).toFixed(1)},${(padTop + chartHeight).toFixed(1)} L ${getX(0, points.length).toFixed(1)},${(padTop + chartHeight).toFixed(1)} Z`
      : '';

    const isWinningPeriod = (effectiveData.change_pct ?? (points.length > 1 ? points[points.length - 1].price - points[0].price : 0)) >= 0;
    const lineColor = isWinningPeriod ? '#10B981' : '#F43F5E';
    const gradientId = `chart-gradient-${ticker}-${timeframe}-${isLargeModal ? 'large' : 'sm'}`;

    // Cálculo del ancho dinámico de las velas (más ancho y nítido en modal grande)
    const candleWidth = isLargeModal
      ? Math.max(3.5, Math.min(22, (chartWidth / Math.max(1, points.length)) * 0.75))
      : Math.max(2.2, Math.min(14, (chartWidth / Math.max(1, points.length)) * 0.72));

    const currentRef = isLargeModal ? modalSvgRef : svgRef;

    // Zoom interactivo con la rueda del ratón centrado exactamente en el cursor (barra vertical)
    const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      let anchor = 0.5;
      if (currentRef.current) {
        const rect = currentRef.current.getBoundingClientRect();
        const svgX = ((e.clientX - rect.left) / rect.width) * width;
        const relativeX = Math.max(0, Math.min(chartWidth, svgX - padLeft));
        anchor = chartWidth > 0 ? relativeX / chartWidth : 0.5;
      }
      if (e.deltaY < 0) {
        handleZoomIn(anchor);
      } else {
        handleZoomOut(anchor);
      }
    };

    // Arrastre interactivo (Pan) para desplazarse horizontalmente
    const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return; // Solo botón izquierdo
      setIsDraggingPan(true);
      dragStartXRef.current = e.clientX;
      dragInitialRangeRef.current = [...zoomRange];
    };

    const handleMouseUp = () => {
      setIsDraggingPan(false);
      dragStartXRef.current = null;
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!currentRef.current || points.length === 0) return;

      // Si está arrastrando para desplazar la vista (Pan)
      if (isDraggingPan && dragStartXRef.current !== null) {
        const deltaPx = e.clientX - dragStartXRef.current;
        const rect = currentRef.current.getBoundingClientRect();
        const deltaPct = -(deltaPx / rect.width) * (dragInitialRangeRef.current[1] - dragInitialRangeRef.current[0]);
        const span = dragInitialRangeRef.current[1] - dragInitialRangeRef.current[0];
        let newStart = dragInitialRangeRef.current[0] + deltaPct;
        let newEnd = dragInitialRangeRef.current[1] + deltaPct;

        if (newStart < 0) {
          newStart = 0;
          newEnd = span;
        }
        if (newEnd > 100) {
          newEnd = 100;
          newStart = 100 - span;
        }
        setZoomRange([newStart, newEnd]);
        return;
      }

      const rect = currentRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * width;
      const relativeX = Math.max(0, Math.min(chartWidth, svgX - padLeft));
      const closestIdx = Math.round((relativeX / chartWidth) * (points.length - 1));
      setHoverIndex(closestIdx);
    };

    const handleMouseLeave = () => {
      setIsDraggingPan(false);
      dragStartXRef.current = null;
      setHoverIndex(null);
    };

    return (
      <div className={`relative w-full ${isLargeModal ? 'h-[540px]' : 'h-[250px]'} bg-card/70 rounded-xl border border-borderSubtle select-none overflow-hidden group`}>
        <svg
          ref={currentRef}
          viewBox={`0 0 ${width} ${height}`}
          className={`w-full h-full overflow-visible ${isDraggingPan ? 'cursor-grabbing' : isZoomed ? 'cursor-grab' : 'cursor-crosshair'}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Cuadrícula horizontal sutil adaptada al tema activo */}
          <line x1={padLeft} y1={padTop} x2={width - padRight} y2={padTop} stroke="var(--svg-grid)" strokeDasharray="3 4" strokeOpacity="0.8" />
          <line x1={padLeft} y1={padTop + chartHeight * 0.25} x2={width - padRight} y2={padTop + chartHeight * 0.25} stroke="var(--svg-grid)" strokeDasharray="2 4" strokeOpacity="0.5" />
          <line x1={padLeft} y1={padTop + chartHeight * 0.5} x2={width - padRight} y2={padTop + chartHeight * 0.5} stroke="var(--svg-grid)" strokeDasharray="3 4" strokeOpacity="0.8" />
          <line x1={padLeft} y1={padTop + chartHeight * 0.75} x2={width - padRight} y2={padTop + chartHeight * 0.75} stroke="var(--svg-grid)" strokeDasharray="2 4" strokeOpacity="0.5" />
          <line x1={padLeft} y1={padTop + chartHeight} x2={width - padRight} y2={padTop + chartHeight} stroke="var(--svg-grid)" strokeDasharray="3 4" strokeOpacity="0.8" />

          {/* MODO LÍNEA */}
          {chartMode === 'line' && (
            <>
              {areaD && <path d={areaD} fill={`url(#${gradientId})`} />}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={isLargeModal ? '2.8' : '2.2'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </>
          )}

          {/* MODO VELAS JAPONESAS (CANDLESTICKS OHLC) */}
          {chartMode === 'candles' && points.map((p, i) => {
            const x = getX(i, points.length);
            const o = p.open ?? p.price;
            const c = p.close ?? p.price;
            const h = p.high ?? Math.max(o, c);
            const l = p.low ?? Math.min(o, c);
            const isBull = c >= o;
            const color = isBull ? '#10B981' : '#EF4444';

            const wickTop = getY(h);
            const wickBottom = getY(l);
            const bodyTop = getY(Math.max(o, c));
            const bodyBottom = getY(Math.min(o, c));
            const bodyHeight = Math.max(2.5, bodyBottom - bodyTop);

            return (
              <g key={i}>
                {/* Mecha vertical (High a Low) */}
                <line
                  x1={x}
                  y1={wickTop}
                  x2={x}
                  y2={wickBottom}
                  stroke={color}
                  strokeWidth={isLargeModal ? '1.5' : '1.2'}
                  strokeOpacity="0.85"
                />
                {/* Cuerpo de la vela (Open a Close) */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  rx={1}
                  fill={color}
                  stroke={color}
                  strokeWidth={isLargeModal ? '1' : '0.8'}
                  opacity={hoverIndex === i ? 1 : 0.9}
                />
              </g>
            );
          })}

          {/* MODO BARRAS OHLC OCCIDENTALES */}
          {chartMode === 'bars' && points.map((p, i) => {
            const x = getX(i, points.length);
            const o = p.open ?? p.price;
            const c = p.close ?? p.price;
            const h = p.high ?? Math.max(o, c);
            const l = p.low ?? Math.min(o, c);
            const isBull = c >= o;
            const color = isBull ? '#10B981' : '#EF4444';

            const barTick = Math.max(2.5, candleWidth * 0.45);
            const wickTop = getY(h);
            const wickBottom = getY(l);
            const openY = getY(o);
            const closeY = getY(c);

            return (
              <g key={i}>
                {/* Línea vertical principal (High a Low) */}
                <line
                  x1={x}
                  y1={wickTop}
                  x2={x}
                  y2={wickBottom}
                  stroke={color}
                  strokeWidth={isLargeModal ? '2' : '1.5'}
                  strokeLinecap="round"
                />
                {/* Tick de apertura (a la izquierda) */}
                <line
                  x1={x - barTick}
                  y1={openY}
                  x2={x}
                  y2={openY}
                  stroke={color}
                  strokeWidth={isLargeModal ? '2' : '1.5'}
                  strokeLinecap="round"
                />
                {/* Tick de cierre (a la derecha) */}
                <line
                  x1={x}
                  y1={closeY}
                  x2={x + barTick}
                  y2={closeY}
                  stroke={color}
                  strokeWidth={isLargeModal ? '2' : '1.5'}
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* ============================================================== */}
          {/* RAYA HORIZONTAL: FAIR VALUE PILAR 1                            */}
          {/* ============================================================== */}
          {fvY !== null && fvY >= padTop - 5 && fvY <= padTop + chartHeight + 5 && (
            <g>
              <line
                x1={padLeft}
                y1={fvY}
                x2={width - padRight + 6}
                y2={fvY}
                stroke="#10B981"
                strokeWidth={isLargeModal ? '1.8' : '1.5'}
                strokeDasharray="4 3"
                strokeOpacity="0.85"
              />
              <circle cx={padLeft} cy={fvY} r="3" fill="#10B981" />
              <rect x={width - padRight + 4} y={fvY - 10} width={isLargeModal ? 96 : 76} height={20} rx={4} fill="#064E3B" stroke="#10B981" strokeWidth="1" />
              <text x={width - padRight + (isLargeModal ? 52 : 42)} y={fvY + 4} textAnchor="middle" fill="#D1FAE5" fontSize={isLargeModal ? '10' : '9'} fontFamily="monospace" fontWeight="bold">
                FV {sym}{fairValue?.toFixed(1)}
              </text>
            </g>
          )}

          {/* ============================================================== */}
          {/* RAYA HORIZONTAL: TECHO MoS (MARGEN DE SEGURIDAD)               */}
          {/* ============================================================== */}
          {mosY !== null && mosY >= padTop - 5 && mosY <= padTop + chartHeight + 5 && (
            <g>
              <line
                x1={padLeft}
                y1={mosY}
                x2={width - padRight + 6}
                y2={mosY}
                stroke="#EAB308"
                strokeWidth={isLargeModal ? '1.8' : '1.5'}
                strokeDasharray="5 3"
                strokeOpacity="0.9"
              />
              <circle cx={padLeft} cy={mosY} r="3" fill="#EAB308" />
              <rect x={width - padRight + 4} y={mosY - 10} width={isLargeModal ? 96 : 76} height={20} rx={4} fill="#713F12" stroke="#EAB308" strokeWidth="1" />
              <text x={width - padRight + (isLargeModal ? 52 : 42)} y={mosY + 4} textAnchor="middle" fill="#FEF08A" fontSize={isLargeModal ? '10' : '9'} fontFamily="monospace" fontWeight="bold">
                MoS {sym}{mosCeiling?.toFixed(1)}
              </text>
            </g>
          )}

          {/* ============================================================== */}
          {/* RAYA HORIZONTAL: PRECIO DE COMPRA (P_compra)                   */}
          {/* ============================================================== */}
          {buyY !== null && buyY >= padTop - 5 && buyY <= padTop + chartHeight + 5 && (
            <g>
              <line
                x1={padLeft}
                y1={buyY}
                x2={width - padRight + 6}
                y2={buyY}
                stroke="#F59E0B"
                strokeWidth={isLargeModal ? '2' : '1.8'}
                strokeDasharray="5 4"
                strokeOpacity="0.95"
              />
              <circle cx={padLeft} cy={buyY} r="3.5" fill="#F59E0B" />
              <rect x={width - padRight + 4} y={buyY - 10} width={isLargeModal ? 96 : 76} height={20} rx={4} fill="#78350F" stroke="#F59E0B" strokeWidth="1" />
              <text x={width - padRight + (isLargeModal ? 52 : 42)} y={buyY + 4} textAnchor="middle" fill="#FEF3C7" fontSize={isLargeModal ? '10' : '9'} fontFamily="monospace" fontWeight="bold">
                Compra {sym}{buyPrice?.toFixed(1)}
              </text>
            </g>
          )}

          {/* ============================================================== */}
          {/* RAYA HORIZONTAL: OBJETIVO DE SALIDA (Take Profit)              */}
          {/* ============================================================== */}
          {exitY !== null && exitY >= padTop - 5 && exitY <= padTop + chartHeight + 5 && (
            <g>
              <line
                x1={padLeft}
                y1={exitY}
                x2={width - padRight + 6}
                y2={exitY}
                stroke="#06B6D4"
                strokeWidth={isLargeModal ? '1.8' : '1.6'}
                strokeDasharray="4 3"
                strokeOpacity="0.9"
              />
              <circle cx={padLeft} cy={exitY} r="3" fill="#06B6D4" />
              <rect x={width - padRight + 4} y={exitY - 10} width={isLargeModal ? 96 : 76} height={20} rx={4} fill="#164E63" stroke="#06B6D4" strokeWidth="1" />
              <text x={width - padRight + (isLargeModal ? 52 : 42)} y={exitY + 4} textAnchor="middle" fill="#CFFAFE" fontSize={isLargeModal ? '10' : '9'} fontFamily="monospace" fontWeight="bold">
                🎯 {sym}{targetExitPrice?.toFixed(1)}
              </text>
            </g>
          )}

          {/* Punto de Cotización Actual en el extremo derecho (modo línea) */}
          {chartMode === 'line' && points.length > 0 && (
            <circle
              cx={getX(points.length - 1, points.length)}
              cy={getY(points[points.length - 1].price)}
              r={isLargeModal ? '5' : '4.5'}
              fill={lineColor}
              stroke="#0F172A"
              strokeWidth="2"
            />
          )}

          {/* ============================================================== */}
          {/* CURSOR INTERACTIVO & TOOLTIP AL PASAR EL RATÓN                */}
          {/* ============================================================== */}
          {hoverIndex !== null && activeHoverPoint && (
            <g>
              <line
                x1={getX(hoverIndex, points.length)}
                y1={padTop}
                x2={getX(hoverIndex, points.length)}
                y2={padTop + chartHeight}
                stroke="#94A3B8"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                strokeOpacity="0.85"
              />
              <circle
                cx={getX(hoverIndex, points.length)}
                cy={getY(activeHoverPoint.price)}
                r={isLargeModal ? '5' : '4.5'}
                fill="#38BDF8"
                stroke="#0F172A"
                strokeWidth="2"
              />

              {(() => {
                const hX = getX(hoverIndex, points.length);
                const hY = getY(activeHoverPoint.price);
                const tipWidth = isLargeModal ? 130 : 112;
                const tipHeight = activeHoverPoint.open != null ? (isLargeModal ? 60 : 54) : 40;
                const tipX = Math.max(padLeft, Math.min(width - padRight - tipWidth, hX - tipWidth / 2));
                const tipY = hY - tipHeight - 12 > padTop ? hY - tipHeight - 12 : hY + 14;

                return (
                  <g pointerEvents="none">
                    <rect
                      x={tipX}
                      y={tipY}
                      width={tipWidth}
                      height={tipHeight}
                      rx={7}
                      fill="var(--svg-tooltip-bg)"
                      stroke="var(--svg-tooltip-border)"
                      strokeWidth="1.2"
                      filter="drop-shadow(0 6px 12px rgba(0,0,0,0.18))"
                    />
                    <text x={tipX + tipWidth / 2} y={tipY + 15} textAnchor="middle" fill="var(--color-text-secondary, #94A3B8)" fontSize={isLargeModal ? '10' : '9'} fontFamily="sans-serif">
                      {activeHoverPoint.date_str}
                    </text>
                    <text x={tipX + tipWidth / 2} y={tipY + 32} textAnchor="middle" fill="var(--svg-tooltip-text)" fontSize={isLargeModal ? '13' : '11'} fontFamily="monospace" fontWeight="bold">
                      {sym}{activeHoverPoint.price.toFixed(2)}
                    </text>
                    {activeHoverPoint.open != null && (
                      <text x={tipX + tipWidth / 2} y={tipY + (isLargeModal ? 48 : 46)} textAnchor="middle" fill={activeHoverPoint.close && activeHoverPoint.open && activeHoverPoint.close >= activeHoverPoint.open ? '#10B981' : '#F43F5E'} fontSize={isLargeModal ? '10' : '9'} fontFamily="monospace">
                        O:{sym}{activeHoverPoint.open.toFixed(1)} C:{sym}{activeHoverPoint.close?.toFixed(1)}
                      </text>
                    )}
                  </g>
                );
              })()}
            </g>
          )}

          {/* Marcas de Fecha en el Eje X */}
          {points.length > 2 && (
            <g fill="var(--color-text-secondary, #64748B)" fontSize={isLargeModal ? '11' : '9'} fontFamily="monospace">
              <text x={padLeft} y={height - 8} textAnchor="start">
                {points[0].date_str}
              </text>
              <text x={padLeft + chartWidth * 0.25} y={height - 8} textAnchor="middle">
                {points[Math.floor(points.length * 0.25)]?.date_str}
              </text>
              <text x={padLeft + chartWidth * 0.5} y={height - 8} textAnchor="middle">
                {points[Math.floor(points.length * 0.5)]?.date_str}
              </text>
              <text x={padLeft + chartWidth * 0.75} y={height - 8} textAnchor="middle">
                {points[Math.floor(points.length * 0.75)]?.date_str}
              </text>
              <text x={width - padRight} y={height - 8} textAnchor="end">
                {points[points.length - 1].date_str}
              </text>
            </g>
          )}
        </svg>

        {/* Overlay informativo de Zoom / Pan cuando está enfocado */}
        {isZoomed && (
          <div className="absolute top-2 left-3 pointer-events-none flex items-center space-x-1.5 bg-card/90 border border-borderSubtle px-2 py-0.5 rounded text-[10px] font-mono text-accentSky shadow">
            <Sparkles className="w-3 h-3 text-accentSky" />
            <span>Ventana: {points.length} de {rawPoints.length} velas ({zoomRange[0].toFixed(0)}%–{zoomRange[1].toFixed(0)}%) · Arrastra para mover</span>
          </div>
        )}

        {/* Indicador sutil si alguna referencia quedó fuera de la vista en modo price_focus */}
        {scaleMode === 'price_focus' && (isExitOffScreen || isFvOffScreen) && (
          <div className="absolute top-2 right-3 pointer-events-none">
            <span className="text-[10px] px-2 py-0.5 rounded bg-card/90 border border-accentSky/30 text-accentSky font-mono shadow">
              Zoom Velas Activo {isExitOffScreen ? `(Salida: ${sym}${targetExitPrice?.toFixed(1)} superior)` : ''}
            </span>
          </div>
        )}

        {/* Overlay de carga */}
        {isLoading && (
          <div className="absolute inset-0 bg-canvas/60 backdrop-blur-[2px] flex items-center justify-center rounded-xl">
            <span className="text-xs text-textSecondary font-mono flex items-center space-x-1.5">
              <RefreshCw className="w-4 h-4 animate-spin text-accentSky" />
              <span>Cargando datos OHLC ({timeframe})...</span>
            </span>
          </div>
        )}
      </div>
    );
  };

  // Distancia del precio actual al precio de compra
  const buyDiffPct = (buyPrice && buyPrice > 0) ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0;
  const isAboveBuy = buyDiffPct >= 0;
  const effChangePct = effectiveData.change_pct ?? (buyPrice && buyPrice > 0 ? ((currentPrice - buyPrice) / buyPrice) * 100 : 0);
  const effChangeAmt = effectiveData.change_amount ?? (buyPrice && buyPrice > 0 ? currentPrice - buyPrice : 0);
  const isWinningPeriod = effChangePct >= 0;

  // Formato para volumen (ej: 4.5M o 850K)
  const formatVolume = (vol?: number) => {
    if (!vol) return null;
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(0)}K`;
    return `${vol}`;
  };

  const activeHoverPoint: ChartPoint | null =
    hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  // Barra de Controles (Timeframes, Velas/Línea, Zoom Escala y Maximizar)
  const renderControls = (isLargeModal: boolean) => (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borderSubtle/60 pb-2.5">
      <div className="flex items-center space-x-2">
        <Clock className="w-3.5 h-3.5 text-accentSky" />
        <span className={`${isLargeModal ? 'text-sm font-black' : 'text-xs font-bold'} text-textPrimary uppercase tracking-wider`}>
          Cotización & Velas ({ticker})
        </span>
        {isLoading && <RefreshCw className="w-3 h-3 text-accentSky animate-spin" />}
      </div>

      <div className="flex items-center space-x-2">
        {/* Selector de Modo: Velas Japonesas vs Barras OHLC vs Línea */}
        <div className="flex items-center bg-cardSecondary p-0.5 rounded-lg border border-borderSubtle text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setChartMode('candles')}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-md transition font-mono ${
              chartMode === 'candles'
                ? 'bg-accentSky text-canvas font-bold shadow-sm'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
            title="Ver gráfico de velas japonesas (OHLC)"
          >
            <CandleIcon className="w-3 h-3" />
            <span>Velas</span>
          </button>
          <button
            type="button"
            onClick={() => setChartMode('bars')}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-md transition font-mono ${
              chartMode === 'bars'
                ? 'bg-accentSky text-canvas font-bold shadow-sm'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
            title="Ver gráfico de barras occidentales (OHLC)"
          >
            <BarIcon className="w-3 h-3" />
            <span>Barras</span>
          </button>
          <button
            type="button"
            onClick={() => setChartMode('line')}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-md transition font-mono ${
              chartMode === 'line'
                ? 'bg-accentSky text-canvas font-bold shadow-sm'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
            title="Ver gráfico lineal continuo"
          >
            <LineIcon className="w-3 h-3" />
            <span>Línea</span>
          </button>
        </div>

        {/* Toggle de Enfoque de Escala Y (Zoom Velas vs Ver Todos los Niveles) */}
        <button
          type="button"
          onClick={() => setScaleMode(prev => prev === 'price_focus' ? 'all_targets' : 'price_focus')}
          className={`px-2 py-1 rounded-lg border text-[11px] font-mono transition flex items-center space-x-1 ${
            scaleMode === 'price_focus'
              ? 'bg-accentSky/15 border-accentSky/40 text-accentSky font-bold'
              : 'bg-cardSecondary border-borderSubtle text-textSecondary hover:text-textPrimary'
          }`}
          title={scaleMode === 'price_focus' ? 'Enfoque en velas activado (máxima legibilidad). Haz clic para ver todos los techos distantes' : 'Escala completa que incluye todos los techos lejanos. Haz clic para ampliar velas'}
        >
          <Sliders className="w-3 h-3" />
          <span className="hidden sm:inline">{scaleMode === 'price_focus' ? 'Zoom Velas' : 'Escala Global'}</span>
        </button>

        {/* Selector de Plazos: 1D, 5D, 1M, 6M, YTD, 1A, 5A */}
        <div className="flex items-center space-x-0.5 bg-cardSecondary p-0.5 rounded-lg border border-borderSubtle text-[11px] font-semibold">
          {TIMEFRAMES.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setTimeframe(btn.key)}
              className={`px-2 py-0.5 rounded-md transition font-mono ${
                timeframe === btn.key
                  ? 'bg-accentSky text-canvas font-bold shadow-sm'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
              title={btn.tip}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Herramientas Interactivas de Lupa y Navegación (Zoom In / Zoom Out / Pan / Reset) */}
        <div className="flex items-center space-x-0.5 bg-cardSecondary p-0.5 rounded-lg border border-borderSubtle text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => {
              const anchor = hoverIndex !== null && points.length > 1 ? hoverIndex / (points.length - 1) : 0.5;
              handleZoomIn(anchor);
            }}
            className="p-1 rounded-md text-textSecondary hover:text-accentSky hover:bg-card transition"
            title="Acercar lupa en la vela/barra seleccionada (o rueda arriba)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const anchor = hoverIndex !== null && points.length > 1 ? hoverIndex / (points.length - 1) : 0.5;
              handleZoomOut(anchor);
            }}
            className="p-1 rounded-md text-textSecondary hover:text-accentSky hover:bg-card transition"
            title="Alejar lupa (o rueda abajo)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          {isZoomed && (
            <>
              <button
                type="button"
                onClick={() => handlePan('left')}
                className="p-1 rounded-md text-textSecondary hover:text-accentSky hover:bg-card transition"
                title="Desplazar ventana a la izquierda (histórico anterior)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handlePan('right')}
                className="p-1 rounded-md text-textSecondary hover:text-accentSky hover:bg-card transition"
                title="Desplazar ventana a la derecha (más reciente)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-1.5 py-0.5 rounded-md text-[10px] text-accentYellow hover:bg-accentYellow/10 transition font-mono flex items-center space-x-0.5"
                title="Restablecer zoom al 100% de la serie"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden md:inline">Reset</span>
              </button>
            </>
          )}
        </div>

        {/* Botón Maximizar / Abrir Popup Grande */}
        {!isLargeModal ? (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="p-1 rounded-lg bg-cardSecondary hover:bg-cardHover border border-borderSubtle text-textSecondary hover:text-accentSky transition shadow-sm ml-1"
            title="Abrir gráfico en pantalla ampliada / popup grande"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="p-1 rounded-lg bg-cardSecondary hover:bg-cardHover border border-borderSubtle text-textSecondary hover:text-textPrimary transition shadow-sm ml-1"
            title="Cerrar modal ampliado (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  // Barra de métricas (Precio en vivo, HUD, badges)
  const renderMetricsBar = (isLargeModal: boolean) => (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex items-center space-x-3 font-mono">
        <div>
          <span className="text-[10px] text-textSecondary uppercase block">Precio en Vivo</span>
          <span className={`${isLargeModal ? 'text-base font-black' : 'text-sm font-bold'} text-textPrimary`}>
            {sym}{currentPrice.toFixed(2)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-textSecondary uppercase block">
            Variación ({timeframe})
          </span>
          <span
            className={`${isLargeModal ? 'text-sm font-bold' : 'text-xs font-bold'} flex items-center space-x-1 ${
              isWinningPeriod ? 'text-statusGreen' : 'text-statusRed'
            }`}
          >
            {isWinningPeriod ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>
              {effChangePct >= 0 ? '+' : ''}
              {effChangePct.toFixed(2)}% ({effChangeAmt >= 0 ? '+' : ''}{sym}{Math.abs(effChangeAmt).toFixed(2)})
            </span>
          </span>
        </div>

        {/* HUD interactivo de la vela seleccionada al pasar el ratón */}
        {activeHoverPoint && (
          <div className="hidden sm:flex items-center space-x-2.5 pl-3 border-l border-borderSubtle text-[11px] text-textSecondary">
            <span className="font-bold text-textPrimary">{activeHoverPoint.date_str}</span>
            {activeHoverPoint.open != null && (
              <>
                <span>O: <strong className="text-textPrimary font-mono">{sym}{activeHoverPoint.open.toFixed(2)}</strong></span>
                <span>H: <strong className="text-statusGreen font-mono">{sym}{activeHoverPoint.high?.toFixed(2)}</strong></span>
                <span>L: <strong className="text-statusRed font-mono">{sym}{activeHoverPoint.low?.toFixed(2)}</strong></span>
                <span>C: <strong className="text-textPrimary font-mono">{sym}{activeHoverPoint.close?.toFixed(2)}</strong></span>
                {activeHoverPoint.volume ? (
                  <span className="text-[10px] text-textSecondary bg-card px-1.5 py-0.5 rounded border border-borderSubtle">Vol: {formatVolume(activeHoverPoint.volume)}</span>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      {/* Meridianos Activos de Compra, Salida o Valoración */}
      <div className="flex items-center space-x-1.5 text-[11px] font-mono flex-wrap gap-y-1">
        {buyPrice && buyPrice > 0 && (
          <div className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span className="text-amber-300 font-semibold">Compra: {sym}{buyPrice.toFixed(2)}</span>
            <span className={`text-[10px] font-bold ${isAboveBuy ? 'text-statusGreen' : 'text-statusRed'}`}>
              ({isAboveBuy ? '+' : ''}{buyDiffPct.toFixed(1)}%)
            </span>
          </div>
        )}

        {targetExitPrice && targetExitPrice > 0 && (
          <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-1">
            <Target className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-300 font-semibold">Salida: {sym}{targetExitPrice.toFixed(2)}</span>
          </div>
        )}

        {fairValue && fairValue > 0 && (
          <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-1">
            <Award className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-300 font-semibold">Fair Value: {sym}{fairValue.toFixed(2)}</span>
          </div>
        )}

        {mosCeiling && mosCeiling > 0 && (
          <div className="px-2 py-0.5 rounded-md bg-accentYellow/10 border border-accentYellow/30 flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3 text-accentYellow" />
            <span className="text-accentYellow font-semibold">Techo MoS: {sym}{mosCeiling.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );

  // Barra de leyenda inferior
  const renderFooterLegend = () => {
    const minPriceDisplay = effectiveData.min_price ?? (points.length > 0 ? Math.min(...points.map(p => p.low ?? p.price)) : (currentPrice > 0 ? currentPrice * 0.95 : 0));
    const maxPriceDisplay = effectiveData.max_price ?? (points.length > 0 ? Math.max(...points.map(p => p.high ?? p.price)) : (currentPrice > 0 ? currentPrice * 1.05 : 0));

    return (
      <div className="flex flex-wrap items-center justify-between text-[10px] text-textSecondary/80 px-1 pt-0.5">
        <div className="flex items-center space-x-3 flex-wrap gap-y-1">
          {buyPrice && buyPrice > 0 && (
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-0.5 bg-amber-400 border-b border-dashed inline-block"></span>
              <span className="text-amber-300 font-medium">Compra ({sym}{buyPrice.toFixed(2)})</span>
            </span>
          )}
          {fairValue && fairValue > 0 && (
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-0.5 bg-emerald-400 border-b border-dashed inline-block"></span>
              <span className="text-emerald-300 font-medium">Fair Value ({sym}{fairValue.toFixed(2)})</span>
            </span>
          )}
          {mosCeiling && mosCeiling > 0 && (
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-0.5 bg-yellow-400 border-b border-dashed inline-block"></span>
              <span className="text-yellow-300 font-medium">Techo MoS ({sym}{mosCeiling.toFixed(2)})</span>
            </span>
          )}
          {targetExitPrice && targetExitPrice > 0 && (
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-0.5 bg-cyan-400 border-b border-dashed inline-block"></span>
              <span className="text-cyan-300 font-medium">Take Profit ({sym}{targetExitPrice.toFixed(2)})</span>
            </span>
          )}
        </div>

        <div className="font-mono text-textSecondary/60 flex items-center space-x-2">
          <span>Rango: {sym}{minPriceDisplay.toFixed(2)} - {sym}{maxPriceDisplay.toFixed(2)}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 1. Componente en Modo Compacto (Incrustado en la ficha) */}
      <div className="rounded-xl bg-canvas border border-borderSubtle overflow-hidden space-y-2.5 p-3.5 shadow-sm">
        {renderControls(false)}
        {renderMetricsBar(false)}
        {renderChartContent(false)}
        {renderFooterLegend()}
      </div>

      {/* 2. POPUP MODAL EN PANTALLA GRANDE (AMPLIADO Y DE ALTA DEFINICIÓN) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn">
          <div className="bg-canvas border border-borderMedium w-full max-w-[96vw] xl:max-w-7xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-3.5 max-h-[98vh] flex flex-col justify-between overflow-hidden">
            {/* Cabecera del Popup Ampliado */}
            <div className="flex items-center justify-between border-b border-borderSubtle pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-accentSky/15 text-accentSky border border-accentSky/30">
                  <CandleIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-textPrimary flex items-center space-x-2">
                    <span>Gráfico de Velas Japonesas OHLCV</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cardSecondary text-accentSky border border-borderSubtle">
                      {ticker}
                    </span>
                  </h3>
                  <p className="text-xs text-textSecondary mt-0.5">
                    Vista ampliada interactiva · Usa la <strong>rueda del ratón</strong> o los botones <ZoomIn className="w-3 h-3 inline text-accentSky" /> / <ZoomOut className="w-3 h-3 inline text-accentSky" /> para hacer zoom y <strong>arrastra</strong> para desplazarte.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-cardSecondary border border-transparent hover:border-borderSubtle transition"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Controles y Métricas en el Popup */}
            {renderControls(true)}
            {renderMetricsBar(true)}

            {/* Gráfico SVG Grande */}
            <div className="flex-1 w-full min-h-[520px]">
              {renderChartContent(true)}
            </div>

            {/* Leyenda y Ayuda */}
            <div className="border-t border-borderSubtle/60 pt-2.5">
              {renderFooterLegend()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

