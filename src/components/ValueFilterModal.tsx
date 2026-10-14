import React from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Filter,
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  TrendingUp
} from 'lucide-react';
import { Pilar1Result, DiscardedCompanyDetail } from '../types';

interface ValueFilterModalProps {
  isOpen: boolean;
  company: Pilar1Result | DiscardedCompanyDetail | null;
  onClose: () => void;
  onOpenFinancialDeepDive?: (ticker: string) => void;
}

export const ValueFilterModal: React.FC<ValueFilterModalProps> = ({
  isOpen,
  company,
  onClose,
  onOpenFinancialDeepDive
}) => {
  if (!isOpen || !company || !company.filtro_value) return null;

  const fv = company.filtro_value;
  const isApto = fv.apto;
  const isCasiApto = fv.casi_apto;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-borderMedium rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del Modal */}
        <div className="p-4 border-b border-borderSubtle flex items-center justify-between bg-cardSecondary">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isApto
                  ? 'bg-statusGreen/15 border-statusGreen/40 text-statusGreen'
                  : isCasiApto
                  ? 'bg-accentYellow/15 border-accentYellow/40 text-accentYellow'
                  : 'bg-statusRed/15 border-statusRed/40 text-statusRed'
              }`}
            >
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accentSky">
                  Filtro Value · Cribado Fundamental (5 Años SEC 10-K)
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    isApto
                      ? 'bg-statusGreen/15 text-statusGreen border-statusGreen/40'
                      : isCasiApto
                      ? 'bg-accentYellow/15 text-accentYellow border-accentYellow/40'
                      : 'bg-statusRed/15 text-statusRed border-statusRed/40'
                  }`}
                >
                  {fv.etiqueta_estado}
                </span>
              </div>
              <h2 className="text-lg font-black text-textPrimary flex items-center space-x-2 mt-0.5">
                <span>{company.nombre}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-canvas text-accentSky border border-borderSubtle">
                  {company.ticker}
                </span>
                <span className="text-xs font-mono text-textSecondary font-normal">
                  P₀: ${company.precio_cierre_P0.toFixed(2)}
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-canvas hover:bg-cardHover text-textSecondary hover:text-textPrimary border border-borderSubtle transition"
            title="Cerrar informe de Filtro Value"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Tabla Resumen Estricta: [Métrica / Criterio] | [Dato Actual] | [Objetivo Mínimo] | [Estado: APTO / DESCARTADO] */}
          <div className="rounded-xl border border-borderSubtle overflow-hidden bg-canvas">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-cardSecondary border-b border-borderSubtle text-[11px] uppercase tracking-wider text-textSecondary">
                  <th className="py-2.5 px-3.5 font-bold w-[26%]">Métrica / Criterio</th>
                  <th className="py-2.5 px-3.5 font-bold w-[38%]">Dato Actual (Últimos 5 Años)</th>
                  <th className="py-2.5 px-3.5 font-bold w-[20%]">Objetivo Mínimo</th>
                  <th className="py-2.5 px-3.5 font-bold text-center w-[16%]">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderSubtle/60">
                {fv.criterios.map((crit) => (
                  <tr key={crit.id} className="hover:bg-cardSecondary/40 transition">
                    <td className="py-3 px-3.5 font-bold text-textPrimary align-top">
                      {crit.metrica}
                    </td>
                    <td className="py-3 px-3.5 text-textSecondary font-mono text-[11px] leading-relaxed align-top">
                      {crit.dato_actual}
                    </td>
                    <td className="py-3 px-3.5 text-textSecondary text-[11px] align-top">
                      {crit.objetivo_minimo}
                    </td>
                    <td className="py-3 px-3.5 text-center align-top">
                      {crit.cumple ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-statusGreen/15 text-statusGreen border border-statusGreen/30 font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>APTO</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-statusRed/15 text-statusRed border border-statusRed/30 font-mono">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>DESCARTADO</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Evolución Visual del Flujo de Caja Libre (Últimos 5 Años) si está disponible */}
          {fv.criterios[3]?.fcf_series && fv.criterios[3].fcf_series.length > 0 && (
            <div className="p-3.5 rounded-xl bg-canvas border border-borderSubtle">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-textSecondary flex items-center space-x-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-accentSky" />
                  <span>Evolución Auditada del Flujo de Caja Libre (FCF 10-K Últimos 5 Años)</span>
                </span>
                <span className="text-[10px] font-mono text-textSecondary">
                  Criterio 4: {fv.criterios[3].estado}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {fv.criterios[3].fcf_series.map((item, idx, arr) => {
                  const prev = idx > 0 ? arr[idx - 1].fcf_billions : null;
                  const grew = prev != null ? item.fcf_billions > prev : true;
                  const isPos = item.fcf_billions > 0;
                  return (
                    <div
                      key={item.year}
                      className={`p-2.5 rounded-lg border text-center font-mono ${
                        !isPos
                          ? 'bg-statusRed/10 border-statusRed/30'
                          : grew
                          ? 'bg-statusGreen/10 border-statusGreen/30'
                          : 'bg-accentYellow/10 border-accentYellow/30'
                      }`}
                    >
                      <span className="text-[10px] text-textSecondary block">FY {item.year}</span>
                      <span
                        className={`text-sm font-black block mt-0.5 ${
                          !isPos ? 'text-statusRed' : grew ? 'text-statusGreen' : 'text-accentYellow'
                        }`}
                      >
                        ${item.fcf_billions.toFixed(2)}B
                      </span>
                      {idx > 0 && (
                        <span className="text-[9px] text-textSecondary block mt-0.5">
                          {grew ? '▲ Creciente' : '▼ Consolidación'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Veredicto Definitivo y Párrafo Explicativo */}
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              isApto
                ? 'bg-statusGreen/10 border-statusGreen/40'
                : isCasiApto
                ? 'bg-accentYellow/10 border-accentYellow/40'
                : 'bg-statusRed/10 border-statusRed/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isApto ? (
                  <ShieldCheck className="w-5 h-5 text-statusGreen flex-shrink-0" />
                ) : (
                  <ShieldAlert
                    className={`w-5 h-5 flex-shrink-0 ${
                      isCasiApto ? 'text-accentYellow' : 'text-statusRed'
                    }`}
                  />
                )}
                <span
                  className={`text-sm font-black uppercase tracking-wide font-mono ${
                    isApto
                      ? 'text-statusGreen'
                      : isCasiApto
                      ? 'text-accentYellow'
                      : 'text-statusRed'
                  }`}
                >
                  {fv.veredicto}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-textPrimary">
                Criterios Superados: {fv.puntuacion} / {fv.total_criterios}
              </span>
            </div>

            <p className="text-xs text-textPrimary leading-relaxed font-sans">
              {fv.motivo_parrafo}
            </p>
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="p-3.5 border-t border-borderSubtle bg-cardSecondary flex items-center justify-between">
          <span className="text-[11px] text-textSecondary">
            Datos procesados de estados financieros auditados SEC EDGAR (10-K) y motor de valoración Pilar 1.
          </span>
          <div className="flex items-center space-x-2">
            {onOpenFinancialDeepDive && (
              <button
                onClick={() => {
                  onClose();
                  onOpenFinancialDeepDive(company.ticker);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Abrir Radiografía 14 Métricas ({company.ticker})</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-accentSky text-canvas font-bold text-xs hover:bg-accentSky/90 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
