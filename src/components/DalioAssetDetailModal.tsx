import React from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Layers,
  Sparkles,
  Info,
  BarChart2,
  PlusCircle,
  Eye
} from 'lucide-react';
import { RayDalioCycleData } from '../types';

type TacticalAsset = NonNullable<RayDalioCycleData['tactical_allocation']>['assets'][0];
type RecommendedAsset = NonNullable<TacticalAsset['recommended_assets']>[0];

interface DalioAssetDetailModalProps {
  asset: TacticalAsset | null;
  onClose: () => void;
  onOpenAssetDetail?: (asset: RecommendedAsset) => void;
  onBuyAsset?: (asset: RecommendedAsset) => void;
  onAddToWatchlist?: (ticker: string) => void;
}

export const DalioAssetDetailModal: React.FC<DalioAssetDetailModalProps> = ({
  asset,
  onClose,
  onOpenAssetDetail,
  onBuyAsset,
  onAddToWatchlist
}) => {
  if (!asset) return null;

  const isOverweight = asset.stance === 'SOBREPONDERAR';
  const isUnderweight = asset.stance === 'INFRAEPONDERAR';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-canvas border border-borderSubtle rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header del Modal */}
        <div className="p-4 sm:p-5 border-b border-borderSubtle flex items-start justify-between bg-card/40 sticky top-0 backdrop-blur-md z-10">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isOverweight
                  ? 'bg-statusGreen/15 border-statusGreen/30 text-statusGreen'
                  : isUnderweight
                  ? 'bg-statusRed/15 border-statusRed/30 text-statusRed'
                  : 'bg-accentYellow/15 border-accentYellow/30 text-accentYellow'
              }`}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-textSecondary font-semibold">
                  {asset.category}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isOverweight
                      ? 'bg-statusGreen/15 text-statusGreen border-statusGreen/30'
                      : isUnderweight
                      ? 'bg-statusRed/15 text-statusRed border-statusRed/30'
                      : 'bg-accentYellow/15 text-accentYellow border-accentYellow/30'
                  }`}
                >
                  {asset.stance} ({asset.conviction_pct}% Convicción)
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-textPrimary tracking-tight mt-0.5">
                {asset.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-cardSecondary transition border border-transparent hover:border-borderSubtle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-5 space-y-4 text-xs">
          {/* 1. Diagnóstico y Qué significa en este momento */}
          <div className="p-3.5 rounded-xl bg-card border border-borderSubtle space-y-2">
            <div className="flex items-center space-x-2 text-textPrimary font-bold text-sm">
              <Info className="w-4 h-4 text-accentSky" />
              <span>¿Qué significa esta postura en el momento actual?</span>
            </div>
            <p className="text-textSecondary leading-relaxed text-xs">
              {asset.detailed_explanation || asset.rationale}
            </p>
          </div>

          {/* 2. Fundamento Teórico Canónico de Ray Dalio */}
          {asset.theoretical_basis && (
            <div className="p-3.5 rounded-xl bg-card border border-borderSubtle space-y-2">
              <div className="flex items-center space-x-2 text-textPrimary font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-accentYellow" />
                <span>Base Teórica & Modelo Macroeconómico de Dalio</span>
              </div>
              <p className="text-textSecondary leading-relaxed text-xs">
                {asset.theoretical_basis}
              </p>
            </div>
          )}

          {/* 3. Activos Recomendados en Función del Análisis de Mercado Actual */}
          <div>
            <div className="flex items-center justify-between mb-2 px-0.5">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-accentSky" />
                <h3 className="font-extrabold text-sm text-textPrimary tracking-tight">
                  Activos Concretos Recomendados & Análisis de Cotización
                </h3>
              </div>
              <span className="text-[10px] text-textSecondary font-mono">
                Evaluados en tiempo real
              </span>
            </div>

            {asset.recommended_assets && asset.recommended_assets.length > 0 ? (
              <div className="space-y-2.5">
                {asset.recommended_assets.map((rec) => (
                  <div
                    key={rec.ticker}
                    className="p-3.5 rounded-xl bg-card border border-borderSubtle hover:border-accentSky/50 transition shadow-sm space-y-2"
                  >
                    {/* Header Activo */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cardSecondary border border-borderSubtle flex items-center justify-center font-mono font-black text-accentSky text-xs">
                          {rec.ticker}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-textPrimary text-xs sm:text-sm">
                              {rec.name}
                            </span>
                            <span className="text-[10px] text-textSecondary font-mono">
                              ({rec.asset_type})
                            </span>
                          </div>
                          <span className="text-[10px] text-textSecondary">
                            Cotización:{' '}
                            <strong className="text-textPrimary font-mono">
                              ${rec.price.toFixed(2)} {rec.currency}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Rendimiento del Periodo Relevante */}
                      <div className="text-right">
                        <div
                          className={`font-mono font-black text-xs sm:text-sm flex items-center justify-end space-x-0.5 ${
                            rec.period_return_pct >= 0 ? 'text-statusGreen' : 'text-statusRed'
                          }`}
                        >
                          {rec.period_return_pct >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5 inline mr-0.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 inline mr-0.5" />
                          )}
                          <span>
                            {rec.period_return_pct >= 0 ? '+' : ''}
                            {rec.period_return_pct.toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-[9px] text-textSecondary uppercase font-mono block">
                          {rec.period_label}
                        </span>
                      </div>
                    </div>

                    {/* Análisis del Mercado y Evolución */}
                    <div className="p-2.5 rounded-lg bg-canvas border border-borderSubtle/70 text-textSecondary leading-relaxed text-[11px]">
                      <p>{rec.market_analysis}</p>
                    </div>

                    {/* Catalizador / Motor */}
                    <div className="flex items-center justify-between text-[10px] text-textSecondary px-1 pt-0.5">
                      <span className="flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accentSky inline-block" />
                        <span>Catalizador macro:</span>
                      </span>
                      <strong className="text-textPrimary font-medium text-right ml-2 truncate max-w-[320px]">
                        {rec.catalyst}
                      </strong>
                    </div>

                    {/* Botones de Acción Directa: Ver Detalle / Velas & Añadir a Compras */}
                    <div className="pt-2 mt-1 border-t border-borderSubtle/60 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-textSecondary font-mono">
                        Ticker activo: <strong className="text-accentSky">{rec.ticker}</strong>
                      </span>
                      <div className="flex items-center space-x-2">
                        {onOpenAssetDetail && (
                          <button
                            type="button"
                            onClick={() => onOpenAssetDetail(rec)}
                            className="px-2.5 py-1 rounded-lg bg-accentSky/10 hover:bg-accentSky/20 text-accentSky border border-accentSky/30 text-[11px] font-bold transition flex items-center space-x-1 shadow-sm"
                            title={`Abrir auditoría completa, gráfico de velas y traza de ${rec.ticker} (Pilar Central)`}
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span>Ver Gráfico & Auditoría</span>
                          </button>
                        )}
                        {onAddToWatchlist && (
                          <button
                            type="button"
                            onClick={() => onAddToWatchlist(rec.ticker)}
                            className="px-2.5 py-1 rounded-lg bg-cardSecondary hover:bg-borderSubtle text-textPrimary border border-borderSubtle text-[11px] font-bold transition flex items-center space-x-1 shadow-sm"
                            title={`Poner ${rec.ticker} en seguimiento`}
                          >
                            <Eye className="w-3.5 h-3.5 text-accentSky" />
                            <span>Poner en Seguimiento</span>
                          </button>
                        )}
                        {onBuyAsset && (
                          <button
                            type="button"
                            onClick={() => onBuyAsset(rec)}
                            className="px-2.5 py-1 rounded-lg bg-statusGreen hover:bg-statusGreen/90 text-canvas font-bold text-[11px] transition flex items-center space-x-1 shadow-sm"
                            title={`Añadir orden de compra de ${rec.ticker} con precio actual`}
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Añadir Compra</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-card border border-borderSubtle text-center text-textSecondary text-xs">
                Para esta categoría con postura de infraponderación ({asset.stance}), la recomendación
                institucional de Dalio es <strong>reducir exposición y rotar liquidez</strong> hacia Quality
                Compounders y Oro Físico.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-borderSubtle bg-card/60 flex items-center justify-between text-[11px] text-textSecondary">
          <span className="font-mono">
            Rigor: Modelo de Dinámica Macroeconómica de Bridgewater Associates
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-cardSecondary hover:bg-cardHover border border-borderSubtle text-textPrimary font-semibold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
