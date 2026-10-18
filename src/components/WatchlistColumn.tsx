import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  Plus,
  TrendingUp,
  TrendingDown,
  Trash2,
  ChevronRight,
  ShoppingCart,
  RefreshCw,
  FileCheck2,
  ArrowRight,
  GripVertical,
  Award,
  BellRing,
  Zap
} from 'lucide-react';
import { WatchlistItem, Currency } from '../types';
import { WatchlistFullModal } from './WatchlistFullModal';

interface WatchlistColumnProps {
  watchlist: WatchlistItem[];
  isLoading: boolean;
  onSelectCompany: (ticker: string) => void;
  onAddTicker: (ticker: string) => Promise<boolean>;
  onRemoveTicker: (ticker: string) => Promise<boolean>;
  onBuyTrade?: (tradeData: {
    ticker: string;
    companyName: string;
    buyPrice: number;
    fairValue: number;
    currency: Currency;
  }) => void;
  onRefresh?: () => void;
  onOpenFinancialDeepDive?: (ticker: string) => void;
  onAuditInCentralPillar?: (ticker: string) => void;
}

export const WatchlistColumn: React.FC<WatchlistColumnProps> = ({
  watchlist,
  isLoading,
  onSelectCompany,
  onAddTicker,
  onRemoveTicker,
  onBuyTrade,
  onRefresh,
  onOpenFinancialDeepDive,
  onAuditInCentralPillar
}) => {
  const [newTickerInput, setNewTickerInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isFullModalOpen, setIsFullModalOpen] = useState(false);
  const [draggingTicker, setDraggingTicker] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [justAddedTicker, setJustAddedTicker] = useState<string | null>(null);
  const dragCounterRef = useRef<number>(0);

  // Medición dinámica del contenedor para mostrar todas las que quepan en la pantalla
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  const handleDragEnter = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('text/plain') || e.dataTransfer.types.includes('application/x-ticker')) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const rawTicker =
      e.dataTransfer.getData('application/x-ticker') ||
      e.dataTransfer.getData('text/plain') ||
      '';
    const cleanTicker = rawTicker.trim().toUpperCase();
    if (cleanTicker && /^[A-Z0-9.-]{1,10}$/.test(cleanTicker)) {
      const ok = await onAddTicker(cleanTicker);
      if (ok) {
        setJustAddedTicker(cleanTicker);
        setTimeout(() => setJustAddedTicker(null), 3500);
      }
    }
  };

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;

    const measure = () => {
      if (el) {
        setContainerHeight(el.clientHeight);
      }
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });
    resizeObserver.observe(el);

    window.addEventListener('resize', measure);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTickerInput.trim()) return;
    setIsAdding(true);
    const success = await onAddTicker(newTickerInput.trim().toUpperCase());
    setIsAdding(false);
    if (success) {
      setNewTickerInput('');
      setIsInputExpanded(false);
    }
  };

  // Altura aproximada de cada tarjeta compacta (incluyendo gap)
  const ITEM_HEIGHT = 52;
  const BUTTON_HEIGHT = 38;

  // Calculamos si caben todas en el alto disponible
  const maxFitTotal = containerHeight > 0
    ? Math.max(1, Math.floor(containerHeight / ITEM_HEIGHT))
    : watchlist.length;

  const allFit = watchlist.length <= maxFitTotal;

  // Si no caben todas, reservamos espacio para el botón del modal
  const maxFitWithBtn = containerHeight > 0
    ? Math.max(1, Math.floor((containerHeight - BUTTON_HEIGHT) / ITEM_HEIGHT))
    : watchlist.length;

  const visibleCount = allFit ? watchlist.length : maxFitWithBtn;
  const hasMore = !allFit && watchlist.length > visibleCount;
  const visibleItems = watchlist.slice(0, visibleCount);

  const mosOpportunityItems = watchlist.filter(
    (item) => item.techo_mos && item.current_price <= item.techo_mos
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-card border rounded-2xl p-3 flex flex-col h-full max-h-full min-h-0 overflow-hidden shadow-md relative transition-all ${
        isDragOver
          ? 'border-accentSky ring-2 ring-accentSky/50 shadow-[0_0_25px_rgba(56,189,248,0.25)]'
          : 'border-borderSubtle'
      }`}
    >
      {/* Overlay de Soltar (Drop Zone) cuando el usuario arrastra una empresa desde el Pilar Central */}
      {isDragOver && (
        <div className="absolute inset-2 z-50 rounded-2xl bg-slate-950/90 backdrop-blur-sm border-2 border-dashed border-accentSky flex flex-col items-center justify-center p-4 text-center pointer-events-none animate-in fade-in duration-150">
          <div className="w-12 h-12 rounded-2xl bg-accentSky/20 border border-accentSky/40 flex items-center justify-center text-accentSky mb-2 shadow-lg">
            <Eye className="w-6 h-6 animate-bounce" />
          </div>
          <p className="text-sm font-extrabold text-textPrimary tracking-tight">
            Suelta aquí para poner en seguimiento continuo
          </p>
          <p className="text-[11px] text-accentSky font-medium mt-1">
            Se registrará su cotización en vivo y se monitorizará su evolución
          </p>
        </div>
      )}

      {/* Notificación de adición exitosa tras arrastrar o añadir */}
      {justAddedTicker && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-statusGreen/15 border border-statusGreen/40 text-statusGreen text-xs font-bold flex items-center justify-center space-x-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <Award className="w-3.5 h-3.5" />
          <span>¡{justAddedTicker} añadida a empresas en seguimiento!</span>
        </div>
      )}

      {/* HEADER DE LA SECCIÓN DE SEGUIMIENTO */}
      <div className="pb-2.5 border-b border-borderSubtle space-y-1.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-accentSky/15 border border-accentSky/30 flex items-center justify-center text-accentSky font-bold">
              <Eye className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h2 className="text-xs font-bold text-textPrimary tracking-tight">Empresas en Seguimiento</h2>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-accentSky/15 text-accentSky border border-accentSky/30">
                  {watchlist.length}
                </span>
              </div>
              <p className="text-[10px] text-textSecondary">
                Cotización vs precio añadido & análisis técnico
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-1 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-canvas transition-colors"
                title="Refrescar cotizaciones"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsInputExpanded(!isInputExpanded)}
              className="p-1 px-2 rounded-lg text-[11px] font-semibold bg-accentSky/10 hover:bg-accentSky/20 text-accentSky border border-accentSky/30 transition-all flex items-center space-x-1"
              title="Añadir nueva compañía a seguimiento"
            >
              <Plus className="w-3 h-3" />
              <span>Añadir</span>
            </button>
          </div>
        </div>

        {/* BANNER DINÁMICO DE ALERTA DE ENTRADA MoS */}
        {mosOpportunityItems.length > 0 && (
          <div className="p-2 rounded-xl bg-statusGreen/15 border border-statusGreen/40 flex items-center justify-between text-xs animate-pulse">
            <div className="flex items-center space-x-2">
              <BellRing className="w-3.5 h-3.5 text-statusGreen shrink-0" />
              <div>
                <span className="font-bold text-statusGreen text-[11px] uppercase tracking-wider block">
                  ¡Alerta de Entrada MoS! ({mosOpportunityItems.length})
                </span>
                <span className="text-[10px] text-textSecondary font-mono truncate max-w-[190px] block">
                  {mosOpportunityItems.map((i) => i.ticker).join(', ')} en zona de compra
                </span>
              </div>
            </div>
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-statusGreen text-black uppercase">
              COMPRA
            </span>
          </div>
        )}

        {/* INPUT EXPANDIBLE PARA AÑADIR TICKER DIRECTO */}
        {isInputExpanded && (
          <form onSubmit={handleAddSubmit} className="flex items-center space-x-1.5 pt-1 animate-in fade-in duration-150">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Ticker (ej. VICI, EG, MSFT)..."
                value={newTickerInput}
                onChange={(e) => setNewTickerInput(e.target.value)}
                className="w-full bg-canvas border border-borderSubtle focus:border-accentSky rounded-lg px-2.5 py-1 text-xs text-textPrimary placeholder:text-textSecondary/60 outline-none uppercase font-mono"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={isAdding || !newTickerInput.trim()}
              className="px-2.5 py-1 bg-accentSky text-canvas rounded-lg text-xs font-bold hover:bg-accentSky/90 disabled:opacity-50 transition-all"
            >
              {isAdding ? '...' : 'Seguir'}
            </button>
          </form>
        )}
      </div>

      {/* CONTENEDOR DINÁMICO QUE OCUPA TODO EL ALTO DISPONIBLE */}
      <div ref={listContainerRef} className="flex-1 min-h-0 overflow-hidden flex flex-col justify-start space-y-1.5 py-2">
        {isLoading && watchlist.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-textSecondary">
            <RefreshCw className="w-4 h-4 text-accentSky animate-spin mr-2" />
            <span>Cargando cotizaciones...</span>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="h-40 border border-dashed border-borderSubtle rounded-xl flex flex-col items-center justify-center p-3 text-center text-textSecondary space-y-1.5">
            <Eye className="w-6 h-6 text-textSecondary/40" />
            <p className="text-xs font-medium">No tienes empresas en seguimiento todavía.</p>
            <p className="text-[10px] text-textSecondary/70 max-w-xs">
              Arrastra cualquier compañía desde el Pilar Central hasta aquí o usa el botón Añadir para monitorizar su cotización.
            </p>
            <div className="flex space-x-1.5 pt-1">
              {['VICI', 'EG', 'LEN'].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => onAddTicker(sug)}
                  className="px-2 py-0.5 rounded bg-canvas border border-borderSubtle text-[10px] font-mono text-accentSky hover:border-accentSky/50"
                >
                  +{sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          visibleItems.map((item) => {
            const isPos = item.change_since_added_pct >= 0;
            const diffPct = item.change_since_added_pct;
            const diffAmount = item.change_since_added_amount;
            const isMoSEntry = Boolean(item.techo_mos && item.current_price <= item.techo_mos);
            const mosDiscountPct = item.techo_mos ? Math.round(((item.techo_mos - item.current_price) / item.techo_mos) * 100) : 0;

            return (
              <div
                key={item.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', item.ticker);
                  e.dataTransfer.setData('application/x-ticker', item.ticker);
                  e.dataTransfer.setData('application/x-company-name', item.company_name || item.ticker);
                  e.dataTransfer.setData('application/x-current-price', String(item.current_price || item.added_price || 0));
                  e.dataTransfer.setData('application/x-currency', item.currency || 'USD');
                  if (item.fair_value) {
                    e.dataTransfer.setData('application/x-fair-value', String(item.fair_value));
                  }
                  e.dataTransfer.setData('application/x-item-json', JSON.stringify(item));
                  e.dataTransfer.effectAllowed = 'copyMove';
                  setDraggingTicker(item.ticker);
                }}
                onDragEnd={() => setDraggingTicker(null)}
                onClick={() => onSelectCompany(item.ticker)}
                title="Arrastra a Mis Compras para añadir compra, o al Pilar Central para auditarla"
                className={`group px-2.5 py-1.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing relative shadow-sm flex-shrink-0 ${
                  draggingTicker === item.ticker
                    ? 'border-accentSky ring-2 ring-accentSky/40 opacity-65 scale-[0.99] bg-canvas'
                    : isMoSEntry
                    ? 'border-statusGreen/50 bg-statusGreen/10 shadow-[0_0_12px_rgba(16,185,129,0.14)] ring-1 ring-statusGreen/30 hover:border-statusGreen'
                    : 'border-borderSubtle bg-canvas hover:border-accentSky/40 hover:bg-card/90'
                }`}
              >
                {/* 1. LÍNEA SUPERIOR: TICKER, MONEDA, NOMBRE Y ACCIONES EN LA MISMA LÍNEA */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center space-x-1 min-w-0">
                    <GripVertical
                      className="w-3 h-3 text-textSecondary/40 group-hover:text-accentSky/80 transition-colors shrink-0 -ml-0.5"
                    />
                    <span className="font-extrabold text-xs text-textPrimary tracking-tight group-hover:text-accentSky transition-colors shrink-0">
                      {item.ticker}
                    </span>
                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-card border border-borderSubtle text-textSecondary uppercase shrink-0">
                      {item.currency}
                    </span>
                    <span
                      className="text-[11px] text-textSecondary truncate font-medium max-w-[100px] sm:max-w-[130px]"
                      title={item.company_name}
                    >
                      {item.company_name}
                    </span>
                    {isMoSEntry && (
                      <span
                        className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-statusGreen text-black uppercase tracking-wider flex items-center space-x-0.5 shrink-0 animate-pulse"
                        title={`Cotiza a $${item.current_price.toFixed(2)}, por debajo del techo MoS de $${item.techo_mos?.toFixed(2)}`}
                      >
                        <Zap className="w-2.5 h-2.5 fill-current" />
                        <span>MoS -{mosDiscountPct}%</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-0.5 shrink-0">
                    {onAuditInCentralPillar && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAuditInCentralPillar(item.ticker);
                        }}
                        className="p-1 rounded text-textSecondary hover:text-accentSky hover:bg-accentSky/15 transition-colors opacity-0 group-hover:opacity-100"
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
                          onOpenFinancialDeepDive(item.ticker);
                        }}
                        className="p-1 rounded text-textSecondary hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Ver Radiografía Financiera (SEC EDGAR)"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onBuyTrade && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBuyTrade({
                            ticker: item.ticker,
                            companyName: item.company_name,
                            buyPrice: item.current_price,
                            fairValue: item.fair_value || item.current_price,
                            currency: item.currency
                          });
                        }}
                        className={`p-1 rounded transition-colors ${
                          isMoSEntry
                            ? 'text-black bg-statusGreen hover:bg-statusGreen/90 font-bold opacity-100 shadow-sm'
                            : 'text-textSecondary hover:text-statusGreen hover:bg-statusGreen/10 opacity-0 group-hover:opacity-100'
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
                      className="p-1 rounded text-textSecondary hover:text-statusRed hover:bg-statusRed/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Eliminar de seguimiento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <ChevronRight className="w-3.5 h-3.5 text-textSecondary/50 group-hover:text-accentSky group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                {/* 2. LÍNEA INFERIOR: PRECIOS, VARIACIÓN ACUMULADA, HOY % Y MoS */}
                <div className="flex items-center justify-between text-[11px] pt-1 font-mono">
                  <div className="flex items-center space-x-2 text-[10px]">
                    <span>
                      <span className="text-textSecondary">Añadido: </span>
                      <strong className="text-textPrimary font-bold">${item.added_price.toFixed(2)}</strong>
                    </span>
                    <span>
                      <span className="text-textSecondary">Actual: </span>
                      <strong className="text-textPrimary font-bold">${item.current_price.toFixed(2)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    {/* Variación acumulada desde añadido */}
                    <span
                      className={`font-mono font-bold flex items-center space-x-0.5 text-[10px] px-1.5 py-0.2 rounded border ${
                        isPos
                          ? 'bg-statusGreen/15 text-statusGreen border-statusGreen/30'
                          : 'bg-statusRed/15 text-statusRed border-statusRed/30'
                      }`}
                      title="Variación acumulada desde que se añadió a la lista de seguimiento"
                    >
                      {isPos ? <TrendingUp className="w-2.5 h-2.5 inline" /> : <TrendingDown className="w-2.5 h-2.5 inline" />}
                      <span>{isPos ? '+' : ''}${diffAmount.toFixed(2)} ({isPos ? '+' : ''}{diffPct.toFixed(1)}%)</span>
                    </span>

                    {/* Variación de la sesión de HOY (solicitada por el usuario) */}
                    {item.day_change_pct != null && (
                      <span
                        className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded border ${
                          item.day_change_pct >= 0
                            ? 'bg-statusGreen/10 text-statusGreen border-statusGreen/20'
                            : 'bg-statusRed/10 text-statusRed border-statusRed/20'
                        }`}
                        title="Variación de cotización durante la sesión de hoy"
                      >
                        Hoy: {item.day_change_pct >= 0 ? '+' : ''}{item.day_change_pct.toFixed(2)}%
                      </span>
                    )}

                    {/* Techo MoS / Estado de valoración */}
                    {item.techo_mos && (
                      <span
                        className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
                          item.current_price <= item.techo_mos
                            ? 'bg-statusGreen/10 text-statusGreen border-statusGreen/30'
                            : item.fair_value && item.current_price <= item.fair_value
                            ? 'bg-accentSky/10 text-accentSky border-accentSky/30'
                            : 'bg-accentYellow/10 text-accentYellow border-accentYellow/30'
                        }`}
                        title={`Techo MoS: $${item.techo_mos.toFixed(2)} | Fair Value: $${item.fair_value?.toFixed(2) || 'N/A'}`}
                      >
                        {item.current_price <= item.techo_mos ? 'MoS' : item.fair_value && item.current_price <= item.fair_value ? 'FV' : 'Sobre'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* 3. EN CASO DE QUE NO ENTREN TODAS: LINK EN LA ÚLTIMA LÍNEA ANTES DE TERMINAR */}
        {hasMore && (
          <div className="pt-1 mt-auto flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsFullModalOpen(true)}
              className="w-full py-1.5 px-3 rounded-xl bg-accentSky/10 hover:bg-accentSky/20 text-accentSky border border-accentSky/30 text-[11px] font-bold transition flex items-center justify-between group shadow-sm"
              title="Abrir ventana modal para explorar y hacer scroll en todas las empresas"
            >
              <div className="flex items-center space-x-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>Ver todas las empresas en seguimiento ({watchlist.length})</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>

      {/* FOOTER INFORMATIVO */}
      <div className="pt-2 border-t border-borderSubtle flex items-center justify-between text-[10px] text-textSecondary flex-shrink-0">
        <span>Arrastra desde/hacia Pilar Central · Click para técnico</span>
        <span className="font-semibold text-accentSky">Seguimiento Activo</span>
      </div>

      {/* MODAL COMPLETO CON SCROLL PARA TODAS LAS EMPRESAS */}
      <WatchlistFullModal
        isOpen={isFullModalOpen}
        onClose={() => setIsFullModalOpen(false)}
        watchlist={watchlist}
        isLoading={isLoading}
        onSelectCompany={onSelectCompany}
        onRemoveTicker={onRemoveTicker}
        onBuyTrade={onBuyTrade}
        onOpenFinancialDeepDive={onOpenFinancialDeepDive}
        onAuditInCentralPillar={onAuditInCentralPillar}
        onRefresh={onRefresh}
      />
    </div>
  );
};
