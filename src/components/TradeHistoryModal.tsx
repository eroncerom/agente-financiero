import React, { useState, useEffect, useMemo } from 'react';
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
  Target,
  Filter,
  Clock,
  Plus
} from 'lucide-react';
import { PortfolioTrade, ClosedSummary, Currency } from '../types';
import { calculatePrudentTargetExit } from '../utils/valuation';

export type ClosedTradePeriod = '1Y' | 'YTD' | '6M' | 'ALL' | 'CUSTOM';

interface TradeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: PortfolioTrade[];
  closedTrades?: PortfolioTrade[];
  closedSummary?: ClosedSummary | null;
  initialTab?: 'OPEN' | 'CLOSED';
  initialLiquidateTrade?: PortfolioTrade | null;
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
  onAddDirectClosedTrade?: (data: {
    ticker: string;
    company_name: string;
    currency: Currency;
    shares: number;
    buy_price: number;
    fees?: number;
    execution_date: string;
    sell_price: number;
    sell_date: string;
    sell_fees?: number;
    closing_notes?: string;
  }) => Promise<void>;
}

export const TradeHistoryModal: React.FC<TradeHistoryModalProps> = ({
  isOpen,
  onClose,
  trades,
  closedTrades = [],
  closedSummary: _closedSummary,
  initialTab,
  initialLiquidateTrade,
  onDeleteTrade,
  onCloseTrade,
  onReopenTrade,
  onClearAllTrades,
  onUpdateTrade,
  onAddDirectClosedTrade
}) => {
  const [activeTab, setActiveTab] = useState<'OPEN' | 'CLOSED'>(() => initialTab || 'OPEN');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reopeningId, setReopeningId] = useState<number | null>(null);

  // Filtrado temporal para el histórico cerrado (Por defecto: Último Año)
  const [selectedPeriod, setSelectedPeriod] = useState<ClosedTradePeriod>('1Y');
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customToDate, setCustomToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Modal para registro directo de ventas históricas
  const [isDirectClosedOpen, setIsDirectClosedOpen] = useState(false);
  const [directTicker, setDirectTicker] = useState('');
  const [directCompanyName, setDirectCompanyName] = useState('');
  const [directCurrency, setDirectCurrency] = useState<Currency>('EUR');
  const [directShares, setDirectShares] = useState('');
  const [directBuyPrice, setDirectBuyPrice] = useState('');
  const [directBuyFees, setDirectBuyFees] = useState('0');
  const [directBuyDate, setDirectBuyDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [directSellPrice, setDirectSellPrice] = useState('');
  const [directSellFees, setDirectSellFees] = useState('0');
  const [directSellDate, setDirectSellDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [directNotes, setDirectNotes] = useState('');
  const [isSavingDirect, setIsSavingDirect] = useState(false);
  const [isLoadingDirectQuote, setIsLoadingDirectQuote] = useState(false);

  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (initialLiquidateTrade && isOpen) {
      setLiquidatingTrade(initialLiquidateTrade);
      setSellMode('ALL');
      setSellSharesInput(initialLiquidateTrade.shares.toString());
      setSellPriceInput(initialLiquidateTrade.market_price ? initialLiquidateTrade.market_price.toString() : initialLiquidateTrade.buy_price.toString());
      setSellDateInput(new Date().toISOString().split('T')[0]);
      setSellFeesInput('0');
      setClosingNotesInput('');
    }
  }, [initialLiquidateTrade, isOpen]);
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
        : calculatePrudentTargetExit(trade.buy_price, trade.fifty_two_week_high, trade.fair_value)
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
            const prudent = data.target_exit_price
              ? Number(data.target_exit_price).toFixed(2)
              : calculatePrudentTargetExit(data.price || parseFloat(editBuyPrice), data.fifty_two_week_high, data.fair_value);
            if (prudent) setEditTargetExitPrice(prudent);
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

  // Helper para verificar si una fecha cae en el periodo seleccionado (Por defecto: Último Año)
  const isDateInPeriod = (dateStr?: string) => {
    if (!dateStr) return true;
    const tradeDate = new Date(dateStr + 'T00:00:00');
    if (isNaN(tradeDate.getTime())) return true;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (selectedPeriod === '1Y') {
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      oneYearAgo.setHours(0, 0, 0, 0);
      return tradeDate >= oneYearAgo && tradeDate <= today;
    }
    if (selectedPeriod === 'YTD') {
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return tradeDate >= startOfYear && tradeDate <= today;
    }
    if (selectedPeriod === '6M') {
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setHours(0, 0, 0, 0);
      return tradeDate >= sixMonthsAgo && tradeDate <= today;
    }
    if (selectedPeriod === 'CUSTOM') {
      if (customFromDate) {
        const start = new Date(customFromDate + 'T00:00:00');
        if (tradeDate < start) return false;
      }
      if (customToDate) {
        const end = new Date(customToDate + 'T23:59:59');
        if (tradeDate > end) return false;
      }
      return true;
    }
    // 'ALL'
    return true;
  };

  // Filtrado y ordenación cronológica inversa de posiciones cerradas
  const filteredClosedTrades = useMemo(() => {
    return closedTrades
      .filter((t) => isDateInPeriod(t.sell_date || t.execution_date))
      .sort((a, b) => {
        const dateA = a.sell_date || a.execution_date || '';
        const dateB = b.sell_date || b.execution_date || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return b.id - a.id;
      });
  }, [closedTrades, selectedPeriod, customFromDate, customToDate]);

  // Métricas financieras calculadas para el periodo seleccionado
  const periodMetrics = useMemo(() => {
    let totalPnlEur = 0;
    let totalInvestedEur = 0;
    let totalProceedsEur = 0;
    let totalFeesEur = 0;
    let winningCount = 0;
    let losingCount = 0;

    for (const t of filteredClosedTrades) {
      const rateToEur = t.currency === 'USD' ? (t.realized_pnl && t.realized_pnl_eur ? t.realized_pnl_eur / t.realized_pnl : 0.92) : 1;
      const pnlEur = t.realized_pnl_eur != null ? t.realized_pnl_eur : ((t.realized_pnl || 0) * rateToEur);
      const investedEur = ((t.shares * t.buy_price) + (t.fees || 0)) * rateToEur;
      const proceedsEur = ((t.shares * (t.sell_price || t.buy_price)) - (t.sell_fees || 0)) * rateToEur;
      const feesEur = ((t.fees || 0) + (t.sell_fees || 0)) * rateToEur;

      totalPnlEur += pnlEur;
      totalInvestedEur += investedEur;
      totalProceedsEur += proceedsEur;
      totalFeesEur += feesEur;

      if ((t.realized_pnl || 0) >= 0) {
        winningCount++;
      } else {
        losingCount++;
      }
    }

    const roiPct = totalInvestedEur > 0 ? (totalPnlEur / totalInvestedEur) * 100 : 0;
    const totalCount = filteredClosedTrades.length;
    const winRatePct = totalCount > 0 ? (winningCount / totalCount) * 100 : 0;

    return {
      totalPnlEur: Number(totalPnlEur.toFixed(2)),
      totalInvestedEur: Number(totalInvestedEur.toFixed(2)),
      totalProceedsEur: Number(totalProceedsEur.toFixed(2)),
      totalFeesEur: Number(totalFeesEur.toFixed(2)),
      roiPct: Number(roiPct.toFixed(2)),
      winningCount,
      losingCount,
      totalCount,
      winRatePct: Number(winRatePct.toFixed(1))
    };
  }, [filteredClosedTrades]);

  // Cálculo de permanencia en cartera (Holding Period)
  const calculateHoldingDays = (buyDate?: string, sellDate?: string) => {
    if (!buyDate || !sellDate) return null;
    const start = new Date(buyDate).getTime();
    const end = new Date(sellDate).getTime();
    if (isNaN(start) || isNaN(end)) return null;
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Mismo día';
    if (diffDays === 1) return '1 día';
    if (diffDays < 30) return `${diffDays} días`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      const days = diffDays % 30;
      return `${months}m ${days}d (${diffDays}d)`;
    }
    const years = (diffDays / 365).toFixed(1);
    return `${years} años (${diffDays}d)`;
  };

  const getPeriodLabel = (period: ClosedTradePeriod) => {
    switch (period) {
      case '1Y': return 'Último Año (12 meses)';
      case 'YTD': return 'Año Actual (YTD)';
      case '6M': return 'Últimos 6 Meses';
      case 'ALL': return 'Histórico Completo';
      case 'CUSTOM': return `Del ${customFromDate} al ${customToDate}`;
    }
  };

  // Manejo de consulta de ticker en modal directo
  const handleFetchDirectQuote = async () => {
    if (!directTicker.trim()) return;
    try {
      setIsLoadingDirectQuote(true);
      const res = await fetch(`/api/quote/${encodeURIComponent(directTicker.trim().toUpperCase())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.name) setDirectCompanyName(data.name);
        if (data.price) {
          if (!directSellPrice) setDirectSellPrice(data.price.toString());
          if (!directBuyPrice) setDirectBuyPrice(data.price.toString());
          if (data.currency) setDirectCurrency(data.currency as Currency);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingDirectQuote(false);
    }
  };

  // Guardar registro directo de venta histórica
  const handleSaveDirectClosedTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddDirectClosedTrade) return;

    const sharesNum = parseFloat(directShares);
    const buyPriceNum = parseFloat(directBuyPrice);
    const sellPriceNum = parseFloat(directSellPrice);
    const buyFeesNum = parseFloat(directBuyFees || '0');
    const sellFeesNum = parseFloat(directSellFees || '0');

    if (!directTicker.trim() || isNaN(sharesNum) || sharesNum <= 0 || isNaN(buyPriceNum) || buyPriceNum <= 0 || isNaN(sellPriceNum) || sellPriceNum <= 0) {
      return;
    }

    try {
      setIsSavingDirect(true);
      await onAddDirectClosedTrade({
        ticker: directTicker.trim().toUpperCase(),
        company_name: directCompanyName.trim() || directTicker.trim().toUpperCase(),
        currency: directCurrency,
        shares: sharesNum,
        buy_price: buyPriceNum,
        fees: buyFeesNum,
        execution_date: directBuyDate,
        sell_price: sellPriceNum,
        sell_date: directSellDate,
        sell_fees: sellFeesNum,
        closing_notes: directNotes.trim() || 'Venta histórica registrada'
      });
      setIsDirectClosedOpen(false);
      setDirectTicker('');
      setDirectCompanyName('');
      setDirectShares('');
      setDirectBuyPrice('');
      setDirectSellPrice('');
      setDirectNotes('');
    } catch (err) {
      console.error('Error al guardar venta directa:', err);
    } finally {
      setIsSavingDirect(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-card border border-borderMedium w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col relative">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-borderSubtle pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-accentSky/10 border border-accentSky/20 text-accentSky">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-textPrimary">Movimientos de Cartera y Registro de Ventas</h3>
              <p className="text-[11px] text-textSecondary">
                Registro persistente de compras, liquidaciones y ganancias/pérdidas en base de datos local SQLite
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
                ? 'bg-accentSky/15 text-accentSky border border-accentSky/30 shadow-sm'
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
                ? 'bg-statusGreen/15 text-statusGreen border border-statusGreen/30 shadow-sm'
                : 'text-textSecondary hover:text-textPrimary hover:bg-cardSecondary'
            }`}
          >
            <span>Histórico de Ventas y Rendimiento</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {closedTrades.length}
            </span>
          </button>
        </div>

        {/* Panel Superior de Filtro Temporal y KPIs en Pestaña CLOSED */}
        {activeTab === 'CLOSED' && (
          <div className="space-y-3">
            {/* Barra de Filtro de Periodo */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-canvas border border-borderSubtle">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-textSecondary flex items-center space-x-1 mr-1">
                  <Filter className="w-3.5 h-3.5 text-accentSky" />
                  <span>Periodo:</span>
                </span>

                {[
                  { key: '1Y', label: 'Último Año (12M)', isDefault: true },
                  { key: 'YTD', label: 'Año en Curso (YTD)' },
                  { key: '6M', label: 'Últimos 6M' },
                  { key: 'ALL', label: 'Histórico Completo' },
                  { key: 'CUSTOM', label: 'Personalizado' },
                ].map((item) => {
                  const isActive = selectedPeriod === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedPeriod(item.key as ClosedTradePeriod)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                        isActive
                          ? 'bg-statusGreen text-canvas shadow-sm font-bold'
                          : 'bg-cardSecondary hover:bg-cardHover text-textSecondary hover:text-textPrimary border border-borderSubtle'
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.isDefault && (
                        <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isActive ? 'bg-black/20 text-canvas' : 'bg-statusGreen/15 text-statusGreen'}`}>
                          Por defecto
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {onAddDirectClosedTrade && (
                <button
                  type="button"
                  onClick={() => setIsDirectClosedOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-accentSky/15 text-accentSky hover:bg-accentSky/25 border border-accentSky/30 transition text-xs font-bold flex items-center space-x-1 shadow-sm"
                  title="Registrar una venta ya ejecutada en tu broker para archivarlo con fecha y P&L"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Registrar Venta Histórica</span>
                </button>
              )}
            </div>

            {/* Inputs de Fecha Personalizada */}
            {selectedPeriod === 'CUSTOM' && (
              <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-cardSecondary/60 border border-borderSubtle text-xs animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-textSecondary font-medium">Desde:</span>
                  <input
                    type="date"
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="px-2.5 py-1 bg-canvas border border-borderMedium rounded-lg text-xs text-textPrimary focus:outline-none focus:border-accentSky font-mono"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-textSecondary font-medium">Hasta:</span>
                  <input
                    type="date"
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="px-2.5 py-1 bg-canvas border border-borderMedium rounded-lg text-xs text-textPrimary focus:outline-none focus:border-accentSky font-mono"
                  />
                </div>
                <span className="text-[10px] text-textSecondary/70 italic">
                  Mostrando ventas liquidadas entre ambas fechas
                </span>
              </div>
            )}

            {/* Resumen de KPIs Financieros del Periodo */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-canvas border border-borderSubtle text-xs">
              <div>
                <span className="text-[10px] text-textSecondary uppercase font-medium block">P&L Realizado Periodo</span>
                <span
                  className={`text-sm font-bold font-mono flex items-center space-x-1 ${
                    periodMetrics.totalPnlEur >= 0 ? 'text-statusGreen' : 'text-statusRed'
                  }`}
                >
                  {periodMetrics.totalPnlEur >= 0 ? <TrendingUp className="w-3.5 h-3.5 inline" /> : <TrendingDown className="w-3.5 h-3.5 inline" />}
                  <span>
                    {periodMetrics.totalPnlEur >= 0 ? '+' : ''}
                    {periodMetrics.totalPnlEur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </span>
                </span>
              </div>

              <div>
                <span className="text-[10px] text-textSecondary uppercase font-medium block">ROI Ponderado Periodo</span>
                <span
                  className={`text-sm font-bold font-mono ${
                    periodMetrics.roiPct >= 0 ? 'text-statusGreen' : 'text-statusRed'
                  }`}
                >
                  {periodMetrics.roiPct >= 0 ? '+' : ''}
                  {periodMetrics.roiPct.toFixed(2)}%
                </span>
              </div>

              <div>
                <span className="text-[10px] text-textSecondary uppercase font-medium block">Tasa de Acierto (Win Rate)</span>
                <span className="text-xs font-semibold text-textPrimary block font-mono">
                  <span className="text-statusGreen font-bold">{periodMetrics.winningCount}G</span>
                  {' / '}
                  <span className="text-statusRed font-bold">{periodMetrics.losingCount}P</span>
                  <span className="text-[10px] text-textSecondary ml-1">({periodMetrics.winRatePct}%)</span>
                </span>
              </div>

              <div>
                <span className="text-[10px] text-textSecondary uppercase font-medium block">Comisiones Periodo</span>
                <span className="text-xs font-mono font-bold text-textPrimary">
                  {periodMetrics.totalFeesEur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </span>
              </div>

              <div>
                <span className="text-[10px] text-textSecondary uppercase font-medium block">Capital Recuperado</span>
                <span className="text-xs font-mono font-bold text-accentSky">
                  {periodMetrics.totalProceedsEur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </span>
              </div>
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
            {filteredClosedTrades.length === 0 ? (
              <div className="py-12 text-center text-textSecondary space-y-2.5 font-sans">
                <div className="w-12 h-12 rounded-2xl bg-cardSecondary border border-borderSubtle flex items-center justify-center mx-auto text-textSecondary">
                  <Calendar className="w-6 h-6 text-accentSky/70" />
                </div>
                <p className="text-sm font-semibold text-textPrimary">
                  No hay ventas registradas en el periodo: <span className="text-accentSky">{getPeriodLabel(selectedPeriod)}</span>
                </p>
                <p className="text-xs text-textSecondary/70 max-w-md mx-auto">
                  {closedTrades.length > 0
                    ? `Tienes ${closedTrades.length} ventas en otros periodos. Prueba a seleccionar "Histórico Completo" para verlas todas.`
                    : 'Cuando vendas una posición abierta o añadas una venta histórica con el botón superior, aparecerá registrada aquí con su ganancia/pérdida neta.'}
                </p>
                {closedTrades.length > 0 && selectedPeriod !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod('ALL')}
                    className="mt-1 px-3 py-1.5 rounded-lg bg-cardSecondary hover:bg-cardHover text-accentSky font-bold text-xs border border-borderSubtle transition"
                  >
                    Ver Todo el Histórico ({closedTrades.length} ventas)
                  </button>
                )}
              </div>
            ) : (
              filteredClosedTrades.map((trade) => {
                const cSym = trade.currency === 'EUR' ? '€' : '$';
                const pnl = trade.realized_pnl ?? 0;
                const roi = trade.realized_roi_pct ?? 0;
                const isWinning = pnl >= 0;
                const isReopening = reopeningId === trade.id;
                const isDeleting = deletingId === trade.id;
                const holdingDays = calculateHoldingDays(trade.execution_date, trade.sell_date);

                return (
                  <div
                    key={trade.id}
                    className="p-3.5 rounded-xl bg-canvas border border-borderSubtle hover:border-borderMedium flex items-center justify-between transition gap-3"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-sm font-bold text-textPrimary">{trade.ticker}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cardSecondary text-textSecondary border border-borderSubtle font-mono">
                          {trade.currency}
                        </span>
                        <span className="text-xs text-textSecondary truncate max-w-[200px]">
                          {trade.company_name}
                        </span>

                        {holdingDays && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-md bg-cardSecondary text-textSecondary border border-borderSubtle font-mono flex items-center space-x-1"
                            title="Tiempo transcurrido entre la compra y la venta (Holding Period)"
                          >
                            <Clock className="w-3 h-3 text-accentSky" />
                            <span>{holdingDays}</span>
                          </span>
                        )}

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
                      <div className="flex items-center space-x-4 text-[11px] text-textSecondary font-mono flex-wrap gap-y-1">
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
                        {(trade.sell_fees || 0) > 0 && (
                          <span className="text-[10px] text-textSecondary/70">
                            (Comisión vta: {cSym}{(trade.sell_fees || 0).toFixed(2)})
                          </span>
                        )}
                      </div>

                      {/* Notas de cierre */}
                      {(trade.closing_notes || trade.notes) && (
                        <div className="text-[10px] text-textSecondary/80 flex items-center space-x-2">
                          <FileText className="w-3 h-3 text-accentYellow flex-shrink-0" />
                          <span className="italic truncate max-w-[480px]">
                            {trade.closing_notes ? `Venta: ${trade.closing_notes}` : trade.notes}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      {/* Botón Modificar / Editar */}
                      <button
                        onClick={() => openEditModal(trade)}
                        className="px-2 py-1.5 rounded-lg bg-cardSecondary hover:bg-cardHover text-textSecondary hover:text-textPrimary border border-borderSubtle transition text-xs font-semibold flex items-center space-x-1"
                        title="Modificar fecha, precio o notas de esta operación"
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
                    {(() => {
                      const prudentEdit = calculatePrudentTargetExit(
                        parseFloat(editBuyPrice) || editingTrade?.buy_price,
                        editingTrade?.fifty_two_week_high,
                        editFairValue || editingTrade?.fair_value
                      );
                      return prudentEdit ? (
                        <button
                          type="button"
                          onClick={() => setEditTargetExitPrice(prudentEdit)}
                          className="text-[10px] text-accentSky hover:text-accentSky/80 font-mono underline"
                          title="Fijar precio objetivo en la salida táctica prudente acotada bajo la resistencia de 52 semanas"
                        >
                          Salida Prudente ({editCurrency === 'EUR' ? '€' : '$'}{prudentEdit})
                        </button>
                      ) : null;
                    })()}
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

        {/* SUBMODAL / DIÁLOGO DE REGISTRO DIRECTO DE VENTA HISTÓRICA */}
        {isDirectClosedOpen && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md rounded-2xl flex items-center justify-center p-4 z-30 animate-fadeIn">
            <form
              onSubmit={handleSaveDirectClosedTrade}
              className="bg-card border border-borderMedium w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-borderSubtle pb-2.5">
                <div>
                  <h4 className="text-sm font-bold text-textPrimary flex items-center space-x-1.5">
                    <Plus className="w-4 h-4 text-accentSky" />
                    <span>Registrar Venta Histórica Directa</span>
                  </h4>
                  <p className="text-[11px] text-textSecondary">
                    Guarda una operación ya cerrada en tu broker con su fecha y resultado fiscal
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDirectClosedOpen(false)}
                  className="text-textSecondary hover:text-textPrimary p-1 rounded-lg hover:bg-cardSecondary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

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
                        value={directTicker}
                        onChange={(e) => setDirectTicker(e.target.value.toUpperCase())}
                        required
                        placeholder="Ej. AAPL, ASML, SAN.MC"
                        className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-accentSky font-mono font-bold uppercase text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleFetchDirectQuote}
                        disabled={isLoadingDirectQuote}
                        className="absolute right-1.5 top-1.5 p-1 rounded hover:bg-cardSecondary text-textSecondary hover:text-accentSky"
                        title="Buscar cotización"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDirectQuote ? 'animate-spin text-accentSky' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                      Divisa *
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDirectCurrency('EUR')}
                        className={`py-1.5 rounded-lg font-bold border transition text-xs ${
                          directCurrency === 'EUR'
                            ? 'bg-accentSky/20 border-accentSky text-accentSky shadow-sm'
                            : 'bg-canvas border-borderSubtle text-textSecondary'
                        }`}
                      >
                        EUR (€)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDirectCurrency('USD')}
                        className={`py-1.5 rounded-lg font-bold border transition text-xs ${
                          directCurrency === 'USD'
                            ? 'bg-accentSky/20 border-accentSky text-accentSky shadow-sm'
                            : 'bg-canvas border-borderSubtle text-textSecondary'
                        }`}
                      >
                        USD ($)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Nombre de la Empresa y Acciones */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                      Nombre de Empresa
                    </label>
                    <input
                      type="text"
                      value={directCompanyName}
                      onChange={(e) => setDirectCompanyName(e.target.value)}
                      placeholder="Ej. Apple Inc."
                      className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-accentSky text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                      Nº Acciones *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      required
                      value={directShares}
                      onChange={(e) => setDirectShares(e.target.value)}
                      placeholder="Ej. 10"
                      className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-accentSky font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Datos de Compra */}
                <div className="p-3 rounded-xl bg-canvas border border-borderSubtle space-y-2.5">
                  <span className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block">
                    1. Datos de la Compra Original
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-textSecondary mb-0.5">Precio Compra ({directCurrency === 'EUR' ? '€' : '$'}) *</label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        value={directBuyPrice}
                        onChange={(e) => setDirectBuyPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-card border border-borderMedium rounded-lg px-2.5 py-1.5 text-textPrimary font-mono text-xs focus:outline-none focus:border-accentSky"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-textSecondary mb-0.5">Fecha Compra *</label>
                      <input
                        type="date"
                        required
                        value={directBuyDate}
                        onChange={(e) => setDirectBuyDate(e.target.value)}
                        className="w-full bg-card border border-borderMedium rounded-lg px-2.5 py-1.5 text-textPrimary font-mono text-xs focus:outline-none focus:border-accentSky"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-textSecondary mb-0.5">Comisión Compra</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={directBuyFees}
                        onChange={(e) => setDirectBuyFees(e.target.value)}
                        className="w-full bg-card border border-borderMedium rounded-lg px-2.5 py-1.5 text-textPrimary font-mono text-xs focus:outline-none focus:border-accentSky"
                      />
                    </div>
                  </div>
                </div>

                {/* Datos de Venta */}
                <div className="p-3 rounded-xl bg-canvas border border-borderSubtle space-y-2.5">
                  <span className="text-[10px] font-bold text-statusGreen uppercase tracking-wider block">
                    2. Datos de la Venta / Liquidación
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-textSecondary mb-0.5">Precio Venta ({directCurrency === 'EUR' ? '€' : '$'}) *</label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        value={directSellPrice}
                        onChange={(e) => setDirectSellPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-card border border-borderMedium rounded-lg px-2.5 py-1.5 text-textPrimary font-mono text-xs focus:outline-none focus:border-statusGreen"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-textSecondary mb-0.5">Fecha Venta *</label>
                      <input
                        type="date"
                        required
                        value={directSellDate}
                        onChange={(e) => setDirectSellDate(e.target.value)}
                        className="w-full bg-card border border-borderMedium rounded-lg px-2.5 py-1.5 text-textPrimary font-mono text-xs focus:outline-none focus:border-statusGreen"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-textSecondary mb-0.5">Comisión Venta</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={directSellFees}
                        onChange={(e) => setDirectSellFees(e.target.value)}
                        className="w-full bg-card border border-borderMedium rounded-lg px-2.5 py-1.5 text-textPrimary font-mono text-xs focus:outline-none focus:border-statusGreen"
                      />
                    </div>
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-[11px] font-semibold text-textSecondary mb-1">
                    Notas o Motivo de la Venta
                  </label>
                  <input
                    type="text"
                    value={directNotes}
                    onChange={(e) => setDirectNotes(e.target.value)}
                    placeholder="Ej. Venta en Trade Republic tras alcanzar objetivo..."
                    className="w-full bg-canvas border border-borderMedium rounded-xl px-3 py-2 text-textPrimary focus:outline-none focus:border-accentSky text-xs"
                  />
                </div>

                {/* Previsualización del Resultado Financiero */}
                {(() => {
                  const s = parseFloat(directShares) || 0;
                  const bp = parseFloat(directBuyPrice) || 0;
                  const bf = parseFloat(directBuyFees) || 0;
                  const sp = parseFloat(directSellPrice) || 0;
                  const sf = parseFloat(directSellFees) || 0;
                  const totalCost = (s * bp) + bf;
                  const grossProceeds = (s * sp) - sf;
                  const netProfit = grossProceeds - totalCost;
                  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
                  const curSym = directCurrency === 'EUR' ? '€' : '$';

                  return (
                    <div className="p-3 rounded-xl bg-canvas border border-borderSubtle grid grid-cols-3 gap-2 text-center text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-textSecondary block">Coste Compra</span>
                        <span className="font-bold text-textPrimary">{curSym}{totalCost.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-textSecondary block">Importe Venta</span>
                        <span className="font-bold text-accentSky">{curSym}{grossProceeds.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-textSecondary block">P&L Neto</span>
                        <span className={`font-bold ${netProfit >= 0 ? 'text-statusGreen' : 'text-statusRed'}`}>
                          {netProfit >= 0 ? '+' : ''}{curSym}{netProfit.toFixed(2)} ({netProfit >= 0 ? '+' : ''}{roi.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-borderSubtle">
                <button
                  type="button"
                  onClick={() => setIsDirectClosedOpen(false)}
                  className="px-3 py-2 rounded-xl bg-cardSecondary text-textSecondary hover:text-textPrimary transition text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingDirect || !directTicker.trim() || !parseFloat(directShares) || !parseFloat(directBuyPrice) || !parseFloat(directSellPrice)}
                  className="px-4 py-2 rounded-xl bg-statusGreen text-black font-bold hover:bg-statusGreen/90 transition text-xs shadow-lg disabled:opacity-50"
                >
                  {isSavingDirect ? 'Guardando...' : 'Guardar Venta en el Histórico'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
