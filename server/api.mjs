// Manejo robusto de señales y errores de pipes rotos (evita cierres por EPIPE en Windows)
process.stdout?.on('error', (err) => { if (err.code === 'EPIPE') return; });
process.stderr?.on('error', (err) => { if (err.code === 'EPIPE') return; });
process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync(path.join(process.cwd(), 'server_error.log'), `${new Date().toISOString()} [UNCAUGHT] ${err.stack || err.message}\n`);
  } catch {}
  console.error('[UNCAUGHT]', err);
});
process.on('unhandledRejection', (reason) => {
  try {
    fs.appendFileSync(path.join(process.cwd(), 'server_error.log'), `${new Date().toISOString()} [UNHANDLED_REJECTION] ${reason}\n`);
  } catch {}
  console.error('[UNHANDLED_REJECTION]', reason);
});

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, initDatabase } from './db.mjs';
import { ejecutarBarridoPilar1, obtenerValuacionTicker, auditarActivoCompleto } from './pilar1_engine.mjs';
import { ejecutarTestCalibracion } from './test_calibracion.mjs';
import { syncPortfolioQuotesRealtime, fetchLiveQuote, fetchInstitutionalConsensus, fetchChartHistory, generateFallbackChart, searchMarketAssets } from './market_service.mjs';
import { MARKETS_CONFIG, scanMarketWithLiveQuotes, syncMarketQuotesInRealtime } from './market_indices_service.mjs';
import { computeRayDalioMacroState, computeSovereignComparison, computePortfolioDalioQuadrants } from './dalio_macro_engine.mjs';
import { generarAnalisisTecnico } from './technical_analysis.mjs';
import { buildCompanyFinancialDeepDive, getCompanyOperationalMomentum } from './financial_history_service.mjs';
import { handleAIChatQuery, getAIConfig, saveAIConfig, removeAIKey, testGeminiConnection, testAIConnection, generatePortfolioAuditReport } from './ai_assistant_service.mjs';

initDatabase();

// Sincronización inicial de cotizaciones reales de mercado
syncPortfolioQuotesRealtime().catch(err => console.error('[API Startup] Error en sync:', err));

let ultimoScanPilar1 = null;

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(compression());
app.use(express.json());

