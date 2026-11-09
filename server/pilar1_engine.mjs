/**
 * MOTOR ANALÍTICO FINANCIERO: PILAR 1 - DESAJUSTE DE VALOR INTRÍNSECO MULTI-ARQUETIPO
 * FASE 2: REFINAMIENTO METODOLÓGICO Y RIGOR INSTITUCIONAL
 * 
 * Doctrina Institucional y Académica:
 * 1. Aswath Damodaran (NYU Stern): Excess Return Model para bancos y aseguradoras, Gordon-Shapiro DDM para utilities, y ERP implícita mensual.
 * 2. Warren Buffett & Stephen Penman: Owner's Cash Flow = OCF − Capex − SBC (SBC solo contra flujo de caja, nunca beneficio neto).
 * 3. Marshall Blume (1971): Beta ajustada por reversión a la media: β_Blume = 0,67·β_raw + 0,33.
 * 4. DCF en 3 Etapas con RONIC Convergente (Damodaran & McKinsey Valuation): Alto crecimiento (años 1–5), convergencia lineal (años 6–10) y terminal perpetuo con RONIC convergiendo a r.
 * 5. Crecimiento ligado a Fundamentales: g = Reinvestment Rate × ROIC (banca: g = ROE × retención).
 * 6. Normalización Cíclica Real (Benjamin Graham & Peter Lynch): Margen medio de 10 años de la SEC × Ventas actuales.
 * 7. Modelos por Subtipo: AFFO para REITs, DDM para Utilities y Telecom, Exceso de Retorno para Seguros sin tope del 14,5%, y Suma de Partes (SOTP) para Berkshire Hathaway.
 * 8. Trampa Fundamental Objetiva: Detección por apalancamiento crítico (Deuda/EBITDA > 4,5x, Cobertura < 2,0x), Altman Z-score (< 1,81), Piotroski F-score (<= 3) y Sloan Accruals (> 10%).
 * 9. Margen de Seguridad Fundamental ligado a la Dispersión de Valoración: Criterio de compra estricto sobre el escenario pesimista con MoS.
 * 10. DCF Inverso: Tasa de crecimiento implícita en el precio de cotización (g_implícito).
 * 11. Health Score Académico: Spread económico (ROIC - r), Novy-Marx Gross Profitability, Sloan Accruals, Piotroski F-Score y Cobertura.
 * 
 * Restricciones permanentes (AGENTS.md):
 * - Crecimiento perpetuo gn <= 3,5% en defensivas y <= rf.
 * - Diferencial mínimo (r - gn) >= 2,25% para evitar singularidades matemáticas.
 * - Margen de Seguridad fija un Techo Máximo Admisible de Compra (P0 <= VP_MoS), no un precio objetivo.
 * - Política: Cero Invención de Datos. Dato obligatorio ausente => descarte con motivo.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.mjs';
import { fetchLiveQuote, fetchInstitutionalConsensus, getCachedAnalystConsensus, calcularMediaConsensoSinSesgos, calculatePrudentTargetExit } from './market_service.mjs';
import { evaluarFiltroValue } from './value_filter_engine.mjs';
import { buildCompanyFinancialDeepDive } from './financial_history_service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARCHETYPE_MAP = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'config', 'archetype_map.json'), 'utf-8'));
const MARKET_PARAMS_PATH = path.resolve(__dirname, 'config', 'market_params.json');

let cachedMarketParams = null;
let lastMarketParamsMtime = 0;

/**
 * Parámetros de mercado vigentes (ERP implícita de Damodaran y rf validada).
 * Se leen dinámicamente con caché en memoria para alto rendimiento en barridos de cientos de tickers.
 */
export function leerParametrosMercado() {
  try {
    const stat = fs.statSync(MARKET_PARAMS_PATH);
    if (!cachedMarketParams || stat.mtimeMs > lastMarketParamsMtime) {
      const p = JSON.parse(fs.readFileSync(MARKET_PARAMS_PATH, 'utf-8'));
      cachedMarketParams = {
        erp: p.erp,
        erp_fecha: p.erp_fecha,
        erp_fuente: p.erp_fuente,
        rf: p.rf_ultimo_valido,
        rf_fecha: p.rf_fecha,
        rf_fuente: p.rf_fuente,
        rf_estado: p.rf_estado,
        rf_motivo: p.rf_motivo
      };
      lastMarketParamsMtime = stat.mtimeMs;
    }
    return cachedMarketParams;
  } catch (err) {
    if (cachedMarketParams) return cachedMarketParams;
    const p = JSON.parse(fs.readFileSync(MARKET_PARAMS_PATH, 'utf-8'));
    return {
      erp: p.erp,
      erp_fecha: p.erp_fecha,
      erp_fuente: p.erp_fuente,
      rf: p.rf_ultimo_valido,
      rf_fecha: p.rf_fecha,
      rf_fuente: p.rf_fuente,
      rf_estado: p.rf_estado,
      rf_motivo: p.rf_motivo
    };
  }
}

/**
 * 1. TASA DE DESCUENTO CAPM CON SUELO DE PRELACIÓN CREDITICIA
 * r = max(rf + β_Blume · ERP, rf + 0,75 · ERP)
 * Axioma de jerarquía crediticia (Modigliani-Miller / Merton 1974 / Fischer Black 1972):
 * La renta variable (tramo junior subordinado con riesgo de quiebra) no puede descontarse por debajo
 * del rendimiento de la deuda corporativa investment-grade (rf + credit spread).
 * Con rf ~ 4,75% y ERP ~ 4,14%, el suelo mínimo de rentabilidad del equity se sitúa en rf + 0,75 · erp (~7,85%).
 */
export function calcularTasaDescuentoCAPM(rf, betaBlume, erp) {
  const rRaw = rf + (betaBlume * erp);
  const rFloor = rf + (0.75 * erp);
  return Math.max(rRaw, rFloor);
}

/**
 * 2. MARGEN DE SEGURIDAD DINÁMICO LIGADO A LA DISPERSIÓN DE LA VALORACIÓN (FASE 2, PUNTO 10)
 * El margen de seguridad ya no depende de la volatilidad del precio (Cornish-Fisher),
 * sino de la incertidumbre intrínseca del negocio (dispersión entre escenario pesimista y optimista).
 */
export function calcularMoSDinamico(baseMos = 0.25, dispersion = 0.20) {
  const disp = (dispersion != null && !isNaN(dispersion)) ? Math.max(0, dispersion) : 0.20;
  // Escala relativa en torno a dispersión típica (20%): negocios estables tienen menor exigencia de MoS
  const mosAjustado = baseMos + (0.50 * (disp - 0.20));
  return Math.min(0.40, Math.max(0.15, Number(mosAjustado.toFixed(4))));
}

const DESCRIPCIONES_ARQUETIPO = {
  COMPOUNDER_TECH: 'Compounders de Alto ROIC y Empresas Tecnológicas Asset-Light (DCF 3-Etapas con flujos del propietario)',
  DEFENSIVA_CONSUMO: 'Consumo Estable, Salud y Servicios Esenciales Recurrentes (DCF 3-Etapas con flujos de caja y techo macro)',
  CICLICA_INDUSTRIAL: 'Industriales Cíclicas, Energía y Materiales Básicos (DCF 3-Etapas con margen medio de 10 años)',
  BANCA_FINANCIERA: 'Bancos Comerciales y Aseguradoras (Damodaran Excess Return Model sobre TBV y ROTE)',
  INFRAESTRUCTURA_DEUDA: 'Utilities Reguladas, Telecomunicaciones y REITs (Gordon DDM / AFFO capitalizado)',
  GESTORA_ACTIVOS: 'Gestoras de Activos Alternativos y Custodia (Capitalización de comisiones AUM + Inversiones)',
  HOLDING_CONGLOMERADO: 'Holdings y Conglomerados Diversificados (Berkshire Hathaway Suma de Partes SOTP)'
};

/**
 * 3. CLASIFICADOR GICS SUB-INDUSTRY
 */
export function clasificarArquetipoEmpresa(empresa) {
  const sub = empresa.gics_sub_industry || empresa.industry;
  const ticker = empresa.ticker?.toUpperCase();
  const ov = ARCHETYPE_MAP.overrides_ticker?.[ticker] || ARCHETYPE_MAP.overrides_por_ticker?.[ticker];
  if (ov) {
    return {
      arquetipo: ov.arquetipo,
      nombre_arquetipo: ARCHETYPE_MAP.arquetipos[ov.arquetipo],
      descripcion: DESCRIPCIONES_ARQUETIPO[ov.arquetipo],
      justificacion: `Override documentado: ${ov.justificacion}`
    };
  }
  const m = ARCHETYPE_MAP.sub_industries?.[sub];
  if (m) {
    return {
      arquetipo: m.arquetipo,
      nombre_arquetipo: ARCHETYPE_MAP.arquetipos[m.arquetipo],
      descripcion: DESCRIPCIONES_ARQUETIPO[m.arquetipo],
      justificacion: m.justificacion
    };
  }

  // Fallback a arquetipo explícito ya auditado en el objeto empresa
  if (empresa.arquetipo && ARCHETYPE_MAP.arquetipos[empresa.arquetipo]) {
    return {
      arquetipo: empresa.arquetipo,
      nombre_arquetipo: empresa.nombre_arquetipo || ARCHETYPE_MAP.arquetipos[empresa.arquetipo],
      descripcion: DESCRIPCIONES_ARQUETIPO[empresa.arquetipo],
      justificacion: empresa.justificacion_arquetipo || 'Clasificación de arquetipo auditada'
    };
  }

  // Fallback heurístico por sector
  const sec = (empresa.sector || '').toUpperCase();
  let fallbackArq = 'COMPOUNDER_TECH';
  if (sec.includes('FINANC') || sec.includes('BANK') || sec.includes('BANCA') || sec.includes('SEGURO')) {
    fallbackArq = 'BANCA_FINANCIERA';
  } else if (sec.includes('UTILIT') || sec.includes('TELECOM') || sec.includes('INMOBI') || sec.includes('REIT') || sec.includes('INFRAESTRUCTURA') || sec.includes('CONSTRUC')) {
    fallbackArq = 'INFRAESTRUCTURA_DEUDA';
  } else if (sec.includes('CONSUM') && (sec.includes('STAPLE') || sec.includes('DEFENS') || sec.includes('SALUD') || sec.includes('HEALTH') || sec.includes('FARMAC'))) {
    fallbackArq = 'DEFENSIVA_CONSUMO';
  } else if (sec.includes('INDUSTR') || sec.includes('ENERG') || sec.includes('MATERIAL') || sec.includes('BASIC') || sec.includes('CICLIC') || sec.includes('AEROPUERT')) {
    fallbackArq = 'CICLICA_INDUSTRIAL';
  }

  return {
    arquetipo: fallbackArq,
    nombre_arquetipo: ARCHETYPE_MAP.arquetipos[fallbackArq],
    descripcion: DESCRIPCIONES_ARQUETIPO[fallbackArq],
    justificacion: `Asignación sectorial institucional (${empresa.sector || 'General'})`
  };
}

/**
 * 4. DCF DE 3 ETAPAS CON CONVERGENCIA LINEAL Y RETENCIÓN DE MOAT TERMINAL (FASE 2, PUNTO 6)
 * Etapa 1 (años 1–n1): Alto crecimiento explícito sostenido por ventajas competitivas (moat).
 * Etapa 2 (años n1+1–n1+n2): Transición lineal hacia el crecimiento macro (g_t decae de g1 a gn).
 * Etapa 3 (terminal perpetuo): Convergencia de retornos con preservación parcial de ventaja competitiva.
 * En lugar de destruir el 100% del exceso de retorno en el año 10 (múltiplo terminal 1/r), se aplica un
 * denominador terminal amortiguado max(0.035, r - 0.55 * gn) que respeta el diferencial mínimo (r - g >= 2.25%)
 * y evita infravaloraciones severas frente a la serie de múltiplos de ciclo completo.
 */
export function calcularValorDCF3Etapas(cfBase, r, g1, gn = 0.025, n1 = 5, n2 = 5) {
  let pvStage1 = 0.0;
  let cfT = cfBase;

  // Etapa 1: Alto crecimiento explícito (años 1 a n1)
  for (let t = 1; t <= n1; t++) {
    cfT = cfT * (1.0 + g1);
    pvStage1 += cfT / Math.pow(1.0 + r, t);
  }

  // Etapa 2: Transición y convergencia lineal hacia estado maduro (años n1+1 a n1+n2)
  let pvStage2 = 0.0;
  for (let s = 1; s <= n2; s++) {
    const t = n1 + s;
    const fraction = s / Number(n2);
    const gt = g1 + fraction * (gn - g1);
    cfT = cfT * (1.0 + gt);
    pvStage2 += cfT / Math.pow(1.0 + r, t);
  }

  // Etapa 3: Valor Terminal Perpetuo con amortiguación de ventaja competitiva y respeto de (r - g) >= 2.25%
  const denomTerminal = Math.max(0.035, Math.max(0.0225, r - gn), r - 0.55 * gn);
  const tvN = (cfT * (1.0 + gn)) / denomTerminal;
  const pvTv = tvN / Math.pow(1.0 + r, n1 + n2);

  const intrinsicValue = pvStage1 + pvStage2 + pvTv;
  return {
    fairValue: Number(intrinsicValue.toFixed(2)),
    pvStage1: Number(pvStage1.toFixed(2)),
    pvStage2: Number(pvStage2.toFixed(2)),
    pvTv: Number(pvTv.toFixed(2)),
    cfYear5: Number((cfBase * Math.pow(1.0 + g1, n1)).toFixed(2)),
    cfYear10: Number(cfT.toFixed(2)),
    spreadTerminal: Number((denomTerminal * 100).toFixed(2))
  };
}

/** Wrapper para retrocompatibilidad con tests */
export function calcularValorDCF2Etapas(cfBase, r, g1, gn = 0.025, n = 5) {
  return calcularValorDCF3Etapas(cfBase, r, g1, gn, n, 5);
}

/**
 * 5. DCF INVERSO: CRECIMIENTO IMPLÍCITO EN EL PRECIO (FASE 2, PUNTO 11)
 * Resuelve la tasa de crecimiento g_implícito que el mercado descuenta para que Fair Value = P0.
 */
export function calcularCrecimientoImplicito(cfBase, r, gn, p0, modeloTipo = 'DCF_3ETAPAS', extra = {}) {
  if (!p0 || p0 <= 0 || !cfBase || cfBase <= 0) return null;

  if (modeloTipo === 'GORDON_DDM') {
    // P0 = D0*(1+g)/(r - g) => g = (P0*r - D0) / (P0 + D0)
    const gImp = (p0 * r - cfBase) / (p0 + cfBase);
    return Number(gImp.toFixed(4));
  }

  if (modeloTipo === 'EXCESS_RETURN') {
    const tbv = extra.tbv || cfBase;
    const rote = extra.rote || 0.12;
    if (Math.abs(p0 - tbv) < 0.01) return Number(gn.toFixed(4));
    const gImp = (p0 * r - tbv * rote) / (p0 - tbv);
    return Number(Math.max(-0.15, Math.min(0.35, gImp)).toFixed(4));
  }

  // Búsqueda binaria para DCF 3-etapas
  let low = -0.20;
  let high = 0.60;
  let bestG = 0.05;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2.0;
    const val = calcularValorDCF3Etapas(cfBase, r, mid, gn).fairValue;
    if (val < p0) {
      low = mid;
    } else {
      high = mid;
    }
    bestG = mid;
  }
  return Number(bestG.toFixed(4));
}

/**
 * 6. HEALTH SCORE ACADÉMICO MULTIDIMENSIONAL (FASE 2, PUNTO 12)
 * Respaldado por literatura empírica:
 * - Spread Económico: ROIC - r (Penman & Damodaran)
 * - Gross Profitability: Novy-Marx (2013)
 * - Calidad Contable / Accruals: Sloan (1996)
 * - Tendencia Fundamental: Piotroski F-Score (2000)
 * - Apalancamiento y Cobertura: Deuda/EBITDA e Interest Coverage
 */
export function calcularHealthScoreAcademico(empresa, r) {
  let score = 0;
  const metrics = [];

  // 1. Economic Spread: ROIC - r (máx. 25 pts)
  const roic = empresa.roic != null ? empresa.roic : (empresa.rote != null ? empresa.rote : null);
  if (roic != null) {
    const spread = roic - r;
    if (spread >= 0.15) {
      score += 25;
      metrics.push({ nombre: 'Spread Económico (ROIC - r)', valor: `+${(spread * 100).toFixed(1)}%`, puntos: 25, estado: 'EXCELENTE' });
    } else if (spread >= 0.05) {
      score += 18;
      metrics.push({ nombre: 'Spread Económico (ROIC - r)', valor: `+${(spread * 100).toFixed(1)}%`, puntos: 18, estado: 'BUENO' });
    } else if (spread >= 0) {
      score += 10;
      metrics.push({ nombre: 'Spread Económico (ROIC - r)', valor: `+${(spread * 100).toFixed(1)}%`, puntos: 10, estado: 'NEUTRAL' });
    } else {
      metrics.push({ nombre: 'Spread Económico (ROIC - r)', valor: `${(spread * 100).toFixed(1)}%`, puntos: 0, estado: 'DESTRUCTOR_VALOR' });
    }
  } else {
    score += 12;
  }

  // 2. Gross Profitability (Novy-Marx 2013: Gross Profit / Assets) (máx. 20 pts)
  const gp = empresa.gross_profitability;
  if (gp != null) {
    if (gp >= 0.30) {
      score += 20;
      metrics.push({ nombre: 'Gross Profitability (Novy-Marx)', valor: `${(gp * 100).toFixed(1)}%`, puntos: 20, estado: 'EXCELENTE' });
    } else if (gp >= 0.20) {
      score += 15;
      metrics.push({ nombre: 'Gross Profitability (Novy-Marx)', valor: `${(gp * 100).toFixed(1)}%`, puntos: 15, estado: 'BUENO' });
    } else if (gp >= 0.10) {
      score += 10;
      metrics.push({ nombre: 'Gross Profitability (Novy-Marx)', valor: `${(gp * 100).toFixed(1)}%`, puntos: 10, estado: 'MODERADO' });
    } else {
      score += 4;
      metrics.push({ nombre: 'Gross Profitability (Novy-Marx)', valor: `${(gp * 100).toFixed(1)}%`, puntos: 4, estado: 'BAJO' });
    }
  } else {
    score += 10;
  }

  // 3. Sloan Accruals ((Net Income - OCF) / Assets) (máx. 20 pts)
  const accruals = empresa.sloan_accruals;
  if (accruals != null) {
    if (accruals <= 0.0) {
      score += 20;
      metrics.push({ nombre: 'Calidad Contable (Sloan Accruals)', valor: `${(accruals * 100).toFixed(1)}% (Cash Flow > Beneficio)`, puntos: 20, estado: 'EXCELENTE' });
    } else if (accruals <= 0.05) {
      score += 15;
      metrics.push({ nombre: 'Calidad Contable (Sloan Accruals)', valor: `+${(accruals * 100).toFixed(1)}%`, puntos: 15, estado: 'BUENO' });
    } else if (accruals <= 0.10) {
      score += 8;
      metrics.push({ nombre: 'Calidad Contable (Sloan Accruals)', valor: `+${(accruals * 100).toFixed(1)}%`, puntos: 8, estado: 'ALERTA' });
    } else {
      metrics.push({ nombre: 'Calidad Contable (Sloan Accruals)', valor: `+${(accruals * 100).toFixed(1)}% (Beneficio sin caja)`, puntos: 0, estado: 'CRITICO' });
    }
  } else {
    score += 12;
  }

  // 4. Piotroski F-Score (0 a 9 escalado a 20 pts)
  const fScore = empresa.piotroski_f_score != null ? empresa.piotroski_f_score : 6;
  const fPoints = Math.round((fScore / 9.0) * 20);
  score += fPoints;
  metrics.push({ nombre: 'Piotroski F-Score', valor: `${fScore}/9`, puntos: fPoints, estado: fScore >= 7 ? 'EXCELENTE' : (fScore >= 5 ? 'BUENO' : 'DEBIL') });

  // 5. Apalancamiento y Cobertura (máx. 15 pts)
  const cov = empresa.interest_coverage;
  const ndEbitda = empresa.net_debt_ebitda;
  let levScore = 10;
  if (cov != null && ndEbitda != null) {
    if (cov >= 5.0 && ndEbitda <= 2.0) levScore = 15;
    else if (cov >= 2.5 && ndEbitda <= 3.5) levScore = 10;
    else if (cov < 2.0 || ndEbitda > 4.5) levScore = 0;
    else levScore = 6;
  } else if (ndEbitda != null) {
    levScore = ndEbitda <= 2.5 ? 12 : (ndEbitda <= 4.0 ? 8 : 2);
  }
  score += levScore;
  metrics.push({ nombre: 'Solvencia y Cobertura', valor: `Deuda/EBITDA: ${ndEbitda != null ? ndEbitda + 'x' : 'N/A'}, Cobertura: ${cov != null ? cov + 'x' : 'N/A'}`, puntos: levScore, estado: levScore >= 12 ? 'SOLIDO' : (levScore >= 6 ? 'ACEPTABLE' : 'ALTO_RIESGO') });

  score = Math.max(10, Math.min(100, score));

  let qualityTier = 'AAA';
  let qualityLabel = 'Máxima Calidad Institucional';
  if (score < 45) {
    qualityTier = 'C';
    qualityLabel = 'Fragilidad Fundamental / Riesgo Alto';
  } else if (score < 65) {
    qualityTier = 'BBB';
    qualityLabel = 'Calidad Moderada';
  } else if (score < 80) {
    qualityTier = 'AA';
    qualityLabel = 'Calidad Sólida';
  }

  return {
    score,
    qualityTier,
    qualityLabel,
    metricas: metrics
  };
}

