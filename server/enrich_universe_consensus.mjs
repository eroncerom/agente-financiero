import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, initDatabase } from './db.mjs';
import { fetchInstitutionalConsensus } from './market_service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

initDatabase();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const upsertQuoteConsensusStmt = db.prepare(`
  INSERT INTO market_quotes (ticker, current_price, currency, change_pct, target_mean, target_median, updated_at)
  VALUES (?, 0, ?, 0, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(ticker) DO UPDATE SET
    target_mean = excluded.target_mean,
    target_median = excluded.target_median,
    updated_at = CURRENT_TIMESTAMP
`);

async function enrichUniverse(fileName, marketName) {
  const filePath = path.join(__dirname, 'data', fileName);
  if (!fs.existsSync(filePath)) {
    console.error(`[Enrich] Archivo no encontrado: ${filePath}`);
    return;
  }

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const universe = JSON.parse(rawData);
  console.log(`\n========================================`);
  console.log(`[Enrich] Procesando ${marketName} (${universe.length} empresas)...`);
  console.log(`========================================`);

  let enrichedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const BATCH_SIZE = 6;
  for (let i = 0; i < universe.length; i += BATCH_SIZE) {
    const batch = universe.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (emp) => {
      try {
        const consensus = await fetchInstitutionalConsensus(emp.ticker);
        if (consensus && (consensus.target_mean || consensus.target_median)) {
          const targetMean = consensus.target_mean ?? consensus.target_median;
          const targetMedian = consensus.target_median ?? consensus.target_mean;
          
          emp.target_mean_analysts = targetMean;
          emp.target_median_analysts = targetMedian;
          emp.target_high_analysts = consensus.target_high ?? null;
          emp.target_low_analysts = consensus.target_low ?? null;
          emp.number_of_analysts = consensus.number_of_analysts ?? null;

          // Normalización si el flujo de caja está severamente inflado por distorsión IFRS
          const maxEarnings = Math.max(emp.forward_eps || 0, emp.eps_diluted || 0);
          if (maxEarnings > 0 && emp.fcf_per_share && emp.fcf_per_share > 1.85 * maxEarnings) {
            console.log(`  [Anti-Distorsión IFRS] ${emp.ticker}: FCF ${emp.fcf_per_share}€ ajustado a base normalizada de beneficios`);
            emp.fcf_per_share_reportado_crudo = emp.fcf_per_share;
            emp.D1_o_FCFA1 = Number((maxEarnings * 1.35).toFixed(2));
            emp.fcf_per_share = Number((maxEarnings * 1.35).toFixed(2));
          }

          // Guardar también en SQLite market_quotes
          try {
            upsertQuoteConsensusStmt.run(
              emp.ticker.toUpperCase(),
              emp.currency || 'USD',
              targetMean,
              targetMedian
            );
          } catch {}

          enrichedCount++;
          console.log(`  ✓ ${emp.ticker.padEnd(8)}: Target Mean = ${targetMean} (${consensus.number_of_analysts || '?'} analistas)`);
        } else {
          skippedCount++;
          console.log(`  - ${emp.ticker.padEnd(8)}: Sin consenso disponible en Yahoo Finance`);
        }
      } catch (err) {
        failedCount++;
        console.warn(`  ✗ ${emp.ticker}: Error al consultar consenso:`, err.message);
      }
    }));

    if (i + BATCH_SIZE < universe.length) {
      await delay(250); // Pausa prudente para no saturar API
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(universe, null, 2), 'utf-8');
  console.log(`\n[Enrich] ${marketName} finalizado:`);
  console.log(`  - Enriquecidas con Target Institucional: ${enrichedCount}`);
  console.log(`  - Sin consenso disponible: ${skippedCount}`);
  console.log(`  - Errores de red: ${failedCount}`);
  console.log(`  - Guardado en: ${filePath}`);
}

async function main() {
  console.log('Iniciando enriquecimiento institucional de Universos Multimercado...');
  // Warm up crumb session
  await fetchInstitutionalConsensus('SAN.MC');
  await delay(500);

  await enrichUniverse('ibex35_universe.json', 'IBEX 35');
  await enrichUniverse('nasdaq_universe.json', 'NASDAQ-100');
  
  console.log('\n[Enrich] ¡Todos los universos han sido enriquecidos y sincronizados con éxito!');
}

main().catch(console.error);