// Función centralizada para consolidar portafolio con métricas de mercado y sectoriales
export async function getConsolidatedPortfolio() {
  const fxRow = db.prepare("SELECT rate FROM fx_rates WHERE pair = 'EUR_USD'").get();
  const eurUsdRate = fxRow ? fxRow.rate : 1.085;

  // Obtener todas las transacciones individuales unidas a cotizaciones de mercado
  const allTrades = db.prepare(`
    SELECT t.*, q.fifty_two_week_high, q.fifty_two_week_low, q.current_price as market_price
    FROM portfolio_trades t
    LEFT JOIN market_quotes q ON UPPER(t.ticker) = UPPER(q.ticker)
    ORDER BY t.execution_date DESC, t.id DESC
  `).all();

  const openTrades = allTrades.filter(t => (t.status || 'OPEN') === 'OPEN');
  const closedTrades = allTrades
    .filter(t => t.status === 'CLOSED')
    .sort((a, b) => {
      const dateA = a.sell_date || a.execution_date || '';
      const dateB = b.sell_date || b.execution_date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return b.id - a.id;
    });

  // Obtener cotizaciones de mercado
  const quotes = db.prepare(`SELECT * FROM market_quotes`).all();
  const quotesMap = new Map(quotes.map(q => [q.ticker.toUpperCase(), q]));

  // Consolidar por Ticker solo las transacciones ABIERTAS
  const positionsMap = new Map();

  for (const trade of openTrades) {
    const ticker = trade.ticker.toUpperCase();
    if (!positionsMap.has(ticker)) {
      positionsMap.set(ticker, {
        ticker,
        company_name: trade.company_name,
        currency: trade.currency,
        total_shares: 0,
        total_cost: 0,
        total_fees: 0,
        trades: []
      });
    }

    const pos = positionsMap.get(ticker);
    pos.total_shares += trade.shares;
    pos.total_cost += (trade.shares * trade.buy_price);
    pos.total_fees += (trade.fees || 0);
    pos.trades.push(trade);
  }

  const positions = [];
  let portfolioTotalCostEUR = 0;
  let portfolioTotalValueEUR = 0;
  const marketTotals = {};
  const sectorTotals = {};
  const currencyTotals = {};

  for (const [ticker, pos] of positionsMap.entries()) {
    if (pos.total_shares <= 0) continue;

    const avgBuyPrice = pos.total_cost / pos.total_shares;
    const quote = quotesMap.get(ticker) || {
      current_price: avgBuyPrice,
      currency: pos.currency,
      change_pct: 0
    };

    const currentPrice = quote.current_price;
    const currentValuation = pos.total_shares * currentPrice;
    const profitLoss = currentValuation - pos.total_cost;
    const variationPct = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

    let statusColor = 'NEUTRAL';
    if (variationPct > 0.001) {
      statusColor = 'POSITIVE';
    } else if (variationPct < -0.001) {
      statusColor = 'NEGATIVE';
    }

    const rateToEur = pos.currency === 'USD' ? (1 / eurUsdRate) : 1;
    const valEur = currentValuation * rateToEur;
    portfolioTotalCostEUR += (pos.total_cost + pos.total_fees) * rateToEur;
    portfolioTotalValueEUR += valEur;

    const valModel = obtenerValuacionTicker(ticker);
    const fairValueFund = valModel?.escalera_mos?.fair_value || null;
    const mosBuyCeiling = valModel?.techo_maximo_compra || null;

    let marketName = 'S&P 500';
    if (ticker.endsWith('.MC')) {
      marketName = 'IBEX 35';
    } else if (ticker === 'AAPL' || ticker === 'MSFT' || ticker === 'NVDA' || ticker === 'AMZN' || ticker === 'GOOGL' || ticker === 'META' || ticker === 'TSLA' || ticker === 'AVGO' || ticker === 'ADBE' || ticker === 'COST') {
      marketName = 'NASDAQ 100';
    }
    const sectorName = valModel?.sector || (ticker.endsWith('.MC') ? 'Finanzas / Servicios' : 'Tecnología / Renta Variable');

    marketTotals[marketName] = (marketTotals[marketName] || 0) + valEur;
    sectorTotals[sectorName] = (sectorTotals[sectorName] || 0) + valEur;
    currencyTotals[pos.currency] = (currencyTotals[pos.currency] || 0) + valEur;

    let targetExitPrice = null;
    const customTradesTarget = pos.trades.reduce((acc, t) => {
      const val = t.target_exit_price || null;
      return val ? Math.max(acc, val) : acc;
    }, 0);

    if (customTradesTarget > 0) {
      targetExitPrice = customTradesTarget;
    } else if (fairValueFund && fairValueFund > 0) {
      targetExitPrice = fairValueFund;
    }

    const hasReachedExit = targetExitPrice != null && targetExitPrice > 0 && currentPrice >= targetExitPrice;
    const isInFreefall = variationPct <= -8.0 || (quote.change_pct != null && quote.change_pct <= -4.5);
    let freefallReason = null;
    if (variationPct <= -8.0) {
      freefallReason = `Pérdida acumulada del ${variationPct.toFixed(1)}% desde la compra`;
    } else if (quote.change_pct != null && quote.change_pct <= -4.5) {
      freefallReason = `Desplome diario del ${quote.change_pct.toFixed(1)}% en mercado`;
    }

    positions.push({
      ticker,
      company_name: pos.company_name,
      currency: pos.currency,
      shares: pos.total_shares,
      buy_price: parseFloat(avgBuyPrice.toFixed(2)),
      current_price: parseFloat(currentPrice.toFixed(2)),
      variation_pct: parseFloat(variationPct.toFixed(2)),
      profit_loss: parseFloat(profitLoss.toFixed(2)),
      status_color: statusColor,
      trades_count: pos.trades.length,
      sector: sectorName,
      total_value_eur: parseFloat(valEur.toFixed(2)),
      weight_pct: 0,
      fair_value: fairValueFund ? parseFloat(fairValueFund.toFixed(2)) : null,
      mos_buy_ceiling: mosBuyCeiling ? parseFloat(mosBuyCeiling.toFixed(2)) : null,
      target_exit_price: targetExitPrice != null && targetExitPrice > 0 ? parseFloat(targetExitPrice.toFixed(2)) : null,
      has_reached_exit: hasReachedExit,
      is_in_freefall: isInFreefall,
      freefall_reason: freefallReason,
      fifty_two_week_low: quote.fifty_two_week_low || null,
      fifty_two_week_high: quote.fifty_two_week_high || null,
      trades: pos.trades
    });
  }

  positions.forEach(p => {
    p.weight_pct = portfolioTotalValueEUR > 0 ? Number(((p.total_value_eur / portfolioTotalValueEUR) * 100).toFixed(1)) : 0;
  });

  const market_allocations = Object.entries(marketTotals).map(([market, val]) => ({
    market,
    value_eur: Number(val.toFixed(2)),
    weight_pct: portfolioTotalValueEUR > 0 ? Number(((val / portfolioTotalValueEUR) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.value_eur - a.value_eur);

  const sector_allocations = Object.entries(sectorTotals).map(([sector, val]) => ({
    sector,
    value_eur: Number(val.toFixed(2)),
    weight_pct: portfolioTotalValueEUR > 0 ? Number(((val / portfolioTotalValueEUR) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.value_eur - a.value_eur);

  const usd_pct = portfolioTotalValueEUR > 0 ? Number(((currencyTotals['USD'] || 0) / portfolioTotalValueEUR * 100).toFixed(1)) : 0;
  const eur_pct = portfolioTotalValueEUR > 0 ? Number(((currencyTotals['EUR'] || 0) / portfolioTotalValueEUR * 100).toFixed(1)) : 0;

  const totalProfitLossEUR = portfolioTotalValueEUR - portfolioTotalCostEUR;
  const totalVariationPctEUR = portfolioTotalCostEUR > 0 
    ? (totalProfitLossEUR / portfolioTotalCostEUR) * 100 
    : 0;

  let totalRealizedPnlEUR = 0;
  let totalRealizedInvestedEUR = 0;
  let winningTradesCount = 0;
  let losingTradesCount = 0;

  for (const ct of closedTrades) {
    const rateToEur = ct.currency === 'USD' ? (1 / eurUsdRate) : 1;
    const pnlEur = ct.realized_pnl_eur != null 
      ? ct.realized_pnl_eur 
      : Number(((ct.realized_pnl || 0) * rateToEur).toFixed(2));
    const investedEur = ((ct.shares * ct.buy_price) + (ct.fees || 0)) * rateToEur;
    
    totalRealizedPnlEUR += pnlEur;
    totalRealizedInvestedEUR += investedEur;
    if ((ct.realized_pnl || 0) >= 0) winningTradesCount++;
    else losingTradesCount++;
  }

  const totalRealizedRoiPct = totalRealizedInvestedEUR > 0 
    ? Number(((totalRealizedPnlEUR / totalRealizedInvestedEUR) * 100).toFixed(2)) 
    : 0;

  return {
    summary: {
      total_invested_eur: parseFloat(portfolioTotalCostEUR.toFixed(2)),
      total_value_eur: parseFloat(portfolioTotalValueEUR.toFixed(2)),
      total_pnl_eur: parseFloat(totalProfitLossEUR.toFixed(2)),
      total_variation_pct: parseFloat(totalVariationPctEUR.toFixed(2)),
      fx_eur_usd: eurUsdRate,
      usd_pct,
      eur_pct,
      market_allocations,
      sector_allocations
    },
    positions,
    raw_trades: openTrades,
    closed_trades: closedTrades,
    closed_summary: {
      total_realized_pnl_eur: parseFloat(totalRealizedPnlEUR.toFixed(2)),
      total_realized_roi_pct: totalRealizedRoiPct,
      winning_trades_count: winningTradesCount,
      losing_trades_count: losingTradesCount,
      total_closed_count: closedTrades.length
    }
  };
}

// 1. OBTENER PORTAFOLIO CONSOLIDADO Y COMPRAS (CON PRECIOS REALES)
app.get('/api/portfolio', async (req, res) => {
  try {
    if (req.query.sync === 'true') {
      await syncPortfolioQuotesRealtime();
    }
    const data = await getConsolidatedPortfolio();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. INSERTAR NUEVA COMPRA (MANUAL EN BBDD LOCAL)
app.post('/api/portfolio', (req, res) => {
  try {
    const {
      ticker,
      company_name,
      currency,
      shares,
      buy_price,
      fees,
      execution_date,
      notes,
      target_exit_price,
      target_exit_notes
    } = req.body;

    if (!ticker || !shares || !buy_price || !currency) {
      return res.status(400).json({ error: 'Campos obligatorios incompletos (ticker, shares, buy_price, currency)' });
    }

    const cleanTicker = ticker.trim().toUpperCase();
    const cleanCurrency = currency.trim().toUpperCase();

    if (!['EUR', 'USD'].includes(cleanCurrency)) {
      return res.status(400).json({ error: 'Solo se admiten divisas EUR o USD' });
    }

    const parsedBuyPrice = parseFloat(buy_price);
    const valModel = obtenerValuacionTicker(cleanTicker, parsedBuyPrice);
    const parsedTargetExit = (target_exit_price != null && !isNaN(parseFloat(target_exit_price)) && parseFloat(target_exit_price) > 0)
      ? parseFloat(target_exit_price)
      : (valModel?.fair_value_teorico || valModel?.escalera_mos?.fair_value || null);

    const stmt = db.prepare(`
      INSERT INTO portfolio_trades (
        ticker, company_name, currency, shares, buy_price, fees, execution_date, notes, target_exit_price, target_exit_notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      cleanTicker,
      company_name || cleanTicker,
      cleanCurrency,
      parseFloat(shares),
      parsedBuyPrice,
      parseFloat(fees || 0),
      execution_date || new Date().toISOString().split('T')[0],
      notes || '',
      parsedTargetExit,
      target_exit_notes || ''
    );

    // Asegurar que exista cotización de mercado (si es nueva, igualarla al precio de compra)
    const quoteExists = db.prepare('SELECT ticker FROM market_quotes WHERE ticker = ?').get(cleanTicker);
    if (!quoteExists) {
      db.prepare(`
        INSERT INTO market_quotes (ticker, current_price, currency, change_pct)
        VALUES (?, ?, ?, 0.0)
      `).run(cleanTicker, parseFloat(buy_price), cleanCurrency);
    }

    // Al comprar la empresa, eliminarla automáticamente de la lista de seguimiento (watchlist)
    try {
      db.prepare('DELETE FROM watchlist WHERE UPPER(ticker) = ?').run(cleanTicker);
    } catch {}

    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.1 MODIFICAR TRANSACCIÓN EXISTENTE
app.put('/api/portfolio/trade/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM portfolio_trades WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    const {
      ticker,
      company_name,
      currency,
      shares,
      buy_price,
      fees,
      execution_date,
      notes,
      sell_price,
      sell_date,
      sell_fees,
      closing_notes,
      target_exit_price,
      target_exit_notes
    } = req.body;

    const newTicker = ticker ? ticker.trim().toUpperCase() : existing.ticker;
    const newCompanyName = company_name ? company_name.trim() : existing.company_name;
    const newCurrency = currency ? currency.trim().toUpperCase() : existing.currency;
    const newShares = shares != null ? parseFloat(shares) : existing.shares;
    const newBuyPrice = buy_price != null ? parseFloat(buy_price) : existing.buy_price;
    const newFees = fees != null ? parseFloat(fees) : (existing.fees || 0);
    const newExecutionDate = execution_date || existing.execution_date;
    const newNotes = notes !== undefined ? notes : existing.notes;
    let newTargetExitPrice = existing.target_exit_price;
    if (target_exit_price !== undefined) {
      newTargetExitPrice = (target_exit_price != null && !isNaN(parseFloat(target_exit_price)))
        ? parseFloat(target_exit_price)
        : null;
    }
    const newTargetExitNotes = target_exit_notes !== undefined ? target_exit_notes : existing.target_exit_notes;

    let newSellPrice = existing.sell_price;
    let newSellDate = existing.sell_date;
    let newSellFees = existing.sell_fees || 0;
    let newClosingNotes = existing.closing_notes;
    let newRealizedPnl = existing.realized_pnl;
    let newRealizedPnlEur = existing.realized_pnl_eur;
    let newRealizedRoi = existing.realized_roi_pct;

    if (existing.status === 'CLOSED' || sell_price != null) {
      if (sell_price != null) newSellPrice = parseFloat(sell_price);
      if (sell_date != null) newSellDate = sell_date;
      if (sell_fees != null) newSellFees = parseFloat(sell_fees);
      if (closing_notes !== undefined) newClosingNotes = closing_notes;

      if (newSellPrice != null) {
        const fxRow = db.prepare("SELECT rate FROM fx_rates WHERE pair = 'EUR_USD'").get();
        const eurUsdRate = fxRow ? fxRow.rate : 1.085;

        const investedTotal = (newShares * newBuyPrice) + newFees;
        const proceedsTotal = (newShares * newSellPrice) - newSellFees;
        newRealizedPnl = Number((proceedsTotal - investedTotal).toFixed(2));
        newRealizedRoi = investedTotal > 0 ? Number(((newRealizedPnl / investedTotal) * 100).toFixed(2)) : 0;
        newRealizedPnlEur = newCurrency === 'USD' ? Number((newRealizedPnl / eurUsdRate).toFixed(2)) : newRealizedPnl;
      }
    }

    db.prepare(`
      UPDATE portfolio_trades
      SET ticker = ?,
          company_name = ?,
          currency = ?,
          shares = ?,
          buy_price = ?,
          fees = ?,
          execution_date = ?,
          notes = ?,
          sell_price = ?,
          sell_date = ?,
          sell_fees = ?,
          realized_pnl = ?,
          realized_pnl_eur = ?,
          realized_roi_pct = ?,
          closing_notes = ?,
          target_exit_price = ?,
          target_exit_notes = ?
      WHERE id = ?
    `).run(
      newTicker,
      newCompanyName,
      newCurrency,
      newShares,
      newBuyPrice,
      newFees,
      newExecutionDate,
      newNotes,
      newSellPrice,
      newSellDate,
      newSellFees,
      newRealizedPnl,
      newRealizedPnlEur,
      newRealizedRoi,
      newClosingNotes,
      newTargetExitPrice,
      newTargetExitNotes,
      id
    );

    // Asegurar cotización para el ticker
    const quoteExists = db.prepare('SELECT ticker FROM market_quotes WHERE ticker = ?').get(newTicker);
    if (!quoteExists) {
      db.prepare(`
        INSERT INTO market_quotes (ticker, current_price, currency, change_pct)
        VALUES (?, ?, ?, 0.0)
      `).run(newTicker, newBuyPrice, newCurrency);
    }

    res.json({ success: true, trade_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ELIMINAR TRANSACCIÓN INDIVIDUAL
app.delete('/api/portfolio/trade/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.prepare('DELETE FROM portfolio_trades WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3.1 CERRAR / LIQUIDAR OPERACIÓN (VENTA TOTAL O PARCIAL CON PnL REALIZADO)
app.post('/api/portfolio/close-trade', (req, res) => {
  try {
    const { id, sell_price, sell_date, sell_fees, closing_notes, shares_to_sell } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Falta parámetro obligatorio (id)' });
    }

    const trade = db.prepare('SELECT * FROM portfolio_trades WHERE id = ?').get(parseInt(id));
    if (!trade) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    const fxRow = db.prepare("SELECT rate FROM fx_rates WHERE pair = 'EUR_USD'").get();
    const eurUsdRate = fxRow ? fxRow.rate : 1.085;

    // Si no se envía sell_price, tomar cotización de mercado en vivo automáticamente
    let sPrice = (sell_price != null && !isNaN(parseFloat(sell_price)) && parseFloat(sell_price) > 0)
      ? parseFloat(sell_price)
      : null;
    if (sPrice == null) {
      const quote = db.prepare('SELECT current_price FROM market_quotes WHERE ticker = ?').get(trade.ticker.toUpperCase());
      sPrice = quote ? quote.current_price : trade.buy_price;
    }

    const sFees = parseFloat(sell_fees || 0);
    const sDate = sell_date || new Date().toISOString().split('T')[0];

    // Verificar si es venta parcial
    const reqShares = shares_to_sell != null ? parseFloat(shares_to_sell) : null;
    const isPartial = reqShares != null && !isNaN(reqShares) && reqShares > 0 && reqShares < trade.shares;

    if (isPartial) {
      const soldShares = reqShares;
      const remainingShares = Number((trade.shares - soldShares).toFixed(4));
      const initialFeesProp = trade.fees ? Number((trade.fees * (soldShares / trade.shares)).toFixed(2)) : 0;
      const remainingFees = trade.fees ? Number((trade.fees - initialFeesProp).toFixed(2)) : 0;

      const investedTotal = (soldShares * trade.buy_price) + initialFeesProp;
      const proceedsTotal = (soldShares * sPrice) - sFees;
      const realizedPnl = Number((proceedsTotal - investedTotal).toFixed(2));
      const realizedRoi = Number(((realizedPnl / investedTotal) * 100).toFixed(2));
      const pnlEur = trade.currency === 'USD' ? Number((realizedPnl / eurUsdRate).toFixed(2)) : realizedPnl;

      // 1. Descontar acciones vendidas de la posición abierta
      db.prepare(`
        UPDATE portfolio_trades
        SET shares = ?, fees = ?
        WHERE id = ?
      `).run(remainingShares, remainingFees, trade.id);

      // 2. Crear trade cerrado con la porción liquidada
      const noteText = closing_notes
        ? `Venta parcial (${soldShares}/${trade.shares} acc): ${closing_notes}`
        : `Venta parcial (${soldShares} acc)`;

      const result = db.prepare(`
        INSERT INTO portfolio_trades (
          ticker, company_name, currency, shares, buy_price, fees, execution_date, notes,
          status, sell_price, sell_date, sell_fees, realized_pnl, realized_pnl_eur, realized_roi_pct, closing_notes,
          target_exit_price, target_exit_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CLOSED', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        trade.ticker, trade.company_name, trade.currency, soldShares, trade.buy_price, initialFeesProp, trade.execution_date, trade.notes,
        sPrice, sDate, sFees, realizedPnl, pnlEur, realizedRoi, noteText,
        trade.target_exit_price, trade.target_exit_notes
      );

      return res.json({
        success: true,
        partial: true,
        trade_id: trade.id,
        closed_trade_id: result.lastInsertRowid,
        remaining_shares: remainingShares,
        sold_shares: soldShares,
        realized_pnl: realizedPnl,
        realized_pnl_eur: pnlEur,
        realized_roi_pct: realizedRoi
      });
    }

    // Cierre Total
    const investedTotal = (trade.shares * trade.buy_price) + (trade.fees || 0);
    const proceedsTotal = (trade.shares * sPrice) - sFees;
    const realizedPnl = Number((proceedsTotal - investedTotal).toFixed(2));
    const realizedRoi = Number(((realizedPnl / investedTotal) * 100).toFixed(2));
    const pnlEur = trade.currency === 'USD' ? Number((realizedPnl / eurUsdRate).toFixed(2)) : realizedPnl;

    db.prepare(`
      UPDATE portfolio_trades
      SET status = 'CLOSED',
          sell_price = ?,
          sell_date = ?,
          sell_fees = ?,
          realized_pnl = ?,
          realized_pnl_eur = ?,
          realized_roi_pct = ?,
          closing_notes = ?
      WHERE id = ?
    `).run(sPrice, sDate, sFees, realizedPnl, pnlEur, realizedRoi, closing_notes || '', trade.id);

    res.json({
      success: true,
      partial: false,
      trade_id: trade.id,
      realized_pnl: realizedPnl,
      realized_pnl_eur: pnlEur,
      realized_roi_pct: realizedRoi
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
// 3.1b REGISTRAR VENTA HISTÓRICA DIRECTA (POSICIÓN YA CERRADA)
app.post('/api/portfolio/direct-closed-trade', (req, res) => {
  try {
    const {
      ticker,
      company_name,
      currency,
      shares,
      buy_price,
      fees,
      execution_date,
      sell_price,
      sell_date,
      sell_fees,
      closing_notes
    } = req.body;

    if (!ticker || !shares || !buy_price || !sell_price) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (ticker, acciones, precio compra y precio venta)' });
    }

    const cleanTicker = ticker.trim().toUpperCase();
    const cleanCurrency = (currency || 'USD').trim().toUpperCase();
    const sShares = parseFloat(shares);
    const bPrice = parseFloat(buy_price);
    const bFees = parseFloat(fees || 0);
    const sPrice = parseFloat(sell_price);
    const sDate = sell_date || new Date().toISOString().split('T')[0];
    const sFees = parseFloat(sell_fees || 0);
    const eDate = execution_date || sDate;

    const fxRow = db.prepare("SELECT rate FROM fx_rates WHERE pair = 'EUR_USD'").get();
    const eurUsdRate = fxRow ? fxRow.rate : 1.085;

    const investedTotal = (sShares * bPrice) + bFees;
    const proceedsTotal = (sShares * sPrice) - sFees;
    const realizedPnl = Number((proceedsTotal - investedTotal).toFixed(2));
    const realizedRoi = investedTotal > 0 ? Number(((realizedPnl / investedTotal) * 100).toFixed(2)) : 0;
    const pnlEur = cleanCurrency === 'USD' ? Number((realizedPnl / eurUsdRate).toFixed(2)) : realizedPnl;

    const stmt = db.prepare(`
      INSERT INTO portfolio_trades (
        ticker, company_name, currency, shares, buy_price, fees, execution_date, notes,
        status, sell_price, sell_date, sell_fees, realized_pnl, realized_pnl_eur, realized_roi_pct, closing_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CLOSED', ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      cleanTicker,
      company_name || cleanTicker,
      cleanCurrency,
      sShares,
      bPrice,
      bFees,
      eDate,
      'Registro directo de venta histórica',
      sPrice,
      sDate,
      sFees,
      realizedPnl,
      pnlEur,
      realizedRoi,
      closing_notes || ''
    );

    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      realized_pnl: realizedPnl,
      realized_pnl_eur: pnlEur,
      realized_roi_pct: realizedRoi
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3.2 REABRIR OPERACIÓN CERRADA
app.post('/api/portfolio/reopen-trade', (req, res) => {
  try {
    const { id } = req.body;
    db.prepare(`
      UPDATE portfolio_trades
      SET status = 'OPEN',
          sell_price = NULL,
          sell_date = NULL,
          sell_fees = 0,
          realized_pnl = NULL,
          realized_pnl_eur = NULL,
          realized_roi_pct = NULL,
          closing_notes = NULL
      WHERE id = ?
    `).run(parseInt(id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3.3 LIMPIAR TODAS LAS OPERACIONES (BORRADO DE DATOS DE PRUEBA)
app.delete('/api/portfolio/clear-all', (req, res) => {
  try {
    db.prepare('DELETE FROM portfolio_trades').run();
    res.json({ success: true, message: 'Todas las compras han sido eliminadas correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DATOS MACRO Y CURVA DE DEUDA
app.get('/api/macro', (req, res) => {
  try {
    const curvePoints = db.prepare(`
      SELECT maturity, yield_rate, prev_yield_rate FROM macro_yield_curve ORDER BY sort_order ASC
    `).all();

    const regime = db.prepare(`SELECT * FROM macro_regime WHERE id = 1`).get();
    const effectiveRegime = regime || {
      spread_10y_2y: 0.18,
      cycle_phase: 'Curva Normalizándose (Desinversión)',
      description: 'Fase de desinversión de la curva soberana'
    };

    const dalioCycle = computeRayDalioMacroState(curvePoints, effectiveRegime);

    // Comparación Macro Soberana: Bono Español 10Y vs US Treasury 10Y (^TNX)
    const us10Y = curvePoints.find(p => p.maturity === '10Y')?.yield_rate || 4.05;
    const es10Y = 3.05; // Rendimiento soberano del Bono Español 10A (Bono del Estado a 10 años)
    const sovereignComparison = computeSovereignComparison(us10Y, es10Y);

    // Diagnóstico All-Weather de Cartera según Ray Dalio
    const openTrades = db.prepare(`SELECT * FROM portfolio_trades WHERE status = 'OPEN'`).all();
    const fxRate = db.prepare(`SELECT rate FROM fx_rates WHERE pair = 'EUR/USD'`).get()?.rate || 1.08;
    const portfolioDalio = computePortfolioDalioQuadrants(openTrades, fxRate);

    res.json({
      curve: curvePoints,
      regime: effectiveRegime,
      dalio_cycle: dalioCycle,
      sovereign_comparison: sovereignComparison,
      portfolio_dalio: portfolioDalio
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. PILAR FUNDAMENTAL (OPORTUNIDADES FILTRADAS)
app.get('/api/opportunities', (req, res) => {
  try {
    const opportunities = db.prepare(`SELECT * FROM screened_opportunities`).all();
    const formatted = opportunities.map(opp => ({
      ...opp,
      thesis_points: JSON.parse(opp.thesis_points_json)
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. ANÁLISIS GROWING / IMPULSO OPERATIVO (ESTADOS AUDITADOS SEC EDGAR)
app.get('/api/growth/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const growth = db.prepare(`SELECT * FROM growth_metrics WHERE ticker = ?`).get(ticker);
    if (growth) {
      return res.json(growth);
    }

    // Si no está precargada en SQLite, computarla dinámicamente desde SEC EDGAR XBRL
    const dynamicGrowth = await getCompanyOperationalMomentum(ticker);
    if (dynamicGrowth) {
      return res.json(dynamicGrowth);
    }

    res.status(404).json({ error: 'Métricas de crecimiento no encontradas para ' + ticker });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. TIPOS DE CAMBIO
app.get('/api/fx', (req, res) => {
  try {
    const rates = db.prepare(`SELECT * FROM fx_rates`).all();
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7.1 CONSULTA DE COTIZACIÓN Y CONVERSIÓN EN VIVO
app.get('/api/quote/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.trim().toUpperCase();
    let quote = await fetchLiveQuote(ticker);

    if (!quote || !quote.price) {
      const localQuote = db.prepare('SELECT * FROM market_quotes WHERE ticker = ?').get(ticker);
      if (localQuote) {
        quote = {
          ticker: localQuote.ticker,
          price: localQuote.current_price,
          currency: localQuote.currency,
          name: ticker
        };
      }
    }

    const fxRow = db.prepare("SELECT rate FROM fx_rates WHERE pair = 'EUR_USD'").get();
    const eurUsdRate = fxRow ? fxRow.rate : 1.085;

    const price = quote?.price || null;
    const currency = (quote?.currency || 'USD').toUpperCase();
    let priceEUR = price;
    if (price && currency === 'USD') {
      priceEUR = Number((price / eurUsdRate).toFixed(4));
    }

    const valModel = obtenerValuacionTicker(ticker, price);
    const fairValue = valModel?.fair_value_teorico || valModel?.escalera_mos?.fair_value || null;
    const mosCeiling = valModel?.techo_maximo_compra || null;
    const arquetipo = valModel?.nombre_arquetipo || null;
    const qualityTier = valModel?.quality_tier || null;
    const modeloValoracion = valModel?.modelo_valoracion || null;
    const formulaValoracion = valModel?.formula_valoracion || null;

    res.json({
      ticker,
      name: quote?.name || ticker,
      price,
      currency,
      fx_eur_usd: eurUsdRate,
      price_eur: priceEUR,
      fifty_two_week_low: quote?.fifty_two_week_low || null,
      fifty_two_week_high: quote?.fifty_two_week_high || null,
      fair_value: fairValue ? parseFloat(fairValue.toFixed(2)) : null,
      mos_buy_ceiling: mosCeiling ? parseFloat(mosCeiling.toFixed(2)) : null,
      arquetipo,
      quality_tier: qualityTier,
      modelo_valoracion: modeloValoracion,
      formula_valoracion: formulaValoracion
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7.85 BATCH LIVE QUOTES SYNCHRONIZATION (ALTA FRECUENCIA TIEMPO REAL: CARTERA + SEGUIMIENTO)
app.post('/api/market/batch-live-quotes', async (req, res) => {
  try {
    const { tickers } = req.body || {};
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return res.json({ success: true, updated_count: 0, quotes: {} });
    }

    const cleanTickers = [...new Set(tickers.map(t => (t || '').trim().toUpperCase()).filter(Boolean))].slice(0, 50);
    const fxRow = db.prepare("SELECT rate FROM fx_rates WHERE pair = 'EUR_USD'").get();
    const eurUsdRate = fxRow ? fxRow.rate : 1.085;

    const upsertStmt = db.prepare(`
      INSERT INTO market_quotes (ticker, current_price, currency, change_pct, fifty_two_week_low, fifty_two_week_high, target_mean, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(ticker) DO UPDATE SET
        current_price = excluded.current_price,
        currency = excluded.currency,
        change_pct = excluded.change_pct,
        fifty_two_week_low = COALESCE(excluded.fifty_two_week_low, market_quotes.fifty_two_week_low),
        fifty_two_week_high = COALESCE(excluded.fifty_two_week_high, market_quotes.fifty_two_week_high),
        target_mean = COALESCE(excluded.target_mean, market_quotes.target_mean),
        updated_at = CURRENT_TIMESTAMP
    `);

    const results = await Promise.allSettled(cleanTickers.map(async (tkr) => {
      const [quote, consensus] = await Promise.all([
        fetchLiveQuote(tkr).catch(() => null),
        fetchInstitutionalConsensus(tkr).catch(() => null)
      ]);
      if (!quote || !(quote.price > 0)) return null;
      return {
        ...quote,
        ticker: tkr,
        target_mean: consensus?.target_mean ?? null
      };
    }));

    const quotesMap = {};
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        const q = r.value;
        const upperTkr = q.ticker.toUpperCase();
        try {
          upsertStmt.run(
            upperTkr,
            q.price,
            q.currency || (upperTkr.endsWith('.MC') ? 'EUR' : 'USD'),
            q.change_pct || 0.0,
            q.fifty_two_week_low ?? null,
            q.fifty_two_week_high ?? null,
            q.target_mean ?? null
          );
        } catch {}

        const valModel = obtenerValuacionTicker(upperTkr, q.price);
        quotesMap[upperTkr] = {
          ticker: upperTkr,
          price: q.price,
          currency: q.currency || (upperTkr.endsWith('.MC') ? 'EUR' : 'USD'),
          change_pct: q.change_pct || 0.0,
          fifty_two_week_low: q.fifty_two_week_low ?? null,
          fifty_two_week_high: q.fifty_two_week_high ?? null,
          fair_value: valModel?.fair_value_teorico ?? valModel?.escalera_mos?.fair_value ?? null,
          techo_mos: valModel?.techo_maximo_compra ?? null,
          estado_compra: valModel?.estado_compra ?? null,
          discrepancia: valModel?.discrepancia ?? null,
          quality_tier: valModel?.quality_tier ?? null
        };
      }
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      eur_usd_rate: eurUsdRate,
      updated_count: Object.keys(quotesMap).length,
      quotes: quotesMap
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7.9 LISTA DE MERCADOS SOPORTADOS (FASE 2: MULTI-MERCADO)
app.get('/api/markets', (req, res) => {
  res.json(MARKETS_CONFIG);
});

// 8. MOTOR ANALÍTICO PILAR 1: VALUACIÓN MULTI-MERCADO (S&P 500, NASDAQ-100, IBEX 35)
app.get('/api/pilar1/scan', async (req, res) => {
  try {
    const rawG = req.query.pivot_g ? parseFloat(req.query.pivot_g) : 0.07;
    const pivotG = rawG > 1.0 ? rawG / 100.0 : rawG;
    const rawMos = req.query.mos ? parseFloat(req.query.mos) : 0.20;
    const mosDiscount = rawMos > 1.0 ? rawMos / 100.0 : rawMos;
    const market = (req.query.market || 'SP500').toUpperCase();
    const syncQuotes = req.query.sync === 'true' || req.query.sync === '1';

    ultimoScanPilar1 = await scanMarketWithLiveQuotes({
      market,
      pivotG,
      mosDiscount,
      syncQuotes
    });
    res.json(ultimoScanPilar1);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8.1 TEST DE CALIBRACIÓN AUTOMÁTICO (FASE 2, PUNTO 13)
app.get('/api/pilar1/calibration', (req, res) => {
  try {
    const testResult = ejecutarTestCalibracion();
    res.json(testResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pilar1/run', async (req, res) => {
  try {
    const { force_empty, pivot_g, mos, sync, market = 'SP500' } = req.body || {};
    const normMarket = (market || 'SP500').toUpperCase();
    const rawG = pivot_g ? parseFloat(pivot_g) : 0.07;
    const pivotG = rawG > 1.0 ? rawG / 100.0 : rawG;
    const rawMos = mos ? parseFloat(mos) : 0.20;
    const mosDiscount = rawMos > 1.0 ? rawMos / 100.0 : rawMos;
    const mosPct = Math.round(mosDiscount * 100);

    if (force_empty) {
      const cfg = MARKETS_CONFIG[normMarket] || MARKETS_CONFIG.SP500;
      ultimoScanPilar1 = {
        ejecucion_fecha: new Date().toISOString().split('T')[0],
        market: normMarket,
        market_name: cfg.name,
        currency: cfg.currency,
        currency_symbol: cfg.currency_symbol,
        universo_analizado: normMarket === 'IBEX35' ? 35 : (normMarket === 'NASDAQ' ? 100 : 500),
        empresas_descartadas_datos_insuficientes: 0,
        empresas_descartadas_techo_r: 0,
        empresas_descartadas_trampa_valor: 0,
        empresas_en_zona_valor_justo: 0,
        empresas_no_calificadas_precio: 0,
        empresas_calificadas_pilar1: 0,
        pivote_g_utilizado: pivotG,
        mos_utilizado: mosDiscount,
        mos_pct: mosPct,
        mensaje_vacio: `BARRIDO COMPLETADO: Ninguna compañía de ${cfg.name} cumple el criterio de Margen de Seguridad del ${mosPct}% en este momento.`,
        resultados: [],
        diagnostico_pedagogico: {
          descartadas_techo_r: [],
          descartadas_trampa_valor: [],
          en_zona_valor_justo: [],
          no_calificadas_precio: []
        }
      };
      return res.json(ultimoScanPilar1);
    }

    ultimoScanPilar1 = await scanMarketWithLiveQuotes({
      market: normMarket,
      pivotG,
      mosDiscount,
      syncQuotes: sync !== false
    });
    res.json(ultimoScanPilar1);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. FORZAR SINCRONIZACIÓN DE MERCADO REAL
app.post('/api/market/sync', async (req, res) => {
  try {
    const market = (req.body?.market || req.query?.market || 'SP500').toUpperCase();
    const syncRes = await syncMarketQuotesInRealtime(market);
    await syncPortfolioQuotesRealtime().catch(() => {});
    res.json({ success: true, ...syncRes, message: `Cotizaciones en tiempo real actualizadas para ${market}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. OBTENER GRÁFICO HISTÓRICO DE PRECIOS (1D, 5D, 1M, 6M, YTD, 1A, 5A)
app.get('/api/chart/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const { timeframe = '1M' } = req.query;
  try {
    const data = await fetchChartHistory(ticker, timeframe);
    if (!data || !data.points || data.points.length === 0) {
      const fallback = generateFallbackChart(ticker, timeframe);
      return res.json(fallback);
    }
    res.json(data);
  } catch (err) {
    console.warn(`[API] Fallback forzado en /api/chart/${ticker}:`, err.message);
    try {
      const fallback = generateFallbackChart(ticker, timeframe);
      return res.json(fallback);
    } catch (fallbackErr) {
      res.status(500).json({ error: 'Error al consultar gráfico de precios' });
    }
  }
});

// 11. BÚSQUEDA MULTI-UNIVERSO DE ACTIVOS (LOCAL, S&P 500 Y YAHOO FINANCE)
app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const results = await searchMarketAssets(q);
    res.json(results);
  } catch (err) {
    console.error('Error en /api/search:', err);
    res.status(500).json({ error: 'Error en búsqueda de activos' });
  }
});

// 12. AUDITORÍA METODOLÓGICA COMPLETA DE CUALQUIER ACTIVO (PILAR 1 / DCF / GORDON-SHAPIRO)
app.get('/api/pilar1/audit/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.trim().toUpperCase();
    const rawMos = req.query.mos ? parseFloat(req.query.mos) : 0.25;
    const mosDiscount = rawMos > 1.0 ? rawMos / 100.0 : rawMos;
    const auditResult = await auditarActivoCompleto(ticker, mosDiscount);
    if (!auditResult) {
      return res.status(404).json({ error: `No se pudo auditar el activo ${ticker}. Verifique que el símbolo sea válido.` });
    }
    res.json(auditResult);
  } catch (err) {
    console.error('Error en /api/pilar1/audit/:ticker:', err);
    res.status(500).json({ error: 'Error al realizar auditoría completa del activo' });
  }
});

// 12.0 COMPARADOR DE ACTIVOS FRENTE A FRENTE (GORDON-SHAPIRO & FILTRO VALUE)
const SECTOR_PEERS_MAP = {
  'AMS.MC': ['BKNG', 'EXPE', 'ABG.MC'],
  'BKNG': ['AMS.MC', 'EXPE', 'ABNB'],
  'SAN.MC': ['BBVA.MC', 'CABK.MC', 'JPM'],
  'BBVA.MC': ['SAN.MC', 'CABK.MC', 'SAB.MC'],
  'CABK.MC': ['SAN.MC', 'BBVA.MC', 'BKT.MC'],
  'ITX.MC': ['NKE', 'HMB.ST', 'TGT'],
  'IBE.MC': ['NEE', 'ENEL.MI', 'ELE.MC'],
  'TEF.MC': ['VOD', 'ORAN', 'T'],
  'REP.MC': ['XOM', 'CVX', 'SHEL', 'TTE'],
  'AAPL': ['MSFT', 'GOOGL', 'META'],
  'MSFT': ['AAPL', 'GOOGL', 'AMZN'],
  'NVDA': ['AMD', 'INTC', 'TSM', 'AVGO'],
  'AMD': ['NVDA', 'INTC', 'QCOM'],
  'KO': ['PEP', 'MNST', 'KDP'],
  'PEP': ['KO', 'MDLZ', 'KHC'],
  'JNJ': ['PFE', 'ABBV', 'MRK'],
  'V': ['MA', 'AXP', 'PYPL'],
  'MA': ['V', 'AXP', 'PYPL'],
  'JPM': ['BAC', 'WFC', 'C', 'SAN.MC'],
  'AMZN': ['BABA', 'WMT', 'COST']
};

app.get('/api/pilar1/compare', async (req, res) => {
  try {
    const ticker1 = req.query.ticker1 ? req.query.ticker1.trim().toUpperCase() : null;
    const ticker2 = req.query.ticker2 ? req.query.ticker2.trim().toUpperCase() : null;
    const rawMos = req.query.mos ? parseFloat(req.query.mos) : 0.20;
    const mosDiscount = rawMos > 1.0 ? rawMos / 100.0 : rawMos;

    if (!ticker1) {
      return res.status(400).json({ error: 'Se requiere al menos el parámetro ticker1 para la comparación.' });
    }

    const suggestedPeers = SECTOR_PEERS_MAP[ticker1] || ['MSFT', 'AAPL', 'NVDA', 'SAN.MC'];

    if (!ticker2) {
      const audit1 = await auditarActivoCompleto(ticker1, mosDiscount);
      return res.json({
        asset1: audit1,
        asset2: null,
        suggestedPeers
      });
    }

    const [res1, res2] = await Promise.allSettled([
      auditarActivoCompleto(ticker1, mosDiscount),
      auditarActivoCompleto(ticker2, mosDiscount)
    ]);

    const audit1 = res1.status === 'fulfilled' ? res1.value : null;
    const audit2 = res2.status === 'fulfilled' ? res2.value : null;

    if (!audit1 && !audit2) {
      return res.status(404).json({ error: `No se pudo obtener información ni de ${ticker1} ni de ${ticker2}` });
    }

    // Análisis comparativo sintético
    let mosWinner = null;
    let scoreWinner = null;
    if (audit1 && audit2) {
      const mos1 = audit1.escenario_neutro?.VP_MoS || audit1.escenario_neutro?.VP_MoS_30 || 0;
      const mos2 = audit2.escenario_neutro?.VP_MoS || audit2.escenario_neutro?.VP_MoS_30 || 0;
      const p0_1 = audit1.precio_cierre_P0 || 1;
      const p0_2 = audit2.precio_cierre_P0 || 1;
      const discount1 = ((mos1 - p0_1) / mos1) * 100;
      const discount2 = ((mos2 - p0_2) / mos2) * 100;

      mosWinner = discount1 >= discount2 ? ticker1 : ticker2;

      const score1 = audit1.filtro_value?.puntuacion ?? 0;
      const score2 = audit2.filtro_value?.puntuacion ?? 0;
      scoreWinner = score1 >= score2 ? ticker1 : ticker2;
    }

    res.json({
      asset1: audit1,
      asset2: audit2,
      suggestedPeers,
      comparison: {
        mosWinner,
        scoreWinner
      }
    });
  } catch (err) {
    console.error('Error en /api/pilar1/compare:', err);
    res.status(500).json({ error: 'Error interno al procesar la comparación de activos' });
  }
});


// 12.1 RADIOGRAFÍA FINANCIERA INSTITUCIONAL Y HISTÓRICO DE ESTADOS (SEC XBRL AUDITADO)
app.get('/api/company/:ticker/financial-history', async (req, res) => {
  try {
    const ticker = req.params.ticker.trim().toUpperCase();
    const deepDive = await buildCompanyFinancialDeepDive(ticker);
    if (!deepDive) {
      return res.status(404).json({ error: `No se encontraron estados financieros auditados en SEC EDGAR para ${ticker}` });
    }
    res.json(deepDive);
  } catch (err) {
    console.error('Error en /api/company/:ticker/financial-history:', err);
    res.status(500).json({ error: 'Error al generar radiografía financiera auditada' });
  }
});

// 13. SECCIÓN DE EMPRESAS EN SEGUIMIENTO (WATCHLIST)
app.get('/api/watchlist', async (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM watchlist ORDER BY created_at DESC').all();

    // Sincronizar cotizaciones en vivo en paralelo para que refleje la evolución real
    const liveQuotes = await Promise.all(items.map(async item => {
      try {
        const live = await fetchLiveQuote(item.ticker);
        if (live && live.price > 0) {
          db.prepare(`
            INSERT OR REPLACE INTO market_quotes (ticker, current_price, currency, change_pct, fifty_two_week_low, fifty_two_week_high, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(live.ticker, live.price, live.currency, live.change_pct, live.fifty_two_week_low, live.fifty_two_week_high);
          return { ticker: item.ticker.toUpperCase(), live };
        }
      } catch {}
      return null;
    }));

    const liveMap = new Map(liveQuotes.filter(Boolean).map(x => [x.ticker, x.live]));
    const quotes = db.prepare('SELECT * FROM market_quotes').all();
    const quotesMap = new Map(quotes.map(q => [q.ticker.toUpperCase(), q]));

    const enriched = items.map(item => {
      const t = item.ticker.toUpperCase();
      const live = liveMap.get(t);
      const q = quotesMap.get(t);

      const currentPrice = live?.price ?? q?.current_price ?? item.added_price;
      const dayChangePct = live?.change_pct ?? q?.change_pct ?? 0;
      const high52 = live?.fifty_two_week_high ?? q?.fifty_two_week_high ?? null;
      const low52 = live?.fifty_two_week_low ?? q?.fifty_two_week_low ?? null;

      const pActual = currentPrice;
      const diffAmount = Number((pActual - item.added_price).toFixed(2));
      const diffPct = item.added_price > 0 ? Number((((pActual - item.added_price) / item.added_price) * 100).toFixed(2)) : 0;

      // Valoración del Pilar 1 para contextualizar la curva
      const valPilar1 = obtenerValuacionTicker(t, pActual);
      const fairValue = valPilar1?.fair_value_teorico || null;
      const techoMoS = valPilar1?.techo_maximo_compra || null;
      const diffVsMoSPct = (techoMoS && pActual) ? Number((((pActual - techoMoS) / techoMoS) * 100).toFixed(1)) : null;

      return {
        id: item.id,
        ticker: t,
        company_name: item.company_name,
        currency: item.currency || 'USD',
        added_price: item.added_price,
        current_price: pActual,
        change_since_added_amount: diffAmount,
        change_since_added_pct: diffPct,
        day_change_pct: dayChangePct,
        target_price: item.target_price || techoMoS,
        fair_value: fairValue,
        techo_mos: techoMoS,
        diff_vs_mos_pct: diffVsMoSPct,
        estado_valoracion: valPilar1?.estado_compra || 'NEUTRAL',
        arquetipo: valPilar1?.nombre_arquetipo || null,
        notes: item.notes,
        created_at: item.created_at,
        high_52w: high52,
        low_52w: low52
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Error en GET /api/watchlist:', err);
    res.status(500).json({ error: 'Error al consultar empresas en seguimiento' });
  }
});

app.post('/api/watchlist', async (req, res) => {
  try {
    const { ticker, notes, target_price } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker requerido' });
    const cleanTicker = ticker.trim().toUpperCase();

    // 1. Consultar SIEMPRE cotización fresca en vivo para registrar el precio real exacto de adición
    let p0 = null;
    let name = cleanTicker;
    let currency = 'USD';
    let high52 = null;
    let low52 = null;
    let changePct = 0;

    try {
      const live = await fetchLiveQuote(cleanTicker);
      if (live && live.price > 0) {
        p0 = live.price;
        name = live.name || cleanTicker;
        currency = live.currency || 'USD';
        high52 = live.fifty_two_week_high;
        low52 = live.fifty_two_week_low;
        changePct = live.change_pct || 0;
        // Guardar cotización fresca en SQLite
        db.prepare(`
          INSERT OR REPLACE INTO market_quotes (ticker, current_price, currency, change_pct, fifty_two_week_low, fifty_two_week_high, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(cleanTicker, p0, currency, changePct, low52, high52);
      }
    } catch (e) {
      console.warn('[Watchlist POST] Error consultando cotización live:', e.message);
    }

    if (!p0) {
      const quote = db.prepare('SELECT current_price, currency, fifty_two_week_high, fifty_two_week_low FROM market_quotes WHERE UPPER(ticker) = ?').get(cleanTicker);
      if (quote?.current_price > 0) {
        p0 = quote.current_price;
        currency = quote.currency || 'USD';
      }
    }

    if (!p0) {
      const val = obtenerValuacionTicker(cleanTicker);
      if (val?.precio_cierre_P0 > 0) {
        p0 = val.precio_cierre_P0;
        name = val.nombre || cleanTicker;
      }
    }

    if (!p0 || p0 <= 0) {
      return res.status(400).json({ error: `No se pudo obtener la cotización actual para registrar ${cleanTicker}` });
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO watchlist (ticker, company_name, currency, added_price, target_price, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(cleanTicker, name, currency, Number(p0.toFixed(2)), target_price ? Number(target_price) : null, notes || null);

    res.json({
      success: true,
      ticker: cleanTicker,
      company_name: name,
      added_price: Number(p0.toFixed(2)),
      currency,
      message: `${cleanTicker} añadida a seguimiento al precio actual de $${p0.toFixed(2)}`
    });
  } catch (err) {
    console.error('Error en POST /api/watchlist:', err);
    res.status(500).json({ error: 'Error al añadir empresa a seguimiento' });
  }
});

app.delete('/api/watchlist/:ticker', (req, res) => {
  try {
    const ticker = req.params.ticker.trim().toUpperCase();
    db.prepare('DELETE FROM watchlist WHERE UPPER(ticker) = ?').run(ticker);
    res.json({ success: true, message: `${ticker} eliminada de seguimiento` });
  } catch (err) {
    console.error('Error en DELETE /api/watchlist:', err);
    res.status(500).json({ error: 'Error al eliminar de seguimiento' });
  }
});

// 14. ANÁLISIS TÉCNICO CUANTITATIVO Y ESTADO DE EVOLUCIÓN
app.get('/api/technical/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.trim().toUpperCase();
    const timeframe = req.query.timeframe || '1A';
    const analysis = await generarAnalisisTecnico(ticker, timeframe);
    if (!analysis) {
      return res.status(404).json({ error: `No se pudo generar análisis técnico para ${ticker}` });
    }
    res.json(analysis);
  } catch (err) {
    console.error(`Error en GET /api/technical/${req.params.ticker}:`, err);
    res.status(500).json({ error: err.message || 'Error al generar análisis técnico' });
  }
});

// 15. ASISTENTE FINANCIERO IA & GESTIÓN DE CONFIGURACIÓN
app.get('/api/ai/config', (req, res) => {
  try {
    res.json(getAIConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/config', async (req, res) => {
  try {
    const { apiKey, model, provider } = req.body || {};
    const result = await saveAIConfig({ apiKey, model, provider });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ai/config', (req, res) => {
  try {
    res.json(removeAIKey());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/test-key', async (req, res) => {
  try {
    const { apiKey, model, provider } = req.body || {};
    const result = await testAIConnection(apiKey, model, provider);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export async function buildCompleteAuditContext(providedContext = {}) {
  const portData = await getConsolidatedPortfolio();

  // Watchlist con precios y cálculos MoS
  const rawWatchlist = db.prepare('SELECT * FROM watchlist').all();
  const quotes = db.prepare('SELECT ticker, current_price FROM market_quotes').all();
  const quoteMap = new Map(quotes.map(q => [q.ticker.toUpperCase(), q.current_price]));

  const enrichedWatchlist = rawWatchlist.map(w => {
    const curP = quoteMap.get(w.ticker.toUpperCase()) || w.added_price || 0;
    const valModel = obtenerValuacionTicker(w.ticker);
    const fv = valModel?.escalera_mos?.fair_value || (curP * 1.15);
    const techo = valModel?.techo_maximo_compra || (fv * 0.80);
    return {
      ticker: w.ticker,
      company_name: w.company_name || w.ticker,
      currency: w.currency || 'USD',
      current_price: Number(curP.toFixed(2)),
      fair_value: Number(fv.toFixed(2)),
      mos_buy_ceiling: Number(techo.toFixed(2)),
      cumple_MoS: curP > 0 && curP <= techo,
      notes: w.notes
    };
  });

  // Macro, curvas soberanas y 4 cuadrantes Dalio
  const macroState = computeRayDalioMacroState();
  const sovComp = computeSovereignComparison();
  const dalioRadar = computePortfolioDalioQuadrants(portData.positions);

  const fullMacro = {
    ...macroState,
    sovereign_comparison: sovComp,
    portfolio_dalio: dalioRadar
  };

  return {
    ...(providedContext || {}),
    portfolio: portData,
    watchlist: enrichedWatchlist,
    macro: fullMacro
  };
}

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history, context } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }

    let enrichedContext = { ...(context || {}) };
    const msgLower = message.trim().toLowerCase();
    const isAuditOrPortfolioQuery =
      msgLower.includes('cartera') ||
      msgLower.includes('auditar') ||
      msgLower.includes('auditoría') ||
      msgLower.includes('auditoria') ||
      msgLower.includes('rebalance') ||
      msgLower.includes('posicion') ||
      msgLower.includes('posiciones') ||
      msgLower.includes('compras');

    if (isAuditOrPortfolioQuery || !enrichedContext.portfolio) {
      enrichedContext = await buildCompleteAuditContext(enrichedContext);
    }

    const response = await handleAIChatQuery({ message: message.trim(), history, context: enrichedContext });
    res.json(response);
  } catch (err) {
    console.error('Error en POST /api/ai/chat:', err);
    res.status(500).json({ error: err.message || 'Error en el asistente de IA' });
  }
});

// 16. AUDITORÍA CUANTITATIVA DIRECTA DE CARTERA CON IA
app.post('/api/ai/audit-portfolio', async (req, res) => {
  try {
    const { context } = req.body || {};
    const auditContext = await buildCompleteAuditContext(context);
    const config = getAIConfig();

    let report = null;
    let provider = 'local';
    let model = 'Motor Cuantitativo Local';

    // Si hay clave configurada de Gemini, ejecutar a través de Gemini
    if (config.has_api_key && config.api_key) {
      try {
        const aiRes = await handleAIChatQuery({ message: '/auditar-cartera', history: [], context: auditContext });
        if (aiRes && aiRes.reply && aiRes.reply.length > 100) {
          report = aiRes.reply;
          provider = aiRes.provider;
          model = aiRes.model;
        }
      } catch (e) {
        console.warn('[AuditEndpoint] Error llamando a Gemini, usando motor local:', e.message);
      }
    }

    if (!report) {
      report = generatePortfolioAuditReport(auditContext);
    }

    res.json({ success: true, report, provider, model });
  } catch (err) {
    console.error('Error en POST /api/ai/audit-portfolio:', err);
    res.status(500).json({ error: err.message || 'Error al generar auditoría de cartera' });
  }
});

// 17. SERVIR FRONTEND ESTÁTICO DE PRODUCCIÓN (dist) EN MODO STANDALONE
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.resolve(__dirname, '..', 'dist');

if (fs.existsSync(DIST_PATH)) {
  console.log(`[Production] Sirviendo interfaz de usuario compilada desde: ${DIST_PATH}`);
  app.use(express.static(DIST_PATH));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[API Server] Corriendo en http://localhost:${PORT}`);
});
