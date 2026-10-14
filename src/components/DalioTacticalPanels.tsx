import React, { useState } from 'react';
import {
  PieChart,
  ShieldAlert,
  Compass,
  Building2,
  CheckCircle2,
  Info,
  ChevronRight
} from 'lucide-react';
import { RayDalioCycleData, ScreenedOpportunity } from '../types';
import { DalioAssetDetailModal } from './DalioAssetDetailModal';

type TacticalAsset = NonNullable<RayDalioCycleData['tactical_allocation']>['assets'][0];
type RecommendedAsset = NonNullable<TacticalAsset['recommended_assets']>[0];

interface DalioTacticalPanelsProps {
  dalioData?: RayDalioCycleData;
  selectedOpportunity: ScreenedOpportunity | null;
  onOpenAssetDetail?: (asset: RecommendedAsset) => void;
  onBuyAsset?: (asset: RecommendedAsset) => void;
  onAddToWatchlist?: (ticker: string) => void;
}

type TacticalTab = 'allocation' | 'debt_wall' | 'bridgewater' | 'company_test';

export const DalioTacticalPanels: React.FC<DalioTacticalPanelsProps> = ({
  dalioData,
  selectedOpportunity,
  onOpenAssetDetail,
  onBuyAsset,
  onAddToWatchlist
}) => {
  const [activeTab, setActiveTab] = useState<TacticalTab>('allocation');
  const [selectedAssetForModal, setSelectedAssetForModal] = useState<TacticalAsset | null>(null);

  if (!dalioData) return null;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-borderSubtle/80 flex flex-col flex-1">
      {/* Navegador de 4 Sub-Pestañas Tácticas */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex bg-canvas p-0.5 rounded-lg border border-borderSubtle text-[10px] space-x-0.5 w-full">
          <button
            type="button"
            onClick={() => setActiveTab('allocation')}
            className={`flex-1 py-1 px-1.5 rounded-md font-semibold transition-all flex items-center justify-center space-x-1 ${
              activeTab === 'allocation'
                ? 'bg-accentSky/20 text-accentSky border border-accentSky/30 shadow-sm'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
            title="Opción 1: Matriz de Asignación por Clases de Activo de Dalio"
          >
            <PieChart className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Asignación</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('debt_wall')}
            className={`flex-1 py-1 px-1.5 rounded-md font-semibold transition-all flex items-center justify-center space-x-1 ${
              activeTab === 'debt_wall'
                ? 'bg-accentSky/20 text-accentSky border border-accentSky/30 shadow-sm'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
            title="Opción 2: Termómetros de Estrés y Muro de Refinanciación"
          >
            <ShieldAlert className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Muro Deuda</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bridgewater')}
            className={`flex-1 py-1 px-1.5 rounded-md font-semibold transition-all flex items-center justify-center space-x-1 ${
              activeTab === 'bridgewater'
                ? 'bg-accentSky/20 text-accentSky border border-accentSky/30 shadow-sm'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
            title="Opción 3: Cuadrante Bridgewater (Crecimiento vs Inflación)"
          >
            <Compass className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Cuadrante</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('company_test')}
            className={`flex-1 py-1 px-1.5 rounded-md font-semibold transition-all flex items-center justify-center space-x-1 ${
              activeTab === 'company_test'
                ? 'bg-accentSky/20 text-accentSky border border-accentSky/30 shadow-sm'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
            title="Opción 4: Test de Estrés Macro sobre la Empresa Seleccionada"
          >
            <Building2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Test Acción</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO DE CADA PESTAÑA */}
      <div className="flex-1 flex flex-col justify-between">
        {/* ========================================================================= */}
        {/* PESTAÑA 1: MATRIZ DE ASIGNACIÓN (POR DEFECTO)                            */}
        {/* ========================================================================= */}
        {activeTab === 'allocation' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-textSecondary px-0.5">
              <span>Activo según Fase Tardía (Click para ver análisis):</span>
              <span>Postura Dalio</span>
            </div>

            <div className="space-y-1 text-xs">
              {dalioData.tactical_allocation?.assets.slice(0, 3).map((item, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setSelectedAssetForModal(item)}
                  className="w-full text-left p-1.5 rounded-lg bg-canvas hover:bg-card border border-borderSubtle/70 hover:border-accentSky/50 transition-all flex items-center justify-between group shadow-sm hover:shadow"
                  title="Haz clic para ver explicación detallada, base teórica y activos concretos recomendados"
                >
                  <div className="flex items-center space-x-1.5 min-w-0 pr-1">
                    {item.stance === 'SOBREPONDERAR' ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-statusGreen flex-shrink-0" />
                    ) : item.stance === 'INFRAEPONDERAR' ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-statusRed flex-shrink-0" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-accentYellow flex-shrink-0" />
                    )}
                    <span className="text-[11px] font-medium text-textPrimary group-hover:text-accentSky transition-colors truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        item.stance === 'SOBREPONDERAR'
                          ? 'bg-statusGreen/15 text-statusGreen border border-statusGreen/30'
                          : item.stance === 'INFRAEPONDERAR'
                          ? 'bg-statusRed/15 text-statusRed border border-statusRed/30'
                          : 'bg-accentYellow/15 text-accentYellow border border-accentYellow/30'
                      }`}
                    >
                      {item.stance === 'SOBREPONDERAR' ? 'Sobre' : item.stance === 'INFRAEPONDERAR' ? 'Infra' : 'Neutro'}
                    </span>
                    <ChevronRight className="w-3 h-3 text-textSecondary group-hover:text-accentSky transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>

            {/* Micro banner de convicción de cartera */}
            <div className="p-1.5 rounded-lg bg-card/60 border border-borderSubtle text-[10px] text-textSecondary flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-statusGreen" />
                <span>Playbook Dalio:</span>
              </span>
              <strong className="text-textPrimary font-semibold">Priorizar Caja Neta & Activos Reales</strong>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: MURO DE REFINANCIACIÓN Y ESTRÉS DE DEUDA                       */}
        {/* ========================================================================= */}
        {activeTab === 'debt_wall' && dalioData.debt_wall_gauges && (
          <div className="space-y-2 text-xs">
            {/* Medidor 1: DSR */}
            <div className="p-2 rounded-lg bg-canvas border border-borderSubtle">
              <div className="flex justify-between items-center text-[11px] mb-1">
                <span className="text-textSecondary">Servicio de Deuda (DSR):</span>
                <span className="font-mono font-bold text-accentYellow">
                  {dalioData.debt_wall_gauges.debt_service_ratio.value}%{' '}
                  <span className="text-[9px] text-textSecondary">
                    (ref. {dalioData.debt_wall_gauges.debt_service_ratio.benchmark}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-accentYellow h-1.5 rounded-full"
                  style={{ width: `${Math.min((dalioData.debt_wall_gauges.debt_service_ratio.value / 20) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Medidor 2: Maturity Wall Refinancing */}
            <div className="p-2 rounded-lg bg-canvas border border-borderSubtle">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-textSecondary">Muro Vencimientos 25-27:</span>
                <span className="font-mono font-bold text-statusRed">
                  ${dalioData.debt_wall_gauges.refinancing_stress_2025_2027.value_t}T
                </span>
              </div>
              <div className="flex justify-between text-[9px] text-textSecondary mt-0.5 font-mono">
                <span>Cupón emisión: {dalioData.debt_wall_gauges.refinancing_stress_2025_2027.avg_orig_rate_pct}%</span>
                <span className="text-statusRed font-bold">
                  Coste actual: {dalioData.debt_wall_gauges.refinancing_stress_2025_2027.current_market_rate_pct}% (+
                  {dalioData.debt_wall_gauges.refinancing_stress_2025_2027.spread_burden_pct}%)
                </span>
              </div>
            </div>

            {/* Medidor 3: Condiciones Financieras */}
            <div className="flex items-center justify-between text-[10px] px-1 text-textSecondary">
              <span>Condiciones Crédito (NFCI):</span>
              <span className="font-bold text-statusGreen">
                {dalioData.debt_wall_gauges.financial_conditions_index.value} (Holgadas)
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 3: CUADRANTE BRIDGEWATER (CRECIMIENTO VS INFLACIÓN)               */}
        {/* ========================================================================= */}
        {activeTab === 'bridgewater' && dalioData.bridgewater_quadrant && (
          <div className="space-y-1.5">
            <div className="p-2 rounded-xl bg-canvas border border-borderSubtle relative">
              {/* Grilla 2x2 compacta */}
              <div className="grid grid-cols-2 gap-1 text-[9px] text-center font-mono">
                <div
                  className={`p-1.5 rounded-lg border ${
                    dalioData.bridgewater_quadrant.current_quadrant === 'REFLACION'
                      ? 'bg-statusGreen/20 border-statusGreen text-statusGreen font-bold'
                      : 'bg-card/40 border-borderSubtle text-textSecondary'
                  }`}
                >
                  ↑ Crec / ↑ Infla
                  <span className="block text-[8px] opacity-75">Reflación</span>
                </div>

                <div
                  className={`p-1.5 rounded-lg border ${
                    dalioData.bridgewater_quadrant.current_quadrant === 'ESTANFLACION'
                      ? 'bg-statusRed/20 border-statusRed text-statusRed font-bold'
                      : 'bg-card/40 border-borderSubtle text-textSecondary'
                  }`}
                >
                  ↓ Crec / ↑ Infla
                  <span className="block text-[8px] opacity-75">Estanflación</span>
                </div>

                <div
                  className={`p-1.5 rounded-lg border relative ${
                    dalioData.bridgewater_quadrant.current_quadrant === 'GOLDILOCKS'
                      ? 'bg-accentSky/20 border-accentSky text-accentSky font-bold ring-1 ring-accentSky/50'
                      : 'bg-card/40 border-borderSubtle text-textSecondary'
                  }`}
                >
                  {dalioData.bridgewater_quadrant.current_quadrant === 'GOLDILOCKS' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accentSky animate-ping" />
                  )}
                  ↑ Crec / ↓ Infla
                  <span className="block text-[8px] opacity-90 font-semibold">★ Goldilocks</span>
                </div>

                <div
                  className={`p-1.5 rounded-lg border ${
                    dalioData.bridgewater_quadrant.current_quadrant === 'DESACELERACION_DESINFLACION'
                      ? 'bg-accentYellow/20 border-accentYellow text-accentYellow font-bold'
                      : 'bg-card/40 border-borderSubtle text-textSecondary'
                  }`}
                >
                  ↓ Crec / ↓ Infla
                  <span className="block text-[8px] opacity-75">Desaceleración</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-textSecondary leading-snug px-0.5">
              Régimen actual:{' '}
              <strong className="text-textPrimary">{dalioData.bridgewater_quadrant.quadrant_label}</strong>. Favorece
              márgenes defensivos y foso corporativo.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 4: IMPACTO MACRO EN LA EMPRESA SELECCIONADA                       */}
        {/* ========================================================================= */}
        {activeTab === 'company_test' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-borderSubtle">
              <span className="text-textSecondary">Empresa Activa:</span>
              <strong className="font-mono text-accentSky font-bold">
                {selectedOpportunity?.ticker || 'TRV'} - {selectedOpportunity?.name || 'The Travelers Companies'}
              </strong>
            </div>

            <div className="space-y-1 text-xs">
              <div className="p-1.5 rounded-lg bg-canvas border border-borderSubtle flex items-center justify-between">
                <span className="text-[11px] text-textSecondary">Sensibilidad Ciclo Deuda:</span>
                <span className="text-[10px] font-bold text-statusGreen bg-statusGreen/10 px-2 py-0.5 rounded border border-statusGreen/20">
                  Defensiva / Contracíclica
                </span>
              </div>

              <div className="p-1.5 rounded-lg bg-canvas border border-borderSubtle flex items-center justify-between">
                <span className="text-[11px] text-textSecondary">Riesgo Tipos Altos (4.3%):</span>
                <span className="text-[10px] font-bold text-statusGreen bg-statusGreen/10 px-2 py-0.5 rounded border border-statusGreen/20">
                  Beneficiaria NII (Cartera Bonos)
                </span>
              </div>

              <div className="p-1.5 rounded-lg bg-canvas border border-borderSubtle flex items-center justify-between">
                <span className="text-[11px] text-textSecondary">Poder Fijación Precios:</span>
                <span className="text-[10px] font-bold text-accentSky bg-accentSky/10 px-2 py-0.5 rounded border border-accentSky/20">
                  Fuerte (Primas P&C)
                </span>
              </div>
            </div>

            <div className="text-[10px] text-textSecondary flex items-center space-x-1 pt-0.5">
              <Info className="w-3 h-3 text-accentSky flex-shrink-0" />
              <span>Diagnóstico: Activo ideal para el final del ciclo de deuda.</span>
            </div>
          </div>
        )}

        {/* Modal Desplegable de Detalle de Activo y Recomendaciones Concretas */}
        <DalioAssetDetailModal
          asset={selectedAssetForModal}
          onClose={() => setSelectedAssetForModal(null)}
          onOpenAssetDetail={(rec) => {
            setSelectedAssetForModal(null);
            if (onOpenAssetDetail) onOpenAssetDetail(rec);
          }}
          onBuyAsset={(rec) => {
            setSelectedAssetForModal(null);
            if (onBuyAsset) onBuyAsset(rec);
          }}
          onAddToWatchlist={(t) => {
            setSelectedAssetForModal(null);
            if (onAddToWatchlist) onAddToWatchlist(t);
          }}
        />
      </div>
    </div>
  );
};