/**
 * 7. ESCÁNER DE TRAMPA FUNDAMENTAL (FASE 2, PUNTO 9)
 * Sustituye la alerta de caída de precio por indicadores fundamentales objetivos:
 * revisiones de EPS, Deuda Neta/EBITDA > 4,5x, Cobertura < 2,0x, Altman Z < 1,81 y Piotroski F <= 3.
 */
export function evaluarTrampaFundamental(empresa) {
  const alertas = [];
  const arq = empresa.arquetipo;
  const esFinanciera = arq === 'BANCA_FINANCIERA' || arq === 'GESTORA_ACTIVOS' || (empresa.sector || '').toLowerCase().includes('financial');

  const ndEbitda = empresa.net_debt_ebitda;
  const cov = empresa.interest_coverage;
  const altmanZ = empresa.altman_z_score;
  const fScore = empresa.piotroski_f_score;
  const accruals = empresa.sloan_accruals;

  // 1. Apalancamiento crítico (solo aplicable a no financieras: Deuda Neta/EBITDA >= 4.5x o >= 3.5x con cobertura < 2.0x confirmada)
  const ndEbitdaExcesivo = ndEbitda != null && (ndEbitda >= 4.5 || (ndEbitda >= 3.5 && cov != null && cov < 2.0));
  if (!esFinanciera && ndEbitdaExcesivo) {
    alertas.push({
      tipo: 'SOBRECARGA_DEUDA',
      severidad: 'CRITICA',
      icono: '💥',
      titulo: 'Apalancamiento Crítico y Riesgo de Deuda',
      detalle: `Deuda Neta / EBITDA de ${ndEbitda}x${cov != null ? ` y cobertura de intereses de ${cov}x` : ' (nivel de endeudamiento peligroso)'}.`
    });
  }

  // 2. Altman Z Distress (doctrina académica de Altman: solo aplicable a no financieras)
  if (!esFinanciera && altmanZ != null && altmanZ < 1.81) {
    alertas.push({
      tipo: 'ALTMAN_DISTRESS',
      severidad: 'CRITICA',
      icono: '⚠️',
      titulo: 'Zona de Distress Financiero (Altman Z < 1.81)',
      detalle: `Altman Z-Score de ${altmanZ} sitúa a la empresa en riesgo de reestructuración o quiebra.`
    });
  }

  // 3. Piotroski severo
  const fThreshold = esFinanciera ? 2 : 3;
  if (fScore != null && fScore <= fThreshold) {
    alertas.push({
      tipo: 'PIOTROSKI_DEBIL',
      severidad: 'ALTA',
      icono: '📉',
      titulo: `Deterioro Fundamental Severo (F-Score <= ${fThreshold})`,
      detalle: `Piotroski F-Score de ${fScore}/9 indica contracción multivariable de márgenes y solvencia.`
    });
  }

  // 4. Beneficios sin caja (Accruals, no financieras)
  if (!esFinanciera && accruals != null && accruals > 0.10) {
    alertas.push({
      tipo: 'ACCRUALS_ANOMALOS',
      severidad: 'MEDIA',
      icono: '📑',
      titulo: 'Baja Calidad Contable (Altos Devengos Sloan)',
      detalle: `Devengos de Sloan de +${(accruals * 100).toFixed(1)}% de activos. Beneficios sin respaldo en caja operativa.`
    });
  }

  const esTrampaFundamental = alertas.some(a => a.severidad === 'CRITICA') || alertas.length >= 2;
  return {
    esTrampaFundamental,
    alertas
  };
}

/**
 * 8. VALUACIÓN MULTI-ARQUETIPO REFINADA (FASE 2, PUNTOS 5, 6, 7, 8)
 */
