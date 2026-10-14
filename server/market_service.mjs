import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let cachedYahooCookie = null;
let cachedYahooCrumb = null;
let crumbExpiresAt = 0;
let crumbPromise = null;

async function getValidYahooSession() {
  const now = Date.now();
  if (cachedYahooCrumb && now < crumbExpiresAt) {
    return { cookie: cachedYahooCookie, crumb: cachedYahooCrumb };
  }
  if (!crumbPromise) {
    crumbPromise = (async () => {
      try {
        const r1 = await fetch('https://fc.yahoo.com', {
          headers: { 'User-Agent': USER_AGENT }
        });
        const cookie = r1.headers.get('set-cookie');
        if (cookie) {
          const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
            headers: { 'User-Agent': USER_AGENT, cookie }
          });
          if (r2.ok) {
            cachedYahooCookie = cookie;
            cachedYahooCrumb = (await r2.text()).trim();
            crumbExpiresAt = Date.now() + 1000 * 60 * 60; // 1 hora de validez
          }
        }
      } catch (err) {
        console.warn('[MarketService] Error obteniendo crumb:', err.message);
      } finally {
        crumbPromise = null;
      }
      return { cookie: cachedYahooCookie, crumb: cachedYahooCrumb };
    })();
  }
  return crumbPromise;
}

/**
 * Obtiene el consenso institucional de analistas de Wall Street (Target Mean / Median / High / Low)
 * utilizando sesión autenticada con crumb de Yahoo Finance.
 */
export async function fetchInstitutionalConsensus(ticker) {
  try {
    const cleanTicker = ticker.trim().toUpperCase();
    const session = await getValidYahooSession();
    if (!session?.crumb) return null;

    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(cleanTicker)}?modules=financialData,defaultKeyStatistics&crumb=${encodeURIComponent(session.crumb)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, cookie: session.cookie }
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const fd = json?.quoteSummary?.result?.[0]?.financialData;
    if (!fd) return null;

    const targetMean = fd.targetMeanPrice?.raw ?? null;
    const targetMedian = fd.targetMedianPrice?.raw ?? null;
    const targetHigh = fd.targetHighPrice?.raw ?? null;
    const targetLow = fd.targetLowPrice?.raw ?? null;
    const numAnalysts = fd.numberOfAnalystOpinions?.raw ?? null;

    if (!targetMean && !targetMedian) return null;

    return {
      target_mean: targetMean ? Number(targetMean.toFixed(2)) : null,
      target_median: targetMedian ? Number(targetMedian.toFixed(2)) : null,
      target_high: targetHigh ? Number(targetHigh.toFixed(2)) : null,
      target_low: targetLow ? Number(targetLow.toFixed(2)) : null,
      number_of_analysts: numAnalysts
    };
  } catch (err) {
    console.warn(`[MarketService] No se pudo obtener consenso para ${ticker}:`, err.message);
    return null;
  }
}

/**
 * Obtiene la cotización real en tiempo real de Yahoo Finance
 * sin requerir cookies ni crumb (v8 chart API).
 */
export async function fetchLiveQuote(ticker) {
  try {
    const cleanTicker = ticker.trim().toUpperCase();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanTicker)}`;
    
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!resp.ok) {
      console.warn(`[MarketService] No se pudo obtener cotización para ${cleanTicker}: HTTP ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta) {
      console.warn(`[MarketService] Formato de respuesta no reconocido para ${cleanTicker}`);
      return null;
    }

    // regularMarketPrice es la cotización en vivo / último cierre
    const price = meta.regularMarketPrice ?? meta.previousClose ?? meta.chartPreviousClose;
    const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const changePct = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
    const currency = meta.currency || 'USD';
    const fiftyTwoWeekLow = meta.fiftyTwoWeekLow ? Number(meta.fiftyTwoWeekLow.toFixed(2)) : null;
    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh ? Number(meta.fiftyTwoWeekHigh.toFixed(2)) : null;

    return {
      ticker: cleanTicker,
      price: Number(price.toFixed(2)),
      change_pct: Number(changePct.toFixed(2)),
      currency: currency.toUpperCase(),
      name: meta.longName || meta.shortName || cleanTicker,
      fifty_two_week_low: fiftyTwoWeekLow,
      fifty_two_week_high: fiftyTwoWeekHigh,
      day_low: meta.regularMarketDayLow ? Number(meta.regularMarketDayLow.toFixed(2)) : null,
      day_high: meta.regularMarketDayHigh ? Number(meta.regularMarketDayHigh.toFixed(2)) : null,
      volume: meta.regularMarketVolume || null,
      instrument_type: meta.instrumentType || 'EQUITY',
      exchange: meta.fullExchangeName || meta.exchangeName || ''
    };
  } catch (err) {
    console.error(`[MarketService] Error al consultar ${ticker}:`, err.message);
    return null;
  }
}

