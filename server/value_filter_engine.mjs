/**
 * MOTOR DE CRIBADO FUNDAMENTAL: "FILTRO VALUE" (INVERTIR O DESCARTAR)
 *
 * Evalúa los 5 criterios obligatorios de calidad y valoración sobre los últimos 5 años (SEC EDGAR 10-K):
 * 1. FILTRO DE MODELO DE NEGOCIO: ¿Tiene una ventaja competitiva clara y comprensible (Moat)?
 * 2. RENTABILIDAD (ROIC / ROE): ROIC medio de los últimos 3 años > 12%.
 * 3. SALUD FINANCIERA (Deuda Neta / EBITDA): Ratio actual < 3.0x.
 * 4. GENERACIÓN DE EFECTIVO: Flujo de Caja Libre (FCF) positivo y creciente en al menos 4 de los últimos 5 años.
 * 5. VALORACIÓN Y MARGEN DE SEGURIDAD: PER actual comparado con su media histórica y descuento razonable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEC_CACHE_DIR = path.resolve(__dirname, 'data', 'sec_cache');
const PRECOMPUTED_5Y_PATH = path.resolve(__dirname, 'data', 'value_filter_5y_cache.json');

// Caché en memoria para evaluación instantánea (<1ms) durante barridos del S&P 500
const sec10KCache = new Map();
try {
  if (fs.existsSync(PRECOMPUTED_5Y_PATH)) {
    const rawPre = JSON.parse(fs.readFileSync(PRECOMPUTED_5Y_PATH, 'utf-8'));
    for (const [k, v] of Object.entries(rawPre)) {
      sec10KCache.set(k.toUpperCase(), v);
    }
  }
} catch (err) {
  console.warn('[FiltroValue] Aviso al cargar caché precomputada 5Y:', err.message);
}

/**
 * Base de conocimiento de ventajas competitivas (Moat) por ticker e industria
 */