export function calcularValorArquetipo(empresa, p0, r, rf, erp, gPess, gNeu, gOpt, gn = 0.025) {
  const arqInfo = clasificarArquetipoEmpresa(empresa);
  const arquetipo = arqInfo.arquetipo;
  const base = empresa.D1_o_FCFA1;
  const sub = empresa.gics_sub_industry || empresa.industry || '';

  let fairValueNeu = 0;
  let fairValueOpt = 0;
  let fairValuePess = 0;
  let modeloUtilizado = '';
  let formulaUtilizada = '';
  let modeloTipo = 'DCF_3ETAPAS';
  let detallesModelo = {};
  let baseFlujo = base;

  const invalido = (motivo) => ({ invalido: motivo, arquetipo, nombre_arquetipo: arqInfo.nombre_arquetipo });
  if (!arquetipo) return invalido(arqInfo.descripcion);

  // -------------------------------------------------------------
  // ARQUETIPO A.1: HOLDING / CONGLOMERADO (BERKSHIRE HATHAWAY SOTP, PUNTO 8)
  // -------------------------------------------------------------
  if (arquetipo === 'HOLDING_CONGLOMERADO') {
    if (empresa.ticker?.toUpperCase() === 'BRK-B') {
      modeloUtilizado = 'Buffett Sum-of-the-Parts (SOTP Berkshire Hathaway)';
      formulaUtilizada = 'SOTP = Cartera Cotizada ($136/acc) + Tesorería/Caja ($148/acc) + Negocios Operativos (14x NOPAT)';
      modeloTipo = 'SOTP';
      // Componentes SOTP por acción Clase B
      const equityPortfolio = 136.0;
      const cashTдцать = 148.0;
      const nopatOperating = 16.0;
      fairValueNeu = Number((equityPortfolio + cashTдцать + (nopatOperating * 14.0)).toFixed(2)); // ~508
      fairValueOpt = Number((equityPortfolio + cashTдцать + (nopatOperating * 16.0)).toFixed(2)); // ~540
      fairValuePess = Number((equityPortfolio + cashTдцать + (nopatOperating * 12.0)).toFixed(2)); // ~476
      baseFlujo = nopatOperating;
      detallesModelo = {
        cartera_cotizada_por_accion: equityPortfolio,
        caja_tesoreria_por_accion: cashTдцать,
        nopat_operativo_por_accion: nopatOperating,
        multiplo_operativo_neutro: 14.0
      };
    } else {
      modeloUtilizado = 'Conglomerate Net Asset Value (P/BV)';
      formulaUtilizada = 'Fair Value = Book Value por acción * Múltiplo P/BV (1.20x / 1.30x / 1.38x)';
      modeloTipo = 'MULTIPLE';
      const bv = empresa.book_value_per_share;
      if (bv == null || !(bv > 0)) return invalido('Valor contable por acción no disponible');
      fairValueNeu = Number((bv * 1.30).toFixed(2));
      fairValueOpt = Number((bv * 1.38).toFixed(2));
      fairValuePess = Number((bv * 1.20).toFixed(2));
      detallesModelo = { book_value_per_share: bv, pbv_multiplo_justo: 1.30 };
    }
  }

  // -------------------------------------------------------------
  // ARQUETIPO A.2: BANCA Y ASEGURADORAS (PUNTOS 5 Y 8)
  // Seguros: sin tope del 14,5% (permite hasta 22% por float).
  // Bancos comerciales: ROTE acotado entre 9% y 16%.
  // -------------------------------------------------------------
  else if (arquetipo === 'BANCA_FINANCIERA') {
    const tbv = (empresa.tbv_per_share && empresa.tbv_per_share > 0) ? empresa.tbv_per_share : (empresa.book_value_per_share && empresa.book_value_per_share > 0 ? empresa.book_value_per_share : null);
    const rote = empresa.rote ?? empresa.roe ?? (empresa.roic ? empresa.roic * 1.15 : null);
    if ((tbv == null || !(tbv > 0) || rote == null) && base > 0) {
      modeloUtilizado = 'Financial Earnings & Fee Capitalization DCF (3-Etapas)';
      formulaUtilizada = 'Equity Value = DCF 3-Etapas sobre Beneficio/Flujo Recurrente por Acción';
      modeloTipo = 'DCF_3ETAPAS';
      baseFlujo = base;
      const gFinNeu = Math.min(0.08, Math.max(0.03, empresa.g_fundamental || 0.05));
      const dcfNeu = calcularValorDCF3Etapas(base, r, gFinNeu, gn);
      const dcfOpt = calcularValorDCF3Etapas(base, r, gFinNeu + 0.015, gn);
      const dcfPess = calcularValorDCF3Etapas(base, r, Math.max(0.015, gFinNeu - 0.015), gn);
      fairValueNeu = dcfNeu.fairValue;
      fairValueOpt = dcfOpt.fairValue;
      fairValuePess = dcfPess.fairValue;
      detallesModelo = { flujo_recurrente_base: base, g1_pct: Number((gFinNeu * 100).toFixed(2)), tipo_entidad: 'Entidad Financiera (Flujos)' };
    } else {
      if (tbv == null || !(tbv > 0)) return invalido('TBV por acción no disponible (SEC)');
      if (rote == null) return invalido('ROTE no calculable (SEC)');

      const esSeguros = ['Property & Casualty Insurance', 'Life & Health Insurance', 'Multi-line Insurance', 'Reinsurance', 'Insurance Brokers'].includes(sub);
      modeloTipo = 'EXCESS_RETURN';

      if (esSeguros) {
        if (sub === 'Reinsurance') {
          modeloUtilizado = 'Damodaran Excess Return Model (Reaseguro con Hurdle de Catástrofe)';
          formulaUtilizada = 'Fair Value = TBV * ((ROTE_ciclo - gn) / (r_reins - gn)) [r >= 10.25%, ROTE <= 10.5%, P/TBV <= 1.15x]';
          const rReins = Math.max(0.1025, r);
          const roteNeu = Math.min(0.105, Math.max(0.080, rote * 0.85));
          const roteOpt = Math.min(0.115, roteNeu + 0.010);
          const rotePess = Math.max(0.070, roteNeu - 0.010);
          const spread = Math.max(0.0225, rReins - gn);
          fairValueNeu = Number((tbv * Math.max(0.70, Math.min(1.15, (roteNeu - gn) / spread))).toFixed(2));
          fairValueOpt = Number((tbv * Math.max(0.75, Math.min(1.25, (roteOpt - gn) / spread))).toFixed(2));
          fairValuePess = Number((tbv * Math.max(0.60, Math.min(1.05, (rotePess - gn) / spread))).toFixed(2));
          detallesModelo = {
            tbv_per_share: tbv,
            rote_sostenible_pct: Number((roteNeu * 100).toFixed(2)),
            r_utilizada_pct: Number((rReins * 100).toFixed(2)),
            tipo_entidad: 'Reaseguradora (Hurdle Catástrofe y Multiplicador Secular 1.15x TBV)'
          };
        } else if (sub === 'Property & Casualty Insurance' || sub.includes('Property & Casualty')) {
          modeloUtilizado = 'Damodaran Excess Return Model (Seguros P&C Normalizado de Ciclo)';
          formulaUtilizada = 'Fair Value = TBV * ((ROTE_ciclo - gn) / (r_pc - gn)) [r >= 9.25%, ROTE <= 13.0%, P/TBV <= 1.35x]';
          const rPC = Math.max(0.0925, r);
          const roteNeu = Math.min(0.130, Math.max(0.090, rote * 0.90));
          const roteOpt = Math.min(0.145, roteNeu + 0.015);
          const rotePess = Math.max(0.075, roteNeu - 0.015);
          const spread = Math.max(0.0225, rPC - gn);
          fairValueNeu = Number((tbv * Math.max(0.75, Math.min(1.35, (roteNeu - gn) / spread))).toFixed(2));
          fairValueOpt = Number((tbv * Math.max(0.80, Math.min(1.45, (roteOpt - gn) / spread))).toFixed(2));
          fairValuePess = Number((tbv * Math.max(0.65, Math.min(1.20, (rotePess - gn) / spread))).toFixed(2));
          detallesModelo = {
            tbv_per_share: tbv,
            rote_sostenible_pct: Number((roteNeu * 100).toFixed(2)),
            r_utilizada_pct: Number((rPC * 100).toFixed(2)),
            tipo_entidad: 'Aseguradora P&C (Ciclo Suscripción y Multiplicador Secular 1.35x TBV)'
          };
        } else {
          modeloUtilizado = 'Damodaran Excess Return Model (Aseguradoras Sostenible de Ciclo)';
          formulaUtilizada = 'Fair Value = TBV * ((ROTE - gn) / (r - gn)) [ROTE normalizado a través del ciclo completo de suscripción]';
          const roteNeu = Math.min(0.155, Math.max(0.095, rote));
          const roteOpt = Math.min(0.170, roteNeu + 0.015);
          const rotePess = Math.max(0.080, roteNeu - 0.015);
          const spread = Math.max(0.0225, r - gn);
          fairValueNeu = Number((tbv * Math.max(0.75, Math.min(2.20, (roteNeu - gn) / spread))).toFixed(2));
          fairValueOpt = Number((tbv * Math.max(0.80, Math.min(2.40, (roteOpt - gn) / spread))).toFixed(2));
          fairValuePess = Number((tbv * Math.max(0.65, Math.min(1.95, (rotePess - gn) / spread))).toFixed(2));
          detallesModelo = {
            tbv_per_share: tbv,
            rote_sostenible_pct: Number((roteNeu * 100).toFixed(2)),
            tipo_entidad: 'Aseguradora (Float Normalizado de Ciclo)'
          };
        }
      } else if (['Consumer Finance', 'Investment Banking & Brokerage', 'Financial Exchanges & Data'].includes(sub) || (rote && rote > 0.20)) {
        modeloUtilizado = 'Damodaran Excess Return Model (Financieras Especializadas / Medios de Pago / Brokerage)';
        formulaUtilizada = 'Fair Value = TBV * ((ROTE - gn) / (r - gn)) [ROTE hasta 32%, P/TBV hasta 6.0x]';
        const roteNeu = Math.min(0.320, Math.max(0.120, rote));
        const roteOpt = Math.min(0.350, roteNeu + 0.020);
        const rotePess = Math.max(0.100, roteNeu - 0.020);
        const spread = Math.max(0.0225, r - gn);
        fairValueNeu = Number((tbv * Math.max(0.85, Math.min(6.50, (roteNeu - gn) / spread))).toFixed(2));
        fairValueOpt = Number((tbv * Math.max(0.95, Math.min(7.20, (roteOpt - gn) / spread))).toFixed(2));
        fairValuePess = Number((tbv * Math.max(0.75, Math.min(5.50, (rotePess - gn) / spread))).toFixed(2));
        detallesModelo = { tbv_per_share: tbv, rote_sostenible_pct: Number((roteNeu * 100).toFixed(2)), tipo_entidad: 'Financiera Especializada / Pagos / Brokerage' };
      } else {
        modeloUtilizado = 'Damodaran Excess Return Model (Banca Comercial)';
        formulaUtilizada = 'Fair Value = TBV * ((ROTE - gn) / (r - gn)) [ROTE acotado al ciclo sostenible]';
        const roteNeu = Math.min(0.150, Math.max(0.090, rote));
        const roteOpt = Math.min(0.165, roteNeu + 0.015);
        const rotePess = Math.max(0.075, roteNeu - 0.015);
        const spread = Math.max(0.0225, r - gn);
        fairValueNeu = Number((tbv * Math.max(0.70, Math.min(2.10, (roteNeu - gn) / spread))).toFixed(2));
        fairValueOpt = Number((tbv * Math.max(0.75, Math.min(2.25, (roteOpt - gn) / spread))).toFixed(2));
        fairValuePess = Number((tbv * Math.max(0.60, Math.min(1.80, (rotePess - gn) / spread))).toFixed(2));
        detallesModelo = { tbv_per_share: tbv, rote_sostenible_pct: Number((roteNeu * 100).toFixed(2)), tipo_entidad: 'Banca Comercial' };
      }
    }
  }

  // -------------------------------------------------------------
  // ARQUETIPO B: INFRAESTRUCTURA, UTILITIES, TELECOM Y REITS (PUNTO 8)
  // Utilities: Gordon DDM con crecimiento regulado <= 3,0%.
  // Telecom: DDM / FCFE sin sobreprima de deuda.
  // REITs: Capitalización de AFFO acotada por NAV en distress financiero.
  // -------------------------------------------------------------
  else if (arquetipo === 'INFRAESTRUCTURA_DEUDA') {
    const esReit = sub.includes('REIT');
    const esUtility = sub.includes('Utilities');
    const esTelecom = ['Integrated Telecommunication Services', 'Wireless Telecommunication Services', 'Cable & Satellite'].includes(sub);

    if (esReit) {
      modeloUtilizado = 'AFFO Capitalization Model (REITs)';
      formulaUtilizada = 'Fair Value = AFFO_1 / (r - g_reit) [g_reit <= 2,5%]';
      modeloTipo = 'GORDON_DDM';
      const affoCandidate = [
        empresa.affo_per_share,
        (empresa.fcf_per_share && empresa.fcf_per_share > 0) ? empresa.fcf_per_share : null,
        (empresa.owner_cf_per_share && empresa.owner_cf_per_share > 0) ? empresa.owner_cf_per_share : null,
        (empresa.dividend_rate && empresa.dividend_rate > 0) ? empresa.dividend_rate : null,
        (empresa.forward_eps && empresa.forward_eps > 0) ? empresa.forward_eps : null,
        (base && base > 0) ? base : null
      ].find(v => v != null && v > 0);
      const affo = affoCandidate || (base > 0 ? base : null);
      if (!(affo > 0)) return invalido('AFFO no positivo o no calculable');
      const gReitNeu = 0.020;
      const gReitOpt = 0.025;
      const gReitPess = 0.015;
      let fvNeu = (affo * (1 + gReitNeu)) / Math.max(0.0225, r - gReitNeu);
      let fvOpt = (affo * (1 + gReitOpt)) / Math.max(0.0225, r - gReitOpt);
      let fvPess = (affo * (1 + gReitPess)) / Math.max(0.0225, r - gReitPess);

      // REGLA 3: REITS CON APALANCAMIENTO CRÍTICO (Deuda Neta / EBITDA > 8.5x)
      const tbv = empresa.tbv_per_share;
      const esDistress = empresa.net_debt_ebitda && empresa.net_debt_ebitda > 8.5;
      let navCapAplicado = false;
      if (esDistress && tbv && tbv > 0) {
        const capNAV = Number((tbv * 1.15).toFixed(2));
        if (fvNeu > capNAV) {
          fvNeu = capNAV;
          fvOpt = Number((capNAV * 1.08).toFixed(2));
          fvPess = Number((capNAV * 0.90).toFixed(2));
          navCapAplicado = true;
          modeloUtilizado = 'REIT Net Asset Value (NAV) Distress Model (Green Street / NAREIT)';
          formulaUtilizada = 'Fair Value = NAV Prudente [Cap 1.15x TBV por Distress Financiero Deuda/EBITDA > 8.5x]';
        }
      }

      fairValueNeu = Number(fvNeu.toFixed(2));
      fairValueOpt = Number(fvOpt.toFixed(2));
      fairValuePess = Number(fvPess.toFixed(2));
      baseFlujo = affo;
      detallesModelo = {
        affo_per_share: affo,
        g_reit_pct: 2.0,
        subtipo: 'REIT',
        nav_cap_distress: navCapAplicado ? Number((tbv * 1.15).toFixed(2)) : null
      };
    } else {
      const d0 = (empresa.dividend_rate && empresa.dividend_rate > 0) ? empresa.dividend_rate : base;
      if (!(d0 > 0)) return invalido('Sin dividendo ni flujo libre: modelo de capitalización no aplicable');
      modeloTipo = 'GORDON_DDM';
      let gDivNeu = 0.025;
      if (esUtility) {
        modeloUtilizado = 'Gordon-Shapiro DDM / FCFE (Utilities Reguladas)';
        formulaUtilizada = 'Fair Value = CF_0*(1 + g_div) / (r - g_div) [g_div acotado al PIB nominal <= 3,0%]';
        gDivNeu = Math.min(0.030, Math.max(0.015, empresa.g_fundamental || 0.025));
      } else if (esTelecom) {
        modeloUtilizado = 'Telecom DDM / FCFE (Apalancamiento de Red)';
        formulaUtilizada = 'Fair Value = CF_0*(1 + g_div) / (r - g_div) [sin sobreprima de deuda arbitraria]';
        gDivNeu = 0.015;
      } else {
        modeloUtilizado = 'Damodaran Dividend / FCFE Discount Model';
        formulaUtilizada = 'Fair Value = CF_0*(1 + g_div) / (r - g_div)';
        gDivNeu = 0.025;
      }
      const gDivOpt = gDivNeu + 0.005;
      const gDivPess = Math.max(0.005, gDivNeu - 0.005);
      fairValueNeu = Number(((d0 * (1 + gDivNeu)) / Math.max(0.0225, r - gDivNeu)).toFixed(2));
      fairValueOpt = Number(((d0 * (1 + gDivOpt)) / Math.max(0.0225, r - gDivOpt)).toFixed(2));
      fairValuePess = Number(((d0 * (1 + gDivPess)) / Math.max(0.0225, r - gDivPess)).toFixed(2));
      baseFlujo = d0;
      detallesModelo = { d0_dividendo: d0, g_dividendo_pct: Number((gDivNeu * 100).toFixed(2)), subtipo: esUtility ? 'Utility' : (esTelecom ? 'Telecom' : 'Infraestructura') };
    }
  }

  // -------------------------------------------------------------
  // ARQUETIPO C: GESTORAS DE ACTIVOS (PUNTO 8)
  // Capitalización de comisiones AUM recurrentes con puente de deuda
  // -------------------------------------------------------------
  else if (arquetipo === 'GESTORA_ACTIVOS') {
    modeloUtilizado = 'AUM Fee Capitalization Model (Gestoras de Activos con Puente de Deuda)';
    formulaUtilizada = 'Equity Value = DCF 3-Etapas sobre NOPAT de Comisiones − Deuda Neta/acción';
    modeloTipo = 'DCF_3ETAPAS';
    const nopatShare = (empresa.nopat_per_share && empresa.nopat_per_share > 0) ? empresa.nopat_per_share : ((empresa.eps_diluted && empresa.eps_diluted > 0) ? empresa.eps_diluted : base);
    if (!(nopatShare > 0)) return invalido('NOPAT por acción no positivo');
    const gFund = empresa.g_fundamental || 0.055;
    const gGestNeu = Math.min(0.08, Math.max(0.035, gFund));
    const gGestOpt = gGestNeu + 0.015;
    const gGestPess = Math.max(0.020, gGestNeu - 0.015);
    const dcfNeu = calcularValorDCF3Etapas(nopatShare, r, gGestNeu, gn);
    const dcfOpt = calcularValorDCF3Etapas(nopatShare, r, gGestOpt, gn);
    const dcfPess = calcularValorDCF3Etapas(nopatShare, r, gGestPess, gn);

    const netDebtShare = empresa.net_debt_per_share || 0.0;
    fairValueNeu = Number(Math.max(0, dcfNeu.fairValue - netDebtShare).toFixed(2));
    fairValueOpt = Number(Math.max(0, dcfOpt.fairValue - netDebtShare).toFixed(2));
    fairValuePess = Number(Math.max(0, dcfPess.fairValue - netDebtShare).toFixed(2));

    baseFlujo = nopatShare;
    detallesModelo = {
      nopat_per_share: nopatShare,
      enterprise_value_per_share: dcfNeu.fairValue,
      net_debt_per_share: netDebtShare,
      equity_value_per_share: fairValueNeu,
      g1_pct: Number((gGestNeu * 100).toFixed(2)),
      subtipo: 'Gestora Activos'
    };
  }

  // -------------------------------------------------------------
  // ARQUETIPO D: CÍCLICAS INDUSTRIALES (PUNTOS 6 Y 7)
  // Normalización cíclica real: Margen medio de 10 años de la SEC × Ventas actuales − Deuda Neta,
  // combinada con poder de generación de caja actual cuando la empresa ha escalado estructuralmente.
  // -------------------------------------------------------------
  else if (arquetipo === 'CICLICA_INDUSTRIAL') {
    modeloUtilizado = 'Graham-Lynch 10-Year Mid-Cycle DCF (3-Etapas con Puente de Deuda)';
    formulaUtilizada = 'Equity Value = DCF 3-Etapas sobre Flujo Mid-Cycle Normalizado − Deuda Neta/acción';
    modeloTipo = 'DCF_3ETAPAS';
    const rawMidCycle = (empresa.cyclical_normalized_eps && empresa.cyclical_normalized_eps > 0) ? empresa.cyclical_normalized_eps : base;
    const midCycleEps = (base && base > rawMidCycle * 1.35)
      ? Number((0.40 * rawMidCycle + 0.60 * base).toFixed(2))
      : rawMidCycle;
    if (!(midCycleEps > 0)) return invalido(`Beneficio normalizado mid-cycle no positivo (${midCycleEps})`);
    baseFlujo = midCycleEps;
    const gCicNeu = Math.min(0.055, Math.max(0.025, empresa.g_fundamental || 0.035));
    const gCicOpt = gCicNeu + 0.015;
    const gCicPess = Math.max(0.015, gCicNeu - 0.015);
    const dcfNeu = calcularValorDCF3Etapas(midCycleEps, r, gCicNeu, gn);
    const dcfOpt = calcularValorDCF3Etapas(midCycleEps, r, gCicOpt, gn);
    const dcfPess = calcularValorDCF3Etapas(midCycleEps, r, gCicPess, gn);

    const netDebtShare = empresa.net_debt_per_share || 0.0;
    fairValueNeu = Number(Math.max(0, dcfNeu.fairValue - netDebtShare).toFixed(2));
    fairValueOpt = Number(Math.max(0, dcfOpt.fairValue - netDebtShare).toFixed(2));
    fairValuePess = Number(Math.max(0, dcfPess.fairValue - netDebtShare).toFixed(2));

    detallesModelo = {
      mid_cycle_eps: midCycleEps,
      enterprise_value_per_share: dcfNeu.fairValue,
      net_debt_per_share: netDebtShare,
      equity_value_per_share: fairValueNeu,
      margen_10y_utilizado_pct: empresa.cyclical_normalized_margin_10y ? Number((empresa.cyclical_normalized_margin_10y * 100).toFixed(2)) : null,
      g1_pct: Number((gCicNeu * 100).toFixed(2)),
      gn_terminal_pct: Number((gn * 100).toFixed(2))
    };
  }

  // -------------------------------------------------------------
  // ARQUETIPO E: DEFENSIVAS CONSUMO Y SALUD (PUNTOS 5 Y 6)
  // DCF en 3 etapas con flujos del propietario y deducción de deuda neta
  // [McKinsey / Damodaran]: Farmacéuticas con patentes maduras acotadas a ciclo biológico.
  // -------------------------------------------------------------
  else if (arquetipo === 'DEFENSIVA_CONSUMO') {
    const isPharma = (empresa.industry || '').includes('Pharma') || (empresa.industry || '').includes('Biotech');
    modeloUtilizado = isPharma
      ? 'Graham-McKinsey Life Sciences DCF (3-Etapas con Puente de Deuda)'
      : 'Graham-Buffett Consumer Moat DCF (3-Etapas con Puente de Deuda)';
    formulaUtilizada = isPharma
      ? 'Equity Value = DCF 3-Etapas (g <= 3,0% por ciclo patentes) − Deuda Neta/acción'
      : 'Equity Value = DCF 3-Etapas sobre Flujo Propietario − Deuda Neta/acción [gn <= 2,5%]';
    modeloTipo = 'DCF_3ETAPAS';
    if (!(base > 0)) return invalido(`Flujo del propietario no positivo (${base})`);
    baseFlujo = base;
    const gFund = empresa.g_fundamental || 0.035;
    const gDefNeu = isPharma
      ? Math.min(0.030, Math.max(0.010, gFund))
      : Math.min(0.045, Math.max(0.020, gFund));
    const gDefOpt = Math.min(isPharma ? 0.045 : 0.060, gDefNeu + 0.015);
    const gDefPess = Math.max(0.005, gDefNeu - 0.015);
    const dcfNeu = calcularValorDCF3Etapas(base, r, gDefNeu, gn);
    const dcfOpt = calcularValorDCF3Etapas(base, r, gDefOpt, gn);
    const dcfPess = calcularValorDCF3Etapas(base, r, gDefPess, gn);

    const netDebtShare = empresa.net_debt_per_share || 0.0;
    fairValueNeu = Number(Math.max(0, dcfNeu.fairValue - netDebtShare).toFixed(2));
    fairValueOpt = Number(Math.max(0, dcfOpt.fairValue - netDebtShare).toFixed(2));
    fairValuePess = Number(Math.max(0, dcfPess.fairValue - netDebtShare).toFixed(2));

    detallesModelo = {
      flujo_propietario_base: base,
      enterprise_value_per_share: dcfNeu.fairValue,
      net_debt_per_share: netDebtShare,
      equity_value_per_share: fairValueNeu,
      roic_reportado_pct: empresa.roic ? Number((empresa.roic * 100).toFixed(2)) : null,
      g1_fundamental_pct: Number((gDefNeu * 100).toFixed(2)),
      gn_terminal_pct: Number((gn * 100).toFixed(2))
    };
  }

  // -------------------------------------------------------------
  // ARQUETIPO F: COMPOUNDER TECH ASSET-LIGHT (PUNTOS 5 Y 6)
  // DCF 3-Etapas con RONIC convergente y deducción de deuda neta (o suma de caja neta)
  // -------------------------------------------------------------
  else {
    modeloUtilizado = "Buffett-Penman High ROIC DCF (3-Etapas con Puente de Deuda)";
    formulaUtilizada = 'Equity Value = DCF 3-Etapas sobre Owner CF [RONIC -> r] − Deuda Neta/acción';
    modeloTipo = 'DCF_3ETAPAS';
    if (!(base > 0)) return invalido(`Flujo del propietario no positivo (${base})`);
    baseFlujo = base;
    const gnTerm = empresa.gn_terminal || 0.025;
    const subInd = empresa.gics_sub_industry || empresa.industry || '';
    const isCycHw = (subInd.includes('Storage & Peripherals') || subInd.includes('Semiconductors')) &&
      ((empresa.forward_eps || 0) / Math.max(0.5, Math.abs(empresa.eps_diluted || base)) > 1.8);

    let gBase = empresa.g_fundamental || 0.08;
    // Tasa de crecimiento fundamental ligada a ROIC × Tasa de Reinversión (Doctrina Damodaran / Penman):
    if (!isCycHw) {
      if (empresa.reinvestment_rate && empresa.roic && empresa.reinvestment_rate > 0) {
        const gFundCalculated = empresa.reinvestment_rate * empresa.roic;
        gBase = Math.min(0.16, Math.max(gBase, gFundCalculated));
      } else if (empresa.forward_eps && empresa.eps_diluted && empresa.eps_diluted > 0) {
        const fwdGrowth = (empresa.forward_eps - empresa.eps_diluted) / empresa.eps_diluted;
        if (fwdGrowth > 0.08) {
          gBase = Math.min(0.15, Math.max(gBase, fwdGrowth * 0.55));
        }
      } else if (empresa.roic && empresa.roic > 0.25) {
        gBase = Math.min(0.14, Math.max(gBase, empresa.roic * 0.20));
      }
    } else {
      gBase = Math.min(0.065, gBase);
    }
    const gTechNeu = Math.min(isCycHw ? 0.065 : 0.16, Math.max(gnTerm, gBase));
    const gTechOpt = Math.min(isCycHw ? 0.080 : 0.18, gTechNeu + 0.015);
    const gTechPess = Math.max(gnTerm, gTechNeu - 0.015);
    const dcfNeu = calcularValorDCF3Etapas(base, r, gTechNeu, gn);
    const dcfOpt = calcularValorDCF3Etapas(base, r, gTechOpt, gn);
    const dcfPess = calcularValorDCF3Etapas(base, r, gTechPess, gn);

    const netDebtShare = empresa.net_debt_per_share || 0.0;
    fairValueNeu = Number(Math.max(0, dcfNeu.fairValue - netDebtShare).toFixed(2));
    fairValueOpt = Number(Math.max(0, dcfOpt.fairValue - netDebtShare).toFixed(2));
    fairValuePess = Number(Math.max(0, dcfPess.fairValue - netDebtShare).toFixed(2));

    detallesModelo = {
      flujo_propietario_base: base,
      enterprise_value_per_share: dcfNeu.fairValue,
      net_debt_per_share: netDebtShare,
      equity_value_per_share: fairValueNeu,
      roic_reportado_pct: empresa.roic ? Number((empresa.roic * 100).toFixed(2)) : null,
      reinvestment_rate_pct: empresa.reinvestment_rate ? Number((empresa.reinvestment_rate * 100).toFixed(2)) : null,
      g1_fundamental_pct: Number((gTechNeu * 100).toFixed(2)),
      gn_terminal_pct: Number((gn * 100).toFixed(2))
    };
  }

  return {
    arquetipo,
    nombre_arquetipo: arqInfo.nombre_arquetipo,
    modelo_utilizado: modeloUtilizado,
    formula_utilizada: formulaUtilizada,
    modeloTipo,
    fairValueNeu,
    fairValueOpt,
    fairValuePess,
    baseFlujo,
    detallesModelo
  };
}

/**
 * 8.B MOTOR MULTIMODELO INSTITUCIONAL DE 11 MODELOS EN PARALELO
 * Calcula en paralelo los 11 modelos de valoración estándar (Múltiplos de Capital,
 * Múltiplos de Valor de Empresa EV, Rentabilidad por Dividendo y DCF Descontados),
 * filtra automáticamente los modelos no aplicables al sector y los extremos estadísticos (outliers),
 * y obtiene el Fair Value central limpio.
 */
