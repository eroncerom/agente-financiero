import React from 'react';
import {
  X,
  Compass,
  AlertTriangle,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { MacroData } from '../types';
import { RayDalioCycleChart } from './RayDalioCycleChart';

interface RayDalioModalProps {
  isOpen: boolean;
  onClose: () => void;
  macroData: MacroData | null;
}

export const RayDalioModal: React.FC<RayDalioModalProps> = ({
  isOpen,
  onClose,
  macroData
}) => {
  if (!isOpen) return null;

  const dalio = macroData?.dalio_cycle;
  const metrics = dalio?.macro_metrics;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-6 animate-fadeIn">
      <div className="bg-canvas border border-borderMedium w-full max-w-5xl rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[96vh] flex flex-col justify-between overflow-y-auto">
        {/* 1. Header con Información y Título */}
        <div className="flex items-center justify-between border-b border-borderSubtle pb-3.5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-accentYellow/15 text-accentYellow border border-accentYellow/30">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-textPrimary">
                  La Máquina Económica de Ray Dalio
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cardSecondary text-accentYellow border border-borderSubtle">
                  Bridgewater Principles
                </span>
              </div>
              <p className="text-xs text-textSecondary mt-0.5">
                Auditoría macroeconómica de los ciclos de deuda a corto plazo (5–8A), deuda a largo plazo (50–75A) y productividad.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-cardSecondary border border-transparent hover:border-borderSubtle transition"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Gráfico Vectorial Canónico a Gran Resolución */}
        <div className="p-4 rounded-xl bg-card border border-borderSubtle space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-extrabold text-textPrimary tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-accentSky" />
              <span>Diagrama Oficial de Ciclos Superpuestos</span>
            </span>
            <div className="flex items-center space-x-2 font-mono text-[11px]">
              <span className="text-textSecondary">Sesgo Macro:</span>
              <strong className="text-accentYellow bg-accentYellow/10 px-2 py-0.5 rounded border border-accentYellow/30">
                {dalio?.trend_bias_label}
              </strong>
            </div>
          </div>

          <RayDalioCycleChart data={dalio} isCompact={false} />
        </div>

        {/* 3. Métricas Cuantitativas Empíricas del Momento */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-card border border-borderSubtle">
              <span className="text-[10px] text-textSecondary uppercase block">Deuda Total / PIB</span>
              <strong className="text-sm text-accentYellow font-black">{metrics.debt_to_gdp_pct}%</strong>
              <span className="text-[9px] text-textSecondary block mt-0.5">Late-Cycle (&gt;250%)</span>
            </div>

            <div className="p-2.5 rounded-xl bg-card border border-borderSubtle">
              <span className="text-[10px] text-textSecondary uppercase block">Curva 10Y - 2Y</span>
              <strong className={`text-sm font-black ${metrics.spread_10y_2y_pct >= 0 ? 'text-statusGreen' : 'text-statusRed'}`}>
                {metrics.spread_10y_2y_pct >= 0 ? '+' : ''}{metrics.spread_10y_2y_pct}%
              </strong>
              <span className="text-[9px] text-textSecondary block mt-0.5">Desinversión activa</span>
            </div>

            <div className="p-2.5 rounded-xl bg-card border border-borderSubtle">
              <span className="text-[10px] text-textSecondary uppercase block">Tipos Oficiales (Fed)</span>
              <strong className="text-sm text-textPrimary font-black">{metrics.fed_funds_rate_pct}%</strong>
              <span className="text-[9px] text-textSecondary block mt-0.5">Restrictivos ({'>'}r*)</span>
            </div>

            <div className="p-2.5 rounded-xl bg-card border border-borderSubtle">
              <span className="text-[10px] text-textSecondary uppercase block">Crédito High Yield</span>
              <strong className="text-sm text-accentSky font-black">{metrics.high_yield_spread_bps} pb</strong>
              <span className="text-[9px] text-textSecondary block mt-0.5">Complaciente (&lt;350)</span>
            </div>

            <div className="p-2.5 rounded-xl bg-card border border-borderSubtle">
              <span className="text-[10px] text-textSecondary uppercase block">Inflación Subyacente</span>
              <strong className="text-sm text-textPrimary font-black">{metrics.core_inflation_pct}%</strong>
              <span className="text-[9px] text-textSecondary block mt-0.5">Por encima de meta (2%)</span>
            </div>
          </div>
        )}

        {/* 4. Riesgos del Momento vs Recomendaciones Estratégicas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Bloque Riesgos */}
          <div className="p-3.5 rounded-xl bg-statusRed/10 border border-statusRed/30 space-y-2">
            <div className="flex items-center space-x-2 text-statusRed font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Riesgos Macroeconómicos del Momento</span>
            </div>
            <div className="space-y-2 text-xs">
              {dalio?.risks.map((r, i) => (
                <div key={i} className="p-2 rounded-lg bg-card/80 border border-borderSubtle space-y-0.5">
                  <div className="flex items-center justify-between">
                    <strong className="text-textPrimary text-[11px]">{r.title}</strong>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-statusRed/20 text-statusRed font-bold">
                      {r.level}
                    </span>
                  </div>
                  <p className="text-[11px] text-textSecondary leading-relaxed">{r.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bloque Recomendaciones / Playbook */}
          <div className="p-3.5 rounded-xl bg-statusGreen/10 border border-statusGreen/30 space-y-2">
            <div className="flex items-center space-x-2 text-statusGreen font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Playbook de Inversión de Ray Dalio</span>
            </div>
            <div className="space-y-2 text-xs">
              {dalio?.recommendations.map((rec, i) => (
                <div key={i} className="p-2 rounded-lg bg-card/80 border border-borderSubtle space-y-0.5">
                  <div className="flex items-center justify-between">
                    <strong className="text-textPrimary text-[11px]">{rec.title}</strong>
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      rec.action === 'SOBREPONDERAR'
                        ? 'bg-statusGreen/20 text-statusGreen'
                        : rec.action === 'INFRAEPONDERAR'
                        ? 'bg-statusRed/20 text-statusRed'
                        : 'bg-accentYellow/20 text-accentYellow'
                    }`}>
                      {rec.action}
                    </span>
                  </div>
                  <p className="text-[11px] text-textSecondary leading-relaxed">{rec.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Footer con Botón Cerrar */}
        <div className="flex items-center justify-between pt-2 border-t border-borderSubtle text-xs text-textSecondary">
          <span className="font-mono text-[11px]">
            Principio: «Aquel que vive según la bola de cristal comerá cristales rotos. Entiende la máquina.» — Ray Dalio
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cardSecondary hover:bg-cardHover text-textPrimary border border-borderSubtle font-semibold transition text-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