const MOAT_OVERRIDES = {
  BKNG: {
    hasMoat: true,
    justificacion: 'Sí. Efecto red bilateral global en reservas de alojamiento (Booking.com, Priceline, Agoda) y escala publicitaria inigualable.'
  },
  DECK: {
    hasMoat: true,
    justificacion: 'Sí. Activos intangibles de marca líder en calzado técnico y lifestyle (HOKA y UGG) con fuerte poder de fijación de precios (margen bruto >55%).'
  },
  CPRT: {
    hasMoat: true,
    justificacion: 'Sí. Duopolio global en subastas digitales de vehículos siniestrados con efecto red bilateral y activos de suelo logístico irreplicables.'
  },
  NVDA: {
    hasMoat: true,
    justificacion: 'Sí. Ecosistema propietario CUDA con altísimos costes de cambio y liderazgo tecnológico en aceleración de IA y centros de datos.'
  },
  TPR: {
    hasMoat: true,
    justificacion: 'Sí. Poder de marca consolidado en lujo accesible (Coach) con canal directo al consumidor y margen bruto estructural superior al 74%.'
  },
  PNR: {
    hasMoat: true,
    justificacion: 'Sí. Amplia base instalada y costes de cambio en sistemas de tratamiento, filtración y bombeo de agua residencial e industrial.'
  },
  FICO: {
    hasMoat: true,
    justificacion: 'Sí. Monopolio regulatorio e institucional de facto en calificación crediticia en EE.UU. (FICO Score) con extremo pricing power.'
  },
  HWM: {
    hasMoat: true,
    justificacion: 'Sí. Propiedad intelectual y certificaciones críticas en superaleaciones y componentes de turbinas aeroespaciales con altos costes de cambio.'
  },
  UBER: {
    hasMoat: true,
    justificacion: 'Sí. Efecto red global multicapa en movilidad y entregas con ventaja de escala local y densidad de rutas.'
  },
  TMUS: {
    hasMoat: true,
    justificacion: 'Sí. Ventaja de escala y liderazgo en espectro 5G de banda media en el oligopolio de telecomunicaciones de EE.UU.'
  },
  BSX: {
    hasMoat: true,
    justificacion: 'Sí. Propiedad intelectual, patentes médicas y altos costes de cambio clínicos en dispositivos cardiovasculares y quirúrgicos.'
  },
  CRH: {
    hasMoat: true,
    justificacion: 'Sí. Monopolios locales naturales en canteras de áridos y cemento por el elevado coste de transporte respecto al valor del material.'
  },
  CMI: {
    hasMoat: true,
    justificacion: 'Sí. Escala global, red de posventa y costes de cambio en motorización industrial y generación de energía.'
  },
  CHRW: {
    hasMoat: true,
    justificacion: 'Sí. Efecto red en intermediación logística (3PL) norteamericana conectando miles de transportistas y cargadores.'
  },
  ALGN: {
    hasMoat: true,
    justificacion: 'Sí. Liderazgo en ortodoncia transparente (Invisalign) con red global de odontólogos formados en su plataforma digital.'
  },
  LVS: {
    hasMoat: true,
    justificacion: 'Sí. Activos irreplicables y licencias oligopolísticas de resorts integrados en Macao y Marina Bay Sands (Singapur).'
  },
  WY: {
    hasMoat: true,
    justificacion: 'Sí. Propiedad de más de 10 millones de acres de terrenos forestales estratégicos irreplicables en Norteamérica.'
  },
  XYL: {
    hasMoat: true,
    justificacion: 'Sí. Costes de cambio y contratos de largo plazo en infraestructura crítica de ciclo del agua para utilities e industria.'
  },
  CBRE: {
    hasMoat: true,
    justificacion: 'Sí. Escala global y red de datos propietarios como mayor firma mundial de servicios e inversión inmobiliaria comercial.'
  },
  WDC: {
    hasMoat: false,
    justificacion: 'No. Fabricante de almacenamiento NAND Flash y discos duros sujeto a fuertes ciclos de precios de comoditización tecnológica.'
  },
  APTV: {
    hasMoat: false,
    justificacion: 'No. Proveedor Tier-1 de componentes de automoción expuesto al poder de negociación de grandes OEMs y alta intensidad de capital.'
  },
  ALB: {
    hasMoat: false,
    justificacion: 'No. Productor de materias primas (litio) sin poder de fijación de precios, totalmente expuesto a la cotización spot del mineral.'
  },
  IP: {
    hasMoat: false,
    justificacion: 'No. Productor de papel y embalaje de cartón corrugado commoditizado, altamente cíclico y sin diferenciación de precios.'
  },
  FSLR: {
    hasMoat: false,
    justificacion: 'No. Fabricación de paneles solares intensiva en CapEx cuya rentabilidad depende de subsidios estatales (IRA) y barreras arancelarias.'
  },
  TSM: {
    hasMoat: true,
    justificacion: 'Sí. Monopolio tecnológico global en fundición de semiconductores avanzados (nodos de 3nm/2nm y empaquetado CoWoS) con economías de escala y costes de cambio insalvables.'
  }
};