/**
 * Actualiza en la base de datos local SQLite los precios reales
 * para todos los activos de la cartera del usuario.
 */
export async function syncPortfolioQuotesRealtime() {
  try {
    // 1. Obtener tickers únicos de la cartera y de empresas en seguimiento (Watchlist)
    const trades = db.prepare('SELECT DISTINCT ticker FROM portfolio_trades').all();
    let watchlistTickers = [];
    try {
      const watch = db.prepare('SELECT DISTINCT ticker FROM watchlist').all();
      watchlistTickers = watch.map(w => w.ticker.toUpperCase());
    } catch {}

    const portfolioTickers = trades.map(t => t.ticker.toUpperCase());

    // Añadir referencias como LIN, V, ASML, JNJ, PG, AAPL, NVDA
    const allTickers = Array.from(new Set([...portfolioTickers, ...watchlistTickers, 'LIN', 'MSFT', 'ASML', 'GOOGL', 'ADBE', 'NVO', 'V', 'JNJ', 'PG', 'AAPL', 'NVDA']));

    const updateStmt = db.prepare(`
      INSERT OR REPLACE INTO market_quotes (ticker, current_price, currency, change_pct, fifty_two_week_low, fifty_two_week_high, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    for (const t of allTickers) {
      const quote = await fetchLiveQuote(t);
      if (quote && quote.price > 0) {
        updateStmt.run(quote.ticker, quote.price, quote.currency, quote.change_pct, quote.fifty_two_week_low, quote.fifty_two_week_high);
      }
    }

    // 2. Obtener tipo de cambio EUR/USD real
    const fxQuote = await fetchLiveQuote('EURUSD=X');
    if (fxQuote && fxQuote.price > 0) {
      db.prepare(`
        INSERT OR REPLACE INTO fx_rates (pair, rate, updated_at)
        VALUES ('EUR_USD', ?, CURRENT_TIMESTAMP)
      `).run(fxQuote.price);
    }

    // 3. Obtener rendimiento del bono libre de riesgo a 10 años (^TNX) con validación macro de curva (Punto 4)
    const tnxQuote = await fetchLiveQuote('^TNX');
    if (tnxQuote && tnxQuote.price > 0) {
      const live10Y = tnxQuote.price;
      const curve5Y = db.prepare("SELECT yield_rate FROM macro_yield_curve WHERE maturity = '5Y'").get()?.yield_rate || 3.84;
      const curve30Y = db.prepare("SELECT yield_rate FROM macro_yield_curve WHERE maturity = '30Y'").get()?.yield_rate || 4.42;

      // Validación económica: rango 2.5%-6.5% y coherencia con la curva (no dispararse más de 60 pb sobre el 30Y)
      const esCoherente = (
        live10Y >= 2.50 && live10Y <= 6.50 &&
        live10Y >= (curve5Y - 1.00) &&
        live10Y <= (curve30Y + 0.60)
      );

      if (esCoherente) {
        db.prepare(`
          INSERT OR REPLACE INTO macro_yield_curve (maturity, sort_order, yield_rate, prev_yield_rate, updated_at)
          VALUES ('10Y', 4, ?, 4.22, CURRENT_TIMESTAMP)
        `).run(live10Y);
        console.log(`[MarketService] 10Y Treasury yield validado y actualizado: ${live10Y}%`);
      } else {
        console.warn(`[MarketService] ALERTA MACRO: ^TNX live (${live10Y}%) no supera la validación de coherencia con curva (5Y=${curve5Y}%, 30Y=${curve30Y}%). Se preserva valor validado de referencia.`);
      }
    }

    console.log(`[MarketService] Sincronización de precios reales completada.`);
    return true;
  } catch (err) {
    console.error('[MarketService] Error en syncPortfolioQuotesRealtime:', err);
    return false;
  }
}

// Cache en memoria para gráficos de cotización
const chartCache = new Map();

/**
 * Genera puntos simulados coherentes con OHLCV cuando no hay conexión a Yahoo Finance
 */
function generateFallbackChart(ticker, tf) {
  const quote = db.prepare('SELECT * FROM market_quotes WHERE ticker = ?').get(ticker);
  const currentPrice = quote?.current_price || 100;
  const currency = quote?.currency || 'USD';
  const low52 = quote?.fifty_two_week_low || currentPrice * 0.85;
  const high52 = quote?.fifty_two_week_high || currentPrice * 1.15;

  let count = 30;
  let timeStepSeconds = 86400;
  if (tf === '1D') {
    count = 35;
    timeStepSeconds = 300; // 5m
  } else if (tf === '5D' || tf === '1W') {
    count = 35;
    timeStepSeconds = 3600 * 2; // 2h
  } else if (tf === '1M') {
    count = 22;
    timeStepSeconds = 86400; // 1d
  } else if (tf === '6M') {
    count = 26;
    timeStepSeconds = 86400 * 7; // 1w
  } else if (tf === 'YTD') {
    count = 35;
    timeStepSeconds = 86400 * 7; // 1w
  } else if (tf === '1A' || tf === '1Y') {
    count = 52;
    timeStepSeconds = 86400 * 7; // 1w
  } else if (tf === '5A' || tf === '5Y') {
    count = 60;
    timeStepSeconds = 86400 * 30; // 1mo
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const points = [];
  let basePrice = (tf === '1A' || tf === '1Y' || tf === '5A' || tf === '5Y') ? (low52 + high52) / 2 : currentPrice * 0.98;

  for (let i = 0; i < count; i++) {
    const ts = nowSec - (count - 1 - i) * timeStepSeconds;
    const progress = i / (count - 1);
    const randomWiggle = (Math.sin(i * 0.8) + Math.cos(i * 0.4)) * (currentPrice * 0.012);
    const interpolated = basePrice + (currentPrice - basePrice) * progress + randomWiggle;
    const priceVal = i === count - 1 ? currentPrice : Math.max(low52 * 0.95, Number(interpolated.toFixed(2)));

    const candleSpread = priceVal * 0.007;
    const o = Number((priceVal + (Math.sin(i * 1.5) * candleSpread)).toFixed(2));
    const c = priceVal;
    const h = Number((Math.max(o, c) + Math.abs(Math.cos(i * 1.2)) * candleSpread).toFixed(2));
    const l = Number((Math.min(o, c) - Math.abs(Math.sin(i * 0.9)) * candleSpread).toFixed(2));
    const v = Math.floor(1000000 + (Math.abs(Math.sin(i)) * 4000000));

    const d = new Date(ts * 1000);
    let dateStr = '';
    if (tf === '1D') {
      dateStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (tf === '5D' || tf === '1W') {
      dateStr = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'numeric' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (tf === '1M' || tf === '6M' || tf === 'YTD') {
      dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    } else {
      dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' });
    }

    points.push({
      timestamp: ts,
      date_str: dateStr,
      price: priceVal,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v
    });
  }

  const prices = points.map(p => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const firstPrice = points[0].price;
  const changePct = firstPrice > 0 ? Number((((currentPrice - firstPrice) / firstPrice) * 100).toFixed(2)) : 0;
  const changeAmount = Number((currentPrice - firstPrice).toFixed(2));

  return {
    ticker,
    timeframe: tf,
    currency,
    points,
    first_price: firstPrice,
    current_price: currentPrice,
    change_pct: changePct,
    change_amount: changeAmount,
    min_price: Number(minPrice.toFixed(2)),
    max_price: Number(maxPrice.toFixed(2))
  };
}

/**
 * Obtiene la serie histórica de precios para un ticker y marco temporal con soporte OHLCV
 * Timeframes: '1D', '5D', '1M', '6M', 'YTD', '1A', '5A'
 */
export async function fetchChartHistory(ticker, timeframe = '1M') {
  const cleanTicker = ticker.trim().toUpperCase();
  const tfRaw = (timeframe || '1M').toUpperCase();
  
  // Normalización de marco temporal
  const tfMap = {
    '1D': { tf: '1D', range: '1d', interval: '5m' },
    '5D': { tf: '5D', range: '5d', interval: '15m' },
    '1W': { tf: '5D', range: '5d', interval: '15m' },
    '1M': { tf: '1M', range: '1mo', interval: '1d' },
    '6M': { tf: '6M', range: '6mo', interval: '1d' },
    'YTD': { tf: 'YTD', range: 'ytd', interval: '1d' },
    '1A': { tf: '1A', range: '1y', interval: '1d' },
    '1Y': { tf: '1A', range: '1y', interval: '1d' },
    '5A': { tf: '5A', range: '5y', interval: '1wk' },
    '5Y': { tf: '5A', range: '5y', interval: '1wk' }
  };

  const tfConfig = tfMap[tfRaw] || tfMap['1M'];
  const tf = tfConfig.tf;
  const cacheKey = `${cleanTicker}_${tf}`;
  const now = Date.now();

  const cached = chartCache.get(cacheKey);
  const ttl = tf === '1D' ? 60 * 1000 : 5 * 60 * 1000;
  if (cached && (now - cached.timestamp) < ttl) {
    return cached.data;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanTicker)}?range=${tfConfig.range}&interval=${tfConfig.interval}`;
    const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const json = await resp.json();
    const result = json?.chart?.result?.[0];
    const quotes = result?.indicators?.quote?.[0];
    if (!result || !result.timestamp || !quotes?.close) {
      throw new Error('Respuesta de Yahoo no válida');
    }

    const timestamps = result.timestamp;
    const closes = quotes.close || [];
    const opens = quotes.open || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const volumes = quotes.volume || [];
    const meta = result.meta || {};
    const currency = (meta.currency || 'USD').toUpperCase();
    const prevClose = meta.chartPreviousClose ?? meta.previousClose;

    const points = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c != null && !isNaN(c) && c > 0) {
        const o = (opens[i] != null && !isNaN(opens[i])) ? opens[i] : c;
        const h = (highs[i] != null && !isNaN(highs[i])) ? Math.max(highs[i], o, c) : Math.max(o, c);
        const l = (lows[i] != null && !isNaN(lows[i])) ? Math.min(lows[i], o, c) : Math.min(o, c);
        const v = volumes[i] || 0;

        const d = new Date(timestamps[i] * 1000);
        let dateStr = '';
        if (tf === '1D') {
          dateStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } else if (tf === '5D') {
          dateStr = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'numeric' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } else if (tf === '1M' || tf === '6M' || tf === 'YTD') {
          dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        } else {
          dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' });
        }

        points.push({
          timestamp: timestamps[i],
          date_str: dateStr,
          price: Number(c.toFixed(2)),
          open: Number(o.toFixed(2)),
          high: Number(h.toFixed(2)),
          low: Number(l.toFixed(2)),
          close: Number(c.toFixed(2)),
          volume: v
        });
      }
    }

    if (points.length === 0) {
      throw new Error('Sin puntos válidos');
    }

    const prices = points.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const firstPrice = prevClose && tf === '1D' ? prevClose : points[0].price;
    const currentPrice = points[points.length - 1].price;
    const changePct = firstPrice > 0 ? Number((((currentPrice - firstPrice) / firstPrice) * 100).toFixed(2)) : 0;
    const changeAmount = Number((currentPrice - firstPrice).toFixed(2));

    const responseData = {
      ticker: cleanTicker,
      timeframe: tf,
      currency,
      points,
      first_price: Number(firstPrice.toFixed(2)),
      current_price: currentPrice,
      change_pct: changePct,
      change_amount: changeAmount,
      min_price: Number(minPrice.toFixed(2)),
      max_price: Number(maxPrice.toFixed(2))
    };

    chartCache.set(cacheKey, { timestamp: now, data: responseData });
    return responseData;
  } catch (err) {
    console.warn(`[MarketService] Fallback gráfico para ${cleanTicker} (${tf}):`, err.message);
    return generateFallbackChart(cleanTicker, tf);
  }
}

