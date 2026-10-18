import React, { useState, useRef } from 'react';
import { PlusCircle, Wallet, ArrowUpRight, ArrowDownRight, Minus, History, Target, AlertTriangle, RefreshCw, FileCheck2, ShoppingCart, TrendingUp } from 'lucide-react';
import { PortfolioPosition, PortfolioSummary, PortfolioTrade, ClosedSummary } from '../types';
import { TradeHistoryModal } from './TradeHistoryModal';
import { TradeDetailModal } from './TradeDetailModal';

interface PortfolioColumnProps {
  summary: PortfolioSummary | null;
  positions: PortfolioPosition[];
  trades?: PortfolioTrade[];
  closedTrades?: PortfolioTrade[];
  closedSummary?: ClosedSummary | null;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  onOpenAddTrade: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onDeleteTrade?: (id: number) => Promise<void>;
  onCloseTrade?: (data: {
    id: number;
    sell_price?: number;
    sell_date?: string;
    sell_fees?: number;
    closing_notes?: string;
    shares_to_sell?: number;
  }) => Promise<void>;
  onReopenTrade?: (id: number) => Promise<void>;
  onClearAllTrades?: () => Promise<void>;
  onUpdateTrade?: (id: number, data: Partial<PortfolioTrade>) => Promise<void>;
  onAddDirectClosedTrade?: (data: any) => Promise<void>;
  onOpenFinancialDeepDive?: (ticker: string) => void;
  onOpenBuyTradeWithCompany?: (company: {
    ticker: string;
    companyName?: string;
    buyPrice?: number;
    fairValue?: number;
    currency?: 'EUR' | 'USD';
    price?: number;
    current_price?: number;
    precio_cierre_P0?: number;
  }) => void;
}

