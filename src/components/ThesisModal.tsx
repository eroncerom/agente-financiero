import React from 'react';
import { X, FileText, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { Pilar1Result } from '../types';

interface ThesisModalProps {
  isOpen: boolean;
  company: Pilar1Result | null;
  onClose: () => void;
}

export const ThesisModal: React.FC<ThesisModalProps> = ({ isOpen, company, onClose }) => {
  if (!isOpen || !company) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-card border border-borderMedium w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header Modal */}
        <div className="flex justify-between items-center border-b border-borderSubtle pb-3">
          <div className="flex items-center space-x-2.5">
            <FileText className="w-5 h-5 text-accentSky" />
            <div>
              <span className="text-[10px] uppercase font-bold text-accentSky tracking-wider">
                Auditoría Metodológica de Valoración
              </span>
              <h3 className="text-lg font-bold text-textPrimary">
                Pilar 1: {company.nombre} ({company.ticker})
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-textSecondary hover:text-textPrimary text-lg p-1 rounded-lg hover:bg-cardSecondary transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Marco Teórico: Gordon-Shapiro & Margen de Seguridad */}
        <div className="p-3.5 rounded-xl bg-canvas border border-borderSubtle space-y-2 text-xs">
          <h4 className="font-bold text-accentSky flex items-center space-x-1.5 uppercase tracking-wide">
            <ShieldCheck className="w-4 h-4 text-accentSky" />
            <span>Modelo Gordon-Shapiro con Colchón Defensivo MoS ({company.mos_discount_pct ?? 30}%)</span>
          </h4>
          <p className="text-textSecondary leading-relaxed">
            Se calcula el valor intrínseco descontado de los flujos de caja futuros (<span className="text-textPrimary font-mono">D₁ / (r - g)</span>) y se exige un colchón de protección del <strong>{company.mos_discount_pct ?? 30}%</strong> basado en la doctrina de <strong>Howard Marks</strong> y <strong>Warren Buffett</strong> para proteger el capital contra errores de estimación o shocks de mercado:
          </p>
          <div className="p-2.5 rounded-lg bg-card border border-borderSubtle font-mono text-[11px] space-y-1">
            <div className="text-textPrimary">
              VP_Teórico = D₁ / (r - g)
            </div>
            <div className="text-statusGreen font-bold">
              VP_MoS ({company.mos_discount_pct ?? 30}%) = VP_Teórico × {((100 - (company.mos_discount_pct ?? 30)) / 100).toFixed(2)}
            </div>
            <div className="text-accentYellow">
              Condición de Compra: P₀ ≤ VP_MoS (Neutro) AND P₀ ≤ VP_MoS (Optimista)
            </div>
          </div>
        </div>

        {/* 2. Desglose Numérico de la Compañía */}
        <div className="p-3.5 rounded-xl bg-canvas border border-borderSubtle space-y-2.5 text-xs">
          <h4 className="font-bold text-textPrimary uppercase tracking-wide">
            Parámetros Auditados para {company.ticker}:
          </h4>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded bg-card border border-borderSubtle">
              <span className="text-textSecondary block">Precio de Cierre (P₀):</span>
              <span className="text-textPrimary font-bold text-sm">${company.precio_cierre_P0.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded bg-card border border-borderSubtle">
              <span className="text-textSecondary block">Tasa de Descuento (r CAPM):</span>
              <span className="text-accentSky font-bold text-sm">{(company.tasa_descuento_r * 100).toFixed(2)}%</span>
            </div>
            <div className="p-2 rounded bg-card border border-borderSubtle">
              <span className="text-textSecondary block">MoS Neutro (g = {(company.escenario_neutro.g * 100).toFixed(1)}%):</span>
              <span className="text-statusGreen font-bold text-sm">${(company.escenario_neutro.VP_MoS ?? company.escenario_neutro.VP_MoS_30).toFixed(2)}</span>
            </div>
            <div className="p-2 rounded bg-card border border-borderSubtle">
              <span className="text-textSecondary block">Discrepancia Neutra (Δ_neu):</span>
              <span className="text-accentYellow font-bold text-sm">{company.discrepancia_porcentual_neutra}</span>
            </div>
          </div>
        </div>

        {/* 3. Política Estricta de Cero Invención de Datos */}
        <div className="p-3.5 rounded-xl bg-cardSecondary border border-borderSubtle flex items-start space-x-2.5 text-xs text-textSecondary leading-relaxed">
          <AlertCircle className="w-4 h-4 text-accentYellow flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-textPrimary block mb-0.5">Política de Anti-Alucinación & Cero Invención:</strong>
            Queda estrictamente prohibido imputar, estimar aleatoriamente o inventar cualquier dato financiero. Si falta algún parámetro esencial (P₀, D₁, r, g_hist) o si r ≤ g, la compañía es descartada de forma inmediata y automática.
          </div>
        </div>

        {/* 4. Conexión Multi-Pilar */}
        <div className="p-3 rounded-xl bg-canvas border border-borderSubtle flex items-center justify-between text-xs font-mono">
          <span className="text-textSecondary">Pipeline Multi-Pilar:</span>
          <span className="text-statusGreen flex items-center">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Pilar 1 Calificado → Listo para Pilares 2 y 3
          </span>
        </div>

        {/* Botón de Cierre */}
        <div className="pt-2 border-t border-borderSubtle flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cardSecondary text-xs font-semibold text-textPrimary hover:bg-cardHover transition"
          >
            Cerrar Auditoría
          </button>
        </div>
      </div>
    </div>
  );
};
