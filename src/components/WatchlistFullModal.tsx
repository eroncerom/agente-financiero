import React, { useState, useEffect } from 'react';
import {
  Eye,
  X,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Trash2,
  ShoppingCart,
  FileCheck2,
  Compass,
  Search,
  RefreshCw,
  Sparkles,
  Award,
  BellRing,
  Zap
} from 'lucide-react';
import { WatchlistItem, Currency } from '../types';

interface WatchlistFullModalProps {
  isOpen: boolean;
  onClose: () => void;
  watchlist: WatchlistItem[];
  isLoading?: boolean;
  onSelectCompany: (ticker: string) => void;
  onRemoveTicker: (ticker: string) => void;
  onBuyTrade?: (asset: {
    ticker: string;
    companyName: string;
    buyPrice: number;
    fairValue: number;
    currency: Currency;
  }) => void;
  onOpenFinancialDeepDive?: (ticker: string) => void;
  onAuditInCentralPillar?: (ticker: string) => void;
  onRefresh?: () => void;
}

export const WatchlistFullModal: React.FC<WatchlistFullModalProps> = ({
  isOpen,
  onClose,
  watchlist,
  isLoading,
  onSelectCompany,
  onRemoveTicker,
  onBuyTrade,
  onOpenFinancialDeepDive,
  onAuditInCentralPillar,
  onRefresh
}) => {
  const [filterText, setFilterText] = useState('');

  // Atajo de teclado ESC
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

  const filteredWatchlist = watchlist.filter((item) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      item.ticker.toLowerCase().includes(q) ||
      (item.company_name && item.company_name.toLowerCase().includes(q))
    );
  });

  const mosOpportunityItems = watchlist.filter(
    (item) => item.techo_mos && item.current_price <= item.techo_mos
  );

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-hidden animate-fadeIn"
    >
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Cabecera del modal */}
        <div className="p-4 md:p-5 border-b border-slate-800/80 bg-slate-900/80 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Botón Volver */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-bold text-xs shadow-sm transition group"
              title="Volver al panel principal (ESC)"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Volver</span>
            </button>

            <div className="w-9 h-9 rounded-xl bg-accentSky/10 border border-accentSky/20 flex items-center justify-center text-accentSky font-bold text-base">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-bold text-slate-100 tracking-tight">
                  Empresas en Seguimiento
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-accentSky/15 text-accentSky border border-accentSky/30 text-xs font-mono font-bold">
                  {watchlist.length} empresas
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Monitorización continua de cotizaciones vs precio de entrada & análisis técnico
              </p>
            </div>
          </div>

          {/* Buscador y botones de acción en cabecera */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por ticker o nombre..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-accentSky w-48 sm:w-64 font-medium"
              />
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                title="Refrescar cotizaciones en tiempo real"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accentSky' : ''}`} />
              </button>
            )}

            <button
              onClick={onClose}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Cerrar modal (ESC)"
            >
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">ESC</span>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BANNER DINÁMICO DE ALERTA DE ENTRADA MoS */}
        {mosOpportunityItems.length > 0 && (
          <div className="mx-4 md:mx-6 mt-3 p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between text-xs animate-pulse">
            <div className="flex items-center space-x-2.5">
              <BellRing className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-emerald-400 text-xs uppercase tracking-wider block">
                  ¡Alerta de Entrada por Margen de Seguridad ({mosOpportunityItems.length} compañías)!
                </span>
                <span className="text-[11px] text-slate-300 font-mono">
                  {mosOpportunityItems.map((i) => i.ticker).join(', ')} cotizan bajo su Techo de Compra MoS (P₀ ≤ VP_MoS)
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400 text-slate-950 uppercase">
              ZONA DE COMPRA
            </span>
          </div>
        )}

        {/* Contenido scrolleable con todas las compañías */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {filteredWatchlist.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Eye className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <p className="text-sm font-semibold">No se encontraron empresas en seguimiento</p>
              <p className="text-xs text-slate-500 mt-1">
                {filterText ? 'Prueba con otro término de búsqueda' : 'Añade compañías desde el panel principal'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredWatchlist.map((item) => {
                const isPos = item.change_since_added_pct >= 0;
                const diffPct = item.change_since_added_pct;
                const diffAmount = item.change_since_added_amount;
                const isMoSEntry = Boolean(item.techo_mos && item.current_price <= item.techo_mos);
                const mosDiscountPct = item.techo_mos ? Math.round(((item.techo_mos - item.current_price) / item.techo_mos) * 100) : 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onClose();
                      onSelectCompany(item.ticker);
                    }}
                    className={`p-3.5 rounded-2xl transition-all cursor-pointer shadow-sm group relative flex flex-col justify-between ${
                      isMoSEntry
                        ? 'bg-emerald-950/20 border border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30 hover:border-emerald-400'
                        : 'bg-slate-900/70 border border-slate-800/80 hover:border-accentSky/50 hover:bg-slate-900'
                    }`}
                  >
                    {/* Línea 1: Ticker, Moneda, Nombre y Botones */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="font-extrabold text-sm text-slate-100 group-hover:text-accentSky transition-colors shrink-0">
                          {item.ticker}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300 uppercase shrink-0">
                          {item.currency}
                        </span>
                        <span className="text-xs text-slate-300 truncate font-semibold" title={item.company_name}>
                          {item.company_name}
                        </span>
                        {isMoSEntry && (
                          <span
                            className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 uppercase tracking-wider flex items-center space-x-0.5 shrink-0 animate-pulse"
                            title={`Cotiza a $${item.current_price.toFixed(2)}, bajo el techo MoS de $${item.techo_mos?.toFixed(2)}`}
                          >
                            <Zap className="w-2.5 h-2.5 fill-current" />
                            <span>MoS -{mosDiscountPct}%</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        {onAuditInCentralPillar && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                              onAuditInCentralPillar(item.ticker);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-accentSky hover:bg-accentSky/15 transition-colors"
                            title="Cargar en el Pilar Central (3 Escenarios & Filtro Value)"
                          >
                            <Award className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onOpenFinancialDeepDive && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                              onOpenFinancialDeepDive(item.ticker);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            title="Ver Radiografía Financiera Auditada (SEC EDGAR)"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onBuyTrade && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                              onBuyTrade({
                                ticker: item.ticker,
                                companyName: item.company_name,
                                buyPrice: item.current_price,
                                fairValue: item.fair_value || item.current_price,
                                currency: item.currency
                              });
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isMoSEntry
                                ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 font-bold shadow-md'
                                : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                            title="Añadir a Mis Compras"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Eliminar ${item.ticker} de la lista de seguimiento?`)) {
                              onRemoveTicker(item.ticker);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Eliminar de seguimiento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Línea 2: Precios de compra y cotización actual en una sola línea */}
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-slate-950/70 border border-slate-800/60 font-mono mb-2">
                      <div className="flex items-center space-x-3 text-[11px]">
                        <span>
                          <span className="text-slate-400 text-[10px]">Añadido: </span>
                          <strong className="text-slate-100 font-bold">${item.added_price.toFixed(2)}</strong>
                        </span>
                        <span>
                          <span className="text-slate-400 text-[10px]">Actual: </span>
                          <strong className="text-slate-100 font-bold">${item.current_price.toFixed(2)}</strong>
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`font-mono font-bold flex items-center space-x-0.5 text-[10px] px-2 py-0.5 rounded-lg border ${
                            isPos
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {isPos ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
                          <span>{isPos ? '+' : ''}${diffAmount.toFixed(2)} ({isPos ? '+' : ''}{diffPct.toFixed(1)}%)</span>
                        </span>

                        {item.techo_mos && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                              item.current_price <= item.techo_mos
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : item.fair_value && item.current_price <= item.fair_value
                                ? 'bg-accentSky/10 text-accentSky border-accentSky/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {item.current_price <= item.techo_mos
                              ? 'Bajo MoS'
                              : item.fair_value && item.current_price <= item.fair_value
                              ? 'Valor Justo'
                              : 'Sobreprecio'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Línea inferior: Acceso a Análisis Técnico */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center space-x-1 text-accentSky font-medium group-hover:underline">
                        <Compass className="w-3.5 h-3.5" />
                        <span>Abrir análisis técnico y gráfico</span>
                      </span>
                      {item.day_change_pct != null && (
                        <span className={`font-mono text-[10px] ${item.day_change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Hoy: {item.day_change_pct >= 0 ? '+' : ''}{item.day_change_pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Barra inferior de navegación */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-accentSky" />
            <span>Haz clic en cualquier tarjeta para abrir su análisis técnico y velas en detalle</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs shadow-md border border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Volver al Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