export const PortfolioColumn: React.FC<PortfolioColumnProps> = ({
  summary,
  positions,
  trades = [],
  closedTrades = [],
  closedSummary = null,
  selectedTicker,
  onSelectTicker,
  onOpenAddTrade,
  onRefresh,
  isRefreshing = false,
  onDeleteTrade = async () => {},
  onCloseTrade = async () => {},
  onReopenTrade = async () => {},
  onClearAllTrades = async () => {},
  onUpdateTrade = async () => {},
  onAddDirectClosedTrade,
  onOpenFinancialDeepDive,
  onOpenBuyTradeWithCompany
}) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyInitialTab, setHistoryInitialTab] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [openSellDirectly, setOpenSellDirectly] = useState(false);
  const [showMetricsDetail, setShowMetricsDetail] = useState(false);
  const [selectedPositionForDetail, setSelectedPositionForDetail] = useState<PortfolioPosition | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef<number>(0);
  const getCurrencySymbol = (currency: 'EUR' | 'USD') => (currency === 'EUR' ? '€' : '$');

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
    if (!cleanTicker) return;

    let companyName = e.dataTransfer.getData('application/x-company-name') || cleanTicker;
    let price = parseFloat(e.dataTransfer.getData('application/x-current-price')) || 0;
    let fairValue = parseFloat(e.dataTransfer.getData('application/x-fair-value')) || 0;
    let currency = (e.dataTransfer.getData('application/x-currency') as 'EUR' | 'USD') || 'USD';

    const rawJson = e.dataTransfer.getData('application/x-item-json');
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        companyName = parsed.company_name || companyName;
        price = parsed.current_price || parsed.added_price || price;
        fairValue = parsed.fair_value || fairValue;
        currency = parsed.currency || currency;
      } catch {}
    }

    if (!price || price <= 0) {
      try {
        const qRes = await fetch(`/api/quote/${encodeURIComponent(cleanTicker)}`);
        if (qRes.ok) {
          const qJson = await qRes.json();
          if (qJson.price > 0) {
            price = qJson.price;
            companyName = qJson.shortName || qJson.name || companyName;
            if (qJson.fair_value) fairValue = qJson.fair_value;
            if (qJson.currency) currency = (qJson.currency as 'EUR' | 'USD');
          }
        }
      } catch {}
    }

    if (onOpenBuyTradeWithCompany) {
      onOpenBuyTradeWithCompany({
        ticker: cleanTicker,
        companyName,
        buyPrice: price > 0 ? price : undefined,
        price: price > 0 ? price : undefined,
        current_price: price > 0 ? price : undefined,
        precio_cierre_P0: price > 0 ? price : undefined,
        fairValue: fairValue > 0 ? fairValue : (price > 0 ? Number((price * 1.15).toFixed(2)) : undefined),
        currency
      });
    } else {
      onOpenAddTrade();
    }
  };

  return (
    <section
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-card border rounded-2xl flex flex-col p-4 overflow-hidden h-full shadow-md relative transition-all ${
        isDragOver
          ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
          : 'border-borderSubtle'
      }`}
    >
      {/* Overlay de Soltar (Drop Zone) cuando el usuario arrastra una empresa desde Seguimiento */}
      {isDragOver && (
        <div className="absolute inset-2 z-50 rounded-2xl bg-slate-950/90 backdrop-blur-sm border-2 border-dashed border-emerald-500 flex flex-col items-center justify-center p-6 text-center pointer-events-none animate-in fade-in duration-150">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3 shadow-lg">
            <ShoppingCart className="w-8 h-8 animate-bounce" />
          </div>
          <p className="text-base font-extrabold text-textPrimary tracking-tight">
            Suelta aquí para añadir a Mis Compras
          </p>
          <p className="text-xs text-emerald-400 font-medium mt-1 max-w-xs">
            Se abrirá el modal de compra con los datos y cotización de la empresa pre-rellenados.
          </p>
        </div>
      )}
      {/* Header Columna */}
      <div className="flex items-center justify-between pb-3 border-b border-borderSubtle">
        <div className="flex items-center space-x-2">
          <Wallet className="w-4 h-4 text-accentSky" />
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary">Pilar Cartera</h2>
            <p className="text-base font-bold text-textPrimary">Mis Compras</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Botón Refrescar Cotizaciones en Vivo */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-cardHover border border-borderSubtle transition-colors disabled:opacity-50"
              title="Refrescar cotizaciones en tiempo real"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-accentSky' : ''}`} />
            </button>
          )}

          {/* Botón de Compras Activas */}
          <button
            onClick={() => {
              setHistoryInitialTab('OPEN');
              setIsHistoryOpen(true);
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-cardSecondary hover:bg-cardHover text-textSecondary hover:text-textPrimary border border-borderSubtle transition"
            title="Ver compras activas y operaciones"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Activas</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/20 text-accentSky font-bold">
              {trades.length}
            </span>
          </button>

          {/* Botón de Ventas & Movimientos Realizados */}
          <button
            onClick={() => {
              setHistoryInitialTab('CLOSED');
              setIsHistoryOpen(true);
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-statusGreen/15 hover:bg-statusGreen/25 text-statusGreen border border-statusGreen/30 transition shadow-sm font-bold"
            title="Consultar registro de ventas, ganancias/pérdidas y movimientos por fecha (por defecto último año)"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ventas & P&L</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/30 text-statusGreen font-bold">
              {closedTrades.length}
            </span>
          </button>

          {/* Botón Añadir Compra */}
          <button
            onClick={onOpenAddTrade}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accentSky/15 text-accentSky hover:bg-accentSky/25 border border-accentSky/30 transition shadow-sm font-bold"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Añadir</span>
          </button>
        </div>
      </div>

      {/* Resumen Consolidado y Métricas Globales */}
      {summary && (
        <div className="my-2.5 p-3 rounded-xl bg-canvas border border-borderSubtle/70 space-y-2">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="text-[10px] text-textSecondary block font-medium uppercase tracking-wider">Invertido Total</span>
              <span className="text-sm font-bold text-textPrimary font-mono">
                {summary.total_invested_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </span>
            </div>
            <div>
              <span className="text-[10px] text-textSecondary block font-medium uppercase tracking-wider">P&L Global (€)</span>
              <span
                className={`text-sm font-bold font-mono ${
                  summary.total_pnl_eur > 0
                    ? 'text-statusGreen'
                    : summary.total_pnl_eur < 0
                    ? 'text-statusRed'
                    : 'text-statusNeutral'
                }`}
              >
                {summary.total_pnl_eur >= 0 ? '+' : ''}
                {summary.total_pnl_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                <span className="text-[10px] ml-1">
                  ({summary.total_variation_pct >= 0 ? '+' : ''}
                  {summary.total_variation_pct.toFixed(2)}%)
                </span>
              </span>
            </div>
          </div>

          {/* Barra de Distribución por Mercado y Divisa */}
          <div className="pt-2 border-t border-borderSubtle/50 flex items-center justify-between text-[10px]">
            <div className="flex items-center space-x-1.5 flex-wrap font-mono">
              <span className="text-textSecondary/80">Divisa:</span>
              <span className="px-1.5 py-0.2 rounded bg-cardSecondary text-textPrimary border border-borderSubtle">
                ${summary.usd_pct ?? 0}% USD
              </span>
              <span className="px-1.5 py-0.2 rounded bg-cardSecondary text-textPrimary border border-borderSubtle">
                €{summary.eur_pct ?? 0}% EUR
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowMetricsDetail(!showMetricsDetail)}
              className="text-accentSky hover:underline font-bold text-[10px] flex items-center space-x-0.5 cursor-pointer"
            >
              <span>{showMetricsDetail ? 'Ocultar' : 'Exposición'}</span>
            </button>
          </div>

          {/* Desglose Expandible de Exposición por Mercado y Sectores */}
          {showMetricsDetail && (
            <div className="pt-2 border-t border-borderSubtle/40 space-y-2 animate-fadeIn">
              {summary.market_allocations && summary.market_allocations.length > 0 && (
                <div>
                  <span className="text-[9px] uppercase font-bold text-textSecondary tracking-wider block mb-1">
                    Exposición por Mercado
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {summary.market_allocations.map((m) => (
                      <span
                        key={m.market}
                        className="text-[10px] px-2 py-0.5 rounded bg-cardSecondary text-textPrimary border border-borderSubtle font-mono"
                      >
                        <strong className="text-accentSky">{m.market}:</strong> {m.weight_pct}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {summary.sector_allocations && summary.sector_allocations.length > 0 && (
                <div>
                  <span className="text-[9px] uppercase font-bold text-textSecondary tracking-wider block mb-1">
                    Diversificación Sectorial
                  </span>
                  <div className="space-y-1">
                    {summary.sector_allocations.slice(0, 4).map((s) => (
                      <div key={s.sector} className="flex items-center justify-between text-[10px] text-textSecondary">
                        <span className="truncate max-w-[140px]">{s.sector}</span>
                        <div className="flex items-center space-x-1.5 font-mono">
                          <div className="w-16 h-1.5 bg-cardSecondary rounded-full overflow-hidden">
                            <div className="h-full bg-accentSky rounded-full" style={{ width: `${Math.min(100, s.weight_pct)}%` }} />
                          </div>
                          <span className="text-textPrimary font-semibold">{s.weight_pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Encabezado de Lista de Compras */}
      <div className="grid grid-cols-12 text-[10px] text-textSecondary uppercase font-bold px-2 py-1.5 border-b border-borderSubtle/60 tracking-wider">
        <span className="col-span-4">Activo</span>
        <span className="col-span-3 text-right">Compra</span>
        <span className="col-span-2 text-right">Actual</span>
        <span className="col-span-3 text-right">% Var.</span>
      </div>

      {/* Lista de Posiciones (BBDD Local) */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 py-2">
        {positions.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-textSecondary font-sans">
            <p className="text-xs">No hay posiciones registradas en la BBDD local.</p>
            <button
              onClick={onOpenAddTrade}
              className="mt-2 text-xs text-accentSky underline hover:text-accentSky/80 font-semibold"
            >
              Registra tu primera compra
            </button>
          </div>
        ) : (
          positions.map((pos) => {
            const sym = getCurrencySymbol(pos.currency);
            const isSelected = selectedTicker === pos.ticker;

            const isPositive = pos.status_color === 'POSITIVE';
            const isNegative = pos.status_color === 'NEGATIVE';
            const isNeutral = pos.status_color === 'NEUTRAL';

            const hasReachedExit = Boolean(pos.has_reached_exit);
            const isInFreefall = Boolean(pos.is_in_freefall || pos.variation_pct <= -8.0);
            const targetExitVal = pos.target_exit_price || pos.fair_value || null;

            return (
              <div
                key={pos.ticker}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', pos.ticker);
                  e.dataTransfer.setData('application/x-ticker', pos.ticker);
                  e.dataTransfer.setData('application/x-company-name', pos.company_name || pos.ticker);
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                onClick={() => {
                  onSelectTicker(pos.ticker);
                  setSelectedPositionForDetail(pos);
                }}
                title="Arrastra al Pilar Central para analizar sus 3 escenarios, o haz click para detalle de posición"
                className={`grid grid-cols-12 items-center p-2.5 rounded-xl border transition cursor-grab active:cursor-grabbing relative ${
                  hasReachedExit
                    ? 'border-statusGreen/80 bg-statusGreen/10 shadow-[0_0_12px_rgba(34,197,94,0.25)] hover:border-statusGreen'
                    : isInFreefall
                    ? 'border-statusRed/80 bg-statusRed/10 shadow-[0_0_12px_rgba(239,68,68,0.25)] hover:border-statusRed'
                    : isSelected
                    ? 'bg-cardHover border-accentSky/50 shadow-md'
                    : 'bg-cardSecondary/60 hover:bg-cardSecondary border-transparent hover:border-borderMedium'
                }`}
              >
                {/* Activo / Ticker & Divisa */}
                <div className="col-span-4">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-sm font-bold text-textPrimary">{pos.ticker}</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-card border border-borderSubtle text-textSecondary font-mono">
                      {pos.currency}
                    </span>
                    {pos.weight_pct != null && pos.weight_pct > 0 && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-card border border-borderSubtle text-accentSky font-mono font-semibold" title={`Peso en cartera: ${pos.weight_pct}%`}>
                        {pos.weight_pct}%
                      </span>
                    )}
                    {onOpenFinancialDeepDive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFinancialDeepDive(pos.ticker);
                        }}
                        className="p-0.5 rounded text-textSecondary/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        title={`Ver Radiografía Financiera (SEC) de ${pos.ticker}`}
                      >
                        <FileCheck2 className="w-3 h-3 text-emerald-400" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPositionForDetail(pos);
                        setOpenSellDirectly(true);
                      }}
                      className="px-1.5 py-0.2 rounded text-[10px] font-bold text-statusGreen bg-statusGreen/10 hover:bg-statusGreen/25 border border-statusGreen/30 transition-colors"
                      title={`Registrar venta o liquidación para ${pos.ticker}`}
                    >
                      Vender
                    </button>
                    {hasReachedExit && (
                      <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-statusGreen text-canvas flex items-center space-x-0.5 animate-pulse" title="Objetivo de salida alcanzado">
                        <Target className="w-2.5 h-2.5" />
                        <span>EXIT</span>
                      </span>
                    )}
                    {isInFreefall && (
                      <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-statusRed text-canvas flex items-center space-x-0.5 animate-bounce" title="Cotización en picado">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>PICADO</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-accentSky truncate block max-w-[110px]" title={pos.company_name}>
                    {pos.company_name}
                  </span>
                </div>

                {/* Valor de Compra y Salida Objetivo */}
                <div className="col-span-3 text-right font-mono">
                  <span className="text-xs text-textSecondary block">
                    {sym}{pos.buy_price.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-textSecondary/70 block">
                    {pos.shares % 1 === 0 ? pos.shares : parseFloat(pos.shares.toFixed(4))} acc.
                  </span>
                  {targetExitVal ? (
                    <span className="text-[9px] text-accentSky/80 font-mono block" title="Precio objetivo de salida (Target Exit)">
                      Salida: {sym}{targetExitVal.toFixed(2)}
                    </span>
                  ) : null}
                </div>

                {/* Valor Actual */}
                <div className="col-span-2 text-right font-mono">
                  <span className="text-xs font-semibold text-textPrimary">
                    {sym}{pos.current_price.toFixed(2)}
                  </span>
                </div>

                {/* % Variación con Colores Específicos */}
                <div className="col-span-3 text-right">
                  <span
                    className={`inline-flex items-center space-x-0.5 text-xs font-bold font-mono px-2 py-0.5 rounded-md border ${
                      isPositive
                        ? 'text-statusGreen bg-statusGreen/10 border-statusGreen/25'
                        : isNegative
                        ? 'text-statusRed bg-statusRed/10 border-statusRed/25'
                        : 'text-statusNeutral bg-statusNeutral/10 border-statusNeutral/25'
                    }`}
                  >
                    {isPositive && <ArrowUpRight className="w-3 h-3 inline mr-0.5" />}
                    {isNegative && <ArrowDownRight className="w-3 h-3 inline mr-0.5" />}
                    {isNeutral && <Minus className="w-3 h-3 inline mr-0.5" />}
                    <span>
                      {pos.variation_pct > 0 ? '+' : ''}
                      {pos.variation_pct.toFixed(2)}%
                    </span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pie de Columna */}
      <div className="pt-3 border-t border-borderSubtle text-[11px] text-textSecondary flex items-center justify-between">
        <span>{positions.length} activos en cartera</span>
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="text-accentSky hover:underline font-mono text-[10px] flex items-center space-x-1"
        >
          <span>BBDD SQLite ({trades.length} activas</span>
          {closedTrades.length > 0 && <span className="text-statusGreen">/ {closedTrades.length} cerradas</span>}
          <span>)</span>
        </button>
      </div>

      {/* Modal de Detalle, Edición, Salida y Cierre Automático de Compra */}
      <TradeDetailModal
        isOpen={Boolean(selectedPositionForDetail)}
        onClose={() => {
          setSelectedPositionForDetail(null);
          setOpenSellDirectly(false);
        }}
        position={selectedPositionForDetail}
        initialOpenSell={openSellDirectly}
        onUpdateTrade={onUpdateTrade}
        onDeleteTrade={onDeleteTrade}
        onCloseTrade={onCloseTrade}
      />

      {/* Modal de Historial de Operaciones */}
      <TradeHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        trades={trades}
        closedTrades={closedTrades}
        closedSummary={closedSummary}
        initialTab={historyInitialTab}
        onDeleteTrade={onDeleteTrade}
        onCloseTrade={onCloseTrade}
        onReopenTrade={onReopenTrade}
        onClearAllTrades={onClearAllTrades}
        onUpdateTrade={onUpdateTrade}
        onAddDirectClosedTrade={onAddDirectClosedTrade}
      />
    </section>
  );
};

