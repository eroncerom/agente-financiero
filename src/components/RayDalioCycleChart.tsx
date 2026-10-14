import React from 'react';
import { Layers, Maximize2 } from 'lucide-react';
import { RayDalioCycleData } from '../types';

interface RayDalioCycleChartProps {
  data?: RayDalioCycleData;
  isCompact?: boolean;
  onOpenModal?: () => void;
}

export const RayDalioCycleChart: React.FC<RayDalioCycleChartProps> = ({
  data,
  isCompact = false,
  onOpenModal
}) => {

  // Coordenadas base del SVG (idénticas a la imagen del vídeo canónico de Ray Dalio)
  const width = isCompact ? 360 : 780;
  const height = isCompact ? 200 : 380;
  const padLeft = isCompact ? 38 : 55;
  const padRight = isCompact ? 20 : 35;
  const padTop = isCompact ? 26 : 38;
  const padBottom = isCompact ? 30 : 45;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // 1. LÍNEA DE PRODUCTIVIDAD: Diagonal recta de (0, H) a (W, 0.2*H)
  const prodStartX = padLeft;
  const prodStartY = padTop + chartH;
  const prodEndX = padLeft + chartW;
  const prodEndY = padTop + chartH * 0.15;
  const productivityPathD = `M ${prodStartX},${prodStartY} L ${prodEndX},${prodEndY}`;

  // 2. CICLO DE DEUDA A LARGO PLAZO: La gran onda sinusoidal en negrita
  // Comienza en el origen, sube formando una gran cresta sobre la productividad,
  // luego sufre la gran pendiente descendente de desapalancamiento hacia el valle inferior,
  // y finalmente reflaciona subiendo hacia el final del eje.
  const p0x = padLeft;
  const p0y = padTop + chartH;

  // Cresta del ciclo largo (alrededor de 40% del tiempo)
  const crestX = padLeft + chartW * 0.44;
  const crestY = padTop + chartH * 0.10;

  // Punto de inflexión y cruce (alrededor de 55% del tiempo)
  const crossX = padLeft + chartW * 0.56;
  const crossY = padTop + chartH * 0.50;

  // Valle del desapalancamiento (alrededor de 68% del tiempo)
  const troughX = padLeft + chartW * 0.70;
  const troughY = padTop + chartH * 0.88;

  // Final del ciclo largo reflacionando hacia arriba
  const endX = padLeft + chartW;
  const endY = padTop + chartH * 0.15;

  const longCyclePathD = `
    M ${p0x},${p0y}
    C ${padLeft + chartW * 0.18},${padTop + chartH * 0.50} ${padLeft + chartW * 0.30},${crestY} ${crestX},${crestY}
    C ${padLeft + chartW * 0.50},${crestY} ${padLeft + chartW * 0.54},${padTop + chartH * 0.35} ${crossX},${crossY}
    C ${padLeft + chartW * 0.58},${padTop + chartH * 0.70} ${padLeft + chartW * 0.62},${troughY} ${troughX},${troughY}
    C ${padLeft + chartW * 0.82},${troughY} ${padLeft + chartW * 0.92},${padTop + chartH * 0.45} ${endX},${endY}
  `;

  // 3. CICLO DE DEUDA A CORTO PLAZO: Ondas de menor amplitud y alta frecuencia superpuestas
  // Se generan 8 crestas y valles siguiendo fielmente el dibujo de la ilustración
  const generateShortCyclesPath = () => {
    const pointsCount = 120;
    const pts: { x: number; y: number }[] = [];

    for (let i = 0; i <= pointsCount; i++) {
      const t = i / pointsCount;
      const x = padLeft + t * chartW;

      // Línea base de productividad en t
      const baseLineY = prodStartY + t * (prodEndY - prodStartY);

      // Desviación del ciclo largo
      // Función senoidal asimétrica que modela la gran ola de Dalio
      let longOffset = 0;
      if (t < 0.56) {
        // Fase de expansión y cresta
        longOffset = -Math.sin((t / 0.56) * Math.PI) * (chartH * 0.38);
      } else {
        // Fase de desapalancamiento y fondo
        longOffset = Math.sin(((t - 0.56) / 0.44) * Math.PI) * (chartH * 0.34);
      }

      // Ondulación del ciclo corto (7 ciclos completos)
      const shortWave = Math.sin(t * Math.PI * 14) * (chartH * 0.11);

      const y = Math.max(padTop + 4, Math.min(padTop + chartH, baseLineY + longOffset + shortWave));
      pts.push({ x, y });
    }

    return pts.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x.toFixed(1)},${p.y.toFixed(1)}` : `${acc} L ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }, '');
  };

  const shortCyclePathD = generateShortCyclesPath();

  // 4. POSICIÓN EXACTA ACTUAL ("ESTÁS AQUÍ")
  // En base al ratio Deuda/PIB > 260% y desinversión activa de curva (Late cycle):
  // Nos encontramos en la cresta madura del ciclo largo (X ~ 48%-50%)
  // y en la cresta tardía del ciclo corto girando hacia distensión.
  const currentPinX = padLeft + chartW * 0.48;
  const currentPinY = padTop + chartH * 0.14;

  const biasColor =
    data?.trend_direction === 'BAJISTA'
      ? 'text-statusRed bg-statusRed/15 border-statusRed/30'
      : data?.trend_direction === 'NEUTRAL_DEFENSIVO'
      ? 'text-accentYellow bg-accentYellow/15 border-accentYellow/30'
      : 'text-statusGreen bg-statusGreen/15 border-statusGreen/30';

  return (
    <div className="flex flex-col select-none">
      {/* 1. Header con Diagnóstico y Acciones (Solo en modo modal/expandido para no duplicar el header del contenedor) */}
      {!isCompact && (
        <div className="flex items-center justify-between pb-2 border-b border-borderSubtle/60 text-xs">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-accentSky" />
            <div>
              <span className="text-[10px] uppercase font-bold text-textSecondary tracking-wider block">
                Máquina Económica (Ray Dalio)
              </span>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="font-extrabold text-textPrimary text-xs sm:text-sm">
                  Ciclo de Préstamos & Deuda
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded-full border ${biasColor}`}>
                  {data?.trend_direction === 'NEUTRAL_DEFENSIVO' ? 'Tardociclo Defensivo' : data?.trend_direction}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {onOpenModal && (
              <button
                type="button"
                onClick={onOpenModal}
                className="p-1 rounded-lg bg-cardSecondary hover:bg-cardHover border border-borderSubtle text-textSecondary hover:text-accentSky transition shadow-sm"
                title="Abrir auditoría macroeconómica ampliada de Ray Dalio"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Lienzo Vectorial SVG Estilo Pizarra Ray Dalio */}
      <div className={`relative w-full ${isCompact ? 'h-36' : 'h-[280px]'} ${isCompact ? 'my-1' : 'my-2'} bg-[#FBF9F1] dark:bg-[#0B132B]/80 rounded-xl border border-borderSubtle overflow-hidden p-2 flex items-center justify-center`}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          {/* Ejes Cartesianos Rotulados como en la Ilustración Original */}
          {/* Eje Y: GROWTH */}
          <line
            x1={padLeft}
            y1={padTop - 6}
            x2={padLeft}
            y2={padTop + chartH + 12}
            stroke="#1E293B"
            strokeWidth={isCompact ? 2 : 2.5}
            strokeLinecap="round"
          />
          {/* Rótulo Eje Y */}
          <text
            x={padLeft - (isCompact ? 28 : 36)}
            y={padTop + (isCompact ? 4 : 8)}
            fill="#0F172A"
            className="dark:fill-slate-200"
            fontSize={isCompact ? 9 : 12}
            fontFamily="monospace"
            fontWeight="900"
            letterSpacing="0.08em"
          >
            GROWTH
          </text>

          {/* Eje X: TIME */}
          <line
            x1={padLeft - 6}
            y1={padTop + chartH}
            x2={padLeft + chartW + 18}
            y2={padTop + chartH}
            stroke="#1E293B"
            strokeWidth={isCompact ? 2 : 2.5}
            strokeLinecap="round"
          />
          {/* Rótulo Eje X */}
          <text
            x={padLeft + chartW + (isCompact ? 8 : 12)}
            y={padTop + chartH + (isCompact ? 14 : 18)}
            fill="#0F172A"
            className="dark:fill-slate-200"
            fontSize={isCompact ? 9 : 12}
            fontFamily="monospace"
            fontWeight="900"
            letterSpacing="0.08em"
          >
            TIME
          </text>

          {/* Cuadrícula sutil de referencia */}
          <line x1={padLeft} y1={padTop + chartH * 0.5} x2={padLeft + chartW} y2={padTop + chartH * 0.5} stroke="#64748B" strokeDasharray="3 3" strokeOpacity="0.2" />

          {/* ============================================================== */}
          {/* 1. LÍNEA DE PRODUCTIVIDAD (Tendencia recta diagonal)            */}
          {/* ============================================================== */}
          <path
            d={productivityPathD}
            fill="none"
            stroke="#0284C7"
            strokeWidth={isCompact ? 2 : 2.8}
            strokeLinecap="round"
            strokeOpacity="0.85"
          />

          {/* ============================================================== */}
          {/* 2. CICLO DE DEUDA A CORTO PLAZO (Ondas onduladas grises)       */}
          {/* ============================================================== */}
          <path
            d={shortCyclePathD}
            fill="none"
            stroke="#94A3B8"
            strokeWidth={isCompact ? 1.4 : 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.75"
          />

          {/* ============================================================== */}
          {/* 3. CICLO DE DEUDA A LARGO PLAZO (Gran onda en negrita gruesa)   */}
          {/* ============================================================== */}
          <path
            d={longCyclePathD}
            fill="none"
            stroke="#0F172A"
            className="dark:stroke-slate-100"
            strokeWidth={isCompact ? 2.8 : 4.0}
            strokeLinecap="round"
          />

          {/* ============================================================== */}
          {/* 4. MARCADOR DINÁMICO "ESTÁS AQUÍ" (Punto pulsante animado)      */}
          {/* ============================================================== */}
          <g className="cursor-pointer" onClick={() => onOpenModal && onOpenModal()}>
            {/* Halo de pulsación externo */}
            <circle
              cx={currentPinX}
              cy={currentPinY}
              r={isCompact ? 10 : 16}
              fill="#EAB308"
              fillOpacity="0.25"
              className="animate-ping"
            />
            {/* Anillo de advertencia */}
            <circle
              cx={currentPinX}
              cy={currentPinY}
              r={isCompact ? 6 : 8.5}
              fill="#CA8A04"
              stroke="#FEF08A"
              strokeWidth={isCompact ? 1.5 : 2}
            />
            {/* Centro luminoso */}
            <circle
              cx={currentPinX}
              cy={currentPinY}
              r={isCompact ? 3 : 4}
              fill="#FFFFFF"
            />

            {/* Etiqueta Flotante "ESTÁS AQUÍ" */}
            <g>
              <rect
                x={currentPinX - (isCompact ? 38 : 52)}
                y={currentPinY - (isCompact ? 26 : 38)}
                width={isCompact ? 76 : 104}
                height={isCompact ? 18 : 24}
                rx={isCompact ? 4 : 6}
                fill="#0F172A"
                stroke="#EAB308"
                strokeWidth={isCompact ? 1 : 1.5}
                filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
              />
              <text
                x={currentPinX}
                y={currentPinY - (isCompact ? 14 : 22)}
                textAnchor="middle"
                fill="#FEF08A"
                fontSize={isCompact ? 8.5 : 11}
                fontFamily="monospace"
                fontWeight="900"
                letterSpacing="0.05em"
              >
                📍 ESTÁS AQUÍ
              </text>
            </g>
          </g>
        </svg>

        {/* Badge lateral explicativo rápido */}
        <div className="absolute bottom-2 left-3 pointer-events-none">
          <span className="text-[9px] sm:text-[10px] font-mono text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-card/90 px-2 py-0.5 rounded border border-borderSubtle shadow-sm">
            Cresta Tardía (Late-Cycle)
          </span>
        </div>
      </div>

      {/* 3. Leyenda Geométrica Canónica */}
      <div className="flex flex-wrap items-center justify-between text-[10px] text-textSecondary gap-y-1 pt-1 border-t border-borderSubtle/50">
        <div className="flex items-center space-x-3 flex-wrap gap-y-1">
          <span className="flex items-center space-x-1">
            <span className="w-3 h-0.5 bg-accentSky inline-block"></span>
            <span>Productividad</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-3 h-1 bg-textPrimary dark:bg-white inline-block"></span>
            <span>Ciclo Largo (50-75A)</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-3 h-0.5 bg-slate-400 inline-block"></span>
            <span>Ciclo Corto (5-8A)</span>
          </span>
        </div>

        {data?.macro_metrics && (
          <span className="font-mono text-[10px] text-accentYellow font-bold">
            Deuda/PIB: {data.macro_metrics.debt_to_gdp_pct}%
          </span>
        )}
      </div>

      {/* 4. Píldora de Diagnóstico y Riesgo Clave */}
      {!isCompact && data && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-canvas border border-borderSubtle space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-textSecondary">
              Diagnóstico Institucional:
            </span>
            <span className="text-[10px] font-mono font-bold text-accentSky">
              Curva 10Y-2Y: +{data.macro_metrics.spread_10y_2y_pct}%
            </span>
          </div>
          <p className="text-[11px] text-textSecondary leading-relaxed">
            {data.summary_diagnosis}
          </p>
        </div>
      )}
    </div>
  );
};
