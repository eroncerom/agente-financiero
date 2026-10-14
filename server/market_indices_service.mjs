import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.mjs';
import { fetchLiveQuote, fetchInstitutionalConsensus } from './market_service.mjs';
import { ejecutarBarridoPilar1, getCachedUniverse, obtenerValuacionTicker } from './pilar1_engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Mercados disponibles y sus configuraciones macro
 */
export const MARKETS_CONFIG = {
  SP500: {
    id: 'SP500',
    name: 'S&P 500',
    country: 'US',
    currency: 'USD',
    currency_symbol: '$',
    badge: 'US · $',
    default_rf: 0.0435,
    default_erp: 0.0433,
    gn_terminal: 0.025,
    universe_file: 'sp500_universe.json'
  },
  NASDAQ: {
    id: 'NASDAQ',
    name: 'NASDAQ-100',
    country: 'US',
    currency: 'USD',
    currency_symbol: '$',
    badge: 'TECH · $',
    default_rf: 0.0435,
    default_erp: 0.0433,
    gn_terminal: 0.025,
    universe_file: 'nasdaq_universe.json'
  },
  IBEX35: {
    id: 'IBEX35',
    name: 'IBEX 35',
    country: 'ES',
    currency: 'EUR',
    currency_symbol: '€',
    badge: 'ES · €',
    default_rf: 0.0315, // Bono Español 10Y
    default_erp: 0.0540, // Damodaran Spain/Europe ERP
    gn_terminal: 0.020, // Techo macro PIB nominal europeo
    universe_file: 'ibex35_universe.json'
  }
};

/**
 * Sincroniza en tiempo real las cotizaciones de mercado para el índice especificado
 * en lotes concurrentes para máxima velocidad y datos en vivo
 */
export async function syncMarketQuotesInRealtime(marketId = 'SP500') {
  const normMarket = (marketId || 'SP500').toUpperCase();
  const universe = getCachedUniverse(normMarket);
  if (!universe || universe.length === 0) return { updated: 0 };

  const tickers = universe.map(e => e.ticker).filter(Boolean);
  const CHUNK_SIZE = 12; // 12 peticiones concurrentes simultáneas
  let updatedCount = 0;

  const targetMeanMap = new Map(universe.map(e => [e.ticker?.toUpperCase(), e.target_mean_analysts]));

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

  for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
    const chunk = tickers.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(chunk.map(async (tkr) => {
      const [quote, consensus] = await Promise.all([
        fetchLiveQuote(tkr).catch(() => null),
        fetchInstitutionalConsensus(tkr).catch(() => null)
      ]);
      if (!quote || !(quote.price > 0)) return null;
      return {
        ...quote,
        ticker: tkr,
        target_mean: consensus?.target_mean ?? null,
        target_median: consensus?.target_median ?? null
      };
    }));

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value && res.value.price > 0) {
        const q = res.value;
        const upperTkr = q.ticker.toUpperCase();
        try {
          upsertStmt.run(
            upperTkr,
            q.price,
            q.currency || 'USD',
            q.change_pct || 0.0,
            q.fifty_two_week_low ?? null,
            q.fifty_two_week_high ?? null,
            q.target_mean ?? targetMeanMap.get(upperTkr) ?? null
          );
          updatedCount++;
        } catch (dbErr) {
          // ignorar error individual de inserción
        }
      }
    }
  }

  return { market: normMarket, total: tickers.length, updated: updatedCount };
}

/**
 * Ejecuta el escaneo del mercado especificado garantizando datos en tiempo real
 */
export async function scanMarketWithLiveQuotes({
  market = 'SP500',
  pivotG = 0.07,
  mosDiscount = 0.20,
  syncQuotes = true
}) {
  const normMarket = (market || 'SP500').toUpperCase();
  const config = MARKETS_CONFIG[normMarket] || MARKETS_CONFIG.SP500;

  // 1. Sincronizar cotizaciones en vivo en el momento de la consulta si se solicita
  if (syncQuotes) {
    try {
      await syncMarketQuotesInRealtime(normMarket);
    } catch (err) {
      console.warn(`[MarketIndicesService] Aviso en sincronización en vivo para ${normMarket}:`, err.message);
    }
  }

  // 2. Ejecutar barrido analítico institucional
  const rawPivot = pivotG > 1.0 ? pivotG / 100.0 : pivotG;
  const rawMos = mosDiscount > 1.0 ? mosDiscount / 100.0 : mosDiscount;

  const result = ejecutarBarridoPilar1(null, null, null, rawPivot, rawMos, normMarket);
  return {
    ...result,
    market: normMarket,
    market_config: config
  };
}

/**
 * Búsqueda unificada en los 3 mercados
 */
export function searchInAllMarkets(query) {
  if (!query || typeof query !== 'string') return [];
  const qUpper = query.trim().toUpperCase();
  const qLower = query.trim().toLowerCase();

  const markets = ['SP500', 'NASDAQ', 'IBEX35'];
  const hits = [];
  const seen = new Set();

  for (const mkt of markets) {
    const u = getCachedUniverse(mkt);
    const mktCfg = MARKETS_CONFIG[mkt];
    for (const emp of u) {
      const t = emp.ticker.toUpperCase();
      const n = (emp.nombre || '').toLowerCase();
      if (t.includes(qUpper) || n.includes(qLower)) {
        if (!seen.has(t)) {
          seen.add(t);
          hits.push({
            ticker: t,
            name: emp.nombre || t,
            currency: emp.currency || mktCfg.currency,
            sector: emp.sector || 'General',
            market: mkt,
            market_label: mktCfg.name,
            badge: mktCfg.badge,
            price: emp.precio_cierre_P0,
            hasInstitutionalAudit: true
          });
        }
      }
    }
  }

  return hits.slice(0, 15);
}
