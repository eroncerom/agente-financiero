import fs from 'fs';
import { obtenerValuacionTicker } from './pilar1_engine.mjs';

function auditUniverse(filePath, name) {
  const list = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const anomalies = [];

  for (const item of list) {
    const p0 = item.precio_cierre_P0;
    if (!p0 || p0 <= 0) continue;
    const val = obtenerValuacionTicker(item.ticker, p0);
    const fv = val?.fair_value_teorico || val?.fair_value_Gordon || null;
    const target = item.target_mean_analysts || null;

    const issues = [];
    if (fv == null || fv <= 0) {
      issues.push('FV_NULL_OR_ZERO');
    } else {
      const ratioP0 = fv / p0;
      if (ratioP0 > 2.5) issues.push('FV_TOO_HIGH_VS_P0 (' + ratioP0.toFixed(2) + 'x)');
      if (ratioP0 < 0.28) issues.push('FV_TOO_LOW_VS_P0 (' + ratioP0.toFixed(2) + 'x)');
      if (target && target > 0) {
        const ratioTgt = fv / target;
        if (ratioTgt > 2.0) issues.push('FV_TOO_HIGH_VS_TARGET (' + ratioTgt.toFixed(2) + 'x)');
        if (ratioTgt < 0.30) issues.push('FV_TOO_LOW_VS_TARGET (' + ratioTgt.toFixed(2) + 'x)');
      }
    }

    if (issues.length > 0) {
      anomalies.push({
        ticker: item.ticker,
        name: (item.nombre || '').substring(0, 24),
        arquetipo: item.arquetipo,
        p0: Number(p0.toFixed(2)),
        fv: fv ? Number(fv.toFixed(2)) : null,
        target: target ? Number(target.toFixed(2)) : null,
        eps: item.eps_diluted,
        fcf: item.fcf_per_share,
        debt: item.net_debt_per_share,
        base: val?.cf_base_utilizado,
        issues: issues.join('; ')
      });
    }
  }

  console.log(`\n========================================================================`);
  console.log(` AUDITORÍA DE FAIR VALUE: ${name} (Total: ${list.length} activos)`);
  console.log(`========================================================================`);
  console.log(`Total anomalías encontradas: ${anomalies.length} / ${list.length} (${((anomalies.length / list.length) * 100).toFixed(1)}%)`);
  if (anomalies.length > 0) {
    console.table(anomalies);
  }
  return anomalies;
}

const spAnomalies = auditUniverse('./server/data/sp500_universe.json', 'S&P 500');
const nasAnomalies = auditUniverse('./server/data/nasdaq_universe.json', 'NASDAQ 100');