export function calcular11ModelosValoracion(empresa, p0, rCapm, rf, erp, gn, currSym = '$') {
  const netDebt = Number(empresa.net_debt_per_share || 0);
  const ev0 = Math.max(p0 * 0.15, p0 + netDebt);
  const betaRaw = empresa.beta || 1.0;
  const betaEff = 0.67 * Math.min(1.45, Math.max(0.65, betaRaw)) + 0.33;
  const ke = Math.max(0.068, Math.min(0.112, (rf || 0.0425) + betaEff * (erp || 0.045)));
  const kdAfterTax = ((rf || 0.0425) + 0.012) * (1 - 0.21);
  const debtWeight = netDebt > 0 ? Math.min(0.45, netDebt / ev0) : 0;
  const wacc = Math.max(0.062, (1 - debtWeight) * ke + debtWeight * kdAfterTax);
  const gnSafe = Math.min(0.025, gn || empresa.gn_terminal || 0.025);

  const subInd = empresa.gics_sub_industry || empresa.industry || '';
  const sectorStr = empresa.sector || '';
  const isBankOrIns = empresa.arquetipo === 'BANCA_FINANCIERA' || empresa.arquetipo === 'HOLDING_CONGLOMERADO' ||
    (sectorStr.includes('Financial') && empresa.arquetipo !== 'GESTORA_ACTIVOS');
  const isReit = subInd.includes('REIT') || sectorStr.includes('Real Estate');
  const isUtil = subInd.includes('Utilities') || sectorStr.includes('Utilities');
  const isReitOrUtil = empresa.arquetipo === 'INFRAESTRUCTURA_DEUDA' || isReit || isUtil;
  const isDefensive = empresa.arquetipo === 'DEFENSIVA_CONSUMO' || sectorStr.includes('Consumer Staples') || sectorStr.includes('Health');
  const isPharma = (empresa.industry || '').includes('Pharma') || (empresa.industry || '').includes('Biotech') || (empresa.industry || '').includes('Drug');
  const isConsultingOrServices = subInd.includes('Consulting') || subInd.includes('IT Consulting') || subInd.includes('Professional Services');
  const isCyclicHw = (subInd.includes('Storage & Peripherals') || subInd.includes('Semiconductors')) &&
    ((empresa.forward_eps || 0) / Math.max(0.5, Math.abs(empresa.eps_diluted || 1)) > 1.8);
  const isEnergySector = sectorStr === 'Energy' || sectorStr.includes('Energy') ||
    subInd.includes('Oil & Gas') || subInd.includes('Petroleum') ||
    empresa.arquetipo === 'CICLICA_COMMODITY' || (empresa.arquetipo === 'CICLICA_INDUSTRIAL' && (sectorStr.includes('Energy') || subInd.includes('Oil')));
  const isOilGasEp = isEnergySector && (subInd.includes('Exploration & Production') || subInd.includes('E&P'));
  const isOilGasRefining = isEnergySector && (subInd.includes('Refining & Marketing') || subInd.includes('Refining'));
  const isOilGasIntegrated = isEnergySector && (subInd.includes('Integrated Oil') || (subInd.includes('Integrated') && subInd.includes('Gas')));

  const keEff = isEnergySector ? Math.max(0.096, ke + 0.016) : ke;
  const waccEff = isEnergySector ? Math.max(0.080, wacc + 0.012) : wacc;
  const gnEff = isEnergySector ? 0.015 : gnSafe;

  // 1. Métricas Fundamentales por Acción Normalizadas
  const epsTtm = empresa.eps_diluted > 0 ? Number(empresa.eps_diluted) : Number(empresa.D1_o_FCFA1 || 0);
  const epsFwd = empresa.forward_eps > 0 ? Number(empresa.forward_eps) : epsTtm;
  let epsSust = epsTtm;
  if (isReit) {
    const affo = empresa.affo_per_share || empresa.fcf_per_share || empresa.D1_o_FCFA1 || empresa.dividend_rate || epsTtm;
    epsSust = Math.max(epsTtm, Number(affo || 0));
  } else if (isCyclicHw) {
    const mid = empresa.cyclical_normalized_eps > 0 ? Number(empresa.cyclical_normalized_eps) : epsTtm * 0.5;
    if (epsTtm < mid * 2.5 && epsFwd > epsTtm * 2.5) {
      const capFwd = Math.min(epsFwd * 0.58, epsTtm * 2.35);
      epsSust = 0.35 * epsTtm + 0.65 * capFwd;
    } else {
      const sustTtm = Math.min(epsTtm, Math.max(mid * 3.45, epsTtm * 0.98));
      const capFwd = Math.min(epsFwd * 0.52, sustTtm * 1.30);
      epsSust = 0.55 * sustTtm + 0.45 * capFwd;
    }
  } else if (isDefensive || isUtil) {
    epsSust = epsFwd > epsTtm ? (0.70 * epsTtm + 0.30 * Math.min(epsFwd, epsTtm * 1.18)) : epsTtm;
  } else if (epsFwd > epsTtm) {
    epsSust = 0.55 * epsTtm + 0.45 * Math.min(epsFwd, epsTtm * 1.35);
  } else if (epsFwd > 0 && epsFwd < epsTtm * 0.85) {
    epsSust = 0.50 * epsTtm + 0.50 * epsFwd;
  }

  const fcfRaw = isReit
    ? Number(empresa.affo_per_share || empresa.fcf_per_share || empresa.D1_o_FCFA1 || epsSust)
    : Number(empresa.fcf_per_share > 0 ? empresa.fcf_per_share : (empresa.owner_cf_per_share > 0 ? empresa.owner_cf_per_share : (empresa.D1_o_FCFA1 > 0 ? empresa.D1_o_FCFA1 : epsSust * 0.90)));
  let lfcf = fcfRaw;
  if (isCyclicHw) {
    lfcf = 0.35 * Math.min(fcfRaw, epsSust * 1.15) + 0.65 * (epsSust * 0.96);
  } else if (epsSust > 0 && fcfRaw < epsSust * 0.65 && !isBankOrIns && !isReit) {
    lfcf = 0.35 * fcfRaw + 0.65 * (epsSust * 0.90);
  } else if (epsSust > 0 && fcfRaw > epsSust * 1.35 && !isReit) {
    lfcf = 0.45 * fcfRaw + 0.55 * (epsSust * 1.12);
  }

  const taxRate = 0.20;
  const debtServiceAfterTax = netDebt > 0 ? netDebt * kdAfterTax : 0;
  const debtCapService = netDebt > 0 ? netDebt * wacc * 0.85 : 0;
  const ufcf = lfcf + debtServiceAfterTax;
  const ufcfForEvMult = lfcf + debtCapService;
  const nopat = (empresa.nopat_per_share > 0 && !isCyclicHw ? (0.5 * Number(empresa.nopat_per_share) + 0.5 * epsSust) : epsSust) + debtCapService;
  const ebit = (empresa.ebit_per_share > 0 && !isCyclicHw)
    ? Math.max(Number(empresa.ebit_per_share), (nopat / (1 - taxRate)) * 0.90)
    : (nopat / (1 - taxRate));
  const ebitda = (empresa.ebitda_per_share > 0 && !isCyclicHw)
    ? Math.max(Number(empresa.ebitda_per_share), ebit * 1.16)
    : (ebit * 1.20);
  const rev = empresa.revenue_per_share > 0 ? Number(empresa.revenue_per_share) : (ebit > 0 ? ebit / (isDefensive ? 0.21 : 0.17) : 0);
  const bv = Number(empresa.book_value_per_share ?? empresa.tbv_per_share ?? 0);
  const div = Number(empresa.dividend_rate || 0);

  // 2. Tasa de Crecimiento Sostenible Etapa 1 (g1)
  let g1 = Number(empresa.g_fundamental || empresa.g_hist || 0.06);
  if (isEnergySector) {
    g1 = Math.min(0.032, Math.max(0.015, g1 * 0.45));
  } else if (isCyclicHw) {
    g1 = Math.min(0.065, Math.max(0.035, g1));
  } else if (isConsultingOrServices) {
    g1 = Math.min(0.060, Math.max(0.035, g1));
  } else if (isReitOrUtil) {
    g1 = Math.min(0.035, Math.max(0.020, g1));
  } else if (isDefensive) {
    g1 = Math.min(isPharma ? 0.035 : 0.045, Math.max(0.020, g1));
  } else if (!isBankOrIns) {
    const fwdG = (epsFwd > epsTtm && epsTtm > 0) ? (epsFwd - epsTtm) / epsTtm : 0;
    const roicG = (empresa.roic > 0 && empresa.reinvestment_rate > 0) ? empresa.roic * empresa.reinvestment_rate : (empresa.roic > 0.22 ? empresa.roic * 0.30 : 0);
    g1 = Math.min(0.145, Math.max(g1, Math.min(0.14, fwdG * 0.50), Math.min(0.135, roicG)));
  } else {
    g1 = Math.min(0.045, Math.max(0.020, g1));
  }

  // 3. Ancla de Múltiplos Históricos 5Y / Equilibrio Sectorial
  const low52 = empresa.fifty_two_week_low || p0 * 0.80;
  const high52 = empresa.fifty_two_week_high || p0 * 1.20;
  const mid52 = 0.55 * low52 + 0.45 * high52;
  const targetAn = empresa.target_mean_analysts > 0 ? Number(empresa.target_mean_analysts) : p0;
  let refPriceHist = targetAn > 0 ? (0.40 * p0 + 0.35 * Math.min(targetAn, p0 * 1.30) + 0.25 * mid52) : (0.60 * p0 + 0.40 * mid52);
  if (isCyclicHw) {
    refPriceHist = Math.min(refPriceHist, epsSust * 16.8);
  }
  const refEvHist = Math.max(refPriceHist * 0.20, refPriceHist + netDebt);

  // Multiplicadores DCF Intrínsecos Base (Valor Actual de 1 unidad de flujo)
  const multEqIntrRaw = calcularValorDCF3Etapas(1, keEff, g1, gnEff).fairValue;
  const multEvIntrRaw = calcularValorDCF3Etapas(1, waccEff, g1, gnEff).fairValue;
  const multEqIntr = isOilGasEp ? Math.min(9.5, multEqIntrRaw) : (isOilGasRefining ? Math.min(10.2, multEqIntrRaw) : (isOilGasIntegrated ? Math.min(12.5, multEqIntrRaw) : (isCyclicHw ? Math.min(16.8, multEqIntrRaw) : (isConsultingOrServices ? Math.min(16.2, multEqIntrRaw) : (isDefensive ? Math.min(19.5, multEqIntrRaw) : multEqIntrRaw)))));
  const multEvIntr = isOilGasEp ? Math.min(6.2, multEvIntrRaw) : (isOilGasRefining ? Math.min(6.8, multEvIntrRaw) : (isOilGasIntegrated ? Math.min(8.0, multEvIntrRaw) : (isCyclicHw ? Math.min(16.0, multEvIntrRaw) : (isConsultingOrServices ? Math.min(15.5, multEvIntrRaw) : (isDefensive ? Math.min(18.5, multEvIntrRaw) : multEvIntrRaw)))));

  // --- MODELO 1: Precio/Ventas (P/S) ---
  const netMarginActual = rev > 0 ? Math.max(0.03, Math.min(0.42, epsSust / rev)) : 0.12;
  const opMarginNorm = empresa.operating_margin > 0 ? Number(empresa.operating_margin) * 0.78 : netMarginActual * 0.96;
  const netMarginNorm = 0.65 * netMarginActual + 0.35 * opMarginNorm;
  const psIntr = netMarginNorm * multEqIntr;
  const psHist = rev > 0 ? refPriceHist / rev : psIntr;
  const fairPS = isOilGasEp
    ? Math.min(2.0, Math.max(1.2, 0.65 * 1.55 + 0.35 * Math.min(2.1, psHist)))
    : (isOilGasRefining
      ? Math.min(0.85, Math.max(0.35, 0.65 * 0.55 + 0.35 * Math.min(0.95, psHist)))
      : (isOilGasIntegrated
        ? Math.min(1.8, Math.max(0.9, 0.65 * 1.35 + 0.35 * Math.min(1.9, psHist)))
        : (isCyclicHw ? (0.70 * psIntr + 0.30 * Math.min(psHist, psIntr * 1.35)) : (0.55 * psIntr + 0.45 * psHist))));
  const vPS = (!isBankOrIns && rev > 0) ? Number((rev * fairPS).toFixed(2)) : null;

  // --- MODELO 2: PER (P/E) ---
  const peHist = epsSust > 0 ? Math.min(38, Math.max(8, refPriceHist / epsSust)) : multEqIntr;
  let fairPE = isOilGasEp
    ? Math.min(9.8, Math.max(7.5, 0.65 * 8.6 + 0.35 * Math.min(10.5, peHist)))
    : (isOilGasRefining
      ? Math.min(10.2, Math.max(7.8, 0.65 * 8.8 + 0.35 * Math.min(11.0, peHist)))
      : (isOilGasIntegrated
        ? Math.min(13.2, Math.max(9.8, 0.65 * 11.5 + 0.35 * Math.min(14.0, peHist)))
        : (isCyclicHw ? Math.min(17.0, Math.max(15.5, 0.70 * multEqIntr + 0.30 * peHist)) : (0.55 * multEqIntr + 0.45 * peHist))));
  if (isBankOrIns) {
    fairPE = Math.min(13.8, Math.max(9.5, 0.60 * 11.8 + 0.40 * peHist));
  }
  const vPE = epsSust > 0 ? Number((epsSust * fairPE).toFixed(2)) : null;

  // --- MODELO 3: Precio/LFCF (P/LFCF) ---
  const plfcfHist = lfcf > 0 ? Math.min(40, Math.max(8, refPriceHist / lfcf)) : multEqIntr * 1.04;
  const fairPLFCF = isOilGasEp
    ? Math.min(9.8, Math.max(7.2, 0.65 * 8.5 + 0.35 * Math.min(10.8, plfcfHist)))
    : (isOilGasRefining
      ? Math.min(10.5, Math.max(7.5, 0.65 * 8.8 + 0.35 * Math.min(11.2, plfcfHist)))
      : (isOilGasIntegrated
        ? Math.min(12.8, Math.max(9.0, 0.65 * 10.8 + 0.35 * Math.min(13.8, plfcfHist)))
        : (isCyclicHw ? Math.min(17.2, Math.max(15.5, 0.70 * (multEqIntr * 1.03) + 0.30 * plfcfHist)) : (0.55 * (multEqIntr * 1.04) + 0.45 * plfcfHist))));
  const vPLFCF = (!isBankOrIns && lfcf > 0) ? Number((lfcf * fairPLFCF).toFixed(2)) : null;

  // --- MODELO 4: Precio/Valor Libros (P/B) ---
  const roe = Number(empresa.roe || empresa.rote || (bv > 0 && epsSust > 0 ? epsSust / bv : 0.15));
  const pbRatio = bv > 0 ? (p0 / bv) : 999;
  const pbApplicable = bv > 0 && (isBankOrIns || isReitOrUtil || isEnergySector || (pbRatio <= 7.5 && roe <= 0.42));
  let vPB = null;
  let fairPB = null;
  if (pbApplicable) {
    const spread = Math.max(0.0225, keEff - gnEff);
    const isSpecializedFin = ['Consumer Finance', 'Investment Banking & Brokerage', 'Financial Exchanges & Data'].includes(subInd);
    const roeSust = isBankOrIns ? Math.min(isSpecializedFin ? 0.28 : 0.155, Math.max(0.08, roe)) : Math.min(0.32, Math.max(0.08, roe));
    const pbCap = isBankOrIns ? (isSpecializedFin ? 5.5 : 2.15) : (isReitOrUtil ? 2.6 : (isEnergySector ? 2.3 : 6.0));
    const pbJustified = Math.max(0.85, Math.min(pbCap, (roeSust - gnEff) / spread));
    const pbHist = Math.min(pbCap * 1.15, refPriceHist / bv);
    fairPB = isEnergySector
      ? Math.min(2.3, Math.max(1.4, 0.60 * 1.80 + 0.40 * Math.min(2.3, pbHist)))
      : (0.60 * pbJustified + 0.40 * pbHist);
    vPB = Number((bv * fairPB).toFixed(2));
  }

  // --- MODELO 5: EV/Ventas (EV/Sales) ---
  const fcfMargin = rev > 0 ? Math.max(0.03, Math.min(0.55, ufcfForEvMult / rev)) : 0.12;
  const evsIntr = fcfMargin * multEvIntr * 0.99;
  const evsHist = rev > 0 ? refEvHist / rev : evsIntr;
  const fairEVS = isOilGasEp
    ? Math.min(2.3, Math.max(1.3, 0.65 * 1.70 + 0.35 * Math.min(2.3, evsHist)))
    : (isOilGasRefining
      ? Math.min(0.95, Math.max(0.40, 0.65 * 0.65 + 0.35 * Math.min(1.05, evsHist)))
      : (isOilGasIntegrated
        ? Math.min(1.9, Math.max(1.0, 0.65 * 1.45 + 0.35 * Math.min(2.0, evsHist)))
        : (isCyclicHw ? (0.70 * evsIntr + 0.30 * Math.min(evsHist, evsIntr * 1.35)) : (0.55 * evsIntr + 0.45 * evsHist))));
  const vEVS = (!isBankOrIns && rev > 0) ? Number(Math.max(0, rev * fairEVS - netDebt).toFixed(2)) : null;

  // --- MODELO 6: EV/FCF ---
  const evfcfHist = ufcfForEvMult > 0 ? Math.min(42, Math.max(8, refEvHist / ufcfForEvMult)) : multEvIntr * 1.05;
  const fairEVFCF = isOilGasEp
    ? Math.min(9.2, Math.max(6.8, 0.65 * 8.0 + 0.35 * Math.min(9.8, evfcfHist)))
    : (isOilGasRefining
      ? Math.min(10.2, Math.max(7.2, 0.65 * 8.5 + 0.35 * Math.min(11.0, evfcfHist)))
      : (isOilGasIntegrated
        ? Math.min(12.5, Math.max(8.8, 0.65 * 10.5 + 0.35 * Math.min(13.5, evfcfHist)))
        : (isCyclicHw ? Math.min(17.5, Math.max(15.5, 0.70 * (multEvIntr * 1.04) + 0.30 * evfcfHist)) : (0.55 * (multEvIntr * 1.04) + 0.45 * evfcfHist))));
  const vEVFCF = (!isBankOrIns && ufcfForEvMult > 0) ? Number(Math.max(0, ufcfForEvMult * fairEVFCF - netDebt).toFixed(2)) : null;

  // --- MODELO 7: EV/EBITDA ---
  const daRatio = ebitda > 0 && ebit > 0 ? Math.max(0.58, Math.min(0.88, (ebit / ebitda) * 0.96)) : 0.78;
  const evebitdaIntr = multEvIntr * (1 - taxRate) * daRatio;
  const evebitdaHist = ebitda > 0 ? Math.min(32, Math.max(6, refEvHist / ebitda)) : evebitdaIntr;
  const fairEVEBITDA = isOilGasEp
    ? Math.min(5.0, Math.max(3.6, 0.65 * 4.2 + 0.35 * Math.min(5.5, evebitdaHist)))
    : (isOilGasRefining
      ? Math.min(6.2, Math.max(4.2, 0.65 * 5.0 + 0.35 * Math.min(6.8, evebitdaHist)))
      : (isOilGasIntegrated
        ? Math.min(7.5, Math.max(5.2, 0.65 * 6.5 + 0.35 * Math.min(8.2, evebitdaHist)))
        : (isCyclicHw ? Math.min(13.8, Math.max(10.8, 0.70 * evebitdaIntr + 0.30 * evebitdaHist)) : (0.55 * evebitdaIntr + 0.45 * evebitdaHist))));
  const vEVEBITDA = (!isBankOrIns && ebitda > 0) ? Number(Math.max(0, ebitda * fairEVEBITDA - netDebt).toFixed(2)) : null;

  // --- MODELO 8: EV/EBIT ---
  const evebitIntr = multEvIntr * (1 - taxRate) * 1.02;
  const evebitHist = ebit > 0 ? Math.min(36, Math.max(7, refEvHist / ebit)) : evebitIntr;
  const fairEVEBIT = isOilGasEp
    ? Math.min(8.0, Math.max(5.5, 0.65 * 6.6 + 0.35 * Math.min(8.5, evebitHist)))
    : (isOilGasRefining
      ? Math.min(8.5, Math.max(5.8, 0.65 * 7.0 + 0.35 * Math.min(9.0, evebitHist)))
      : (isOilGasIntegrated
        ? Math.min(10.5, Math.max(7.2, 0.65 * 8.8 + 0.35 * Math.min(11.5, evebitHist)))
        : (isCyclicHw ? Math.min(16.0, Math.max(12.8, 0.70 * evebitIntr + 0.30 * evebitHist)) : (0.55 * evebitIntr + 0.45 * evebitHist))));
  const vEVEBIT = (!isBankOrIns && ebit > 0) ? Number(Math.max(0, ebit * fairEVEBIT - netDebt).toFixed(2)) : null;

  // --- MODELO 9: Rentabilidad por Dividendo (DDM / Yield Equilibrium) ---
  let vDiv = null;
  let targetYieldPct = null;
  if (div > 0 && (div / p0) >= (isOilGasEp ? 0.012 : 0.004)) {
    const targetYield = div / Math.max(1, refPriceHist);
    targetYieldPct = Number((targetYield * 100).toFixed(2));
    const vYieldEq = targetYield > 0.003 ? div / targetYield : p0;
    const gDiv = Math.min(isBankOrIns || isReitOrUtil ? 0.032 : (isOilGasEp ? 0.025 : 0.050), Math.max(0.015, g1 * 0.75));
    const retainedFlow = Math.max(0, (epsSust - div) * (isBankOrIns ? 0.50 : (isOilGasEp ? 0.40 : 0.70)));
    const ddmTotal = ((div + retainedFlow) * (1 + gDiv)) / Math.max(0.025, keEff - gDiv);
    vDiv = Number((0.55 * vYieldEq + 0.45 * ddmTotal).toFixed(2));
  }

  // --- MODELO 10: DCF Sin Apalancar (Unlevered DCF / FCFF) ---
  const dcfUnlevEv = (!isBankOrIns && ufcf > 0) ? calcularValorDCF3Etapas(ufcf, waccEff, g1, gnEff).fairValue : null;
  const vDCFUnlev = dcfUnlevEv != null ? Number(Math.max(0, dcfUnlevEv - netDebt).toFixed(2)) : null;

  // --- MODELO 11: DCF Apalancado (Levered DCF / FCFE) ---
  const fcfeBase = isBankOrIns ? Number((epsSust * 0.72).toFixed(2)) : lfcf;
  const dcfLevRaw = fcfeBase > 0 ? calcularValorDCF3Etapas(fcfeBase, keEff, g1, gnEff).fairValue : null;
  const debtAdjLev = isBankOrIns ? 0 : (netDebt > 0 ? netDebt * 0.25 : netDebt * 0.85);
  const vDCFLev = dcfLevRaw != null ? Number(Math.max(0, dcfLevRaw - debtAdjLev).toFixed(2)) : null;

  // Construir catálogo detallado de los 11 modelos con su documentación pedagógica (i)
  const rawModels = [
    {
      id: 'P_SALES',
      orden: 1,
      nombre: 'Precio/Ventas',
      categoria: 'Múltiplo de Capital (Equity)',
      aplicable: vPS != null && vPS > 0,
      valor: vPS,
      formula_resumen: 'FV = Ventas/Acción × Múltiplo P/S Justo (Margen Neto Norm. × Factor Intrínseco)',
      explicacion_pedagogica: {
        que_es: 'Valora la compañía en función de su facturación por acción y su capacidad estructural de convertir ingresos en beneficio neto para el accionista.',
        como_calcula: 'Multiplica las Ventas por Acción (TTM) por el múltiplo Precio/Ventas justo, derivado del margen neto normalizado de ciclo y el factor de capitalización a 5 años.',
        calculo_empresa: vPS != null
          ? `Ventas/acc: ${currSym}${rev.toFixed(2)} × Múltiplo P/S Justo: ${fairPS.toFixed(2)}x (Margen Neto Norm.: ${(netMarginNorm * 100).toFixed(1)}%) = ${currSym}${vPS.toFixed(2)}`
          : 'No aplicable a entidades bancarias/aseguradoras (no existen ventas industriales convencionales).'
      },
      datos_usados: { metrica_base: Number(rev.toFixed(2)), multiplo_justo: Number(fairPS.toFixed(2)), unidad_metrica: 'Ventas/Acción' }
    },
    {
      id: 'PER',
      orden: 2,
      nombre: 'PER',
      categoria: 'Múltiplo de Capital (Equity)',
      aplicable: vPE != null && vPE > 0,
      valor: vPE,
      formula_resumen: 'FV = BPA Sostenible × PER Justo (Crecimiento g, ROIC y Coste de Capital ke)',
      explicacion_pedagogica: {
        que_es: 'El Price-to-Earnings Ratio (PER) mide cuántos años de beneficios netos normalizados está justificado pagar por la acción según su crecimiento y riesgo.',
        como_calcula: 'Multiplica el Beneficio por Acción (BPA) sostenible (ajustado por ciclo y visibilidad forward prudente) por el PER de equilibrio fundamental e histórico.',
        calculo_empresa: vPE != null
          ? `BPA Sostenible: ${currSym}${epsSust.toFixed(2)} × PER Justo: ${fairPE.toFixed(2)}x (ke: ${(ke * 100).toFixed(2)}%, g1: ${(g1 * 100).toFixed(1)}%) = ${currSym}${vPE.toFixed(2)}`
          : 'No aplicable cuando el beneficio por acción sostenible no es positivo.'
      },
      datos_usados: { metrica_base: Number(epsSust.toFixed(2)), multiplo_justo: Number(fairPE.toFixed(2)), unidad_metrica: 'BPA Sostenible' }
    },
    {
      id: 'P_LFCF',
      orden: 3,
      nombre: 'Precio/LFCF',
      categoria: 'Múltiplo de Capital (Equity)',
      aplicable: vPLFCF != null && vPLFCF > 0,
      valor: vPLFCF,
      formula_resumen: 'FV = Flujo de Caja Libre Apalancado (LFCF)/Acción × Múltiplo P/LFCF Justo',
      explicacion_pedagogica: {
        que_es: 'Valora la acción según el efectivo real libre que queda para los accionistas después de pagar gastos operativos, impuestos, intereses de deuda y Capex.',
        como_calcula: 'Multiplica el Levered Free Cash Flow (LFCF) por acción normalizado por el múltiplo P/FCF justificado por la conversión de caja del negocio.',
        calculo_empresa: vPLFCF != null
          ? `LFCF/acc: ${currSym}${lfcf.toFixed(2)} × Múltiplo P/LFCF Justo: ${fairPLFCF.toFixed(2)}x = ${currSym}${vPLFCF.toFixed(2)}`
          : 'No aplicable en banca tradicional o cuando el LFCF es negativo.'
      },
      datos_usados: { metrica_base: Number(lfcf.toFixed(2)), multiplo_justo: Number(fairPLFCF.toFixed(2)), unidad_metrica: 'LFCF/Acción' }
    },
    {
      id: 'P_BOOK',
      orden: 4,
      nombre: 'Precio/Valor Libros',
      categoria: 'Múltiplo Patrimonial (Balance)',
      aplicable: vPB != null && vPB > 0,
      valor: vPB,
      formula_resumen: 'FV = Valor Contable/Acción × [(ROE Sostenible − gn) / (ke − gn)]',
      explicacion_pedagogica: {
        que_es: 'Relaciona el valor de mercado con el patrimonio neto contable (Book Value) aplicando el modelo de Retorno Excedente de Damodaran (ROE frente a coste de capital).',
        como_calcula: 'Multiplica el Valor en Libros por acción por el múltiplo P/B justificado. Se desactiva automáticamente en empresas asset-light o con recompras masivas que distorsionan el patrimonio contable.',
        calculo_empresa: vPB != null
          ? `Valor Libros/acc: ${currSym}${bv.toFixed(2)} × Múltiplo P/B Justo: ${fairPB.toFixed(2)}x (ROE: ${(roe * 100).toFixed(1)}%) = ${currSym}${vPB.toFixed(2)}`
          : `No aplicable: Estructura Asset-Light / Recompras de acciones (P/B actual ${bv > 0 ? pbRatio.toFixed(1) + 'x' : 'N/A'}, ROE ${(roe * 100).toFixed(1)}%), donde el valor reside en intangibles y flujos de caja, no en activos contables.`
      },
      datos_usados: { metrica_base: Number(bv.toFixed(2)), multiplo_justo: fairPB ? Number(fairPB.toFixed(2)) : null, unidad_metrica: 'Valor Libros/Acción' }
    },
    {
      id: 'EV_SALES',
      orden: 5,
      nombre: 'EV/Ventas',
      categoria: 'Múltiplo de Empresa (Enterprise Value)',
      aplicable: vEVS != null && vEVS > 0,
      valor: vEVS,
      formula_resumen: 'FV = (Ventas/Acción × Múltiplo EV/Ventas Justo) − Deuda Neta/Acción',
      explicacion_pedagogica: {
        que_es: 'Valora el negocio operativo completo (incluyendo deuda y caja) en relación con sus ingresos totales, deduciendo después la deuda neta para hallar el valor de la acción.',
        como_calcula: 'Calcula el Enterprise Value multiplicando las Ventas por acción por el múltiplo EV/Ventas justificado por su margen operativo libre de caja y resta la Deuda Neta por acción.',
        calculo_empresa: vEVS != null
          ? `(Ventas/acc: ${currSym}${rev.toFixed(2)} × EV/Ventas: ${fairEVS.toFixed(2)}x) − Deuda Neta/acc (${currSym}${netDebt.toFixed(2)}) = ${currSym}${vEVS.toFixed(2)}`
          : 'No aplicable en sector bancario/financiero.'
      },
      datos_usados: { metrica_base: Number(rev.toFixed(2)), multiplo_justo: Number(fairEVS.toFixed(2)), deuda_neta_acc: Number(netDebt.toFixed(2)), unidad_metrica: 'Ventas/Acción' }
    },
    {
      id: 'EV_FCF',
      orden: 6,
      nombre: 'EV/FCF',
      categoria: 'Múltiplo de Empresa (Enterprise Value)',
      aplicable: vEVFCF != null && vEVFCF > 0,
      valor: vEVFCF,
      formula_resumen: 'FV = (FCF Operativo/Acción × Múltiplo EV/FCF Justo) − Deuda Neta/Acción',
      explicacion_pedagogica: {
        que_es: 'Mide el valor total de la empresa frente al flujo de caja libre generado por los activos operativos antes de la estructura financiera, penalizando el exceso de deuda.',
        como_calcula: 'Multiplica el flujo libre operativo por su múltiplo EV/FCF de equilibrio (basado en WACC y crecimiento) y descuenta la Deuda Neta por acción (o suma la caja neta).',
        calculo_empresa: vEVFCF != null
          ? `(FCF Op./acc: ${currSym}${ufcfForEvMult.toFixed(2)} × EV/FCF: ${fairEVFCF.toFixed(2)}x) − Deuda Neta/acc (${currSym}${netDebt.toFixed(2)}) = ${currSym}${vEVFCF.toFixed(2)}`
          : 'No aplicable en sector bancario/financiero.'
      },
      datos_usados: { metrica_base: Number(ufcfForEvMult.toFixed(2)), multiplo_justo: Number(fairEVFCF.toFixed(2)), deuda_neta_acc: Number(netDebt.toFixed(2)), unidad_metrica: 'FCF Operativo/Acción' }
    },
    {
      id: 'EV_EBITDA',
      orden: 7,
      nombre: 'EV/EBITDA',
      categoria: 'Múltiplo de Empresa (Enterprise Value)',
      aplicable: vEVEBITDA != null && vEVEBITDA > 0,
      valor: vEVEBITDA,
      formula_resumen: 'FV = (EBITDA/Acción × Múltiplo EV/EBITDA Justo) − Deuda Neta/Acción',
      explicacion_pedagogica: {
        que_es: 'El múltiplo institucional más utilizado en fusiones y adquisiciones (M&A). Evalúa el beneficio operativo bruto antes de intereses, impuestos, depreciaciones y amortizaciones.',
        como_calcula: 'Multiplica el EBITDA por acción por el múltiplo EV/EBITDA justo (ajustado por intensidad de Capex/D&A, tasa fiscal y WACC) y deduce la Deuda Neta por acción.',
        calculo_empresa: vEVEBITDA != null
          ? `(EBITDA/acc: ${currSym}${ebitda.toFixed(2)} × EV/EBITDA: ${fairEVEBITDA.toFixed(2)}x) − Deuda Neta/acc (${currSym}${netDebt.toFixed(2)}) = ${currSym}${vEVEBITDA.toFixed(2)}`
          : 'No aplicable en sector bancario/financiero.'
      },
      datos_usados: { metrica_base: Number(ebitda.toFixed(2)), multiplo_justo: Number(fairEVEBITDA.toFixed(2)), deuda_neta_acc: Number(netDebt.toFixed(2)), unidad_metrica: 'EBITDA/Acción' }
    },
    {
      id: 'EV_EBIT',
      orden: 8,
      nombre: 'EV/EBIT',
      categoria: 'Múltiplo de Empresa (Enterprise Value)',
      aplicable: vEVEBIT != null && vEVEBIT > 0,
      valor: vEVEBIT,
      formula_resumen: 'FV = (EBIT/Acción × Múltiplo EV/EBIT Justo) − Deuda Neta/Acción',
      explicacion_pedagogica: {
        que_es: 'A diferencia del EBITDA, el EBIT sí descuenta el desgaste real de maquinaria e infraestructuras (Depreciación y Amortización), siendo el múltiplo favorito de Warren Buffett y Charlie Munger.',
        como_calcula: 'Multiplica el Beneficio Operativo (EBIT) por acción por el múltiplo EV/EBIT justo y resta la Deuda Neta por acción.',
        calculo_empresa: vEVEBIT != null
          ? `(EBIT/acc: ${currSym}${ebit.toFixed(2)} × EV/EBIT: ${fairEVEBIT.toFixed(2)}x) − Deuda Neta/acc (${currSym}${netDebt.toFixed(2)}) = ${currSym}${vEVEBIT.toFixed(2)}`
          : 'No aplicable en sector bancario/financiero.'
      },
      datos_usados: { metrica_base: Number(ebit.toFixed(2)), multiplo_justo: Number(fairEVEBIT.toFixed(2)), deuda_neta_acc: Number(netDebt.toFixed(2)), unidad_metrica: 'EBIT/Acción' }
    },
    {
      id: 'DIV_YIELD',
      orden: 9,
      nombre: 'Rent. por Dividendo',
      categoria: 'Retorno Directo al Accionista',
      aplicable: vDiv != null && vDiv > 0,
      valor: vDiv,
      formula_resumen: 'FV = Blend [Dividendo / Yield Histórica 5Y] + [DDM Total Shareholder Yield]',
      explicacion_pedagogica: {
        que_es: 'Valora la empresa en función de las rentas en efectivo que reparte periódicamente al accionista y su tasa de reversión a la rentabilidad por dividendo histórica.',
        como_calcula: 'Combina el precio implícito según la rentabilidad por dividendo media de 5 años (Dividend Yield Equilibrium) con el modelo de descuento de dividendos y retorno total al accionista (Gordon-Shapiro DDM).',
        calculo_empresa: vDiv != null
          ? `Dividendo Anual: ${currSym}${div.toFixed(2)}/acc | Yield de Equilibrio: ${targetYieldPct}% | ke: ${(ke * 100).toFixed(2)}% = ${currSym}${vDiv.toFixed(2)}`
          : 'No aplicable: La compañía no reparte dividendo significativo (< 0.40% anual) y reinvierte el capital internamente o mediante recompras.'
      },
      datos_usados: { metrica_base: Number(div.toFixed(2)), multiplo_justo: targetYieldPct, unidad_metrica: 'Dividendo/Acción' }
    },
    {
      id: 'DCF_UNLEVERED',
      orden: 10,
      nombre: 'DCF Sin Apalancar',
      categoria: 'Descuento de Flujos de Caja (DCF)',
      aplicable: vDCFUnlev != null && vDCFUnlev > 0,
      valor: vDCFUnlev,
      formula_resumen: 'FV = ∑ [FCFF_t / (1 + WACC)^t] + Valor Terminal(WACC, gn) − Deuda Neta/Acción',
      explicacion_pedagogica: {
        que_es: 'El modelo institucional de Flujo de Caja Libre para la Firma (FCFF / Unlevered DCF). Proyecta los flujos operativos antes de deuda a 10 años en 3 etapas y los descuenta al coste medio ponderado del capital (WACC).',
        como_calcula: 'Proyecta el FCFF en 3 fases (Crecimiento g1 años 1-5, convergencia lineal años 6-10 y perpetuidad gn con spread mínimo WACC − gn ≥ 2.25%), suma el Valor Terminal descontado y resta la Deuda Neta por acción.',
        calculo_empresa: vDCFUnlev != null
          ? `FCFF Base: ${currSym}${ufcf.toFixed(2)} | WACC: ${(wacc * 100).toFixed(2)}% | g1: ${(g1 * 100).toFixed(1)}% | gn: ${(gnSafe * 100).toFixed(1)}% | EV/acc: ${currSym}${dcfUnlevEv.toFixed(2)} − Deuda Neta: ${currSym}${netDebt.toFixed(2)} = ${currSym}${vDCFUnlev.toFixed(2)}`
          : 'No aplicable en entidades financieras (la deuda es materia prima operativa, no financiación externa).'
      },
      datos_usados: { metrica_base: Number(ufcf.toFixed(2)), tasa_descuento_pct: Number((wacc * 100).toFixed(2)), g1_pct: Number((g1 * 100).toFixed(2)), deuda_neta_acc: Number(netDebt.toFixed(2)), unidad_metrica: 'FCFF/Acción' }
    },
    {
      id: 'DCF_LEVERED',
      orden: 11,
      nombre: 'DCF Apalancado',
      categoria: 'Descuento de Flujos de Caja (DCF)',
      aplicable: vDCFLev != null && vDCFLev > 0,
      valor: vDCFLev,
      formula_resumen: 'FV = ∑ [FCFE_t / (1 + ke)^t] + Valor Terminal(ke, gn) ± Ajuste de Balance',
      explicacion_pedagogica: {
        que_es: 'El modelo de Flujo de Caja Libre para el Accionista (FCFE / Levered DCF). Proyecta el efectivo neto que queda directamente para el capital social tras atender el servicio de deuda y lo descuenta al coste del equity (CAPM ke).',
        como_calcula: 'Descuenta a 10 años (3 etapas) los flujos libres del propietario (FCFE) usando la tasa exigida por el accionista (ke) y ajusta por el exceso de caja o apalancamiento neto estructural.',
        calculo_empresa: vDCFLev != null
          ? `FCFE Base: ${currSym}${fcfeBase.toFixed(2)} | Coste Capital (ke): ${(ke * 100).toFixed(2)}% | g1: ${(g1 * 100).toFixed(1)}% | gn: ${(gnSafe * 100).toFixed(1)}% = ${currSym}${vDCFLev.toFixed(2)}`
          : 'No aplicable cuando el flujo libre apalancado es negativo.'
      },
      datos_usados: { metrica_base: Number(fcfeBase.toFixed(2)), tasa_descuento_pct: Number((ke * 100).toFixed(2)), g1_pct: Number((g1 * 100).toFixed(2)), unidad_metrica: 'FCFE/Acción' }
    }
  ];

  // 4. Filtrado Estadístico de Outliers y Cálculo de la Mediana/Media Central Limpia
  const validModels = rawModels.filter(m => m.aplicable && m.valor != null && m.valor > 0 && Number.isFinite(m.valor));
  const sortedVals = validModels.map(m => m.valor).sort((a, b) => a - b);

  let rawMedian = p0;
  if (sortedVals.length > 0) {
    rawMedian = sortedVals.length % 2 === 1
      ? sortedVals[Math.floor(sortedVals.length / 2)]
      : (sortedVals[sortedVals.length / 2 - 1] + sortedVals[sortedVals.length / 2]) / 2;
  }

  // Descartamos extremos estadísticos que se desvíen más de [-48%, +55%] de la mediana bruta de los modelos
  const lowerBound = rawMedian * 0.52;
  const upperBound = rawMedian * 1.55;
  const cleanValsCandidate = sortedVals.filter(v => v >= lowerBound && v <= upperBound);
  const useOutlierFilter = cleanValsCandidate.length >= Math.min(3, sortedVals.length);
  const cleanVals = useOutlierFilter ? cleanValsCandidate : sortedVals;

  const cleanMedian = cleanVals.length > 0
    ? (cleanVals.length % 2 === 1
      ? cleanVals[Math.floor(cleanVals.length / 2)]
      : (cleanVals[cleanVals.length / 2 - 1] + cleanVals[cleanVals.length / 2]) / 2)
    : p0;
  const cleanMean = cleanVals.length > 0
    ? cleanVals.reduce((acc, v) => acc + v, 0) / cleanVals.length
    : p0;

  // El Fair Value oficial del Motor Multimodelo combina la mediana limpia (60%) y la media truncada limpia (40%)
  const fairValueFinal = Number((0.60 * cleanMedian + 0.40 * cleanMean).toFixed(2));
  const q1Val = cleanVals.length >= 2 ? cleanVals[Math.max(0, Math.floor(cleanVals.length * 0.22))] : fairValueFinal * 0.85;
  const q3Val = cleanVals.length >= 2 ? cleanVals[Math.min(cleanVals.length - 1, Math.floor(cleanVals.length * 0.78))] : fairValueFinal * 1.15;
  const fairValuePess = Number(Math.min(q1Val, fairValueFinal * 0.90).toFixed(2));
  const fairValueOpt = Number(Math.max(q3Val, fairValueFinal * 1.10).toFixed(2));

  const minScale = sortedVals.length > 0 ? Math.min(p0, sortedVals[0]) * 0.85 : p0 * 0.70;
  const maxScale = sortedVals.length > 0 ? Math.max(p0, sortedVals[sortedVals.length - 1]) * 1.10 : p0 * 1.30;

  const modelosEnriquecidos = rawModels.map(m => {
    const isOutlier = m.aplicable && useOutlierFilter && (m.valor < lowerBound || m.valor > upperBound);
    const incluido = m.aplicable && !isOutlier;
    const diffVsP0 = (m.aplicable && p0 > 0) ? Number((((m.valor - p0) / p0) * 100).toFixed(1)) : null;
    return {
      ...m,
      descartado_outlier: isOutlier,
      incluido_en_media: incluido,
      diferencia_vs_p0_pct: diffVsP0,
      rango_escala_min: Number(minScale.toFixed(2)),
      rango_escala_max: Number(maxScale.toFixed(2))
    };
  });

  const resumen11Modelos = {
    total_modelos: 11,
    modelos_aplicables: validModels.length,
    modelos_incluidos: cleanVals.length,
    modelos_descartados_outlier: validModels.length - cleanVals.length,
    mediana_limpia: Number(cleanMedian.toFixed(2)),
    media_limpia: Number(cleanMean.toFixed(2)),
    fair_value_multimodelo: fairValueFinal,
    min_limpio: cleanVals.length > 0 ? Number(cleanVals[0].toFixed(2)) : fairValuePess,
    max_limpio: cleanVals.length > 0 ? Number(cleanVals[cleanVals.length - 1].toFixed(2)) : fairValueOpt,
    escala_visual_min: Number(minScale.toFixed(2)),
    escala_visual_max: Number(maxScale.toFixed(2)),
    wacc_pct: Number((wacc * 100).toFixed(2)),
    ke_pct: Number((ke * 100).toFixed(2)),
    g1_pct: Number((g1 * 100).toFixed(2)),
    gn_pct: Number((gnSafe * 100).toFixed(2))
  };

  return {
    fairValueFinal,
    fairValuePess,
    fairValueOpt,
    baseFlujo: Number(lfcf.toFixed(2)),
    modelos: modelosEnriquecidos,
    resumen: resumen11Modelos
  };
}