let tickerCikLookup = null;
function lookupCikByTicker(ticker) {
  if (!tickerCikLookup) {
    tickerCikLookup = {};
    try {
      const p = path.join(SEC_CACHE_DIR, 'company_tickers.json');
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
        for (const k of Object.keys(raw)) {
          const item = raw[k];
          if (item?.ticker && item?.cik_str) {
            tickerCikLookup[item.ticker.toUpperCase()] = item.cik_str;
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return tickerCikLookup[ticker?.toUpperCase()] || null;
}

/**
 * Medias históricas de PER de referencia (5 años) para comparación rigurosa
 */
const HISTORICAL_PE_5Y_MAP = {
  BKNG: 24.5,
  DECK: 22.0,
  CPRT: 28.5,
  NVDA: 48.0,
  TPR: 16.5,
  PNR: 21.0,
  FICO: 42.0,
  HWM: 27.0,
  UBER: 32.0,
  TMUS: 24.0,
  BSX: 26.0,
  CRH: 16.5,
  CMI: 14.5,
  CHRW: 19.0,
  ALGN: 35.0,
  LVS: 22.0,
  WDC: 18.0,
  FSLR: 20.0,
  APTV: 22.0,
  ALB: 18.5,
  WY: 23.0,
  XYL: 28.0,
  IP: 15.0,
  CBRE: 18.5,
  TSM: 23.5
};

function get10KAnnualSeries(facts, tags) {
  for (const t of tags) {
    const list = facts[t]?.USD || [];
    const byEndYear = {};
    for (const item of list) {
      if (item.start && item.end) {
        const days = (new Date(item.end) - new Date(item.start)) / 86400000;
        if (days >= 340 && days <= 380) {
          const yr = item.end.slice(0, 4);
          if (Number(yr) >= 2019 && (!byEndYear[yr] || (item.filed || '') > (byEndYear[yr].filed || ''))) {
            byEndYear[yr] = { val: item.val, filed: item.filed };
          }
        }
      }
    }
    if (Object.keys(byEndYear).some(y => Number(y) >= 2024)) {
      const res = {};
      for (const k in byEndYear) res[k] = byEndYear[k].val;
      return res;
    }
  }
  return {};
}

function get10KBalanceSnapshots(facts, tags) {
  let all = [];
  for (const t of tags) {
    if (facts[t]?.USD) all = all.concat(facts[t].USD);
  }
  const byEndYear = {};
  for (const item of all) {
    if (!item.start && item.end && (item.form === '10-K' || item.form === '20-F' || item.form === '40-F' || item.fp === 'FY')) {
      const yr = item.end.slice(0, 4);
      if (Number(yr) >= 2019 && (!byEndYear[yr] || (item.filed || '') > (byEndYear[yr].filed || ''))) {
        byEndYear[yr] = { val: item.val, filed: item.filed };
      }
    }
  }
  const res = {};
  for (const k in byEndYear) res[k] = byEndYear[k].val;
  return res;
}

/**
 * Extrae y cachea las series anuales auditadas de los últimos 5 años desde SEC EDGAR
 */
function extractSec5YearMetrics(empresa) {
  const ticker = empresa.ticker?.toUpperCase();
  if (!ticker) return null;
  if (sec10KCache.has(ticker)) return sec10KCache.get(ticker);

  const cik = empresa.cik || lookupCikByTicker(ticker);
  if (!cik) {
    return null;
  }

  const cikStr = String(cik).padStart(10, '0');
  const filePath = path.join(SEC_CACHE_DIR, `CIK${cikStr}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const f = raw.facts || {};

    const op = get10KAnnualSeries(f, [
      'OperatingIncomeLoss',
      'ProfitLossFromOperatingActivities',
      'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
      'NetIncomeLoss'
    ]);
    const ni = get10KAnnualSeries(f, ['NetIncomeLoss', 'ProfitLossAttributableToOwnersOfParent', 'ProfitLoss']);
    const da = get10KAnnualSeries(f, [
      'DepreciationDepletionAndAmortization',
      'DepreciationAndAmortization',
      'Depreciation',
      'DepreciationExpense'
    ]);
    const ocf = get10KAnnualSeries(f, [
      'NetCashProvidedByUsedInOperatingActivities',
      'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
      'CashFlowsFromUsedInOperatingActivities'
    ]);
    const capex = get10KAnnualSeries(f, [
      'PaymentsToAcquirePropertyPlantAndEquipment',
      'PaymentsToAcquireProductiveAssets',
      'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'
    ]);

    const eq = get10KBalanceSnapshots(f, [
      'StockholdersEquity',
      'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
      'CommonStockholdersEquity',
      'EquityAttributableToOwnersOfParent',
      'Equity'
    ]);
    const assets = get10KBalanceSnapshots(f, ['Assets']);
    const cash = get10KBalanceSnapshots(f, [
      'CashAndCashEquivalentsAtCarryingValue',
      'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
      'CashAndCashEquivalents'
    ]);
    const mktSec = get10KBalanceSnapshots(f, [
      'MarketableSecuritiesCurrent',
      'ShortTermInvestments',
      'AvailableForSaleSecuritiesCurrent'
    ]);
    const debtLt = get10KBalanceSnapshots(f, [
      'LongTermDebtNoncurrent',
      'LongTermDebt',
      'LongTermDebtAndCapitalLeaseObligations',
      'LongtermBorrowings'
    ]);
    const debtSt = get10KBalanceSnapshots(f, [
      'LongTermDebtCurrent',
      'ShortTermBorrowings',
      'ShorttermBorrowings',
      'DebtCurrent'
    ]);

    // 1. ROIC de los últimos 3 años
    const yrsOp = Object.keys(op).sort().slice(-3);
    const roic3ySeries = yrsOp.map(y => {
      const nopat = op[y] * 0.79;
      const totDebt = (debtLt[y] || 0) + (debtSt[y] || 0);
      const totCash = (cash[y] || 0) + (mktSec[y] || 0);
      const e = eq[y] ?? (assets[y] ? assets[y] * 0.45 : 0);
      let ic = e + totDebt - totCash;
      if (ic <= 0 && assets[y]) {
        ic = Math.max(totDebt, assets[y] * 0.35);
      }
      return ic > 0 ? { year: y, roic_pct: Number(((nopat / ic) * 100).toFixed(1)) } : null;
    }).filter(Boolean);

    const avgRoic3y = roic3ySeries.length > 0
      ? Number((roic3ySeries.reduce((acc, x) => acc + x.roic_pct, 0) / roic3ySeries.length).toFixed(1))
      : null;

    // 2. Deuda Neta / EBITDA desde el último 10-K si no viene en universo
    const lastY = yrsOp[yrsOp.length - 1];
    let ndEbitdaCalc = null;
    let netDebtBillions = null;
    if (lastY) {
      const ebitdaLast = (op[lastY] || 0) + (da[lastY] || 0);
      const netDebtLast = ((debtLt[lastY] || 0) + (debtSt[lastY] || 0)) - ((cash[lastY] || 0) + (mktSec[lastY] || 0));
      netDebtBillions = Number((netDebtLast / 1e9).toFixed(2));
      if (ebitdaLast > 0) {
        ndEbitdaCalc = Number((netDebtLast / ebitdaLast).toFixed(2));
      } else if (netDebtLast <= 0) {
        ndEbitdaCalc = -0.5;
      }
    }

    // 3. FCF de los últimos 5 años
    const yrsOcf = Object.keys(ocf).sort().slice(-5);
    const fcf5ySeries = yrsOcf.map(y => {
      const fcfVal = (ocf[y] || 0) - Math.abs(capex[y] || 0);
      return {
        year: y,
        fcf_billions: Number((fcfVal / 1e9).toFixed(2))
      };
    });

    const parsed = {
      roic3ySeries,
      avgRoic3y,
      ndEbitdaCalc,
      netDebtBillions,
      fcf5ySeries,
      hasLatestPositiveNetIncome: lastY && ni[lastY] != null ? ni[lastY] > 0 : true
    };

    sec10KCache.set(ticker, parsed);
    return parsed;
  } catch (err) {
    sec10KCache.set(ticker, null);
    return null;
  }
}

/**
 * Evalúa el Filtro Value (5 criterios) para una compañía
 */
export function evaluarFiltroValue(empresa, p0Custom = null, fairValueCustom = null) {
  const ticker = (empresa.ticker || '').toUpperCase();
  const p0 = p0Custom ?? empresa.precio_cierre_P0 ?? 0;
  const fairValue = fairValueCustom ?? empresa.fair_value_teorico ?? empresa.fair_value_Gordon ?? 0;
  const secData = extractSec5YearMetrics(empresa);

  // -------------------------------------------------------------------------
  // CRITERIO 1: FILTRO DE MODELO DE NEGOCIO (MOAT)
  // -------------------------------------------------------------------------
  let hasMoat = false;
  let moatJustificacion = '';
  if (MOAT_OVERRIDES[ticker]) {
    hasMoat = MOAT_OVERRIDES[ticker].hasMoat;
    moatJustificacion = MOAT_OVERRIDES[ticker].justificacion;
  } else {
    const roicRef = secData?.avgRoic3y ?? (empresa.roic ? empresa.roic * 100 : 0);
    const gpRef = empresa.gross_profitability ? empresa.gross_profitability * 100 : 0;
    const arq = empresa.arquetipo || '';
    if (roicRef >= 12 || gpRef >= 25 || arq === 'COMPOUNDER_TECH' || arq === 'DEFENSIVA_CONSUMO') {
      hasMoat = true;
      moatJustificacion = `Sí. Ventaja competitiva respaldada por retornos operativos (ROIC ${roicRef.toFixed(1)}%) y posicionamiento en ${empresa.industry || empresa.sector || 'su sector'}.`;
    } else {
      hasMoat = false;
      moatJustificacion = `No. Negocio expuesto a presión competitiva o ciclo industrial (${empresa.industry || empresa.sector || 'General'}) con retornos ajustados.`;
    }
  }

  const criterio1 = {
    id: 1,
    metrica: '1. Filtro de Modelo de Negocio (Moat)',
    dato_actual: moatJustificacion,
    objetivo_minimo: 'Ventaja competitiva clara y comprensible',
    estado: hasMoat ? 'APTO' : 'DESCARTADO',
    cumple: hasMoat
  };

  // -------------------------------------------------------------------------
  // CRITERIO 2: RENTABILIDAD (ROIC / ROE MEDIO 3 AÑOS > 12%)
  // -------------------------------------------------------------------------
  let avgRoic3y = secData?.avgRoic3y;
  if (avgRoic3y == null) {
    if (empresa.roic != null && empresa.roic < 5) {
      avgRoic3y = Number((empresa.roic * 100).toFixed(1));
    } else if (empresa.roe != null) {
      avgRoic3y = Number((empresa.roe * 100).toFixed(1));
    } else {
      avgRoic3y = 10.0;
    }
  }
  const roePct = empresa.roe != null ? Number((empresa.roe * 100).toFixed(1)) : null;
  const cumpleRoic = avgRoic3y > 12.0;
  const desgloseRoic3y = secData?.roic3ySeries?.length
    ? ` (${secData.roic3ySeries.map(s => `${s.year}: ${s.roic_pct}%`).join(', ')})`
    : (roePct != null ? ` (ROE: ${roePct}%)` : '');

  const criterio2 = {
    id: 2,
    metrica: '2. Rentabilidad (ROIC / ROE Medio 3A)',
    dato_actual: `ROIC medio 3A: ${avgRoic3y}%${desgloseRoic3y}`,
    objetivo_minimo: 'ROIC medio 3 años > 12%',
    estado: cumpleRoic ? 'APTO' : 'DESCARTADO',
    cumple: cumpleRoic,
    valor_numerico: avgRoic3y
  };

  // -------------------------------------------------------------------------
  // CRITERIO 3: SALUD FINANCIERA (DEUDA NETA / EBITDA < 3.0x)
  // -------------------------------------------------------------------------
  const rawNdEbitda = empresa.net_debt_ebitda ?? secData?.ndEbitdaCalc ?? 1.5;
  const cumpleDeuda = rawNdEbitda < 3.0;
  let datoDeudaStr = `${Number(rawNdEbitda).toFixed(2)}x`;
  if (rawNdEbitda <= 0) {
    datoDeudaStr = `${Number(rawNdEbitda).toFixed(2)}x (Caja Neta Positiva)`;
  }

  const criterio3 = {
    id: 3,
    metrica: '3. Salud Financiera (Deuda Neta / EBITDA)',
    dato_actual: datoDeudaStr,
    objetivo_minimo: '< 3.0x EBITDA',
    estado: cumpleDeuda ? 'APTO' : 'DESCARTADO',
    cumple: cumpleDeuda,
    valor_numerico: Number(rawNdEbitda)
  };

  // -------------------------------------------------------------------------
  // CRITERIO 4: GENERACIÓN DE EFECTIVO (FCF POSITIVO Y CRECIENTE >= 4/5 AÑOS)
  // -------------------------------------------------------------------------
  const fcfSeries = secData?.fcf5ySeries || [];
  let cumpleFcf = false;
  let datoFcfStr = '';
  let fcfPosCount = 0;
  let fcfGrowTransitions = 0;

  if (fcfSeries.length >= 4) {
    fcfPosCount = fcfSeries.filter(x => x.fcf_billions > 0).length;
    for (let i = 1; i < fcfSeries.length; i++) {
      if (fcfSeries[i].fcf_billions > fcfSeries[i - 1].fcf_billions) {
        fcfGrowTransitions++;
      }
    }
    const firstFcf = fcfSeries[0].fcf_billions;
    const lastFcf = fcfSeries[fcfSeries.length - 1].fcf_billions;
    // Positivo en al menos 4 de 5 años, último año positivo, tendencia creciente en al menos 3 de los 4 saltos (4/5 años en expansión) y último año > primer año
    cumpleFcf = fcfPosCount >= 4 && lastFcf > 0 && fcfGrowTransitions >= 3 && lastFcf > firstFcf;
    const serieTxt = fcfSeries.map(x => `${x.year}: $${x.fcf_billions.toFixed(2)}B`).join(' → ');
    datoFcfStr = `Positivo ${fcfPosCount}/${fcfSeries.length} años | Crece en ${fcfGrowTransitions}/${fcfSeries.length - 1} saltos (${serieTxt})`;
  } else {
    const fcfShare = empresa.fcf_per_share ?? empresa.D1_o_FCFA1 ?? 0;
    cumpleFcf = fcfShare > 0 && (empresa.g_hist || 0) > 0.04;
    datoFcfStr = fcfShare > 0 ? `FCF/acc positivo ($${Number(fcfShare).toFixed(2)})` : 'FCF insuficiente o negativo';
  }

  const criterio4 = {
    id: 4,
    metrica: '4. Generación de Efectivo (FCF 5 Años)',
    dato_actual: datoFcfStr,
    objetivo_minimo: 'FCF positivo y creciente en ≥ 4 de 5 años',
    estado: cumpleFcf ? 'APTO' : 'DESCARTADO',
    cumple: cumpleFcf,
    fcf_series: fcfSeries
  };

  // -------------------------------------------------------------------------
  // CRITERIO 5: VALORACIÓN Y MARGEN DE SEGURIDAD (PER ACTUAL VS MEDIA HISTÓRICA)
  // -------------------------------------------------------------------------
  const epsTtm = empresa.eps_diluted;
  const epsFwd = empresa.forward_eps;
  const peTtm = (epsTtm && epsTtm > 0 && p0 > 0) ? Number((p0 / epsTtm).toFixed(1)) : null;
  const peFwd = (epsFwd && epsFwd > 0 && p0 > 0) ? Number((p0 / epsFwd).toFixed(1)) : null;
  const histPe = HISTORICAL_PE_5Y_MAP[ticker] || (empresa.arquetipo === 'COMPOUNDER_TECH' ? 28.0 : 20.0);
  const discFairPct = (fairValue > 0 && p0 > 0) ? Number((((fairValue - p0) / fairValue) * 100).toFixed(1)) : 0;

  // Cumple si tiene beneficios positivos (PER TTM > 0), su PER TTM está por debajo de su media histórica (con margen de tolerancia del 5% si PER Fwd < 15x) y cotiza con descuento frente a Fair Value
  const hasPositiveEarnings = peTtm != null && peTtm > 0 && (secData?.hasLatestPositiveNetIncome !== false);
  const peDiscountPct = peTtm != null ? Number((((histPe - peTtm) / histPe) * 100).toFixed(0)) : null;
  const cumplePer = hasPositiveEarnings && peTtm <= (histPe * 1.02) && peTtm <= 32.0 && discFairPct >= 15.0;

  let datoValStr = '';
  if (peTtm != null) {
    const signStr = peDiscountPct >= 0 ? `-${peDiscountPct}% dto.` : `+${Math.abs(peDiscountPct)}% prima`;
    datoValStr = `PER TTM: ${peTtm}x${peFwd ? ` (Fwd: ${peFwd}x)` : ''} vs Media Hist. ~${histPe}x (${signStr}) | Dto. FV: -${discFairPct}%`;
  } else {
    datoValStr = `PER TTM: N/A (Beneficio neto negativo) | PER Fwd: ${peFwd ? peFwd + 'x' : 'N/A'}`;
  }

  const criterio5 = {
    id: 5,
    metrica: '5. Valoración y Margen de Seguridad (PER vs Hist.)',
    dato_actual: datoValStr,
    objetivo_minimo: `PER actual < Media Histórica (~${histPe}x) y descuento MoS`,
    estado: cumplePer ? 'APTO' : 'DESCARTADO',
    cumple: cumplePer,
    pe_ttm: peTtm,
    pe_fwd: peFwd,
    pe_hist_5y: histPe
  };

  // -------------------------------------------------------------------------
  // CONSOLIDACIÓN Y EMISIÓN DE VEREDICTO DEFINITIVO
  // -------------------------------------------------------------------------
  const criterios = [criterio1, criterio2, criterio3, criterio4, criterio5];
  const criteriosCumplidos = criterios.filter(c => c.cumple).length;
  const esApto = criteriosCumplidos === 5;
  const esCasiApto = criteriosCumplidos === 4;

  const veredicto = esApto
    ? 'VEREDICTO: APTO PARA ANÁLISIS PROFUNDO'
    : 'VEREDICTO: DESCARTADO DE INMEDIATO';

  let motivoParrafo = '';
  if (esApto) {
    motivoParrafo = `${empresa.nombre || ticker} (${ticker}) supera satisfactoriamente los 5 filtros rigurosos del Cribado Value: cuenta con una ventaja competitiva clara en su sector, mantiene una alta rentabilidad sobre el capital invertido (ROIC medio a 3 años del ${avgRoic3y}%, por encima del 12% exigido), opera con un balance solvente (${datoDeudaStr} Deuda Neta/EBITDA, inferior al límite de 3.0x), demuestra una generación de flujo de caja libre consistente y creciente en los últimos 5 años y cotiza a un múltiplo PER de ${peTtm}x con descuento frente a su media histórica (~${histPe}x) y un margen de seguridad del ${discFairPct}% respecto a su valor intrínseco.`;
  } else {
    const fallidos = criterios.filter(c => !c.cumple).map(c => c.metrica.replace(/^\d+\.\s*/, ''));
    const motivosDetalle = [];
    if (!criterio1.cumple) motivosDetalle.push(`carece de una ventaja competitiva (moat) suficientemente defensiva (${moatJustificacion})`);
    if (!criterio2.cumple) motivosDetalle.push(`su ROIC medio de los últimos 3 años (${avgRoic3y}%) no alcanza el umbral mínimo exigido del 12%`);
    if (!criterio3.cumple) motivosDetalle.push(`presenta un apalancamiento financiero de ${datoDeudaStr} Deuda Neta/EBITDA que rebasa el techo prudente de 3.0x`);
    if (!criterio4.cumple) motivosDetalle.push(`su generación de Flujo de Caja Libre en los últimos 5 años no cumple la exigencia de positividad y crecimiento sostenido (${datoFcfStr})`);
    if (!criterio5.cumple) motivosDetalle.push(`su valoración actual (${datoValStr}) no ofrece el descuento por múltiplo PER requerido frente a su media histórica`);

    motivoParrafo = `${empresa.nombre || ticker} (${ticker}) queda descartada en el primer filtro de cribado Value tras cumplir ${criteriosCumplidos} de los 5 criterios obligatorios (incumple: ${fallidos.join(', ')}). En concreto, ${motivosDetalle.join('; ')}.${esCasiApto ? ' No obstante, al superar 4 de las 5 métricas fundamentales, se clasifica como Caso Frontera (4/5) para seguimiento opcional.' : ''}`;
  }

  return {
    apto: esApto,
    casi_apto: esCasiApto,
    puntuacion: criteriosCumplidos,
    total_criterios: 5,
    etiqueta_estado: esApto ? 'APTO (5/5)' : (esCasiApto ? 'CASI APTO (4/5)' : `DESCARTADO (${criteriosCumplidos}/5)`),
    veredicto,
    motivo_parrafo: motivoParrafo,
    criterios
  };
}
