import { initDatabase, db } from './db.mjs';
import { fetchInstitutionalConsensus } from './market_service.mjs';
import { getCachedUniverse } from './pilar1_engine.mjs';

initDatabase();

async function runSync() {
  const portfolioRows = db.prepare('SELECT DISTINCT ticker FROM portfolio_trades').all();
  let watchlistRows = [];
  try {
    watchlistRows = db.prepare('SELECT DISTINCT ticker FROM watchlist').all();
  } catch {}

  const ibex = getCachedUniverse('IBEX35').map(e => e.ticker);
  const nasdaq = getCachedUniverse('NASDAQ').map(e => e.ticker);
  const sp500 = getCachedUniverse('SP500');

  const spAll = sp500.map(e => e.ticker);
  const nasdaqAll = getCachedUniverse('NASDAQ').map(e => e.ticker);

  const priorityTickers = [
    ...portfolioRows.map(r => r.ticker),
    ...watchlistRows.map(r => r.ticker),
    ...ibex,
    ...nasdaqAll,
    ...spAll,
    'BAH', 'SNDK', 'TSM'
  ];

  const existingRows = db.prepare('SELECT ticker FROM analyst_consensus_cache WHERE fair_value_debiased > 0').all();
  const existingSet = new Set(existingRows.map(r => r.ticker.toUpperCase()));

  const uniqueTickers = [...new Set(priorityTickers.map(t => (t || '').trim().toUpperCase()).filter(Boolean))]
    .filter(t => !existingSet.has(t));
  console.log(`[SyncConsensus] Sincronizando consenso institucional completo para ${uniqueTickers.length} activos...`);

  const CHUNK = 15;
  let okCount = 0;
  for (let i = 0; i < uniqueTickers.length; i += CHUNK) {
    const slice = uniqueTickers.slice(i, i + CHUNK);
    const res = await Promise.allSettled(slice.map(t => fetchInstitutionalConsensus(t)));
    for (const r of res) {
      if (r.status === 'fulfilled' && r.value && (r.value.fair_value_debiased > 0 || r.value.target_mean > 0)) {
        okCount++;
      }
    }
    if ((i + CHUNK) % 60 === 0 || i + CHUNK >= uniqueTickers.length) {
      console.log(`[SyncConsensus] Progreso: ${Math.min(i + CHUNK, uniqueTickers.length)}/${uniqueTickers.length} (${okCount} cacheados con éxito)`);
    }
  }

  // Verificar muestra clave
  for (const sample of ['APA', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'DVN', 'SAN.MC', 'IBE.MC']) {
    const row = db.prepare('SELECT ticker, target_mean, target_median, target_low, target_high, fair_value_debiased, num_analysts, argus_target, tc_fair_value FROM analyst_consensus_cache WHERE ticker = ?').get(sample);
    console.log(`[Muestra ${sample}]`, row);
  }
}

runSync().catch(err => {
  console.error('[SyncConsensus] Error:', err);
  process.exit(1);
});