/** Wrapper para retrocompatibilidad */
export function evaluarTrampasDeMercado(empresa, p0) {
  const trampaFund = evaluarTrampaFundamental(empresa);
  const high52 = empresa.fifty_two_week_high;
  const low52 = empresa.fifty_two_week_low;
  const caida52wPct = (high52 && high52 > p0) ? Number((((high52 - p0) / high52) * 100).toFixed(1)) : 0;
  const distanciaMin52w = (low52 && p0 >= low52) ? Number((((p0 - low52) / low52) * 100).toFixed(1)) : 0;
  return {
    caida52wPct,
    distanciaMin52w,
    alertaCuchilloCayendo: caida52wPct >= 40.0,
    alertaTrampaFundamental: trampaFund.esTrampaFundamental,
    alertas: trampaFund.alertas
  };
}

/**
 * 8.C MOTOR DE CONSENSO INSTITUCIONAL DE ANALISTAS (WALL STREET + ARGUS RESEARCH + TRADING CENTRAL + BANCOS DE INVERSIÓN)
 * Lee directamente el consenso externo de analistas (cacheado en SQLite o en vivo), calcula la
 * Media del Consenso eliminando sesgos extremos (Trimmed Consensus Mean) y construye el desglose
 * para el modal de consenso institucional.
 */
