import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  History,
  Calendar,
  FileText,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  ArrowRight,
  Edit3,
  Calculator,
  RefreshCw,
  Target
} from 'lucide-react';
import { PortfolioTrade, ClosedSummary, Currency } from '../types';

interface TradeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: PortfolioTrade[];
  closedTrades?: PortfolioTrade[];
  closedSummary?: ClosedSummary | null;
  onDeleteTrade: (id: number) => Promise<void>;
  onCloseTrade: (data: {
    id: number;
    sell_price: number;
    sell_date?: string;
    sell_fees?: number;
    closing_notes?: string;
    shares_to_sell?: number;
  }) => Promise<void>;
  onReopenTrade: (id: number) => Promise<void>;
  onClearAllTrades: () => Promise<void>;
  onUpdateTrade: (id: number, data: Partial<PortfolioTrade>) => Promise<void>;
}

export const TradeHistoryModal: React.FC<TradeHistoryModalProps> = ({
  isOpen,
  onClose,
  trades,
  closedTrades = [],
  closedSummary,
  onDeleteTrade,
  onCloseTrade,
  onReopenTrade,
  onClearAllTrades,
  onUpdateTrade
}) => {
  const [activeTab, setActiveTab] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reopeningId, setReopeningId] = useState<number | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Estado para el modal de liquidación/cierre
  const [liquidatingTrade, setLiquidatingTrade] = useState<PortfolioTrade | null>(null);
  const [sellMode, setSellMode] = useState<'ALL' | 'PARTIAL'>('ALL');
  const [sellSharesInput, setSellSharesInput] = useState<string>('');
  const [sellPriceInput, setSellPriceInput] = useState<string>('');
  const [sellDateInput, setSellDateInput] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [sellFeesInput, setSellFeesInput] = useState<string>('0');
  const [closingNotesInput, setClosingNotesInput] = useState<string>('');
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);

  // Estado para el modal de edición/modificación de compra
  const [editingTrade, setEditingTrade] = useState<PortfolioTrade | null>(null);
  const [editTicker, setEditTicker] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCurrency, setEditCurrency] = useState<Currency>('EUR');
  const [editMode, setEditMode] = useState<'AMOUNT' | 'SHARES'>('AMOUNT');
  const [editAmount, setEditAmount] = useState('');
  const [editShares, setEditShares] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState('');
  const [editFees, setEditFees] = useState('0');
  const [editExecutionDate, setEditExecutionDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTargetExitPrice, setEditTargetExitPrice] = useState('');
  const [editTargetExitNotes, setEditTargetExitNotes] = useState('');
  const [editSellPrice, setEditSellPrice] = useState('');
  const [editSellDate, setEditSellDate] = useState('');
  const [editSellFees, setEditSellFees] = useState('0');
  const [editClosingNotes, setEditClosingNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isLoadingEditQuote, setIsLoadingEditQuote] = useState(false);
  const [editFairValue, setEditFairValue] = useState<number | null>(null);

  // Cálculo bidireccional en modo edición:
  useEffect(() => {
    if (!editingTrade) return;
    if (editMode === 'AMOUNT') {
      const numAmount = parseFloat(editAmount);
      const numPrice = parseFloat(editBuyPrice);
      if (!isNaN(numAmount) && !isNaN(numPrice) && numPrice > 0) {
        setEditShares(parseFloat((numAmount / numPrice).toFixed(6)).toString());
      }
    }
  }, [editAmount, editBuyPrice, editMode, editingTrade]);

  useEffect(() => {
    if (!editingTrade) return;
    if (editMode === 'SHARES') {
      const numShares = parseFloat(editShares);
      const numPrice = parseFloat(editBuyPrice);
      if (!isNaN(numShares) && !isNaN(numPrice) && numShares > 0) {
        setEditAmount((numShares * numPrice).toFixed(2));
      }
    }
  }, [editShares, editBuyPrice, editMode, editingTrade]);

  if (!isOpen) return null;

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id);
      await onDeleteTrade(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleReopen = async (id: number) => {
    try {
      setReopeningId(id);
      await onReopenTrade(id);
    } finally {
      setReopeningId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      return;
    }
    try {
      setIsClearing(true);
      await onClearAllTrades();
      setConfirmClearAll(false);
    } finally {
      setIsClearing(false);
    }
  };

  // Abrir diálogo de liquidación
  const openLiquidationModal = (trade: PortfolioTrade) => {
    setLiquidatingTrade(trade);
    setSellMode('ALL');
    setSellSharesInput(trade.shares.toString());
    setSellPriceInput(trade.buy_price.toString());
    setSellDateInput(new Date().toISOString().split('T')[0]);
    setSellFeesInput('0');
    setClosingNotesInput('');
  };

  const handleConfirmClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liquidatingTrade) return;

    const sellPrice = parseFloat(sellPriceInput);
    if (isNaN(sellPrice) || sellPrice <= 0) return;

    const sellFees = parseFloat(sellFeesInput) || 0;
    const reqShares = sellMode === 'PARTIAL' ? parseFloat(sellSharesInput) : undefined;

    try {
      setIsSubmittingClose(true);
      await onCloseTrade({
        id: liquidatingTrade.id,
        sell_price: sellPrice,
        sell_date: sellDateInput,
        sell_fees: sellFees,
        closing_notes: closingNotesInput.trim(),
        shares_to_sell: reqShares
      });
      setLiquidatingTrade(null);
      setActiveTab('CLOSED');
    } catch (err) {
      console.error('Error al liquidar trade:', err);
    } finally {
      setIsSubmittingClose(false);
    }
  };

  // Abrir diálogo de edición de una compra
  const openEditModal = (trade: PortfolioTrade) => {
    setEditingTrade(trade);
    setEditTicker(trade.ticker);
    setEditCompanyName(trade.company_name);
    setEditCurrency(trade.currency);
    const totalCost = trade.shares * trade.buy_price;
    setEditAmount(totalCost.toFixed(2));
    setEditShares(trade.shares.toString());
    setEditBuyPrice(trade.buy_price.toString());
    setEditFees((trade.fees || 0).toString());
    setEditExecutionDate(trade.execution_date);
    setEditNotes(trade.notes || '');
    setEditFairValue(trade.fair_value || null);
    setEditTargetExitPrice(
      trade.target_exit_price
        ? trade.target_exit_price.toString()
        : trade.fair_value
        ? trade.fair_value.toFixed(2)
        : ''
    );
    setEditTargetExitNotes(trade.target_exit_notes || '');
    setEditMode('AMOUNT');
    if (trade.status === 'CLOSED') {
      setEditSellPrice((trade.sell_price || 0).toString());
      setEditSellDate(trade.sell_date || '');
      setEditSellFees((trade.sell_fees || 0).toString());
      setEditClosingNotes(trade.closing_notes || '');
    }
  };

  const handleFetchEditQuote = async () => {
    if (!editTicker.trim()) return;
    try {
      setIsLoadingEditQuote(true);
      const res = await fetch(`/api/quote/${encodeURIComponent(editTicker.trim().toUpperCase())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.name) setEditCompanyName(data.name);
        if (data.price) {
          setEditBuyPrice(data.price.toString());
          if (data.currency) setEditCurrency(data.currency as Currency);
        }
        if (data.fair_value) {
          setEditFairValue(data.fair_value);
          if (!editTargetExitPrice) {
            setEditTargetExitPrice(data.fair_value.toFixed(2));
          }
        }
      }
    } catch (err) {
      console.error('Error al consultar cotización en edición:', err);
    } finally {
      setIsLoadingEditQuote(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrade) return;

    const sharesNum = parseFloat(editShares);
    const buyPriceNum = parseFloat(editBuyPrice);
    const feesNum = parseFloat(editFees || '0');
    const targetExitNum = parseFloat(editTargetExitPrice);

    if (!editTicker.trim() || isNaN(sharesNum) || sharesNum <= 0 || isNaN(buyPriceNum) || buyPriceNum <= 0) {
      return;
    }

    try {
      setIsSavingEdit(true);
      const payload: Partial<PortfolioTrade> = {
        ticker: editTicker.trim().toUpperCase(),
        company_name: editCompanyName.trim() || editTicker.trim().toUpperCase(),
        currency: editCurrency,
        shares: sharesNum,
        buy_price: buyPriceNum,
        fees: feesNum,
        execution_date: editExecutionDate,
        notes: editNotes.trim(),
        target_exit_price: !isNaN(targetExitNum) && targetExitNum > 0 ? targetExitNum : null,
        target_exit_notes: editTargetExitNotes.trim() || null
      };

      if (editingTrade.status === 'CLOSED') {
        const sellPriceNum = parseFloat(editSellPrice);
        if (!isNaN(sellPriceNum) && sellPriceNum > 0) {
          payload.sell_price = sellPriceNum;
          payload.sell_date = editSellDate;
          payload.sell_fees = parseFloat(editSellFees || '0');
          payload.closing_notes = editClosingNotes.trim();
        }
      }

      await onUpdateTrade(editingTrade.id, payload);
      setEditingTrade(null);
    } catch (err) {
      console.error('Error al guardar edición:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Cálculos dinámicos de previsualización de liquidación
  const totalSharesLiq = liquidatingTrade ? liquidatingTrade.shares : 0;
  const numSellShares = sellMode === 'PARTIAL' ? parseFloat(sellSharesInput) || 0 : totalSharesLiq;
  const sharesLiq = Math.min(totalSharesLiq, Math.max(0, numSellShares));
  const buyCostLiq =
    liquidatingTrade && totalSharesLiq > 0
      ? sharesLiq * liquidatingTrade.buy_price + (liquidatingTrade.fees || 0) * (sharesLiq / totalSharesLiq)
      : 0;
  const parsedSellPrice = parseFloat(sellPriceInput) || 0;
  const parsedSellFees = parseFloat(sellFeesInput) || 0;
  const sellProceeds = sharesLiq * parsedSellPrice - parsedSellFees;
  const previewPnl = sellProceeds - buyCostLiq;
  const previewRoi = buyCostLiq > 0 ? (previewPnl / buyCostLiq) * 100 : 0;
  const remainingShares = totalSharesLiq - sharesLiq;
  const symLiq = liquidatingTrade?.currency === 'EUR' ? '€' : '$';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-card border border-borderMedium w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col relative">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-borderSubtle pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-accentSky/10 border border-accentSky/20 text-accentSky">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-textPrimary">Gestión de Compras y Operaciones</h3>
              <p className="text-[11px] text-textSecondary">
                Registros persistentes en base de datos local SQLite (`portfolio.db`)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Botón de Purga Total para limpiar compras no reales/demo */}
            {trades.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearing}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center space-x-1 ${
                  confirmClearAll
                    ? 'bg-statusRed text-white border-statusRed animate-pulse'
                    : 'bg-statusRed/10 text-statusRed border-statusRed/30 hover:bg-statusRed/20'
                }`}
                title="Elimina todas las compras registradas para empezar desde cero"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmClearAll ? '¿Seguro? Clic para borrar TODO' : 'Limpiar Todo'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="text-textSecondary hover:text-textPrimary p-1.5 rounded-lg hover:bg-cardSecondary transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selector de Pestañas: Activas vs Cerradas/Histórico */}
        <div className="flex items-center space-x-2 border-b border-borderSubtle pb-2">
          <button
            onClick={() => setActiveTab('OPEN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'OPEN'
                ? 'bg-accentSky/15 text-accentSky border border-accentSky/30'
                : 'text-textSecondary hover:text-textPrimary hover:bg-cardSecondary'
            }`}
          >
            <span>Posiciones Activas / Abiertas</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {trades.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('CLOSED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'CLOSED'
                ? 'bg-statusGreen/15 text-statusGreen border border-statusGreen/30'
                : 'text-textSecondary hover:text-textPrimary hover:bg-cardSecondary'
            }`}
          >
            <span>Histórico de Posiciones Cerradas / Liquidadas</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {closedTrades.length}
            </span>
          </button>
        </div>

        {/* Resumen de Histórico Cerrado (si estamos en pestaña CLOSED y hay datos) */}
        {activeTab === 'CLOSED' && closedSummary && closedTrades.length > 0 && (
          <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-canvas border border-borderSubtle text-xs">
            <div>
              <span className="text-[10px] text-textSecondary uppercase font-medium block">P&L Realizado Total (€)</span>
              <span
                className={`text-sm font-bold font-mono ${
                  closedSummary.total_realized_pnl_eur >= 0 ? 'text-statusGreen' : 'text-statusRed'
                }`}
              >
                {closedSummary.total_realized_pnl_eur >= 0 ? '+' : ''}
                {closedSummary.total_realized_pnl_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </span>
            </div>
            <div>
              <span className="text-[10px] text-textSecondary uppercase font-medium block">ROI Medio Realizado</span>
              <span
                className={`text-sm font-bold font-mono ${
                  closedSummary.total_realized_roi_pct >= 0 ? 'text-statusGreen' : 'text-statusRed'
                }`}
              >
                {closedSummary.total_realized_roi_pct >= 0 ? '+' : ''}
                {closedSummary.total_realized_roi_pct.toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="text-[10px] text-textSecondary uppercase font-medium block">Balance Operaciones</span>
              <span className="text-xs font-semibold text-textPrimary">
                <span className="text-statusGreen font-mono font-bold">{closedSummary.winning_trades_count} Ganadoras</span>
                {' / '}
                <span className="text-statusRed font-mono font-bold">{closedSummary.losing_trades_count} Perdedoras</span>
              </span>
            </div>
          </div>
        )}

        {/* CONTENIDO PESTAÑA: POSICIONES ABIERTAS */}
        {activeTab === 'OPEN' && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            {trades.length === 0 ? (
              <div className="py-12 text-center text-textSecondary space-y-2 font-sans">
                <p className="text-sm">No tienes compras activas registradas en la base de datos.</p>
                <p className="text-xs text-textSecondary/70">
                  Usa el botón "+ Añadir" en la columna de cartera para registrar compras reales en euros.
                </p>
              </div>
            ) : (
              trades.map((trade) => {
                const cSym = trade.currency === 'EUR' ? '€' : '$';
                const totalCost = trade.shares * trade.buy_price;
                const isDeleting = deletingId === trade.id;

                return (
                  <div
                    key={trade.id}
                    className="p-3.5 rounded-xl bg-canvas border border-borderSubtle hover:border-borderMedium flex items-center justify-between transition gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-textPrimary">{trade.ticker}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cardSecondary text-textSecondary border border-borderSubtle font-mono">
                          {trade.currency}
                        </span>
                        <span className="text-xs text-textSecondary truncate max-w-[220px]">
                          {trade.company_name}
                        </span>
                      </div>

                      <div className="flex items-center flex-wrap gap-2 text-[11px] text-textSecondary font-mono">
                        <span className="text-textPrimary font-bold">
                          {trade.shares % 1 === 0 ? trade.shares : trade.shares.toFixed(4)} acc.
                        </span>
                        <span>a {cSym}{trade.buy_price.toFixed(2)}</span>
                        <span className="text-accentSky font-bold">
                          = {cSym}{totalCost.toFixed(2)}
                        </span>
                        {trade.fees > 0 && <span>(Comisión: {cSym}{trade.fees.toFixed(2)})</span>}
                        {trade.target_exit_price && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/25 text-[10px] flex items-center space-x-1">
                            <Target className="w-3 h-3" />
                            <span>Salida: {cSym}{trade.target_exit_price.toFixed(2)}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-[10px] text-textSecondary/80">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{trade.execution_date}</span>
                        </span>
                        {trade.notes && (
                          <span className="flex items-center space-x-1 truncate max-w-[280px]">
                            <FileText className="w-3 h-3 text-accentYellow" />
                            <span>{trade.notes}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {/* Botón Modificar / Editar */}
                      <button
                        onClick={() => openEditModal(trade)}
                        className="px-2 py-1.5 rounded-lg bg-cardSecondary hover:bg-cardHover text-textSecondary hover:text-textPrimary border border-borderSubtle transition text-xs font-semibold flex items-center space-x-1"
                        title="Modificar cualquier dato de esta compra sin perder su registro"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-accentSky" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>

                      {/* Botón Liquidar / Cerrar Compra */}
                      <button
                        onClick={() => openLiquidationModal(trade)}
                        className="px-2.5 py-1.5 rounded-lg bg-statusGreen/15 text-statusGreen hover:bg-statusGreen/25 border border-statusGreen/30 transition text-xs font-semibold flex items-center space-x-1"
                        title="Liquidar o vender esta operación para guardarla en el histórico con su P&L real"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Cerrar</span>
                      </button>

                      {/* Botón Eliminar / Purgar de BBDD */}
                      <button
                        onClick={() => handleDelete(trade.id)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg bg-statusRed/10 text-statusRed hover:bg-statusRed/20 border border-statusRed/30 transition disabled:opacity-50"
                        title="Borrar completamente (ideal para compras de prueba o erróneas)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* CONTENIDO PESTAÑA: POSICIONES CERRADAS / HISTÓRICO */}
        {activeTab === 'CLOSED' && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
            {closedTrades.length === 0 ? (
              <div className="py-12 text-center text-textSecondary space-y-2 font-sans">
                <p className="text-sm">No tienes operaciones liquidadas en el histórico.</p>
                <p className="text-xs text-textSecondary/70">
                  Cuando vendas una posición abierta, pulsa "Cerrar" para archivarla aquí con su ganancia/pérdida neta.
                </p>
              </div>
            ) : (
              closedTrades.map((trade) => {
                const cSym = trade.currency === 'EUR' ? '€' : '$';
                const pnl = trade.realized_pnl ?? 0;
                const roi = trade.realized_roi_pct ?? 0;
                const isWinning = pnl >= 0;
                const isReopening = reopeningId === trade.id;
                const isDeleting = deletingId === trade.id;

                return (
                  <div
                    key={trade.id}
                    className="p-3.5 rounded-xl bg-canvas border border-borderSubtle hover:border-borderMedium flex items-center justify-between transition gap-3"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-textPrimary">{trade.ticker}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cardSecondary text-textSecondary border border-borderSubtle font-mono">
                          {trade.currency}
                        </span>
                        <span className="text-xs text-textSecondary truncate max-w-[200px]">
                          {trade.company_name}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold flex items-center space-x-1 ${
                            isWinning
                              ? 'bg-statusGreen/15 text-statusGreen border border-statusGreen/30'
                              : 'bg-statusRed/15 text-statusRed border border-statusRed/30'
                          }`}
                        >
                          {isWinning ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>
                            {isWinning ? '+' : ''}
                            {pnl.toFixed(2)} {cSym} ({isWinning ? '+' : ''}{roi.toFixed(2)}%)
                          </span>
                        </span>
                        {trade.currency === 'USD' && trade.realized_pnl_eur !== undefined && (
                          <span className="text-[10px] text-textSecondary font-mono">
                            ≈ {trade.realized_pnl_eur >= 0 ? '+' : ''}
                            {trade.realized_pnl_eur.toFixed(2)} €
                          </span>
                        )}
                      </div>

                      {/* Detalles de compra y venta */}
                      <div className="flex items-center space-x-4 text-[11px] text-textSecondary font-mono">
                        <span>
                          {trade.shares % 1 === 0 ? trade.shares : trade.shares.toFixed(4)} acc.
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="text-textSecondary/70">Compra:</span>
                          <span className="text-textPrimary">{cSym}{trade.buy_price.toFixed(2)}</span>
                          <span className="text-[10px] text-textSecondary/60">({trade.execution_date})</span>
                        </span>
                        <ArrowRight className="w-3 h-3 text-textSecondary/40" />
                        <span className="flex items-center space-x-1">
                          <span className="text-textSecondary/70">Venta:</span>
                          <span className="text-accentSky font-bold">{cSym}{(trade.sell_price || 0).toFixed(2)}</span>
                          <span className="text-[10px] text-textSecondary/60">({trade.sell_date || '-'})</span>
                        </span>
                      </div>

                      {/* Notas de cierre */}
                      {(trade.closing_notes || trade.notes) && (
                        <div className="text-[10px] text-textSecondary/80 flex items-center space-x-2">
                          <FileText className="w-3 h-3 text-accentYellow flex-shrink-0" />
                          <span className="italic truncate max-w-[450px]">
                            {trade.closing_notes ? `Cierre: ${trade.closing_notes}` : trade.notes}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {/* Botón Modificar / Editar */}
                      <button
                        onClick={() => openEditModal(trade)}
                        className="px-2 py-1.5 rounded-lg bg-cardSecondary hover:bg-cardHover text-textSecondary hover:text-textPrimary border border-borderSubtle transition text-xs font-semibold flex items-center space-x-1"
                        title="Modificar datos de esta operación"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-accentSky" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>

                      {/* Botón Reabrir Operación */}
                      <button
                        onClick={() => handleReopen(trade.id)}
                        disabled={isReopening}
                        className="px-2.5 py-1.5 rounded-lg bg-accentSky/15 text-accentSky hover:bg-accentSky/25 border border-accentSky/30 transition text-xs font-semibold flex items-center space-x-1 disabled:opacity-50"
                        title="Reabrir esta posición y devolverla a la cartera activa"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reabrir</span>
                      </button>

                      {/* Botón Eliminar de BBDD */}
                      <button
                        onClick={() => handleDelete(trade.id)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg bg-statusRed/10 text-statusRed hover:bg-statusRed/20 border border-statusRed/30 transition disabled:opacity-50"
                        title="Eliminar registro histórico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-borderSubtle flex items-center justify-between text-xs font-sans">
          <span className="text-[11px] text-textSecondary">
            {activeTab === 'OPEN'
              ? 'Puedes modificar, liquidar o eliminar operaciones directamente.'
              : 'El histórico cerrado conserva tus operaciones pasadas para consulta fiscal o de rendimiento.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-cardSecondary text-textPrimary hover:bg-cardHover transition font-semibold"
          >
            Cerrar
          </button>
        </div>

        {/* SUBMODAL / DIÁLOGO DE MODIFICACIÓN DE OPERACIÓN */}
        {editingTrade && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md rounded-2xl flex items-center justify-center p-4 z-20 animate-fadeIn">
            <form
              onSubmit={handleSaveEdit}
              className="bg-card border border-borderMedium w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-3.5 max-h-[88vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-borderSubtle pb-2.5">
                <div>
                  <h4 className="text-sm font-bold text-textPrimary flex items-center space-x-1.5">
                    <Edit3 className="w-4 h-4 text-accentSky" />
                    <span>Modificar Compra #{editingTrade.id}: {editTicker}</span>
                  </h4>
                  <p className="text-[11px] text-textSecondary">
                    Corrige cualquier dato informado erróneamente sin perder el histórico
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTrade(null)}
                  className="text-textSecondary hover:text-textPrimary p-1 rounded-lg hover:bg-cardSecondary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selector de modo para cálculo de acciones */}
              <div className="p-1 rounded-xl bg-canvas border border-borderSubtle grid grid-cols-2 gap-1 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setEditMode('AMOUNT')}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center space-x-1 transition ${
                    editMode === 'AMOUNT'
                      ? 'bg-accentSky text-canvas shadow font-bold'
                      : 'text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  <Calculator className="w-3 h-3" />
                  <span>Por Importe Invertido ({editCurrency === 'EUR' ? '€' : '$'})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode('SHARES')}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center space-x-1 transition ${
                    editMode === 'SHARES'
                      ? 'bg-accentSky text-canvas shadow font-bold'
                      : 'text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  <span>Por Nº de Acciones</span>
                </button>
              </div>

              {/* Campos Principales */}
              <div className="space-y-3 text-xs">
                {/* Ticker y Divisa */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                      Ticker *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={editTicker}
                        onChange={(e) => setEditTicker(e.target.value.toUpperCase())}
                        required
                        className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-accentSky font-mono font-bold uppercase text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleFetchEditQuote}
                        disabled={isLoadingEditQuote}
                        className="absolute right-1.5 top-1.5 p-1 rounded hover:bg-cardSecondary text-textSecondary hover:text-accentSky"
                        title="Consultar cotización actual del mercado"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEditQuote ? 'animate-spin text-accentSky' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                      Divisa de Compra *
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditCurrency('EUR')}
                        className={`py-1.5 rounded-lg font-bold border transition text-xs ${
                          editCurrency === 'EUR'
                            ? 'bg-accentSky/20 border-accentSky text-accentSky shadow-sm'
                            : 'bg-canvas border-borderSubtle text-textSecondary'
                        }`}
                      >
                        EUR (€)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditCurrency('USD')}
                        className={`py-1.5 rounded-lg font-bold border transition text-xs ${
                          editCurrency === 'USD'
                            ? 'bg-accentSky/20 border-accentSky text-accentSky shadow-sm'
                            : 'bg-canvas border-borderSubtle text-textSecondary'
                        }`}
                      >
                        USD ($)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Nombre de la Empresa */}
                <div>
                  <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                    Nombre de la Empresa
                  </label>
                  <input
                    type="text"
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-accentSky text-xs"
                  />
                </div>

                {/* Importe, Precio y Acciones */}
                <div className="grid grid-cols-3 gap-2.5 p-2.5 rounded-xl bg-canvas border border-borderSubtle">
                  <div>
                    <label className="block text-[10px] font-semibold text-textSecondary mb-1">
                      Importe ({editCurrency === 'EUR' ? '€' : '$'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full bg-card border border-borderMedium rounded-lg px-2 py-1.5 text-textPrimary font-mono font-bold text-xs focus:border-accentSky outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-textSecondary mb-1">
                      Precio Acción ({editCurrency === 'EUR' ? '€' : '$'}) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={editBuyPrice}
                      onChange={(e) => setEditBuyPrice(e.target.value)}
                      required
                      className="w-full bg-card border border-borderMedium rounded-lg px-2 py-1.5 text-textPrimary font-mono font-bold text-xs focus:border-accentSky outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-textSecondary mb-1">
                      Nº Acciones *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={editShares}
                      onChange={(e) => setEditShares(e.target.value)}
                      required
                      className="w-full bg-card border border-borderMedium rounded-lg px-2 py-1.5 text-textPrimary font-mono font-bold text-xs focus:border-accentSky outline-none"
                    />
                  </div>
                </div>

                {/* Fecha y Comisiones de Compra */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                      Fecha de Compra
                    </label>
                    <input
                      type="date"
                      value={editExecutionDate}
                      onChange={(e) => setEditExecutionDate(e.target.value)}
                      className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-accentSky text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                      Comisiones ({editCurrency === 'EUR' ? '€' : '$'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editFees}
                      onChange={(e) => setEditFees(e.target.value)}
                      className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-accentSky text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Precio Objetivo de Salida (Venta) */}
                <div className="p-3 rounded-xl bg-canvas border border-emerald-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-emerald-400 flex items-center space-x-1.5">
                      <Target className="w-3.5 h-3.5" />
                      <span>Precio Objetivo de Salida / Venta ({editCurrency === 'EUR' ? '€' : '$'})</span>
                    </label>
                    {(editFairValue || editingTrade?.fair_value) && (
                      <button
                        type="button"
                        onClick={() => {
                          const fv = editFairValue || editingTrade?.fair_value;
                          if (fv) setEditTargetExitPrice(fv.toFixed(2));
                        }}
                        className="text-[10px] text-accentSky hover:text-accentSky/80 font-mono underline"
                        title="Fijar precio objetivo en el Valor Intrínseco Justo calculado por el motor fundamental"
                      >
                        Cargar Fair Value ({editCurrency === 'EUR' ? '€' : '$'}{(editFairValue || editingTrade?.fair_value)?.toFixed(2)})
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editTargetExitPrice}
                      onChange={(e) => setEditTargetExitPrice(e.target.value)}
                      className="w-full bg-card border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-emerald-500 text-xs font-mono"
                      placeholder="0.00"
                    />
                    <input
                      type="text"
                      value={editTargetExitNotes}
                      onChange={(e) => setEditTargetExitNotes(e.target.value)}
                      className="w-full bg-card border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-emerald-500 text-xs"
                      placeholder="Motivo de salida (opcional)"
                    />
                  </div>
                  <p className="text-[10px] text-textSecondary">
                    Por defecto: objetivo de salida prudente acotado bajo la resistencia de 52 semanas.
                  </p>
                </div>

                {/* Notas de Compra */}
                <div>
                  <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                    Notas o Motivo de la Compra
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-accentSky text-xs"
                    placeholder="Ej. Entrada escalonada, inversión mensual, etc."
                  />
                </div>

                {/* Campos Adicionales si la posición está CERRADA */}
                {editingTrade.status === 'CLOSED' && (
                  <div className="p-3 rounded-xl bg-statusGreen/5 border border-statusGreen/20 space-y-2.5">
                    <span className="text-[11px] font-bold text-statusGreen block">
                      Datos de Cierre / Liquidación Histórica
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-textSecondary mb-1">Precio Venta</label>
                        <input
                          type="number"
                          step="any"
                          value={editSellPrice}
                          onChange={(e) => setEditSellPrice(e.target.value)}
                          className="w-full bg-canvas border border-borderMedium rounded-lg px-2 py-1 text-textPrimary font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-textSecondary mb-1">Fecha Venta</label>
                        <input
                          type="date"
                          value={editSellDate}
                          onChange={(e) => setEditSellDate(e.target.value)}
                          className="w-full bg-canvas border border-borderMedium rounded-lg px-2 py-1 text-textPrimary font-mono text-[10px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-textSecondary mb-1">Comisión Venta</label>
                        <input
                          type="number"
                          step="any"
                          value={editSellFees}
                          onChange={(e) => setEditSellFees(e.target.value)}
                          className="w-full bg-canvas border border-borderMedium rounded-lg px-2 py-1 text-textPrimary font-mono text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-textSecondary mb-1">Notas de Cierre</label>
                      <input
                        type="text"
                        value={editClosingNotes}
                        onChange={(e) => setEditClosingNotes(e.target.value)}
                        className="w-full bg-canvas border border-borderMedium rounded-lg px-2 py-1 text-textPrimary text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-borderSubtle">
                <button
                  type="button"
                  onClick={() => setEditingTrade(null)}
                  className="px-3 py-2 rounded-xl bg-cardSecondary text-textSecondary hover:text-textPrimary transition text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editTicker || !parseFloat(editShares) || !parseFloat(editBuyPrice)}
                  className="px-4 py-2 rounded-xl bg-accentSky text-canvas font-bold hover:bg-accentSky/90 transition text-xs shadow-lg disabled:opacity-50"
                >
                  {isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SUBMODAL / DIÁLOGO DE LIQUIDACIÓN DE OPERACIÓN */}
        {liquidatingTrade && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md rounded-2xl flex items-center justify-center p-6 z-10 animate-fadeIn">
            <form
              onSubmit={handleConfirmClose}
              className="bg-card border border-borderMedium w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-borderSubtle pb-2.5">
                <div>
                  <h4 className="text-sm font-bold text-textPrimary flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-statusGreen" />
                    <span>Liquidar Posición: {liquidatingTrade.ticker}</span>
                  </h4>
                  <p className="text-[11px] text-textSecondary">
                    {liquidatingTrade.shares % 1 === 0 ? liquidatingTrade.shares : liquidatingTrade.shares.toFixed(4)} acc. compradas a {symLiq}{liquidatingTrade.buy_price.toFixed(2)} ({liquidatingTrade.company_name})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLiquidatingTrade(null)}
                  className="text-textSecondary hover:text-textPrimary p-1 rounded-lg hover:bg-cardSecondary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Inputs de Liquidación */}
              <div className="space-y-3 text-xs">
                {/* Selector Modo de Venta: Total vs Parcial */}
                <div>
                  <label className="block text-[11px] font-semibold text-textSecondary mb-1.5">
                    Modalidad de Liquidación
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-canvas p-1 rounded-xl border border-borderSubtle">
                    <button
                      type="button"
                      onClick={() => {
                        setSellMode('ALL');
                        setSellSharesInput(liquidatingTrade.shares.toString());
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${
                        sellMode === 'ALL'
                          ? 'bg-statusGreen text-black shadow-sm'
                          : 'text-textSecondary hover:text-textPrimary'
                      }`}
                    >
                      Venta Total (100% · {liquidatingTrade.shares} acc)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSellMode('PARTIAL');
                        setSellSharesInput((liquidatingTrade.shares / 2).toString());
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${
                        sellMode === 'PARTIAL'
                          ? 'bg-statusGreen text-black shadow-sm'
                          : 'text-textSecondary hover:text-textPrimary'
                      }`}
                    >
                      Venta Parcial
                    </button>
                  </div>
                </div>

                {/* Si es venta parcial, input de acciones y botones de porcentaje */}
                {sellMode === 'PARTIAL' && (
                  <div className="p-2.5 rounded-xl bg-canvas border border-borderMedium space-y-2 animate-fadeIn">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-semibold text-textPrimary">
                        Acciones a Vender (máx. {liquidatingTrade.shares}):
                      </label>
                      <span className="text-[10px] text-textSecondary font-mono">
                        Quedarán: {remainingShares.toFixed(4)} acc
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      max={liquidatingTrade.shares}
                      value={sellSharesInput}
                      onChange={(e) => setSellSharesInput(e.target.value)}
                      className="w-full bg-card border border-borderMedium rounded-lg px-3 py-1.5 text-textPrimary font-mono text-xs focus:outline-none focus:border-statusGreen"
                      placeholder="Cantidad de acciones"
                    />
                    <div className="flex space-x-1.5">
                      {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setSellSharesInput((liquidatingTrade.shares * pct).toString())}
                          className="flex-1 py-1 rounded bg-cardSecondary hover:bg-borderSubtle text-[10px] font-mono text-textSecondary hover:text-textPrimary transition border border-borderSubtle"
                        >
                          {pct * 100}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Precio de Venta */}
                <div>
                  <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                    Precio de Venta por Acción ({symLiq}) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      min="0.0001"
                      value={sellPriceInput}
                      onChange={(e) => setSellPriceInput(e.target.value)}
                      className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-statusGreen text-sm font-mono"
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-textSecondary font-mono">{symLiq}</span>
                  </div>
                </div>

                {/* Fecha y Comisiones */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                      Fecha de Liquidación
                    </label>
                    <input
                      type="date"
                      value={sellDateInput}
                      onChange={(e) => setSellDateInput(e.target.value)}
                      className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-statusGreen text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                      Comisiones Venta ({symLiq})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={sellFeesInput}
                      onChange={(e) => setSellFeesInput(e.target.value)}
                      className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-statusGreen text-xs font-mono"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Notas de Cierre */}
                <div>
                  <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                    Notas de Cierre / Motivo de Salida (Opcional)
                  </label>
                  <input
                    type="text"
                    value={closingNotesInput}
                    onChange={(e) => setClosingNotesInput(e.target.value)}
                    className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-statusGreen text-xs"
                    placeholder="Ej. Toma de beneficios, cambio de tesis, etc."
                  />
                </div>

                {/* Previsualización en Tiempo Real del Resultado */}
                <div className="p-3 rounded-xl bg-canvas border border-borderSubtle space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-textSecondary">
                    <span>Acciones a Liquidar:</span>
                    <span className="text-textPrimary">{sharesLiq.toFixed(4)} acc</span>
                  </div>
                  {sellMode === 'PARTIAL' && (
                    <div className="flex justify-between text-textSecondary">
                      <span>Restarán en Cartera:</span>
                      <span className="text-accentSky">{remainingShares.toFixed(4)} acc</span>
                    </div>
                  )}
                  <div className="flex justify-between text-textSecondary">
                    <span>Coste Proporcional Compra:</span>
                    <span>{symLiq}{buyCostLiq.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-textSecondary">
                    <span>Importe Neto Venta:</span>
                    <span className="text-textPrimary">{symLiq}{sellProceeds.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-borderSubtle pt-1 font-bold">
                    <span className="font-sans">Resultado Realizado:</span>
                    <span className={previewPnl >= 0 ? 'text-statusGreen' : 'text-statusRed'}>
                      {previewPnl >= 0 ? '+' : ''}{symLiq}{previewPnl.toFixed(2)} ({previewPnl >= 0 ? '+' : ''}{previewRoi.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-borderSubtle">
                <button
                  type="button"
                  onClick={() => setLiquidatingTrade(null)}
                  className="px-3 py-2 rounded-xl bg-cardSecondary text-textSecondary hover:text-textPrimary transition text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClose || !parsedSellPrice || sharesLiq <= 0}
                  className="px-4 py-2 rounded-xl bg-statusGreen text-black font-bold hover:bg-statusGreen/90 transition text-xs shadow-lg disabled:opacity-50"
                >
                  {isSubmittingClose ? 'Guardando...' : 'Confirmar Liquidación'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