/**
 * Calcula un Precio Objetivo de Salida (Take Profit) prudente y realista:
 * Reglas de Gestión de Carteras:
 * 1. Respeto al Máximo Anual (52W High):
 *    - Un objetivo conservador de toma de beneficios NUNCA debe proyectarse por encima de la resistencia
 *      anual (máximo de 52 semanas). Exigir que un activo maduro rompa máximos anuales para vender es
/**
 * Salida Fundamental (Graham-Dodd / Klarman / Damodaran):
 * En finanzas corporativas rigurosas, el precio objetivo de salida de una posición de valor
 * es la convergencia hacia su Valor Intrínseco Justo (Fair Value).
 * No se aplican multiplicadores arbitrarios (+8%, +12%, 98%) ni techos ad-hoc sobre precios pasados.
 * 
 * @param {number|null} buyPrice Precio de adquisición
 * @param {number|null} high52 Máximo anual de 52 semanas (no utilizado en salida fundamental)
 * @param {number|null} fairValue Valor Justo del modelo fundamental
 * @returns {number|null} El precio objetivo de salida intrínseco, o null si no hay modelo disponible.
 */
export function calculatePrudentTargetExit(buyPrice = null, high52 = null, fairValue = null) {
  if (fairValue && fairValue > 0) {
    return Number(fairValue.toFixed(2));
  }
  return null;
}