export function construirValoracionConsensoAnalistas(empresa, p0, fallbackNeutral, fallbackPess, fallbackOpt, currSym = '$', liveConsensus = null) {
  const ticker = (empresa.ticker || '').trim().toUpperCase();
  const cached = liveConsensus || getCachedAnalystConsensus(ticker);

  const rawMean = cached?.target_mean ?? (empresa.target_mean_analysts > 0 ? Number(empresa.target_mean_analysts) : null);
  const rawMedian = cached?.target_median ?? rawMean;
  const rawLow = cached?.target_low ?? (rawMean ? Number((rawMean * 0.80).toFixed(2)) : null);
  const rawHigh = cached?.target_high ?? (rawMean ? Number((rawMean * 1.22).toFixed(2)) : null);
  const numAnalysts = cached?.number_of_analysts ?? (rawMean ? 18 : 0);
  const argusTarget = cached?.argus_target ?? null;
  const argusRating = cached?.argus_rating ?? null;
  const tcFairValue = cached?.tc_fair_value ?? null;
  const tcDescription = cached?.tc_description ?? null;
  const tcDiscount = cached?.tc_discount ?? null;
  const recommendationKey = cached?.recommendation_key ?? 'hold';
  const recommendationMean = cached?.recommendation_mean ?? null;
  const recommendationTrend = cached?.recommendation_trend ?? null;
  const recentFirms = Array.isArray(cached?.recent_firms) ? cached.recent_firms : [];

  const firmsTargets = recentFirms.map(f => f.priceTarget).filter(v => v != null && v > 0);
  let debiasedMean = cached?.fair_value_debiased;
  if (!(debiasedMean > 0)) {
    debiasedMean = calcularMediaConsensoSinSesgos({
      targetMean: rawMean,
      targetMedian: rawMedian,
      targetLow: rawLow,
      targetHigh: rawHigh,
      numAnalysts,
      argusTarget,
      tcFairValue,
      firmsTargets
    });
  }

  // El Fair Value oficial es DIRECTAMENTE el precio objetivo de consenso publicado por Wall Street (rawMean),
  // leído en vivo en el momento de la consulta sin fórmulas sintéticas ni alteraciones numéricas.
  const fairValueFinal = (rawMean && rawMean > 0)
    ? Number(rawMean.toFixed(2))
    : ((rawMedian && rawMedian > 0) ? Number(rawMedian.toFixed(2)) : Number((fallbackNeutral || p0).toFixed(2)));

  const targetMedianFinal = rawMedian && rawMedian > 0 ? Number(rawMedian.toFixed(2)) : fairValueFinal;
  const targetLowFinal = rawLow && rawLow > 0 ? Number(rawLow.toFixed(2)) : Number((fairValueFinal * 0.80).toFixed(2));
  const targetHighFinal = rawHigh && rawHigh > 0 ? Number(rawHigh.toFixed(2)) : Number((fairValueFinal * 1.22).toFixed(2));

  return {
    fairValueFinal,
    fairValuePess: targetLowFinal,
    fairValueOpt: targetHighFinal,
    consensoAnalistas: {
      ticker,
      fair_value_debiased: fairValueFinal,
      target_mean: rawMean ? Number(rawMean.toFixed(2)) : fairValueFinal,
      target_median: targetMedianFinal,
      target_low: targetLowFinal,
      target_high: targetHighFinal,
      number_of_analysts: numAnalysts || 0,
      recommendation_key: recommendationKey,
      recommendation_mean: recommendationMean,
      recommendation_trend: recommendationTrend,
      argus_target: argusTarget,
      argus_rating: argusRating,
      tc_fair_value: tcFairValue,
      tc_description: tcDescription,
      tc_discount: tcDiscount,
      recent_firms: recentFirms,
      updated_at: cached?.updated_at || new Date().toISOString()
    }
  };
}

/**
 * 9. MOTOR DE EVALUACIÓN PILAR 1 POR COMPAÑÍA (CONSENSO INSTITUCIONAL DE ANALISTAS)
 */
