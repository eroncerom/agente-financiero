import React, { useState, useEffect } from 'react';
import {
  X,
  Target,
  AlertTriangle,
  TrendingDown,
  Trash2,
  Edit3,
  Save,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { PortfolioPosition, PortfolioTrade } from '../types';
import { StockPriceChart } from './StockPriceChart';

interface TradeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: PortfolioPosition | null;
  initialOpenSell?: boolean;
  onUpdateTrade: (id: number, data: Partial<PortfolioTrade>) => Promise<void>;
  onDeleteTrade: (id: number) => Promise<void>;
  onCloseTrade: (data: {
    id: number;
    sell_price?: number;
    sell_date?: string;
    sell_fees?: number;
    closing_notes?: string;
    shares_to_sell?: number;
  }) => Promise<void>;
}

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({
  isOpen,
  onClose,
  position,
  initialOpenSell = false,
  onUpdateTrade,
  onDeleteTrade,
  onCloseTrade
}) => {
  if (!isOpen || !position) return null;

  const sym = position.currency === 'EUR' ? '€' : '$';
  const trades = position.trades || [];
  const primaryTrade = trades[0] || null;

  // Estado del trade seleccionado si hay varios
  const [selectedTradeId, setSelectedTradeId] = useState<number>(
    primaryTrade ? primaryTrade.id : 0
  );

  const activeTrade = trades.find((t) => t.id === selectedTradeId) || primaryTrade;

  // Estado editable para el trade activo
  const [isEditing, setIsEditing] = useState(false);
  const [editShares, setEditShares] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState('');
  const [editFees, setEditFees] = useState('0');
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTargetExit, setEditTargetExit] = useState('');
  const [editTargetNotes, setEditTargetNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isClosingAuto, setIsClosingAuto] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Estado para venta / liquidación (parcial o total)
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [sellMode, setSellMode] = useState<'TOTAL' | 'PARTIAL'>('TOTAL');
  const [sharesToSell, setSharesToSell] = useState<string>('');
  const [customSellPrice, setCustomSellPrice] = useState<string>('');
  const [customSellFees, setCustomSellFees] = useState<string>('0');
  const [customSellDate, setCustomSellDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [customClosingNotes, setCustomClosingNotes] = useState<string>('');
  const [isSubmittingSell, setIsSubmittingSell] = useState(false);

  // Cargar valores iniciales del trade activo
  useEffect(() => {
    if (activeTrade) {
      setEditShares(activeTrade.shares.toString());
      setEditBuyPrice(activeTrade.buy_price.toString());
      setEditFees((activeTrade.fees || 0).toString());
      setEditDate(activeTrade.execution_date || new Date().toISOString().split('T')[0]);
      setEditNotes(activeTrade.notes || '');

      // Salida sugerida por convergencia a Valor Justo Intrínseco fundamental
      const defaultExit = activeTrade.target_exit_price != null && activeTrade.target_exit_price > 0
        ? activeTrade.target_exit_price.toString()
        : (position.fair_value ? position.fair_value.toFixed(2) : '');

      setEditTargetExit(defaultExit);
      setEditTargetNotes(activeTrade.target_exit_notes || '');
      setIsEditing(false);
      setConfirmDeleteId(null);
    }
  }, [activeTrade?.id, position.fair_value]);

  useEffect(() => {
    if (isOpen && initialOpenSell && position) {
      setIsSellOpen(true);
      setCustomSellPrice(position.current_price.toString());
      if (activeTrade) {
        setSharesToSell(activeTrade.shares.toString());
      }
    }
  }, [isOpen, initialOpenSell, position?.ticker, activeTrade?.id]);

  // Cálculos dinámicos
  const currentPrice = position.current_price;
  const currentTargetExit = parseFloat(editTargetExit) || (activeTrade?.target_exit_price || position.fair_value || 0);
  const hasReachedExit = currentTargetExit > 0 && currentPrice >= currentTargetExit;
  const distToExitPct = currentTargetExit > 0
    ? Number((((currentTargetExit - currentPrice) / currentPrice) * 100).toFixed(1))
    : 0;

  // Alerta de cotización en picado
  const isInFreefall = position.is_in_freefall || position.variation_pct <= -8.0;

  // Manejar guardar cambios
  const handleSaveEdit = async () => {
    if (!activeTrade) return;
    try {
      setIsSaving(true);
      await onUpdateTrade(activeTrade.id, {
        shares: parseFloat(editShares) || activeTrade.shares,
        buy_price: parseFloat(editBuyPrice) || activeTrade.buy_price,
        fees: parseFloat(editFees) || 0,
        execution_date: editDate,
        notes: editNotes,
        target_exit_price: parseFloat(editTargetExit) || null,
        target_exit_notes: editTargetNotes
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Manejar cierre automático con 1 solo clic al precio en vivo
  const handleAutoClose = async (tradeId: number) => {
    try {
      setIsClosingAuto(true);
      await onCloseTrade({
        id: tradeId,
        sell_price: currentPrice,
        sell_date: new Date().toISOString().split('T')[0],
        closing_notes: hasReachedExit
          ? `Cierre automático por alcance de objetivo de salida (${sym}${currentTargetExit.toFixed(2)})`
          : isInFreefall
          ? `Cierre de protección ante cotización en picado (${position.variation_pct.toFixed(1)}%)`
          : 'Cierre automático a mercado desde panel de compra'
      });
      onClose();
    } finally {
      setIsClosingAuto(false);
    }
  };

  // Manejar venta personalizada (total o parcial)
  const handleExecuteSell = async () => {
    if (!activeTrade) return;
    const sPrice = parseFloat(customSellPrice) || currentPrice;
    const sFees = parseFloat(customSellFees) || 0;
    const reqShares = sellMode === 'PARTIAL' ? parseFloat(sharesToSell) : undefined;

    try {
      setIsSubmittingSell(true);
      await onCloseTrade({
        id: activeTrade.id,
        sell_price: sPrice,
        sell_date: customSellDate,
        sell_fees: sFees,
        closing_notes: customClosingNotes.trim() || (sellMode === 'PARTIAL' ? `Venta parcial de ${reqShares} títulos` : 'Venta total'),
        shares_to_sell: reqShares
      });
      setIsSellOpen(false);
      onClose();
    } finally {
      setIsSubmittingSell(false);
    }
  };

  // Manejar borrado
  const handleDelete = async (tradeId: number) => {
    try {
      await onDeleteTrade(tradeId);
      onClose();
    } catch (err) {
      console.error('Error al borrar trade:', err);
    }
  };

  // Aplicar sugerencia basada en el Valor Intrínseco Justo del modelo fundamental
  const handleApplyFundamentalFairValue = () => {
    if (position?.fair_value) {
      setEditTargetExit(position.fair_value.toFixed(2));
      setEditTargetNotes(
        `Convergencia hacia el Valor Justo Intrínseco (${sym}${position.fair_value.toFixed(2)})`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-card border border-borderMedium rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 1. Header con Información del Activo */}
        <div className="p-4 sm:p-5 border-b border-borderSubtle flex items-start justify-between bg-cardSecondary/40">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-accentSky/15 border border-accentSky/30 flex items-center justify-center font-bold text-accentSky text-base">
              {position.ticker}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-textPrimary">{position.company_name}</h2>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-canvas border border-borderSubtle text-textSecondary font-mono">
                  {position.currency}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-statusGreen/15 text-statusGreen border border-statusGreen/30 font-semibold font-mono">
                  ABIERTA
                </span>
              </div>
              <p className="text-xs text-textSecondary mt-0.5">
                Gestión Integral de Compra, Salida y Protección de Capital
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-cardHover border border-transparent hover:border-borderSubtle transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. BANNERS DE ALERTA DINÁMICOS */}
        <div className="px-4 sm:px-5 pt-3 space-y-2">
          {/* A. Alerta de Objetivo de Salida Alcanzado */}
          {hasReachedExit && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-statusGreen/20 via-statusGreen/10 to-canvas border-2 border-statusGreen shadow-lg flex items-center justify-between animate-pulse">
              <div className="flex items-start space-x-2.5">
                <Target className="w-5 h-5 text-statusGreen shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-statusGreen uppercase tracking-wider">
                      🎯 ¡OBJETIVO DE SALIDA ALCANZADO!
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-statusGreen text-canvas font-bold">
                      VENDER AHORA
                    </span>
                  </div>
                  <p className="text-xs text-textPrimary mt-0.5">
                    Cotiza a <span className="font-bold font-mono">{sym}{currentPrice.toFixed(2)}</span>, superando el techo objetivo de salida de{' '}
                    <span className="font-bold font-mono text-statusGreen">{sym}{currentTargetExit.toFixed(2)}</span> (+{Math.abs(distToExitPct)}% a tu favor). ¡Momento óptimo para ejecutar la toma de beneficios!
                  </p>
                </div>
              </div>

              {activeTrade && (
                <button
                  onClick={() => handleAutoClose(activeTrade.id)}
                  disabled={isClosingAuto}
                  className="ml-3 shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-statusGreen text-canvas hover:bg-statusGreen/90 shadow transition flex items-center space-x-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>{isClosingAuto ? 'Cerrando...' : 'Vender Todo'}</span>
                </button>
              )}
            </div>
          )}

          {/* B. Alerta de Cotización en Picado (Cuchillo Cayendo / Stop Loss) */}
          {isInFreefall && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-statusRed/25 via-statusRed/15 to-canvas border-2 border-statusRed shadow-lg flex items-center justify-between">
              <div className="flex items-start space-x-2.5">
                <AlertTriangle className="w-5 h-5 text-statusRed shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-statusRed uppercase tracking-wider">
                      🚨 ALERTA: COTIZACIÓN EN PICADO
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-statusRed text-canvas font-bold">
                      RIESGO ALTO
                    </span>
                  </div>
                  <p className="text-xs text-textPrimary mt-0.5">
                    La posición sufre una variación negativa del{' '}
                    <span className="font-bold font-mono text-statusRed">{position.variation_pct.toFixed(2)}%</span>{' '}
                    ({sym}{position.profit_loss.toFixed(2)}). Se recomienda evaluar la salida inmediata para limitar pérdidas.
                  </p>
                </div>
              </div>

              {activeTrade && (
                <button
                  onClick={() => handleAutoClose(activeTrade.id)}
                  disabled={isClosingAuto}
                  className="ml-3 shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-statusRed text-canvas hover:bg-statusRed/90 shadow transition flex items-center space-x-1.5"
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>{isClosingAuto ? 'Cerrando...' : 'Stop Loss'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. Selector de Compras Múltiples (si el activo tiene más de 1 compra) */}
        {trades.length > 1 && (
          <div className="px-4 sm:px-5 pt-3">
            <span className="text-[10px] uppercase font-bold text-textSecondary tracking-wider block mb-1.5">
              Compras Registradas de {position.ticker} ({trades.length}):
            </span>
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {trades.map((t, idx) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTradeId(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition shrink-0 ${
                    t.id === selectedTradeId
                      ? 'bg-accentSky/20 border-accentSky text-accentSky'
                      : 'bg-cardSecondary border-borderSubtle text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  #{idx + 1}: {sym}{t.buy_price.toFixed(2)} ({t.shares} acc.) - {t.execution_date}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Métricas Clave de la Posición / Trade */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-canvas border border-borderSubtle">
            <div>
              <span className="text-[10px] text-textSecondary block uppercase font-medium">Precio Compra</span>
              <span className="text-sm font-bold font-mono text-textPrimary">
                {sym}{activeTrade ? activeTrade.buy_price.toFixed(2) : position.buy_price.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-textSecondary block uppercase font-medium">Cotización Actual</span>
              <span className="text-sm font-bold font-mono text-accentSky">
                {sym}{currentPrice.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-textSecondary block uppercase font-medium">Títulos (Acciones)</span>
              <span className="text-sm font-bold font-mono text-textPrimary">
                {activeTrade ? activeTrade.shares : position.shares}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-textSecondary block uppercase font-medium">P&L No Realizado</span>
              <span
                className={`text-sm font-bold font-mono ${
                  position.profit_loss >= 0 ? 'text-statusGreen' : 'text-statusRed'
                }`}
              >
                {position.profit_loss >= 0 ? '+' : ''}
                {position.profit_loss.toFixed(2)} {sym} ({position.variation_pct >= 0 ? '+' : ''}
                {position.variation_pct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Gráfico Vectorial Interactivo: Velas Japonesas y Evolución con Rayas Meridianas */}
          <StockPriceChart
            ticker={position.ticker}
            currency={position.currency}
            buyPrice={activeTrade ? activeTrade.buy_price : position.buy_price}
            targetExitPrice={currentTargetExit > 0 ? currentTargetExit : null}
            fairValue={position.fair_value}
            mosCeiling={position.mos_buy_ceiling}
            currentPrice={currentPrice}
            initialMode="candles"
            initialTimeframe="1M"
          />

          {/* 5. SECCIÓN DE SALIDA (TARGET DE VENTA / TAKE PROFIT) */}
          <div className="p-4 rounded-xl bg-cardSecondary/60 border border-borderSubtle space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-accentSky" />
                <span className="text-xs font-bold text-textPrimary uppercase tracking-wider">
                  Configuración de Salida (Precio Objetivo / Venta)
                </span>
              </div>
              {position?.fair_value && (
                <button
                  type="button"
                  onClick={handleApplyFundamentalFairValue}
                  className="text-[11px] font-semibold text-accentSky hover:underline flex items-center space-x-1"
                  title="Fijar precio objetivo en el Valor Intrínseco Justo calculado por el motor fundamental"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Cargar Fair Value ({sym}{position.fair_value.toFixed(2)})</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-textSecondary block font-medium mb-1">
                  Precio Objetivo de Salida ({sym})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-textSecondary font-mono">{sym}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editTargetExit}
                    onChange={(e) => setEditTargetExit(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 bg-canvas border border-borderMedium rounded-lg text-sm font-mono text-textPrimary focus:outline-none focus:border-accentSky"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-textSecondary block font-medium mb-1">
                  Estado vs Objetivo de Salida
                </label>
                <div className="p-2 rounded-lg bg-canvas border border-borderSubtle flex items-center justify-between h-[38px]">
                  <span className="text-xs text-textSecondary">Distancia actual:</span>
                  <span
                    className={`text-xs font-bold font-mono ${
                      hasReachedExit
                        ? 'text-statusGreen'
                        : distToExitPct <= 5
                        ? 'text-accentYellow'
                        : 'text-textPrimary'
                    }`}
                  >
                    {hasReachedExit
                      ? '🎯 ¡Alcanzado!'
                      : distToExitPct > 0
                      ? `Falta +${distToExitPct}%`
                      : '0.0%'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-textSecondary block font-medium mb-1">
                Estrategia / Justificación de Salida
              </label>
              <input
                type="text"
                value={editTargetNotes}
                onChange={(e) => setEditTargetNotes(e.target.value)}
                placeholder="Ej. Salida al alcanzar el Fair Value o tras reversión MoS..."
                className="w-full px-3 py-1.5 bg-canvas border border-borderMedium rounded-lg text-xs text-textPrimary focus:outline-none focus:border-accentSky"
              />
            </div>
          </div>

          {/* 6. EDICIÓN DE CAMPOS DEL TRADE (Títulos, Precio, Fecha, Notas) */}
          <div className="p-4 rounded-xl bg-canvas border border-borderSubtle space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-textPrimary uppercase tracking-wider flex items-center space-x-1.5">
                <Edit3 className="w-3.5 h-3.5 text-textSecondary" />
                <span>Detalle y Edición de la Compra</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-accentSky hover:underline font-semibold"
              >
                {isEditing ? 'Cancelar Edición' : 'Editar Datos'}
              </button>
            </div>

            {isEditing ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-textSecondary block font-medium mb-1">Títulos / Acciones</label>
                    <input
                      type="number"
                      step="any"
                      value={editShares}
                      onChange={(e) => setEditShares(e.target.value)}
                      className="w-full px-3 py-1.5 bg-card border border-borderMedium rounded-lg text-xs font-mono text-textPrimary focus:outline-none focus:border-accentSky"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-textSecondary block font-medium mb-1">Precio Compra ({sym})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBuyPrice}
                      onChange={(e) => setEditBuyPrice(e.target.value)}
                      className="w-full px-3 py-1.5 bg-card border border-borderMedium rounded-lg text-xs font-mono text-textPrimary focus:outline-none focus:border-accentSky"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-textSecondary block font-medium mb-1">Comisiones ({sym})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editFees}
                      onChange={(e) => setEditFees(e.target.value)}
                      className="w-full px-3 py-1.5 bg-card border border-borderMedium rounded-lg text-xs font-mono text-textPrimary focus:outline-none focus:border-accentSky"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-textSecondary block font-medium mb-1">Fecha de Ejecución</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-card border border-borderMedium rounded-lg text-xs text-textPrimary focus:outline-none focus:border-accentSky"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-textSecondary block font-medium mb-1">Notas de la Compra</label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Tesis de inversión o notas de entrada..."
                    className="w-full px-3 py-1.5 bg-card border border-borderMedium rounded-lg text-xs text-textPrimary focus:outline-none focus:border-accentSky"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-textSecondary block">Fecha Compra:</span>
                  <span className="font-mono text-textPrimary">{activeTrade?.execution_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary block">Comisiones:</span>
                  <span className="font-mono text-textPrimary">{sym}{(activeTrade?.fees || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary block">Invertido:</span>
                  <span className="font-mono text-textPrimary">
                    {sym}{activeTrade ? ((activeTrade.shares * activeTrade.buy_price) + (activeTrade.fees || 0)).toFixed(2) : '0.00'}
                  </span>
                </div>
                {activeTrade?.notes && (
                  <div className="col-span-full pt-1">
                    <span className="text-[10px] text-textSecondary block">Notas:</span>
                    <p className="text-xs text-textSecondary italic">{activeTrade.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. PANEL DE VENTA / LIQUIDACIÓN (TOTAL O PARCIAL) */}
          <div className="p-4 rounded-xl bg-cardSecondary/60 border border-borderMedium space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-textPrimary uppercase tracking-wider flex items-center space-x-1.5">
                <Target className="w-3.5 h-3.5 text-statusGreen" />
                <span>Liquidación / Venta de Posición</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!isSellOpen) {
                    setCustomSellPrice(currentPrice.toString());
                    setSharesToSell(activeTrade ? activeTrade.shares.toString() : '1');
                  }
                  setIsSellOpen(!isSellOpen);
                }}
                className="text-xs font-bold text-accentSky hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <span>{isSellOpen ? 'Ocultar Opciones de Venta' : 'Configurar Venta (Parcial / Total)'}</span>
              </button>
            </div>

            {isSellOpen && activeTrade && (
              <div className="space-y-3 pt-2 border-t border-borderSubtle/60 animate-fadeIn">
                {/* Selector Tipo de Venta: Total vs Parcial */}
                <div className="flex items-center space-x-2 bg-canvas p-1 rounded-xl border border-borderSubtle">
                  <button
                    type="button"
                    onClick={() => {
                      setSellMode('TOTAL');
                      setSharesToSell(activeTrade.shares.toString());
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                      sellMode === 'TOTAL'
                        ? 'bg-accentSky text-canvas shadow-sm'
                        : 'text-textSecondary hover:text-textPrimary'
                    }`}
                  >
                    Venta Total (100% · {activeTrade.shares} acc)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSellMode('PARTIAL');
                      setSharesToSell((activeTrade.shares / 2).toString());
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                      sellMode === 'PARTIAL'
                        ? 'bg-accentSky text-canvas shadow-sm'
                        : 'text-textSecondary hover:text-textPrimary'
                    }`}
                  >
                    Venta Parcial
                  </button>
                </div>

                {/* Campos de Venta Parcial si aplica */}
                {sellMode === 'PARTIAL' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-textSecondary font-medium">Títulos a Vender</label>
                      <div className="flex items-center space-x-1">
                        {[0.25, 0.5, 0.75].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setSharesToSell((activeTrade.shares * pct).toFixed(4))}
                            className="px-1.5 py-0.5 rounded bg-cardSecondary hover:bg-cardHover border border-borderSubtle text-[10px] font-mono text-textSecondary hover:text-textPrimary"
                          >
                            {(pct * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      max={activeTrade.shares}
                      value={sharesToSell}
                      onChange={(e) => setSharesToSell(e.target.value)}
                      className="w-full px-3 py-1.5 bg-canvas border border-borderMedium rounded-lg text-xs font-mono text-textPrimary focus:outline-none focus:border-accentSky"
                    />
                  </div>
                )}

                {/* Precio de Venta y Comisiones */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-textSecondary block font-medium mb-1">Precio Venta ({sym})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={customSellPrice}
                      onChange={(e) => setCustomSellPrice(e.target.value)}
                      className="w-full px-3 py-1.5 bg-canvas border border-borderMedium rounded-lg text-xs font-mono text-textPrimary focus:outline-none focus:border-accentSky"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-textSecondary block font-medium mb-1">Comisiones Venta ({sym})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={customSellFees}
                      onChange={(e) => setCustomSellFees(e.target.value)}
                      className="w-full px-3 py-1.5 bg-canvas border border-borderMedium rounded-lg text-xs font-mono text-textPrimary focus:outline-none focus:border-accentSky"
                    />
                  </div>
                </div>

                {/* Fecha y Notas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-textSecondary block font-medium mb-1">Fecha Venta</label>
                    <input
                      type="date"
                      value={customSellDate}
                      onChange={(e) => setCustomSellDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-canvas border border-borderMedium rounded-lg text-xs text-textPrimary focus:outline-none focus:border-accentSky"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-textSecondary block font-medium mb-1">Notas / Justificación</label>
                    <input
                      type="text"
                      value={customClosingNotes}
                      onChange={(e) => setCustomClosingNotes(e.target.value)}
                      placeholder="Ej. Alcance de Target Exit, rebalanceo..."
                      className="w-full px-3 py-1.5 bg-canvas border border-borderMedium rounded-lg text-xs text-textPrimary focus:outline-none focus:border-accentSky"
                    />
                  </div>
                </div>

                {/* Tarjeta de Cálculo en Tiempo Real */}
                {(() => {
                  const sCount = sellMode === 'TOTAL' ? activeTrade.shares : (parseFloat(sharesToSell) || 0);
                  const sPr = parseFloat(customSellPrice) || currentPrice;
                  const sF = parseFloat(customSellFees) || 0;
                  const costBasis = sCount * activeTrade.buy_price;
                  const grossProceeds = (sCount * sPr) - sF;
                  const realizedProfit = grossProceeds - costBasis;
                  const realizedRoi = costBasis > 0 ? (realizedProfit / costBasis) * 100 : 0;
                  const remain = activeTrade.shares - sCount;

                  return (
                    <div className="p-3 rounded-xl bg-canvas border border-borderSubtle grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-textSecondary block">Importe Bruto</span>
                        <span className="font-mono font-bold text-textPrimary">{sym}{grossProceeds.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-textSecondary block">PnL Realizado</span>
                        <span className={`font-mono font-bold ${realizedProfit >= 0 ? 'text-statusGreen' : 'text-statusRed'}`}>
                          {realizedProfit >= 0 ? '+' : ''}{sym}{realizedProfit.toFixed(2)} ({realizedRoi >= 0 ? '+' : ''}{realizedRoi.toFixed(1)}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-textSecondary block">Títulos Restantes</span>
                        <span className="font-mono font-bold text-accentSky">{remain > 0 ? remain.toFixed(4) : '0 (Cierre Total)'}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Botón Ejecutar Venta */}
                <button
                  type="button"
                  onClick={handleExecuteSell}
                  disabled={isSubmittingSell}
                  className="w-full py-2.5 rounded-xl bg-statusGreen hover:bg-statusGreen/90 text-canvas font-bold text-xs transition shadow flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>{isSubmittingSell ? 'Ejecutando venta...' : `Confirmar Venta (${sellMode === 'TOTAL' ? `${activeTrade.shares} acc (100%)` : `${sharesToSell || 0} acc`})`}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 8. Footer con Acciones (Guardar, Cerrar Automáticamente, Borrar) */}
        <div className="p-4 sm:p-5 border-t border-borderSubtle bg-cardSecondary/40 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            {confirmDeleteId === activeTrade?.id ? (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-statusRed font-semibold">¿Seguro que deseas borrarla?</span>
                <button
                  type="button"
                  onClick={() => activeTrade && handleDelete(activeTrade.id)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-statusRed text-canvas hover:bg-statusRed/90 transition shadow"
                >
                  Sí, Borrar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2 py-1 text-xs font-semibold rounded-lg bg-cardSecondary hover:bg-cardHover text-textSecondary"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => activeTrade && setConfirmDeleteId(activeTrade.id)}
                className="px-3 py-2 text-xs font-semibold rounded-xl text-statusRed hover:bg-statusRed/10 border border-statusRed/20 transition flex items-center space-x-1.5"
                title="Eliminar esta compra del registro"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Borrar Compra</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Botón de Guardar Modificaciones */}
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-cardSecondary hover:bg-cardHover border border-borderMedium text-textPrimary transition shadow flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5 text-accentSky" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>

            {/* Botón de Cierre / Liquidación Automática en 1 Clic */}
            {activeTrade && (
              <button
                type="button"
                onClick={() => handleAutoClose(activeTrade.id)}
                disabled={isClosingAuto}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-accentSky text-canvas hover:bg-accentSky/90 transition shadow flex items-center space-x-1.5"
                title="Cerrar la compra inmediatamente al precio actual de mercado"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{isClosingAuto ? 'Cerrando...' : `Cerrar a Mercado (${sym}${currentPrice.toFixed(2)})`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