/**
 * Busca activos financieros combinando base de datos local SQLite,
 * el universo S&P 500 auditado y la API de búsqueda de Yahoo Finance.
 */
export async function searchMarketAssets(query) {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim();
  const qUpper = q.toUpperCase();
  const results = [];
  const seenTickers = new Set();

  // 1. Búsqueda local en base de datos SQLite (portfolio_trades y market_quotes)
  try {
    const localQuotes = db.prepare(`
      SELECT DISTINCT ticker, currency, current_price
      FROM market_quotes
      WHERE UPPER(ticker) LIKE ?
      LIMIT 6
    `).all(`%${qUpper}%`);

    for (const m of localQuotes) {
      const sym = m.ticker.toUpperCase();
      if (!seenTickers.has(sym)) {
        seenTickers.add(sym);
        results.push({
          ticker: sym,
          name: sym,
          currency: m.currency || 'USD',
          exchange: 'BBDD Local',
          type: 'EQUITY',
          price: m.current_price,
          isLocal: true,
          hasInstitutionalAudit: false
        });
      }
    }

    const localTrades = db.prepare(`
      SELECT DISTINCT ticker, company_name, currency
      FROM portfolio_trades
      WHERE UPPER(ticker) LIKE ? OR UPPER(company_name) LIKE ?
      LIMIT 6
    `).all(`%${qUpper}%`, `%${qUpper}%`);

    for (const t of localTrades) {
      const sym = t.ticker.toUpperCase();
      if (!seenTickers.has(sym)) {
        seenTickers.add(sym);
        results.push({
          ticker: sym,
          name: t.company_name || sym,
          currency: t.currency || 'EUR',
          exchange: 'En Cartera',
          type: 'EQUITY',
          price: null,
          isLocal: true,
          hasInstitutionalAudit: false
        });
      } else {
        const item = results.find(r => r.ticker === sym);
        if (item && t.company_name) item.name = t.company_name;
      }
    }
  } catch (err) {
    console.warn('[MarketService] Error buscando en SQLite local:', err.message);
  }

  // 2. Búsqueda en los universos multi-mercado auditados (S&P 500, NASDAQ-100, IBEX 35)
  const universesConfig = [
    { file: 'sp500_universe.json', name: 'S&P 500', currency: 'USD' },
    { file: 'nasdaq_universe.json', name: 'NASDAQ-100', currency: 'USD' },
    { file: 'ibex35_universe.json', name: 'IBEX 35', currency: 'EUR' }
  ];

  for (const uConfig of universesConfig) {
    try {
      const uPath = path.resolve(__dirname, 'data', uConfig.file);
      if (fs.existsSync(uPath)) {
        const uList = JSON.parse(fs.readFileSync(uPath, 'utf-8'));
        const matches = uList.filter(e =>
          e.ticker.toUpperCase().includes(qUpper) ||
          (e.nombre && e.nombre.toLowerCase().includes(q.toLowerCase()))
        ).slice(0, 6);

        for (const emp of matches) {
          const sym = emp.ticker.toUpperCase();
          if (seenTickers.has(sym)) {
            const existing = results.find(r => r.ticker === sym);
            if (existing) {
              existing.name = emp.nombre || existing.name;
              existing.sector = emp.sector || existing.sector;
              existing.hasInstitutionalAudit = true;
              existing.exchange = uConfig.name;
            }
          } else {
            seenTickers.add(sym);
            results.push({
              ticker: sym,
              name: emp.nombre || sym,
              currency: emp.currency || uConfig.currency,
              exchange: uConfig.name,
              type: 'EQUITY',
              sector: emp.sector || 'General',
              price: emp.precio_cierre_P0,
              isLocal: true,
              hasInstitutionalAudit: true
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[MarketService] Error buscando en universo ${uConfig.name}:`, err.message);
    }
  }

  // 3. Búsqueda remota en Yahoo Finance (Mercado Global en tiempo real)
  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
    const resp = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (resp.ok) {
      const data = await resp.json();
      const quotes = data?.quotes || [];
      for (const item of quotes) {
        const sym = item.symbol?.toUpperCase();
        if (sym && !seenTickers.has(sym)) {
          seenTickers.add(sym);
          results.push({
            ticker: sym,
            name: item.longname || item.shortname || sym,
            currency: 'USD',
            exchange: item.exchDisp || item.exchange || 'Mercado Global',
            type: item.quoteType || 'EQUITY',
            sector: item.sector || null,
            price: null,
            isLocal: false,
            hasInstitutionalAudit: false
          });
        }
      }
    }
  } catch (err) {
    console.warn('[MarketService] Error en búsqueda de Yahoo Finance:', err.message);
  }

  return results.slice(0, 15);
}