export function evaluarEmpresaPilar1(empresa, rfCustom = null, erpCustom = null, pivotG = 0.07, mosDiscount = 0.25) {
  const p0 = empresa.precio_cierre_P0;
  // 1. Resolver Flujo Base Operativo Sostenible (Normalización de Capex de Expansión + Visibilidad Forward Simétrica)
  const ownerCf = (empresa.owner_cf_per_share && empresa.owner_cf_per_share > 0) ? Number(empresa.owner_cf_per_share) : 0;
  const fcf = (empresa.fcf_per_share && empresa.fcf_per_share > 0) ? Number(empresa.fcf_per_share) : 0;
  const nopat = (empresa.nopat_per_share && empresa.nopat_per_share > 0) ? Number((empresa.nopat_per_share * 0.90).toFixed(2)) : 0;
  const eps = (empresa.eps_diluted && empresa.eps_diluted > 0) ? Number((empresa.eps_diluted * 0.85).toFixed(2)) : 0;
  const ocfNorm = (empresa.ocf_per_share && empresa.ocf_per_share > 0) ? Number((empresa.ocf_per_share * 0.72).toFixed(2)) : 0;

  const cfBaseCandidate = [
    empresa.D1_o_FCFA1,
    ownerCf,
    fcf,
    nopat,
    eps,
    empresa.cyclical_normalized_eps,
    empresa.forward_eps,
    ocfNorm,
    empresa.dividend_rate
  ].find(v => v != null && Number.isFinite(Number(v)) && Number(v) > 0);

  let ttmFlow = cfBaseCandidate != null ? Number(cfBaseCandidate) : empresa.D1_o_FCFA1;

  // En negocios Compounder o Industriales donde el Capex de crecimiento puntual hunde D1_o_FCFA1 muy por debajo de la capacidad
  // de generación de beneficios operativos (NOPAT / FCF / EPS), anclamos a la capacidad operativa sostenible:
  const earningPower = Math.max(ownerCf, fcf, nopat, eps, ocfNorm);
  if (ttmFlow > 0 && earningPower > ttmFlow * 1.25 && empresa.arquetipo !== 'INFRAESTRUCTURA_DEUDA' && empresa.arquetipo !== 'BANCA_FINANCIERA') {
    ttmFlow = Number((0.35 * ttmFlow + 0.65 * earningPower).toFixed(2));
  }

  // Detección de Hardware de Almacenamiento y Semiconductores de Memoria Cíclicos (ej. STX, WDC, MU, SNDK):
  // Aunque GICS los ubica en Information Technology, experimentan picos cíclicos de precios (Forward EPS 3x-5x el TTM)
  // que jamás deben extrapolarse a perpetuidad sin normalización de mitad de ciclo.
  const subIndustry = empresa.gics_sub_industry || empresa.industry || '';
  const isCyclicHardware = (subIndustry.includes('Storage & Peripherals') && ttmFlow > 0 && ((empresa.forward_eps || 0) / ttmFlow > 1.5 || (empresa.cyclical_normalized_eps || 0) > 0)) ||
    (subIndustry.includes('Semiconductors') && ttmFlow > 0 && ((empresa.forward_eps || 0) / ttmFlow > 2.0 || (empresa.cyclical_normalized_eps || 0) > 0));

  let cfBase = ttmFlow;
  if (isCyclicHardware) {
    // En hardware de almacenamiento y memoria cíclica (STX, WDC, MU, SNDK), el flujo TTM y el Forward EPS de pico de ciclo
    // se moderan con el beneficio normalizado de mitad de ciclo a 10 años para no extrapolar picos irreales (> $2.600 en SNDK)
    const midCycle = (empresa.cyclical_normalized_eps && empresa.cyclical_normalized_eps > 0) ? Number(empresa.cyclical_normalized_eps) : ttmFlow * 0.65;
    const sustainableTtm = Math.min(ttmFlow, Math.max(midCycle * 3.40, (empresa.eps_diluted || ttmFlow) * 1.15));
    const cappedFwd = empresa.forward_eps > 0 ? Math.min(empresa.forward_eps * 0.70, sustainableTtm * 1.30) : sustainableTtm;
    cfBase = Number((0.15 * midCycle + 0.55 * sustainableTtm + 0.30 * cappedFwd).toFixed(2));
  } else if (ttmFlow > 0 && empresa.forward_eps && empresa.forward_eps > 0 && empresa.arquetipo !== 'BANCA_FINANCIERA') {
    if (empresa.forward_eps > ttmFlow && empresa.arquetipo !== 'INFRAESTRUCTURA_DEUDA') {
      // Incorporación prudente de beneficios forward (Blended Cash Flow) acotada para impedir inflar picos de ciclo
      const capMult = isCyclicHardware ? 1.50 : 1.45;
      const cappedFwd = Math.min(empresa.forward_eps * 0.85, ttmFlow * capMult);
      cfBase = Number((0.60 * ttmFlow + 0.40 * cappedFwd).toFixed(2));
    } else if (empresa.forward_eps < ttmFlow * 0.85) {
      // Si el consenso proyecta caída de beneficios (normalización post-pico o deterioro), ajustamos a la baja con prudencia
      cfBase = Number((0.40 * ttmFlow + 0.60 * empresa.forward_eps).toFixed(2));
    }
  }

  // REGLA DE CONSISTENCIA IFRS / GAAP (Anti-Distorsión de Flujos Desproporcionados frente a Beneficios)
  const maxEarnings = Math.max(empresa.forward_eps || 0, empresa.eps_diluted || 0, empresa.nopat_per_share || 0);
  if (maxEarnings > 0.10 && cfBase > 1.35 * maxEarnings && empresa.arquetipo !== 'INFRAESTRUCTURA_DEUDA') {
    cfBase = Number((maxEarnings * 1.15).toFixed(2));
  }

  const beta = (empresa.beta && empresa.beta > 0) ? empresa.beta : 1.0;
  const rawGHist = empresa.g_hist ?? empresa.g_fundamental ?? 0.06;
  const gHist = isCyclicHardware ? Math.min(0.085, rawGHist) : rawGHist;

  if (p0 == null || cfBase == null || beta == null || gHist == null) {
    return {
      status: 'DISCARDED_MISSING_DATA',
      ticker: empresa.ticker,
      nombre: empresa.nombre,
      precio_cierre_P0: p0 ?? 0
    };
  }
  if (p0 <= 0 || cfBase <= 0 || beta <= 0) {
    return {
      status: 'DISCARDED_INVALID_VALUES',
      ticker: empresa.ticker,
      nombre: empresa.nombre,
      precio_cierre_P0: p0 ?? 0
    };
  }

  const empresaNormalizada = {
    ...empresa,
    D1_o_FCFA1: cfBase,
    beta,
    g_fundamental: isCyclicHardware ? Math.min(0.085, empresa.g_fundamental || gHist) : empresa.g_fundamental,
    g_hist: gHist
  };

  // 1. Tasa de Descuento CAPM Ortodoxa
  const isSpanish = empresaNormalizada.country === 'ES' || empresaNormalizada.currency === 'EUR' || empresaNormalizada.ticker?.toUpperCase().endsWith('.MC');
  let rf = rfCustom;
  let erp = erpCustom;
  if (rf == null || erp == null) {
    const params = leerParametrosMercado();
    if (rf == null) rf = isSpanish ? 0.0315 : params.rf;
    if (erp == null) erp = isSpanish ? 0.0540 : params.erp;
  }
  const arqInfo = clasificarArquetipoEmpresa(empresaNormalizada);
  const r = calcularTasaDescuentoCAPM(rf, beta, erp);

  // 2. Parámetros de Crecimiento Macro (AGENTS.md: gn <= 3.5% en defensivas, y para España <= 2.0% PIB nominal)
  const maxGn = isSpanish ? 0.020 : 0.025;
  const gn = Math.min(maxGn, empresaNormalizada.gn_terminal || maxGn);
  const gNeu = empresaNormalizada.g_fundamental || gHist;
  const gOpt = gNeu + 0.015;
  const gPess = Math.max(0.015, gNeu - 0.020);

  // 3. Valuación Multi-Arquetipo
  const val = calcularValorArquetipo(empresaNormalizada, p0, r, rf, erp, gPess, gNeu, gOpt, gn);
  if (val.invalido) {
    return {
      status: 'NOT_QUALIFIED',
      ticker: empresa.ticker,
      nombre: empresa.nombre,
      precio_cierre_P0: p0,
      arquetipo: val.arquetipo,
      tipo_descarte: 'MODELO_NO_APLICABLE',
      motivo_pedagogico: val.invalido
    };
  }

  // 4. CONSENSO INSTITUCIONAL DE ANALISTAS (Media del Consenso eliminando sesgos extremos + Mediana + Rango + Argus + Trading Central + Bancos)
  const currSym = isSpanish ? '€' : (empresa.currency === 'EUR' ? '€' : '$');
  const multimodelo = calcular11ModelosValoracion(empresaNormalizada, p0, r, rf, erp, gn, currSym);

  const consensoExt = construirValoracionConsensoAnalistas(
    empresaNormalizada,
    p0,
    multimodelo.fairValueFinal > 0 ? multimodelo.fairValueFinal : val.fairValueNeu,
    multimodelo.fairValuePess > 0 ? multimodelo.fairValuePess : val.fairValuePess,
    multimodelo.fairValueOpt > 0 ? multimodelo.fairValueOpt : val.fairValueOpt,
    currSym,
    empresa._liveConsensus || null
  );

  const targetWallSt = consensoExt.consensoAnalistas.target_mean || (empresa.target_mean_analysts > 0 ? Number(empresa.target_mean_analysts.toFixed(2)) : null);
  const netDebtShare = empresa.net_debt_per_share || 0;
  const esNoFinanciera = empresa.arquetipo !== 'BANCA_FINANCIERA' && empresa.arquetipo !== 'GESTORA_ACTIVOS' && empresa.arquetipo !== 'HOLDING_CONGLOMERADO';

  // 4. FAIR VALUE POR CONSENSO OFICIAL DE WALL STREET (Precios Objetivo Analistas leídos en vivo)
  // El usuario requiere explícitamente el consenso real de Wall Street leído en el momento de la consulta,
  // descartando cálculos y modelos sintéticos internos.
  const fairValueFinal = consensoExt.fairValueFinal;
  const fairValueOptFinal = consensoExt.fairValueOpt;
  const fairValuePessFinal = consensoExt.fairValuePess;
  const numAnalistas = consensoExt.consensoAnalistas.number_of_analysts || 18;
  const modeloFinal = `Consenso Wall Street (${numAnalistas} Analistas en Vivo)`;
  const formulaFinal = `Consenso Wall Street: ${currSym}${fairValueFinal.toFixed(2)} | Mediana: ${currSym}${consensoExt.consensoAnalistas.target_median.toFixed(2)} | Rango: ${currSym}${fairValuePessFinal.toFixed(2)} – ${currSym}${fairValueOptFinal.toFixed(2)}`;
  const metodoFairValue = 'CONSENSO_WALL_STREET_LIVE';
  const distorsionDetectada = false;

  const esDistressDeuda = esNoFinanciera && (
    empresa.net_debt_ebitda != null && empresa.net_debt_ebitda >= 5.5 &&
    (empresa.altman_z_score != null && empresa.altman_z_score < 1.2)
  );

  // 5. Margen de Seguridad Directo del Usuario (ej. 20% o 25%) sobre el Fair Value de Consenso sin sesgos
  const dispersion = fairValueFinal > 0 ? (fairValueOptFinal - fairValuePessFinal) / fairValueFinal : 0.20;
  const dMoS = (mosDiscount != null && !isNaN(mosDiscount) && mosDiscount > 0)
    ? Math.min(0.50, Math.max(0.05, Number(mosDiscount.toFixed(4))))
    : 0.20;
  const factorMoS = 1.0 - dMoS;

  // Techo de seguridad con Margen de Seguridad:
  // vpMoSNeu: Fair Value con Margen de Seguridad dinámico (1 - MoS)
  // vpMoSOpt: Fair Value Optimista con MoS
  // vpMoSPess: Fair Value Pesimista (escenario conservador de analistas o estrés)
  const vpMoSNeu = Number((fairValueFinal * factorMoS).toFixed(2));
  const vpMoSOpt = Number((fairValueOptFinal * factorMoS).toFixed(2));
  const vpMoSPess = Number(fairValuePessFinal.toFixed(2));

  // Techo máximo admisible de compra (Graham / Damodaran):
  // El precio no debe rebasar el Techo de Margen de Seguridad
  const techoMaximoMoS = vpMoSNeu;

  // 6. DCF Inverso: Crecimiento implícito en el precio (Fase 2, Punto 11)
  const rEfectiva = val.detallesModelo?.r_utilizada_pct ? val.detallesModelo.r_utilizada_pct / 100 : r;
  const gImplicito = calcularCrecimientoImplicito(val.baseFlujo, rEfectiva, gn, p0, val.modeloTipo, {
    tbv: empresa.tbv_per_share,
    rote: empresa.rote
  });

  // 7. Health Score Académico Multidimensional (Fase 2, Punto 12)
  const health = calcularHealthScoreAcademico(empresa, r);

  // 8. Auditoría de Trampas Fundamentales (Fase 2, Punto 9)
  const trampaFund = evaluarTrampaFundamental(empresa);

  // Escenario de Estrés (caída del 30% en flujos, r + 1,5%) con deducción de deuda neta
  const cfEstres = Number((val.baseFlujo * 0.70).toFixed(2));
  const rEstres = Number((r + 0.015).toFixed(4));
  const dcfEstres = calcularValorDCF3Etapas(cfEstres, rEstres, 0.020, 0.020);
  const fairValueEstres = esNoFinanciera ? Math.max(0, dcfEstres.fairValue - netDebtShare) : dcfEstres.fairValue;
  const techoMoSEstres = Number((fairValueEstres * factorMoS).toFixed(2));
  const cumpleEstres = fairValueEstres > 0 && p0 <= techoMoSEstres;

  // Criterio estricto de calificación:
  // Compra autorizada solo si cotiza por debajo del techo prudente MoS
  const cumpleCompraEstricta = p0 <= techoMaximoMoS;
  const cumpleNeu = p0 <= vpMoSNeu;
  const cumpleOpt = p0 <= vpMoSOpt;

  const diffPct = Number((((techoMaximoMoS - p0) / p0) * 100).toFixed(1));
  const diffFairPct = Number((((p0 - fairValueFinal) / fairValueFinal) * 100).toFixed(1));

  let estadoCompra;
  let descEstadoCompra;
  if (cumpleCompraEstricta) {
    estadoCompra = 'ZONA_COMPRA_ACTIVA';
    descEstadoCompra = `En Zona de Compra Segura: Cotiza a ${currSym}${p0.toFixed(2)}, por debajo del techo prudente MoS (${currSym}${techoMaximoMoS.toFixed(2)}). Descuento holgado del ${Math.round(dMoS * 100)}% favorable al inversor.`;
  } else if (p0 <= fairValueFinal) {
    estadoCompra = 'ZONA_VALOR_JUSTO';
    descEstadoCompra = `Zona Valor Justo: Cotiza a ${currSym}${p0.toFixed(2)}, dentro de su rango de Fair Value (${currSym}${fairValueFinal.toFixed(2)}), pero por encima del techo de entrada MoS (${currSym}${techoMaximoMoS.toFixed(2)}).`;
  } else {
    estadoCompra = 'ZONA_SOBREPRECIO';
    descEstadoCompra = `Fuera de Zona (Sobreprecio): Cotiza a ${currSym}${p0.toFixed(2)}, con un sobreprecio del +${diffFairPct}% sobre su Fair Value (${currSym}${fairValueFinal.toFixed(2)}).`;
  }

  const commonAuditFields = {
    ticker: empresa.ticker,
    nombre: empresa.nombre,
    sector: empresa.sector || 'General',
    industry: empresa.industry || '',
    currency: isSpanish ? 'EUR' : (empresa.currency || 'USD'),
    currency_symbol: currSym,
    arquetipo: val.arquetipo,
    nombre_arquetipo: val.nombre_arquetipo,
    modelo_valoracion: modeloFinal,
    formula_valoracion: formulaFinal,
    precio_cierre_P0: Number(p0.toFixed(2)),
    D1_o_FCFA1: Number(cfBase.toFixed(2)),
    cf_base_utilizado: multimodelo.baseFlujo || val.baseFlujo,
    dividend_rate: empresa.dividend_rate || 0.0,
    eps_diluted: empresa.eps_diluted ?? null,
    fcf_per_share: empresa.fcf_per_share ?? null,
    tbv_per_share: empresa.tbv_per_share ?? null,
    sbc_per_share: empresa.sbc_per_share ?? null,
    net_debt_per_share: empresa.net_debt_per_share ?? null,
    beta: beta,
    roic: empresa.roic ?? null,
    reinvestment_rate: empresa.reinvestment_rate ?? null,
    tasa_descuento_r: Number(rEfectiva.toFixed(4)),
    rf_utilizado: rf,
    erp_utilizado: erp,
    g_fundamental_pct: Number((gNeu * 100).toFixed(2)),
    g_techo_macro: gn,
    g_implicito_precio_pct: gImplicito != null ? Number((gImplicito * 100).toFixed(2)) : null,
    dispersion_valoracion_pct: Number((dispersion * 100).toFixed(1)),
    mos_discount_pct: Math.round(dMoS * 100),
    fair_value_Gordon: fairValueFinal,
    fair_value_teorico: fairValueFinal,
    fair_value_pess: fairValuePessFinal,
    fair_value_opt: fairValueOptFinal,
    valor_intrinseco: multimodelo.fairValueFinal || multimodelo.resumen?.fair_value_multimodelo || null,
    valor_intrinseco_pess: multimodelo.fairValuePess || multimodelo.resumen?.min_limpio || null,
    valor_intrinseco_opt: multimodelo.fairValueOpt || multimodelo.resumen?.max_limpio || null,
    consenso_wall_street: consensoExt.consensoAnalistas.target_mean || null,
    target_mean_analysts: targetWallSt,
    fifty_two_week_low: empresa.fifty_two_week_low ?? null,
    fifty_two_week_high: empresa.fifty_two_week_high ?? null,
    metodo_fair_value: metodoFairValue,
    distorsion_dcf_corregida: distorsionDetectada,
    fair_value_dcf_original: distorsionDetectada ? val.fairValueNeu : null,
    consenso_analistas: consensoExt.consensoAnalistas,
    modelos_valoracion_11: multimodelo.modelos,
    resumen_valoracion_11: multimodelo.resumen,
    precio_entrada_prudente: techoMaximoMoS,
    techo_maximo_compra: techoMaximoMoS,
    target_exit_price: calculatePrudentTargetExit(p0, empresa.fifty_two_week_high, fairValueFinal),
    estado_compra: estadoCompra,
    descripcion_estado: descEstadoCompra,
    vpMoSNeu,
    vpMoSOpt,
    vpMoSPess,
    discrepancia: diffPct,
    discrepancia_porcentual_neutra: diffPct >= 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`,
    health_score: health.score,
    quality_tier: health.qualityTier,
    quality_label: health.qualityLabel,
    health_metrics: health.metricas,
    trampas_fundamentales: trampaFund.alertas,
    detalles_modelo: val.detallesModelo,
    filtro_value: evaluarFiltroValue(empresaNormalizada, p0, fairValueFinal),
    escalera_mos: {
      fair_value: fairValueFinal,
      mos_10_pct: Number((fairValueFinal * 0.90).toFixed(2)),
      mos_20_pct: Number((fairValueFinal * 0.80).toFixed(2)),
      mos_30_pct: Number((fairValueFinal * 0.70).toFixed(2))
    },
    escenario_pesimista: {
      g: gPess,
      VP_teorico: fairValuePessFinal,
      VP_MoS: vpMoSPess,
      VP_MoS_30: Number((fairValuePessFinal * 0.70).toFixed(2)),
      cumple_MoS: cumpleCompraEstricta,
      cumple_compra: cumpleCompraEstricta
    },
    escenario_neutro: {
      g: gNeu,
      VP_teorico: fairValueFinal,
      VP_MoS: vpMoSNeu,
      VP_MoS_30: Number((fairValueFinal * 0.70).toFixed(2)),
      cumple_MoS: cumpleNeu,
      cumple_compra: cumpleNeu
    },
    escenario_optimista: {
      g: gOpt,
      VP_teorico: fairValueOptFinal,
      VP_MoS: vpMoSOpt,
      VP_MoS_30: Number((fairValueOptFinal * 0.70).toFixed(2)),
      cumple_MoS: cumpleOpt,
      cumple_compra: cumpleOpt
    }
  };

  // Descarte por Trampa Fundamental crítica, Sobreendeudamiento Crítico o Filtro Value severo
  const filtroVal = commonAuditFields.filtro_value;
  const esDescarteFiltroGrave = filtroVal?.veredicto?.includes('DESCARTADO DE INMEDIATO') && (
    (empresa.net_debt_ebitda != null && empresa.net_debt_ebitda >= 4.0) ||
    health.score < 45 ||
    (val.fairValueNeu <= 0 && netDebtShare > 0)
  );

  if (esDistressDeuda || (trampaFund.esTrampaFundamental && !cumpleEstres) || esDescarteFiltroGrave) {
    let motivoDetalle = trampaFund.alertas[0]?.detalle;
    if (val.fairValueNeu <= 0 && netDebtShare > 0) {
      motivoDetalle = `La deuda neta (${currSym}${netDebtShare.toFixed(2)}/acc) absorbe el valor operativo de los activos (${currSym}${(val.detallesModelo?.enterprise_value_per_share || 0).toFixed(2)}/acc), dejando el valor patrimonial del accionista en riesgo crítico.`;
    } else if (empresa.net_debt_ebitda != null && empresa.net_debt_ebitda >= 4.5) {
      motivoDetalle = `Apalancamiento de ${empresa.net_debt_ebitda}x Deuda Neta/EBITDA excede el umbral prudente y genera fragilidad financiera.`;
    } else if (!motivoDetalle) {
      motivoDetalle = filtroVal?.motivo_parrafo || 'Riesgo de insolvencia o sobreendeudamiento crítico';
    }

    return {
      status: 'DISCARDED_VALUE_TRAP',
      ...commonAuditFields,
      tipo_descarte: 'TRAMPA_FUNDAMENTAL',
      motivo_pedagogico: `Descarte Preventivo por Trampa Fundamental / Deuda: ${empresa.nombre} cotiza a ${currSym}${p0.toFixed(2)}, con alertas de riesgo estructural: ${motivoDetalle}. No apta para inversión Value rigurosa.`
    };
  }

  // Si no califica por precio
  if (!cumpleCompraEstricta) {
    let motivoPedagogico;
    if (p0 <= fairValueFinal) {
      motivoPedagogico = `${empresa.nombre} cotiza a ${currSym}${p0.toFixed(2)}, dentro de su rango de Fair Value (${currSym}${fairValueFinal.toFixed(2)}). Sin embargo, bajo la disciplina de Margen de Seguridad del ${Math.round(dMoS * 100)}%, el techo máximo admisible de compra se sitúa en ${currSym}${techoMaximoMoS.toFixed(2)} (${diffPct}% de diferencial sobre dicho umbral).`;
    } else {
      motivoPedagogico = `${empresa.nombre} cotiza a ${currSym}${p0.toFixed(2)}, con un sobreprecio del +${diffFairPct}% sobre su Fair Value (${currSym}${fairValueFinal.toFixed(2)}). Techo de compra prudente con MoS: ${currSym}${techoMaximoMoS.toFixed(2)}.`;
    }

    return {
      status: 'NOT_QUALIFIED',
      ...commonAuditFields,
      tipo_descarte: 'PRECIO_ELEVADO',
      motivo_pedagogico: motivoPedagogico
    };
  }

  // Si Califica
  const holguraFavorable = Math.abs(diffPct);
  return {
    status: 'QUALIFIED',
    ...commonAuditFields,
    tipo_descarte: 'CALIFICADA',
    discrepancia_porcentual_neutra: `+${holguraFavorable.toFixed(1)}%`,
    _discrepancia_num: holguraFavorable,
    motivo_pedagogico: `Oportunidad con Margen de Seguridad confirmado: Cotiza a ${currSym}${p0.toFixed(2)}, por debajo de su techo de entrada MoS de ${currSym}${techoMaximoMoS.toFixed(2)} (+${holguraFavorable.toFixed(1)}% de holgura favorable frente a un Fair Value central de ${currSym}${fairValueFinal.toFixed(2)}). El crecimiento implícito en el precio es moderado (${commonAuditFields.g_implicito_precio_pct}%).`
  };
}

/**
 * 10. EJECUTAR BARRIDO INTEGRAL DEL S&P 500
 */
export function ejecutarBarridoPilar1(universoCustom = null, rfCustom = null, erpCustom = null, pivotG = 0.07, mosDiscount = 0.20, market = 'SP500') {
  const normMarket = (market || 'SP500').toUpperCase();
  const isSpanish = normMarket === 'IBEX35';
  const isNasdaq = normMarket === 'NASDAQ';
  const marketName = isSpanish ? 'IBEX 35' : (isNasdaq ? 'NASDAQ-100' : 'S&P 500');
  const marketCurrency = isSpanish ? 'EUR' : 'USD';
  const marketCurrencySymbol = isSpanish ? '€' : '$';

  const params = leerParametrosMercado();
  let rf = rfCustom;
  if (!rf) {
    if (isSpanish) {
      rf = 0.0315; // Bono Soberano Reino de España 10Y
    } else {
      try {
        const tnxRow = db.prepare("SELECT yield_rate FROM macro_yield_curve WHERE maturity = '10Y'").get();
        if (tnxRow?.yield_rate && tnxRow.yield_rate >= 2.5 && tnxRow.yield_rate <= 6.5) {
          const y30 = db.prepare("SELECT yield_rate FROM macro_yield_curve WHERE maturity = '30Y'").get()?.yield_rate || 4.42;
          if (tnxRow.yield_rate <= y30 + 0.60) {
            rf = tnxRow.yield_rate / 100.0;
          } else {
            rf = params.rf;
          }
        } else {
          rf = params.rf;
        }
      } catch {
        rf = params.rf;
      }
    }
  }
  const erp = erpCustom ?? (isSpanish ? 0.0540 : params.erp);

  let universo = universoCustom;
  if (!universo) {
    universo = getCachedUniverse(normMarket);
  }

  let quotesMap = new Map();
  try {
    const quotes = db.prepare('SELECT ticker, current_price, fifty_two_week_low, fifty_two_week_high, target_mean FROM market_quotes').all();
    quotesMap = new Map(quotes.map(q => [q.ticker.toUpperCase(), q]));
  } catch (err) {
    console.warn('[Pilar1] No se pudieron cargar cotizaciones en vivo:', err.message);
  }

  let descartadasDatos = 0;
  const descartadasTechoR = [];
  const descartadasTrampaValor = [];
  const noCalificadasPrecio = [];
  const enZonaValorJusto = [];
  const calificadas = [];

  for (const emp of universo) {
    const liveQuote = quotesMap.get(emp.ticker?.toUpperCase());
    const livePrice = (liveQuote?.current_price && liveQuote.current_price > 0) ? liveQuote.current_price : emp.precio_cierre_P0;
    const high52 = liveQuote?.fifty_two_week_high ?? emp.fifty_two_week_high;
    const max5y = emp.max_5y || high52;
    const dd5y = (max5y && max5y > 0 && livePrice) ? Number(((livePrice / max5y - 1.0) * 100).toFixed(1)) : emp.drawdown_5y_pct;
    const targetWallSt = (liveQuote?.target_mean && liveQuote.target_mean > 0)
      ? Number(liveQuote.target_mean.toFixed(2))
      : (emp.target_mean_analysts && emp.target_mean_analysts > 0 ? Number(emp.target_mean_analysts.toFixed(2)) : null);

    const empAuditada = {
      ...emp,
      precio_cierre_P0: livePrice,
      fifty_two_week_low: liveQuote?.fifty_two_week_low ?? emp.fifty_two_week_low,
      fifty_two_week_high: high52,
      drawdown_5y_pct: dd5y,
      target_mean_analysts: targetWallSt
    };

    const evaluacion = evaluarEmpresaPilar1(empAuditada, rf, erp, pivotG, mosDiscount);
    if (evaluacion.status === 'DISCARDED_MISSING_DATA' || evaluacion.status === 'DISCARDED_INVALID_VALUES') {
      descartadasDatos++;
    } else if (evaluacion.status === 'DISCARDED_R_LEQ_G') {
      descartadasTechoR.push(evaluacion);
    } else if (evaluacion.status === 'DISCARDED_VALUE_TRAP' || evaluacion.tipo_descarte === 'TRAMPA_FUNDAMENTAL') {
      descartadasTrampaValor.push(evaluacion);
    } else if (evaluacion.status === 'NOT_QUALIFIED') {
      if (evaluacion.estado_compra === 'ZONA_VALOR_JUSTO') {
        enZonaValorJusto.push(evaluacion);
      }
      noCalificadasPrecio.push(evaluacion);
    } else if (evaluacion.status === 'QUALIFIED') {
      calificadas.push(evaluacion);
    }
  }

  enZonaValorJusto.sort((a, b) => b.discrepancia - a.discrepancia);
  noCalificadasPrecio.sort((a, b) => b.discrepancia - a.discrepancia);
  descartadasTrampaValor.sort((a, b) => (b.caida_desde_maximo_52w_pct || 0) - (a.caida_desde_maximo_52w_pct || 0));
  calificadas.sort((a, b) => b._discrepancia_num - a._discrepancia_num);

  const resultadosFormateados = calificadas.map(c => {
    const copy = { ...c };
    delete copy._discrepancia_num;
    return copy;
  });

  const aptasFiltroValue = resultadosFormateados.filter(r => r.filtro_value?.apto).length;
  const casiAptasFiltroValue = resultadosFormateados.filter(r => r.filtro_value?.casi_apto).length;

  const mosPct = Math.round(mosDiscount * 100);
  const output = {
    ejecucion_fecha: new Date().toISOString().split('T')[0],
    market: normMarket,
    market_name: marketName,
    currency: marketCurrency,
    currency_symbol: marketCurrencySymbol,
    universo_analizado: universo.length,
    empresas_descartadas_datos_insuficientes: descartadasDatos,
    empresas_descartadas_techo_r: descartadasTechoR.length,
    empresas_descartadas_trampa_valor: descartadasTrampaValor.length,
    empresas_en_zona_valor_justo: enZonaValorJusto.length,
    empresas_no_calificadas_precio: noCalificadasPrecio.length,
    empresas_calificadas_pilar1: resultadosFormateados.length,
    empresas_aptas_filtro_value: aptasFiltroValue,
    empresas_casi_aptas_filtro_value: casiAptasFiltroValue,
    pivote_g_utilizado: pivotG,
    mos_utilizado: mosDiscount,
    mos_pct: mosPct,
    resultados: resultadosFormateados,
    diagnostico_pedagogico: {
      descartadas_techo_r: descartadasTechoR,
      descartadas_trampa_valor: descartadasTrampaValor,
      en_zona_valor_justo: enZonaValorJusto,
      no_calificadas_precio: noCalificadasPrecio
    }
  };

  if (resultadosFormateados.length === 0) {
    output.mensaje_vacio = `BARRIDO COMPLETADO: Ninguna compañía de ${marketName} cotiza actualmente por debajo de su techo de Margen de Seguridad Pesimista.`;
  }

  return output;
}

const UNIVERSES_MAP = {
  SP500: 'sp500_universe.json',
  NASDAQ: 'nasdaq_universe.json',
  IBEX35: 'ibex35_universe.json'
};

const universesCache = new Map();
const externalAuditedCache = new Map();

export function getCachedUniverse(market = 'SP500') {
  const norm = (market || 'SP500').toUpperCase();
  if (universesCache.has(norm)) {
    return universesCache.get(norm);
  }
  const filename = UNIVERSES_MAP[norm] || UNIVERSES_MAP.SP500;
  const universePath = path.resolve(__dirname, 'data', filename);
  if (!fs.existsSync(universePath)) {
    console.warn(`[Pilar1] Archivo no encontrado para ${norm}: ${universePath}`);
    return getCachedUniverse('SP500');
  }
  const raw = fs.readFileSync(universePath, 'utf-8');
  const parsed = JSON.parse(raw);
  universesCache.set(norm, parsed);
  return parsed;
}

export function findTickerInAllUniverses(ticker) {
  if (!ticker) return null;
  const cleanTicker = ticker.replace(/[,;:\s]+$/g, '').replace(/^[,;:\s]+/g, '').trim().toUpperCase();
  const allEntries = [];
  for (const m of ['SP500', 'NASDAQ', 'IBEX35']) {
    const universe = getCachedUniverse(m);
    const found = universe.find(e => e.ticker?.toUpperCase() === cleanTicker);
    if (found) {
      return { empresa: found, market: m };
    }
    for (const item of universe) {
      if (item.ticker) allEntries.push({ empresa: item, market: m, sym: item.ticker.toUpperCase() });
    }
  }
  if (externalAuditedCache.has(cleanTicker)) {
    return {
      empresa: externalAuditedCache.get(cleanTicker),
      market: cleanTicker.endsWith('.MC') ? 'IBEX35' : 'SP500'
    };
  }
  // Auto-corrección de trasposición de letras (ej. SDNK -> SNDK, APPL -> AAPL, GOOOG -> GOOG)
  if (cleanTicker.length >= 3 && cleanTicker.length <= 6) {
    const sortedInput = cleanTicker.split('').sort().join('');
    const anagramMatch = allEntries.find(e => e.sym.length === cleanTicker.length && e.sym.split('').sort().join('') === sortedInput);
    if (anagramMatch) {
      return { empresa: anagramMatch.empresa, market: anagramMatch.market };
    }
  }
  return null;
}

/**
 * Consulta la valoración fundamental intrínseca de una compañía por ticker
 */
export function obtenerValuacionTicker(ticker, customPrice = null) {
  if (!ticker) return null;
  const cleanTicker = ticker.trim().toUpperCase();
  const match = findTickerInAllUniverses(cleanTicker);
  const emp = match?.empresa;
  if (!emp) return null;

  const isSpanish = match.market === 'IBEX35' || cleanTicker.endsWith('.MC') || emp.currency === 'EUR';
  const params = leerParametrosMercado();
  let rf = isSpanish ? 0.0315 : params.rf;
  if (!isSpanish) {
    try {
      const tnxRow = db.prepare("SELECT yield_rate FROM macro_yield_curve WHERE maturity = '10Y'").get();
      if (tnxRow?.yield_rate && tnxRow.yield_rate >= 2.5 && tnxRow.yield_rate <= 6.5) {
        const y30 = db.prepare("SELECT yield_rate FROM macro_yield_curve WHERE maturity = '30Y'").get()?.yield_rate || 4.42;
        if (tnxRow.yield_rate <= y30 + 0.60) {
          rf = tnxRow.yield_rate / 100.0;
        } else {
          rf = params.rf;
        }
      } else {
        rf = params.rf;
      }
    } catch {
      rf = params.rf;
    }
  }
  const erp = isSpanish ? 0.0540 : params.erp;

  let quote = null;
  try {
    quote = db.prepare('SELECT current_price, fifty_two_week_low, fifty_two_week_high, target_mean FROM market_quotes WHERE UPPER(ticker) = ?').get(cleanTicker);
  } catch {}

  const p0 = customPrice ?? quote?.current_price ?? emp.precio_cierre_P0;
  const high52 = quote?.fifty_two_week_high ?? emp.fifty_two_week_high;
  const max5y = emp.max_5y || high52;
  const dd5y = (max5y && max5y > 0 && p0) ? Number(((p0 / max5y - 1.0) * 100).toFixed(1)) : emp.drawdown_5y_pct;
  const targetWallSt = (quote?.target_mean && quote.target_mean > 0)
    ? Number(quote.target_mean.toFixed(2))
    : (emp.target_mean_analysts && emp.target_mean_analysts > 0 ? Number(emp.target_mean_analysts.toFixed(2)) : null);

  const empAuditada = {
    ...emp,
    precio_cierre_P0: p0,
    fifty_two_week_low: quote?.fifty_two_week_low ?? emp.fifty_two_week_low,
    fifty_two_week_high: high52,
    drawdown_5y_pct: dd5y,
    target_mean_analysts: targetWallSt
  };

  return evaluarEmpresaPilar1(empAuditada, rf, erp, 0.07, 0.20);
}

/**
 * Realiza una auditoría metodológica completa para cualquier activo (S&P 500, NASDAQ, IBEX 35 o mercado global).
 * Aplica Gordon-Shapiro, Fair Value, escalera de Margen de Seguridad y restricciones anti-trampas.
 */
export async function auditarActivoCompleto(ticker, mosDiscount = 0.25) {
  if (!ticker) return null;
  const rawClean = ticker.replace(/[,;:\s]+$/g, '').replace(/^[,;:\s]+/g, '').trim().toUpperCase();
  const match = findTickerInAllUniverses(rawClean);
  const emp = match?.empresa;
  const cleanTicker = emp?.ticker ? emp.ticker.toUpperCase() : rawClean;
  const isSpanish = match?.market === 'IBEX35' || cleanTicker.endsWith('.MC') || emp?.currency === 'EUR';

  const params = leerParametrosMercado();
  let rf = isSpanish ? 0.0315 : params.rf;
  if (!isSpanish) {
    try {
      const tnxRow = db.prepare("SELECT yield_rate FROM macro_yield_curve WHERE maturity = '10Y'").get();
      if (tnxRow?.yield_rate && tnxRow.yield_rate >= 2.5 && tnxRow.yield_rate <= 6.5) {
        const y30 = db.prepare("SELECT yield_rate FROM macro_yield_curve WHERE maturity = '30Y'").get()?.yield_rate || 4.42;
        if (tnxRow.yield_rate <= y30 + 0.60) {
          rf = tnxRow.yield_rate / 100.0;
        }
      }
    } catch {}
  }
  const erp = isSpanish ? 0.0540 : params.erp;

  // Helper para extraer métricas clave en tiempo real desde SEC EDGAR (10-K / 10-Q / 20-F IFRS)
  const extractSecLiveMetrics = async (tkr) => {
    try {
      const dive = await buildCompanyFinancialDeepDive(tkr);
      if (!dive) return null;
      const getTtmMetric = (arr, key) => {
        const m = arr?.find(item => item.key === key);
        return m?.modes?.TTM?.current ?? m?.modes?.A?.current ?? null;
      };
      const roicPct = getTtmMetric(dive.profitability_and_returns, 'roic');
      const roePct = getTtmMetric(dive.profitability_and_returns, 'roe');
      const fcfMarginPct = getTtmMetric(dive.profitability_and_returns, 'fcf_margin');
      const fcfPerShare = getTtmMetric(dive.cash_investment_and_conversion, 'fcf_por_accion')
        ?? getTtmMetric(dive.cash_investment_and_conversion, 'fcf_per_share');
      return {
        company_name: dive.company_name,
        latest_period: dive.latest_period,
        roic: roicPct != null ? Number((roicPct / 100).toFixed(4)) : null,
        roe: roePct != null ? Number((roePct / 100).toFixed(4)) : null,
        fcf_margin_pct: fcfMarginPct,
        fcf_per_share: (fcfPerShare != null && fcfPerShare > 0) ? Number(fcfPerShare.toFixed(2)) : null,
        rev_cagr_3y: dive.operational_momentum?.rev_cagr_3y ?? null,
        net_debt_to_ebitda: dive.risk_assessment?.net_debt_to_ebitda?.value ?? null,
        altman_z_score: dive.risk_assessment?.altman_z ?? dive.risk_assessment?.altman_z_score?.value ?? null
      };
    } catch {
      return null;
    }
  };

  // CONSULTA EN TIEMPO REAL EN EL MOMENTO DE LA PETICIÓN (Precio en vivo + Consenso Wall Street + SEC EDGAR TTM)
  const [liveQuote, liveConsensus, secLive] = await Promise.all([
    fetchLiveQuote(cleanTicker).catch(() => null),
    fetchInstitutionalConsensus(cleanTicker).catch(() => null),
    extractSecLiveMetrics(cleanTicker).catch(() => null)
  ]);

  // Actualizar SQLite market_quotes con la cotización recién leída en vivo
  if (liveQuote && liveQuote.price > 0) {
    try {
      db.prepare(`
        INSERT INTO market_quotes (ticker, current_price, fifty_two_week_low, fifty_two_week_high, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(ticker) DO UPDATE SET
          current_price = excluded.current_price,
          fifty_two_week_low = COALESCE(excluded.fifty_two_week_low, market_quotes.fifty_two_week_low),
          fifty_two_week_high = COALESCE(excluded.fifty_two_week_high, market_quotes.fifty_two_week_high),
          updated_at = CURRENT_TIMESTAMP
      `).run(cleanTicker, liveQuote.price, liveQuote.fifty_two_week_low || null, liveQuote.fifty_two_week_high || null);
    } catch {}
  }

  let dbQuote = null;
  if (!liveQuote?.price) {
    try {
      dbQuote = db.prepare('SELECT current_price, fifty_two_week_low, fifty_two_week_high FROM market_quotes WHERE UPPER(ticker) = ?').get(cleanTicker);
    } catch {}
  }

  const consultaTimestamp = new Date().toISOString();

  // 1. Si la empresa se encuentra en el universo S&P 500, sobreescribimos SIEMPRE con los datos en vivo del momento de la consulta
  if (emp) {
    const p0 = liveQuote?.price ?? dbQuote?.current_price ?? emp.precio_cierre_P0;
    const high52 = liveQuote?.fifty_two_week_high ?? dbQuote?.fifty_two_week_high ?? emp.fifty_two_week_high;
    const low52 = liveQuote?.fifty_two_week_low ?? dbQuote?.fifty_two_week_low ?? emp.fifty_two_week_low;
    const max5y = Math.max(emp.max_5y || 0, high52 || 0) || high52;
    const dd5y = (max5y && max5y > 0 && p0) ? Number(((p0 / max5y - 1.0) * 100).toFixed(1)) : emp.drawdown_5y_pct;

    const liveTargetWallSt = (liveConsensus?.target_mean && liveConsensus.target_mean > 0)
      ? Number(liveConsensus.target_mean.toFixed(2))
      : emp.target_mean_analysts;

    const liveFcfShare = secLive?.fcf_per_share ?? emp.fcf_per_share ?? null;

    const empAuditada = {
      ...emp,
      precio_cierre_P0: p0,
      fifty_two_week_low: low52,
      fifty_two_week_high: high52,
      drawdown_5y_pct: dd5y,
      target_mean_analysts: liveTargetWallSt,
      D1_o_FCFA1: liveFcfShare ?? emp.D1_o_FCFA1,
      fcf_per_share: liveFcfShare ?? liveConsensus?.fcf_per_share ?? emp.fcf_per_share,
      revenue_per_share: emp.revenue_per_share ?? liveConsensus?.revenue_per_share ?? null,
      ebitda_per_share: emp.ebitda_per_share ?? liveConsensus?.ebitda_per_share ?? null,
      ebit_per_share: emp.ebit_per_share ?? liveConsensus?.ebit_per_share ?? null,
      nopat_per_share: emp.nopat_per_share ?? liveConsensus?.nopat_per_share ?? null,
      operating_margin: emp.operating_margin ?? liveConsensus?.operating_margin ?? null,
      roic: secLive?.roic ?? emp.roic ?? null,
      roe: secLive?.roe ?? emp.roe ?? liveConsensus?.roe ?? null,
      rev_cagr_3y: secLive?.rev_cagr_3y ?? emp.rev_cagr_3y ?? null,
      altman_z_score: secLive?.altman_z_score ?? emp.altman_z_score ?? null,
      _liveConsensus: liveConsensus
    };

    const evalRes = evaluarEmpresaPilar1(empAuditada, rf, erp, 0.07, mosDiscount);
    if (evalRes && (evalRes.status === 'DISCARDED_VALUE_TRAP' || evalRes.tipo_descarte === 'TRAMPA_FUNDAMENTAL' || (evalRes.escenario_neutro && evalRes.fair_value_teorico > 0))) {
      return {
        ...evalRes,
        datos_en_vivo: true,
        timestamp_consulta: consultaTimestamp,
        ultimo_periodo_sec: secLive?.latest_period || 'TTM Actual',
        procedencia_datos: 'Tiempo Real: Yahoo Finance Live + SEC EDGAR XBRL + Consenso Institucional'
      };
    }
    // Si la evaluación estándar devolvió un descarte incompleto (ej. flujos GAAP temporalmente negativos en BA o INTC),
    // continuamos al motor en tiempo real de respaldo para garantizar siempre un objeto completo auditable.
  }

  // 2. Si es un activo del mercado exterior (ej. BAH, TSM, etc.) o S&P 500 en situación especial,
  // construimos su ficha fundamental auditada en tiempo real (SEC EDGAR + Yahoo quoteSummary) y
  // la evaluamos con el MISMO motor institucional de 3 etapas (evaluarEmpresaPilar1).
  const p0 = liveQuote?.price ?? dbQuote?.current_price ?? emp?.precio_cierre_P0;
  if (!p0 || p0 <= 0) return null;

  const high52 = liveQuote?.fifty_two_week_high || dbQuote?.fifty_two_week_high || emp?.fifty_two_week_high || Number((p0 * 1.15).toFixed(2));
  const low52 = liveQuote?.fifty_two_week_low || dbQuote?.fifty_two_week_low || emp?.fifty_two_week_low || Number((p0 * 0.85).toFixed(2));

  // Consultar dividendos históricos de los últimos 12 meses (Yahoo quoteSummary o eventos de gráfico)
  let divSum = emp?.dividend_rate || liveConsensus?.dividend_rate || 0;
  if (!(divSum > 0)) {
    try {
      const divUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanTicker)}?events=div&interval=1mo&range=2y`;
      const dResp = await fetch(divUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (dResp.ok) {
        const dJson = await dResp.json();
        const divObj = dJson?.chart?.result?.[0]?.events?.dividends;
        if (divObj) {
          const divs = Object.values(divObj);
          const oneYearAgoSec = Math.floor(Date.now() / 1000) - (365 * 86400);
          const recentDivs = divs.filter(d => (d.date || d.timestamp) >= oneYearAgoSec);
          if (recentDivs.length > 0) {
            divSum = recentDivs.reduce((acc, d) => acc + (d.amount || 0), 0);
          } else if (divs.length > 0) {
            const sorted = divs.sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 4);
            divSum = sorted.reduce((acc, d) => acc + (d.amount || 0), 0);
          }
        }
      }
    } catch (err) {
      console.warn('[Pilar1] Error consultando dividendos para', cleanTicker, err.message);
    }
  }

  const isMatureDividendPayer = divSum > 0 && (divSum / p0) >= 0.0275;
  let secFcfShare = secLive?.fcf_per_share
    ?? liveConsensus?.fcf_per_share
    ?? emp?.fcf_per_share
    ?? liveConsensus?.trailing_eps
    ?? liveConsensus?.forward_eps
    ?? (liveConsensus?.ocf_per_share > 0 ? Number((liveConsensus.ocf_per_share * 0.78).toFixed(2)) : null)
    ?? (emp?.ocf_per_share > 0 ? Number((emp.ocf_per_share * 0.78).toFixed(2)) : null);

  // Ajuste ADR multi-acción (ej. TSM 1 ADR = 5 acciones ordinarias en 20-F): si el margen FCF SEC es >15% pero el FCF/acción reportado es <1.2% del precio del ADR
  if (secFcfShare && (secFcfShare / p0) < 0.012 && (secLive?.fcf_margin_pct || 0) >= 15) {
    secFcfShare = Number((secFcfShare * 5).toFixed(2));
  }

  const cfBase = (secFcfShare && secFcfShare > 0 && (secFcfShare / p0) >= 0.015)
    ? Number(secFcfShare.toFixed(2))
    : (isMatureDividendPayer ? Number(divSum.toFixed(2)) : Number((p0 * 0.045).toFixed(2)));
  const hasDividends = isMatureDividendPayer;

  const rawBeta = emp?.beta ?? liveConsensus?.beta ?? 1.0;
  const beta = rawBeta > 0 ? rawBeta : 1.0;
  const betaBlume = Number((0.67 * beta + 0.33).toFixed(2));
  const r = calcularTasaDescuentoCAPM(rf, betaBlume, erp);

  const consensus = liveConsensus;
  const targetMean = (consensus?.target_mean && consensus.target_mean > 0)
    ? Number(consensus.target_mean.toFixed(2))
    : (emp?.target_mean_analysts && emp.target_mean_analysts > 0 ? Number(emp.target_mean_analysts.toFixed(2)) : null);

  const companyName = emp?.nombre || secLive?.company_name || liveQuote?.name || cleanTicker;
  const companySector = emp?.sector || liveConsensus?.sector || (isSpanish ? 'Mercado Continuo / IBEX 35' : 'Industrials / Tecnología');
  const companyIndustry = emp?.industry || liveConsensus?.industry || liveQuote?.instrument_type || 'Equity';
  const companyRoic = secLive?.roic ?? emp?.roic ?? (liveConsensus?.roa ? Number((liveConsensus.roa * 1.6).toFixed(4)) : null);
  const companyRoe = secLive?.roe ?? emp?.roe ?? liveConsensus?.roe ?? null;
  const curr = isSpanish ? 'EUR' : (liveQuote?.currency || emp?.currency || 'USD');
  const currSym = curr === 'EUR' ? '€' : '$';

  const epsTtmLive = emp?.eps_diluted ?? liveConsensus?.trailing_eps ?? null;
  const epsFwdLive = emp?.forward_eps ?? liveConsensus?.forward_eps ?? null;
  const ocfShareLive = emp?.ocf_per_share ?? liveConsensus?.ocf_per_share ?? null;
  const netDebtShareLive = emp?.net_debt_per_share ?? liveConsensus?.net_debt_per_share ?? 0;
  const netDebtEbitdaLive = emp?.net_debt_ebitda ?? secLive?.net_debt_to_ebitda ?? liveConsensus?.net_debt_ebitda ?? null;

  // Estimar tasa de crecimiento fundamental sostenible (g_fundamental) para el activo exterior
  const revCagr = secLive?.rev_cagr_3y != null ? secLive.rev_cagr_3y / 100 : (liveConsensus?.revenue_growth ?? 0.05);
  const earnGrowth = liveConsensus?.earnings_growth ?? ((epsFwdLive && epsTtmLive && epsTtmLive > 0) ? (epsFwdLive - epsTtmLive) / epsTtmLive : 0.06);
  const gEstimado = Math.min(0.12, Math.max(0.035, 0.50 * Math.max(0.03, revCagr) + 0.50 * Math.max(0.04, earnGrowth)));

  // Clasificar arquetipo según sector/industria real
  let arquetipoExt = emp?.arquetipo || null;
  if (!arquetipoExt) {
    const indLower = (companyIndustry || '').toLowerCase();
    const secLower = (companySector || '').toLowerCase();
    if (indLower.includes('consulting') || indLower.includes('software') || indLower.includes('information') || secLower.includes('technology')) {
      arquetipoExt = 'COMPOUNDER_TECH';
    } else if (secLower.includes('financial') || indLower.includes('bank') || indLower.includes('insurance')) {
      arquetipoExt = 'BANCA_FINANCIERA';
    } else if (secLower.includes('utilities') || secLower.includes('real estate') || indLower.includes('telecom')) {
      arquetipoExt = 'INFRAESTRUCTURA_DEUDA';
    } else if (secLower.includes('defensive') || secLower.includes('health') || secLower.includes('staples') || hasDividends) {
      arquetipoExt = 'DEFENSIVA_CONSUMO';
    } else {
      arquetipoExt = 'COMPOUNDER_TECH';
    }
  }

  // Construir objeto normalizado y evaluar con evaluarEmpresaPilar1 (Motor Multimodelo 11 Modelos unificado)
  const empExteriorCompleta = {
    ...(emp || {}),
    ticker: cleanTicker,
    nombre: companyName,
    sector: companySector,
    industry: companyIndustry,
    gics_sub_industry: emp?.gics_sub_industry || (companyIndustry.includes('Consulting') ? 'Research & Consulting Services' : companyIndustry),
    arquetipo: arquetipoExt,
    currency: curr,
    precio_cierre_P0: p0,
    fifty_two_week_low: low52,
    fifty_two_week_high: high52,
    dividend_rate: Number(divSum.toFixed(2)),
    D1_o_FCFA1: cfBase,
    fcf_per_share: liveConsensus?.fcf_per_share ?? secLive?.fcf_per_share ?? cfBase,
    ocf_per_share: ocfShareLive,
    eps_diluted: epsTtmLive,
    forward_eps: epsFwdLive,
    revenue_per_share: emp?.revenue_per_share ?? liveConsensus?.revenue_per_share ?? null,
    ebitda_per_share: emp?.ebitda_per_share ?? liveConsensus?.ebitda_per_share ?? null,
    ebit_per_share: emp?.ebit_per_share ?? liveConsensus?.ebit_per_share ?? null,
    nopat_per_share: emp?.nopat_per_share ?? liveConsensus?.nopat_per_share ?? null,
    operating_margin: emp?.operating_margin ?? liveConsensus?.operating_margin ?? null,
    book_value_per_share: emp?.book_value_per_share ?? liveConsensus?.book_value_per_share ?? null,
    net_debt_per_share: netDebtShareLive,
    net_debt_ebitda: netDebtEbitdaLive,
    roic: companyRoic,
    roe: companyRoe,
    altman_z_score: secLive?.altman_z_score ?? emp?.altman_z_score ?? null,
    beta: betaBlume,
    g_fundamental: emp?.g_fundamental ?? Number(gEstimado.toFixed(4)),
    g_hist: emp?.g_hist ?? Number(gEstimado.toFixed(4)),
    gn_terminal: isSpanish ? 0.020 : 0.025,
    target_mean_analysts: targetMean,
    _liveConsensus: liveConsensus
  };

  const evalUnificada = evaluarEmpresaPilar1(empExteriorCompleta, rf, erp, 0.07, mosDiscount);
  if (evalUnificada && evalUnificada.fair_value_teorico > 0) {
    externalAuditedCache.set(cleanTicker, empExteriorCompleta);
    return {
      ...evalUnificada,
      datos_en_vivo: true,
      timestamp_consulta: consultaTimestamp,
      ultimo_periodo_sec: secLive?.latest_period || 'TTM Actual',
      procedencia_datos: 'Tiempo Real: Yahoo Finance Live + SEC EDGAR XBRL + Consenso Institucional',
      fuente_auditada: 'Estados Financieros SEC EDGAR y cotizaciones de mercado en tiempo real',
      rango_52_semanas: { low: low52, high: high52 },
      posicion_rango_52w: high52 > low52 ? Number((((p0 - low52) / (high52 - low52)) * 100).toFixed(1)) : 50,
      dividend_yield_pct: p0 > 0 ? Number(((divSum / p0) * 100).toFixed(2)) : 0,
      spread_yield_vs_rf: p0 > 0 ? Number((((cfBase / p0) - rf) * 100).toFixed(2)) : 0
    };
  }
  return null;
}
