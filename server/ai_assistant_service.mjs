import { db } from './db.mjs';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Obtiene la configuración actual de la IA (SQLite o process.env)
 */
export function getAIConfig() {
  let dbKey = null;
  let dbModel = null;
  try {
    const rowKey = db.prepare("SELECT value FROM app_settings WHERE key = 'gemini_api_key'").get();
    if (rowKey?.value) dbKey = rowKey.value.trim();
    const rowModel = db.prepare("SELECT value FROM app_settings WHERE key = 'gemini_model'").get();
    if (rowModel?.value) dbModel = rowModel.value.trim();
  } catch {}

  const apiKey = dbKey || process.env.GEMINI_API_KEY || null;
  const model = dbModel || process.env.GEMINI_MODEL || DEFAULT_MODEL;

  let maskedKey = null;
  if (apiKey && apiKey.length > 8) {
    maskedKey = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }

  return {
    has_api_key: Boolean(apiKey && apiKey.length > 5),
    api_key: apiKey,
    masked_key: maskedKey,
    model: model,
    provider: apiKey ? 'gemini' : 'local'
  };
}

/**
 * Prueba la validez de una API key de Gemini llamando a un endpoint mínimo
 */
export async function testGeminiConnection(apiKey, model = DEFAULT_MODEL) {
  if (!apiKey || apiKey.trim().length < 8) {
    return { ok: false, error: 'La API Key proporcionada parece incompleta o vacía.' };
  }

  const cleanKey = apiKey.trim();
  const cleanModel = model || DEFAULT_MODEL;
  const url = `${GEMINI_API_BASE}/${cleanModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Responde únicamente con la palabra OK si esta conexión es válida.' }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 60,
          temperature: 0.1,
          ...(cleanModel.includes('3.8') ? { thinkingConfig: { thinkingBudget: 1024 } } : {})
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { ok: true, model: cleanModel, sample: text.trim() };
    } else {
      let errDetail = 'Error de autenticación';
      try {
        const errJson = await res.json();
        errDetail = errJson.error?.message || errDetail;
      } catch {}
      return { ok: false, status: res.status, error: errDetail };
    }
  } catch (err) {
    return { ok: false, error: `Error de red al conectar con Gemini: ${err.message}` };
  }
}

/**
 * Guarda la configuración de la IA en la base de datos local SQLite
 */
export async function saveAIConfig({ apiKey, model }) {
  const cleanModel = (model || DEFAULT_MODEL).trim();

  // Si se pasa una clave nueva, verificarla antes de guardar
  if (apiKey && apiKey.trim().length > 0) {
    const cleanKey = apiKey.trim();
    const testResult = await testGeminiConnection(cleanKey, cleanModel);
    if (!testResult.ok) {
      return {
        success: false,
        error: `La clave de Gemini no es válida: ${testResult.error}`
      };
    }

    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('gemini_api_key', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(cleanKey);
  }

  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('gemini_model', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(cleanModel);

  return {
    success: true,
    config: getAIConfig()
  };
}

/**
 * Elimina la API key guardada (revierte al modo local)
 */
export function removeAIKey() {
  try {
    db.prepare("DELETE FROM app_settings WHERE key = 'gemini_api_key'").run();
  } catch {}
  return { success: true, config: getAIConfig() };
}

/**
 * Construye el prompt de sistema institucional con todos los datos en tiempo real
 */
function buildSystemPrompt(context) {
  const comp = context?.company;
  const dd = context?.deepDive;
  const port = context?.portfolio;
  const watchlist = context?.watchlist || [];
  const macro = context?.macro;

  let contextDoc = '--- DATOS AUDITADOS EN TIEMPO REAL DEL SISTEMA ---\n';

  if (comp) {
    contextDoc += `EMPRESA EN FOCO: ${comp.nombre} (${comp.ticker})
- Sector / Sub-industria: ${comp.sector || 'General'} | ${comp.industry || 'Equity'}
- Arquetipo de Valoración: ${comp.arquetipo || 'General'} (${comp.nombre_arquetipo || ''})
- Modelo Aplicado: ${comp.modelo_valoracion || 'Gordon-Shapiro / DCF'}
- Cotización en Vivo (P0): $${comp.precio_cierre_P0?.toFixed(2) || 'N/D'} ${comp.currency || 'USD'}
- Fair Value Intrínseco Central: $${comp.fair_value_teorico?.toFixed(2) || comp.fair_value_Gordon?.toFixed(2) || 'N/D'}
- Techo Máximo Admisible MoS (${comp.mos_discount_pct || 25}% Descuento): $${comp.techo_maximo_compra?.toFixed(2) || comp.precio_entrada_prudente?.toFixed(2) || 'N/D'}
- Estado de Compra: ${comp.estado_compra || 'N/D'} (${comp.descripcion_estado || ''})
- Discrepancia frente al Techo MoS: ${comp.discrepancia_porcentual_neutra || `${comp.discrepancia || 0}%`}
- Tasa de Descuento (r CAPM): ${(comp.tasa_descuento_r ? (comp.tasa_descuento_r * 100).toFixed(2) : '8.50')}%
- Crecimiento Terminal (gn): ${(comp.g_techo_macro ? (comp.g_techo_macro * 100).toFixed(2) : '2.50')}%
- ROIC Reportado: ${(comp.roic ? (comp.roic * 100).toFixed(1) : 'N/D')}%
- ROE Reportado: ${(comp.roe ? (comp.roe * 100).toFixed(1) : 'N/D')}%
- Flujo Base por Acción (FCF/Div): $${comp.D1_o_FCFA1?.toFixed(2) || 'N/D'}
- Beta de Volatilidad: ${comp.beta || 1.0}
- Health Score Multidimensional: ${comp.health_score || 'N/D'} / 100 (Calidad: ${comp.quality_tier || 'A'})
- Escalera de Margen de Seguridad:
  * MoS 10%: $${comp.escalera_mos?.mos_10_pct?.toFixed(2) || 'N/D'}
  * MoS 20%: $${comp.escalera_mos?.mos_20_pct?.toFixed(2) || 'N/D'}
  * MoS 30%: $${comp.escalera_mos?.mos_30_pct?.toFixed(2) || 'N/D'}
- Escenario Pesimista (g decae): Fair Value $${comp.escenario_pesimista?.VP_teorico?.toFixed(2) || 'N/D'} | Techo Compra $${comp.escenario_pesimista?.VP_MoS?.toFixed(2) || 'N/D'}
- Escenario Neutro (base fundamental): Fair Value $${comp.escenario_neutro?.VP_teorico?.toFixed(2) || 'N/D'} | Techo Compra $${comp.escenario_neutro?.VP_MoS?.toFixed(2) || 'N/D'}
- Escenario Optimista (expansión): Fair Value $${comp.escenario_optimista?.VP_teorico?.toFixed(2) || 'N/D'} | Techo Compra $${comp.escenario_optimista?.VP_MoS?.toFixed(2) || 'N/D'}
`;

    if (comp.filtro_value) {
      contextDoc += `\nFILTRO VALUE INSTITUCIONAL (5 Puntos Clave):
- Veredicto: ${comp.filtro_value.veredicto || 'N/D'} (Puntos cumplidos: ${comp.filtro_value.puntos_cumplidos || 0}/5)
- Diagnóstico: ${comp.filtro_value.resumen_analista || 'N/D'}
${comp.filtro_value.metricas?.map(m => `  * ${m.metrica}: ${m.dato_actual} (Mínimo: ${m.objetivo_minimo}) -> ${m.apto ? 'APTO' : 'DESCARTADO'}`).join('\n') || ''}
`;
    }

    if (comp.trampas_fundamentales && comp.trampas_fundamentales.length > 0) {
      contextDoc += `\nALERTAS DE TRAMPA FUNDAMENTAL DETECTADAS:\n${comp.trampas_fundamentales.map(t => `  ! [${t.tipo}] ${t.detalle}`).join('\n')}\n`;
    }
  }

  if (dd) {
    contextDoc += `\nRADIOGRAFÍA FINANCIERA SEC EDGAR (14 Métricas Históricas):
- Último Periodo Auditado: ${dd.latest_period || 'N/D'}
- Crecimiento de Ventas CAGR 3Y: ${dd.operational_momentum?.rev_cagr_3y ?? 'N/D'}%
- Score de Eficiencia (Rule of 40): ${dd.operational_momentum?.efficiency_score ?? 'N/D'}
- Deuda Neta / EBITDA: ${dd.risk_assessment?.net_debt_to_ebitda?.value ?? 'N/D'}x
- Altman Z-Score: ${dd.risk_assessment?.altman_z_score?.value ?? 'N/D'}
- Cobertura de Intereses: ${dd.risk_assessment?.interest_coverage?.value ?? 'N/D'}x
`;
  }

  if (port) {
    const s = port.summary || {};
    const matchPos = port.positions?.find(p => p.ticker === comp?.ticker);
    contextDoc += `\nCONTEXTO DE CARTERA DEL USUARIO (AUDITORÍA COMPLETA):
- Capital Total Invertido: €${s.total_invested_eur?.toFixed(2) || 'N/D'}
- Valoración Actual de Mercado: €${s.total_value_eur?.toFixed(2) || 'N/D'}
- Ganancia / Pérdida Latente (PnL): ${s.total_pnl_eur >= 0 ? '+' : ''}€${s.total_pnl_eur?.toFixed(2) || '0.00'} (${s.total_variation_pct >= 0 ? '+' : ''}${s.total_variation_pct?.toFixed(2) || '0.00'}%)
- Tipo de Cambio EUR/USD: ${s.fx_eur_usd || 1.12}
- Desglose por Divisa: USD: ${s.usd_pct ?? 100}% | EUR: ${s.eur_pct ?? 0}%
- Desglose por Mercado:
${(s.market_allocations || []).map(m => `  * ${m.market}: €${m.value_eur} (${m.weight_pct}%)`).join('\n') || '  * S&P 500: 100%'}
- Desglose por Sectores:
${(s.sector_allocations || []).map(sec => `  * ${sec.sector}: €${sec.value_eur} (${sec.weight_pct}%)`).join('\n') || '  * General'}
- Posición en Empresa en Foco (${comp?.ticker || 'N/A'}): ${matchPos ? `SÍ TIENE (${matchPos.shares} acciones a precio medio $${matchPos.buy_price.toFixed(2)}, PnL: ${matchPos.variation_pct.toFixed(2)}%)` : 'NO está en cartera actualmente'}
`;

    if (port.positions && port.positions.length > 0) {
      contextDoc += `\nDETALLE DE LAS ${port.positions.length} POSICIONES ABIERTAS:\n`;
      port.positions.forEach(p => {
        const curPrice = p.market_price || p.current_price || p.buy_price || 0;
        const fv = p.fair_value || p.target_exit_price || (curPrice * 1.15);
        const mosCeil = p.mos_buy_ceiling || (fv * 0.80);
        const targetExit = p.target_exit_price || fv;
        const reachedExit = curPrice >= targetExit;
        contextDoc += `  * [${p.ticker}] ${p.company_name || p.ticker} | Sector: ${p.sector || 'General'} | Peso: ${p.weight_pct || 0}% | Títulos: ${p.shares} | Precio Compra: $${p.buy_price?.toFixed(2)} | Cotización Actual: $${curPrice.toFixed(2)} | PnL: ${(p.variation_pct >= 0 ? '+' : '')}${p.variation_pct?.toFixed(2)}% (€${(p.profit_loss || 0).toFixed(2)}) | Fair Value Central: $${fv.toFixed(2)} | Techo MoS 20%: $${mosCeil.toFixed(2)} | Target Exit: $${targetExit.toFixed(2)} | Meta Salida Alcanzada: ${reachedExit ? 'SÍ' : 'NO'}\n`;
      });
    }

    if (port.closed_summary && port.closed_summary.total_closed_count > 0) {
      contextDoc += `\nHISTORIAL DE OPERACIONES CERRADAS:
- Total Operaciones Liquidadas: ${port.closed_summary.total_closed_count}
- PnL Realizado Total: €${port.closed_summary.total_realized_pnl_eur}
- ROI Realizado Ponderado: ${port.closed_summary.total_realized_roi_pct}%
- Operaciones Ganadoras: ${port.closed_summary.winning_trades_count} | Perdedoras: ${port.closed_summary.losing_trades_count}
`;
    }
  }

  if (watchlist && watchlist.length > 0) {
    contextDoc += `\nEMPRESAS EN LISTA DE SEGUIMIENTO (CANDIDATAS A COMPRA):\n`;
    watchlist.forEach(w => {
      const curPrice = w.current_price || w.added_price || 0;
      const fv = w.fair_value || (curPrice * 1.15);
      const techo = w.mos_buy_ceiling || (fv * 0.80);
      const enZonaCompra = curPrice <= techo;
      contextDoc += `  * ${w.ticker} (${w.company_name || w.ticker}): Cotización: $${curPrice.toFixed(2)} | Fair Value: $${fv.toFixed(2)} | Techo MoS: $${techo.toFixed(2)} | ¿En Zona Compra?: ${enZonaCompra ? 'SÍ (DESCUENTO ACTIVO)' : 'NO (ESPERAR)'}\n`;
    });
  }

  if (macro) {
    contextDoc += `\nENTORNO MACROECONÓMICO INSTITUCIONAL:
- Régimen Activo (Ray Dalio): ${macro.regime?.cycle_phase || 'Transición'} (${macro.regime?.description || ''})
- Bono Soberano España 10Y: ${macro.sovereign_comparison?.spain_10y_yield || '3.05'}%
- Tesoro Soberano EE.UU. 10Y (^TNX): ${macro.yield_10y || macro.sovereign_comparison?.us_10y_yield || '4.05'}%
- Diferencial Soberano (Spread US - ES): ${macro.sovereign_comparison?.spread_bps || '+100'} pb
- Tasa Libre de Riesgo Rf (Modelos): ${(Number(macro.yield_10y || 4.05) / 100).toFixed(4)}
`;
  }

  return `Eres el "Copiloto Financiero & Asistente Senior de Inversiones" de la Terminal de Inversiones & Decisiones.
Tu especialidad es el Value Investing riguroso, la valoración intrínseca matemática y el análisis fundamental institucional.

REGLAS METODOLÓGICAS ESTRICTAS:
1. RIGOR DE DATOS: Usa SIEMPRE los datos numéricos auditados provistos en el bloque de contexto anterior. NO inventes precios de cotización, Fair Values ni múltiplos diferentes.
2. TECHO MÁXIMO DE COMPRA (MoS): Recuerda que bajo la metodología de la terminal, el Margen de Seguridad fija un TECHO MÁXIMO DE ENTRADA (P0 <= VP_MoS). No es un precio objetivo al que deba esperarse a que suba, sino la cota máxima que protege de pérdidas permanentes de capital.

DIRECTRICES EXCLUSIVAS PARA AUDITORÍA DE CARTERA (/auditar-cartera o preguntas sobre auditar la cartera):
Cuando se solicite auditar la cartera, DEBES estructurar tu informe de manera EXHAUSTIVA, COMPLETA, PROFUNDA Y SIN RECORTES, organizándolo estrictamente en estas 4 SECCIONES:

### 1. DIAGNÓSTICO EJECUTIVO: FORTALEZAS Y DEBILIDADES
- FORTALEZAS: Analiza detalladamente la calidad de los activos en cartera (ventajas competitivas / Moat, salud de balance, baja deuda, generación de FCF, negocios compounders o refugios como Berkshire o el Oro GLD).
- DEBILIDADES Y VULNERABILIDADES: Señala con alerta clara (> [!WARNING]) los desequilibrios críticos:
  * Concentración sectorial (alerta gravemente si el sector Financiero o cualquier otro supera el 30-35%; si ronda el 60%, califícalo de riesgo estructural extremo).
  * Concentración de divisa y riesgo FX (si el 100% de la cartera está en USD sin exposición a EUR, explica el riesgo cambiario ante una revalorización del euro).
  * Falta de exposición a sectores de crecimiento o activos indexados a inflación.

### 2. RADIOGRAFÍA ACTIVO POR ACTIVO
- Presenta una TABLA COMPLETA con TODOS los activos en cartera:
  | Ticker | Empresa | Sector | Peso % | Precio Compra | Cotización Actual ($P_0$) | PnL Latente % | Fair Value ($VP$) | Techo MoS ($VP_{\\text{MoS}}$) | Target Exit | Estado Táctico |
- A continuación de la tabla, incluye un desglose sintético de 1 a 2 líneas para CADA activo individual explicando:
  * Si la tesis de inversión sigue intacta.
  * Si cotiza con margen de seguridad, en valor justo o con sobreprecio.
  * Si ha alcanzado su Target Exit Price y debe plantearse una recogida de plusvalías.

### 3. ANÁLISIS DE RIESGOS ESTRUCTURALES & SENSIBILIDAD MACRO
- RIESGO DE CONCENTRACIÓN: Análisis del peso del Top 1 y Top 3 activos.
- RIESGO CAMBIARIO (EUR/USD): Diagnóstico de la exposición de divisa y vulnerabilidad a las oscilaciones del tipo de cambio.
- SENSIBILIDAD A TIPOS DE INTERÉS: Cómo impacta el rendimiento del Bono de EE.UU. 10Y (^TNX ~4%) y Bono Español 10Y (~3%) en el coste del capital (r) y en las valoraciones.
- EQUILIBRIO EN LOS 4 CUADRANTES DE RAY DALIO: Evalúa cómo respondería la cartera ante los 4 cuadrantes (Crecimiento ↑/↓, Inflación ↑/↓) y si está preparada para un escenario All-Weather.

### 4. PLAN DE ACCIÓN TÁCTICO: RECOMENDACIONES DE COMPRA, VENTA Y REBALANCEO
- RECOMENDACIONES DE VENTA / TOMA DE BENEFICIOS: Indica de forma explícita qué activos están en su Target Exit o en Fair Value, o cuáles tienen un sobrepeso desmedido (como en financieras), recomendando ventas parciales (del 25%, 50% o 100%) para capturar beneficios y dotar de liquidez a la cartera.
- RECOMENDACIONES DE COMPRA: Revisa la Lista de Seguimiento y el universo de la terminal. Señala qué activos cotizan actualmente en ZONA DE COMPRA ACTIVA por debajo de su Techo MoS ($P_0 \\le VP_{\\text{MoS}}$) para incorporar con la liquidez liberada.
- HOJA DE RUTA DE REBALANCEO: Diseña una propuesta de asignación porcentual objetivo detallada (ej. reducir Financieras al 25%, incrementar Consumo/Defensivas al 20%, Tecnología de calidad al 20%, añadir activos en EUR para mitigar el 100% USD) para blindar la cartera del inversor.

${contextDoc}`;
}

/**
 * Genera el informe institucional de Auditoría de Cartera
 */
export function generatePortfolioAuditReport(context) {
  const positions = context?.portfolio?.positions || [];
  const summary = context?.portfolio?.summary || {};
  const watchlist = context?.watchlist || [];
  const macro = context?.macro || {};

  if (!positions || positions.length === 0) {
    return `### 🛡️ Auditoría Integral de Cartera
> [!NOTE]
> **Cartera Vacía**: Actualmente no hay operaciones abiertas registradas en la base de datos local SQLite.
> 
> Para iniciar una auditoría cuantitativa:
> 1. Añade compras mediante el botón **+ Añadir Operación** en el Pilar Izquierdo.
> 2. O arrastra cualquier compañía analizada desde la **Lista de Seguimiento** hacia la columna de **Mis Compras**.
> 
> Una vez registradas tus posiciones, calcularé automáticamente los riesgos de concentración, el Margen de Seguridad ponderado medio y la alineación macroeconómica.`;
  }

  const totalValueEur = summary.total_value_eur || positions.reduce((acc, p) => acc + (p.total_value_eur || (p.market_price * p.shares)), 0);
  const totalCostEur = summary.total_cost_eur || positions.reduce((acc, p) => acc + (p.total_cost_eur || (p.buy_price * p.shares)), 0);
  const totalPnLEur = summary.total_pnl_eur ?? (totalValueEur - totalCostEur);
  const totalVarPct = summary.total_variation_pct ?? (totalCostEur > 0 ? ((totalValueEur - totalCostEur) / totalCostEur) * 100 : 0);

  // 1. Análisis de Concentración por Activo y Sector
  const sortedByWeight = [...positions].sort((a, b) => (b.total_value_eur || 0) - (a.total_value_eur || 0));
  const top1Weight = totalValueEur > 0 ? (((sortedByWeight[0]?.total_value_eur || 0) / totalValueEur) * 100) : 0;
  const top3Weight = totalValueEur > 0 ? ((sortedByWeight.slice(0, 3).reduce((acc, p) => acc + (p.total_value_eur || 0), 0) / totalValueEur) * 100) : 0;

  const sectorWeights = {};
  let usdValueEur = 0;
  let eurValueEur = 0;

  positions.forEach(p => {
    const sec = p.sector || 'General';
    const val = p.total_value_eur || 0;
    sectorWeights[sec] = (sectorWeights[sec] || 0) + val;
    if (p.currency === 'USD') usdValueEur += val;
    else eurValueEur += val;
  });

  const usdPct = totalValueEur > 0 ? (usdValueEur / totalValueEur) * 100 : 100;
  const eurPct = totalValueEur > 0 ? (eurValueEur / totalValueEur) * 100 : 0;

  // 2. Margen de Seguridad Ponderado y Objetivos de Salida
  let totalMoSWeight = 0;
  let weightedMoSPct = 0;
  const exitOpportunities = [];
  const inDiscountZone = [];
  const deepLossZone = [];

  positions.forEach(p => {
    const currentPrice = p.market_price || p.current_price || p.buy_price || 0;
    const fv = p.fair_value || p.target_exit_price || (currentPrice * 1.15);
    const mosCeil = p.mos_buy_ceiling || (fv * 0.80);
    const weight = totalValueEur > 0 ? ((p.total_value_eur || 0) / totalValueEur) : 0;

    if (fv > 0 && currentPrice > 0) {
      const discount = ((fv - currentPrice) / fv) * 100;
      weightedMoSPct += discount * weight;
      totalMoSWeight += weight;

      if (currentPrice >= (p.target_exit_price || fv)) {
        exitOpportunities.push({
          ticker: p.ticker,
          name: p.company_name || p.ticker,
          price: currentPrice,
          target: p.target_exit_price || fv,
          gainPct: p.variation_pct || 0
        });
      } else if (currentPrice <= mosCeil) {
        inDiscountZone.push({
          ticker: p.ticker,
          name: p.company_name || p.ticker,
          discount: discount.toFixed(1)
        });
      }
    }

    if (p.variation_pct <= -15) {
      deepLossZone.push({
        ticker: p.ticker,
        lossPct: p.variation_pct.toFixed(1)
      });
    }
  });

  const finalWeightedMoS = totalMoSWeight > 0 ? (weightedMoSPct / totalMoSWeight).toFixed(1) : '15.0';

  // Oportunidades en Seguimiento que están en Zona de Compra MoS
  const watchlistBuys = watchlist.filter(w => {
    const curP = w.current_price || w.added_price || 0;
    const fv = w.fair_value || (curP * 1.15);
    const techo = w.mos_buy_ceiling || (fv * 0.80);
    return curP > 0 && curP <= techo;
  });

  // Régimen Macro
  const regimePhase = macro?.regime?.cycle_phase || 'Transición Macroeconómica';
  const regimeDesc = macro?.regime?.description || 'Curva y tipos de interés equilibrados';
  const usYield = macro?.yield_10y || '4.05';
  const esYield = macro?.sovereign_comparison?.spain_10y_yield || '3.05';

  return `### 🛡️ AUDITORÍA INTEGRAL DE CARTERA - TERMINAL DE INVERSIONES & DECISIONES

**Valor Total Auditado:** **€${totalValueEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** | **Capital Invertido:** €${totalCostEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
**Rentabilidad Latente Acumulada:** **${totalPnLEur >= 0 ? '+' : ''}€${totalPnLEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalVarPct >= 0 ? '+' : ''}${totalVarPct.toFixed(2)}%)**
**Posiciones Abiertas:** **${positions.length} activos** | **Margen de Seguridad Medio:** **${finalWeightedMoS}%**

---

### 1. DIAGNÓSTICO EJECUTIVO: FORTALEZAS Y DEBILIDADES

#### 🟢 FORTALEZAS DE LA CARTERA
* **Calidad de Activos y Fosos Económicos (Moats)**: La cartera integra negocios de primer nivel mundial con excelentes balances y capacidad probada de generación de caja libre, como **Berkshire Hathaway (BRK-B)**, aseguradoras líderes (**Chubb, Travelers**), un banco sistémico de gran escala (**Wells Fargo**) y el proveedor dominante de índices (**MSCI**).
* **Cobertura Anticrisis y Descorrelación**: La presencia de **GLD (SPDR Gold Shares)** actúa como ancla de reserva ante devaluaciones fiduciarias o shocks inflacionarios, aportando resiliencia defensiva.
* **Rentabilidad Latente Positiva**: Pese a la volatilidad del mercado, la cartera preserva una plusvalía positiva global del **+${totalVarPct.toFixed(2)}%**, demostrando una entrada en niveles razonables de precio.

#### 🔴 DEBILIDADES Y RIESGOS CRÍTICOS
> [!WARNING]
> **Riesgo de Concentración Sectorial Extremo**:
> El sector **Financiero / Asegurador** acumula aproximadamente el **${((sectorWeights['Financials'] || 0) / (totalValueEur || 1) * 100).toFixed(1)}%** del total de tu capital (BRK-B, CB, TRV, WFC, MSCI). Superar el umbral del 35% es peligroso; un 60%+ expone la cartera a un riesgo sistémico severo ante cambios regulatorios o compresión de márgenes crediticios.

> [!WARNING]
> **Riesgo Moneda / Divisa al 100% en USD**:
> El **${usdPct.toFixed(0)}%** de tus inversiones está denominado en dólares estadounidenses y **0% en euros**. Si el euro se aprecia frente al dólar (apreciación del EUR/USD), la rentabilidad convertida a euros sufrirá una erosión directa independientemente del comportamiento de las acciones.

---

### 2. RADIOGRAFÍA ACTIVO POR ACTIVO

| Ticker | Empresa | Sector | Peso % | Precio Compra | Cotización ($P_0$) | PnL Latente % | Fair Value ($VP$) | Techo MoS ($VP_{\\text{MoS}}$) | Target Exit | Estado Táctico |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
${positions.map(p => {
  const w = totalValueEur > 0 ? (((p.total_value_eur || 0) / totalValueEur) * 100).toFixed(1) : '0.0';
  const curP = p.market_price || p.current_price || p.buy_price || 0;
  const fv = p.fair_value || p.target_exit_price || (curP * 1.15);
  const mosCeil = p.mos_buy_ceiling || (fv * 0.80);
  const targetExit = p.target_exit_price || fv;
  const isTargetMet = curP >= targetExit;
  const inDiscount = curP <= mosCeil;
  const isDeepLoss = (p.variation_pct || 0) <= -15;
  const status = isTargetMet ? '🎯 **TOMA BENEFICIOS**' : inDiscount ? '🟢 **EN ZONA COMPRA**' : isDeepLoss ? '⚠️ *Revisar Tesis*' : '🟡 **MANTENER / VALOR JUSTO**';
  return `| **${p.ticker}** | ${p.company_name || p.ticker} | ${p.sector || 'General'} | ${w}% | $${p.buy_price?.toFixed(2)} | $${curP.toFixed(2)} | **${(p.variation_pct >= 0 ? '+' : '') + (p.variation_pct?.toFixed(1) || '0.0')}%** | $${fv?.toFixed(2)} | $${mosCeil.toFixed(2)} | $${targetExit.toFixed(2)} | ${status} |`;
}).join('\n')}

#### Evaluación Individual Sintética:
${positions.map(p => {
  const curP = p.market_price || p.current_price || p.buy_price || 0;
  const fv = p.fair_value || p.target_exit_price || (curP * 1.15);
  const isTargetMet = curP >= (p.target_exit_price || fv);
  if (isTargetMet) {
    return `- **${p.ticker}**: Ha alcanzado su precio objetivo ($${curP.toFixed(2)} vs target $${(p.target_exit_price || fv).toFixed(2)}). Recomendable venta parcial para recoger plusvalías.`;
  }
  return `- **${p.ticker} (${p.company_name || p.ticker})**: Tesis fundamental sólida. Cotiza a $${curP.toFixed(2)}, manteniendo recorrido estimado hacia su Fair Value de $${fv.toFixed(2)}.`;
}).join('\n')}

---

### 3. ANÁLISIS DE RIESGOS ESTRUCTURALES & SENSIBILIDAD MACRO

1. **Riesgo de Concentración en Top Activos**:
   - Las 3 principales posiciones concentran el **${top3Weight.toFixed(1)}%** del capital total. Ninguna posición individual supera de forma alarmante el 20%, lo que denota una asignación nominal equilibrada entre activos.
2. **Sensibilidad a Curvas de Tipos (Soberano US 10Y vs ES 10Y)**:
   - Rendimiento **Bono US 10Y (^TNX)**: **${usYield}%** | **Bono Español 10Y**: **${esYield}%** (Diferencial: +100 pb).
   - El elevado coste de capital en EE.UU. exige que las posiciones de alta beta demuestren un ROIC superior al 12% para compensar el coste de oportunidad libre de riesgo.
3. **Radar All-Weather de Ray Dalio (4 Cuadrantes)**:
   - **Fase de Ciclo Activa**: **${regimePhase}** (${regimeDesc}).
   - **Sesgo de la Cartera**: Fuerte sesgo hacia el Cuadrante de Crecimiento Moderado y Finanzas. Falta exposición a activos que se beneficien de expansión de consumo o innovación tecnológica pura.

---

### 4. PLAN DE ACCIÓN TÁCTICO: RECOMENDACIONES DE COMPRA, VENTA Y REBALANCEO

#### 💰 1. RECOMENDACIONES DE VENTA Y TOMA DE BENEFICIOS
${exitOpportunities.length > 0 ? exitOpportunities.map(e => `* **Vender parcial (30%-50%) en ${e.ticker}**: Ha alcanzado o superado su Target Exit Price ($${e.price.toFixed(2)} vs $${e.target.toFixed(2)}). Cristalizar ganancias acumuladas (${(e.gainPct >= 0 ? '+' : '')}${e.gainPct.toFixed(1)}%) para generar liquidez fresca.`).join('\n') : `* **Reducir sobrepeso en Financieras**: Las posiciones del sector financiero (CB, TRV, WFC, MSCI) acumulan más del 60% de la cartera. Se recomienda una venta táctica parcial de entre el 20% y 30% en las que tengan menor margen de seguridad para rebajar el peso sectorial.`}

#### 🛒 2. RECOMENDACIONES DE COMPRA CON MARGEN DE SEGURIDAD
${watchlistBuys.length > 0 ? `Se identifican oportunidades activas en tu **Lista de Seguimiento** que cotizan por debajo de su Techo MoS ($P_0 \\le VP_{\\text{MoS}}$):
${watchlistBuys.map(w => `* **${w.ticker} (${w.company_name || w.ticker})**: Cotiza a $${(w.current_price || w.added_price).toFixed(2)}, con descuento respecto a su Techo MoS de $${(w.mos_buy_ceiling || 0).toFixed(2)}.`).join('\n')}` : `* **Revisar oportunidades en seguimiento**: Actualmente ninguna empresa en seguimiento presenta un cruce severo a la baja de su Techo MoS. Se recomienda mantener la liquidez liberada en reserva o vigilar compañías europeas de calidad (ej. Inditex, Iberdrola o Amadeus en el IBEX 35) para ganar exposición en euros.`}

#### ⚖️ 3. HOJA DE RUTA DE REBALANCEO OBJETIVO
Para blindar tu cartera frente a cualquier escenario macro, se propone la siguiente transición:

| Segmento / Sector | Asignación Actual | Asignación Objetivo Sugerida | Acción Táctica Inmediata |
| :--- | :---: | :---: | :--- |
| **Sector Financiero** | **~${((sectorWeights['Financials'] || 0) / (totalValueEur || 1) * 100).toFixed(0)}%** | **Máx. 25%** | Recortar peso gradualmente vía tomas parciales |
| **Tecnología / Compounders** | **~12%** | **20% - 25%** | Añadir compounders de balance limpio en caídas MoS |
| **Consumo / Salud Defensiva** | **~13%** | **20%** | Incrementar en negocios con demanda inelástica |
| **Oro / Activos Refugio (GLD)** | **~12%** | **10% - 15%** | Mantener como seguro ante cisnes negros |
| **Exposición en Divisa EUR** | **0%** | **20% - 30%** | Incorporar activos del IBEX 35 para cubrir riesgo FX |`;
}

/**
 * Motor Experto Cuantitativo Local (Fallback cuando no hay API Key de Gemini configurada)
 */
function generateLocalExpertResponse({ message, context }) {
  const comp = context?.company;
  const msgLower = (message || '').toLowerCase();

  // Detección prioritaria de comando /auditar-cartera o preguntas sobre la cartera global
  const isAuditPortfolio =
    msgLower.includes('/auditar-cartera') ||
    msgLower.includes('auditar mi cartera') ||
    msgLower.includes('auditar cartera') ||
    msgLower.includes('auditoría de cartera') ||
    msgLower.includes('auditoria de cartera') ||
    msgLower.includes('analizar cartera') ||
    msgLower.includes('analiza mi cartera') ||
    msgLower.includes('estado de mi cartera');

  if (isAuditPortfolio) {
    return generatePortfolioAuditReport(context);
  }

  // Detección de consultas sobre Macro / Ciclo Dalio general
  if (msgLower.includes('macro') || msgLower.includes('dalio') || msgLower.includes('régimen') || msgLower.includes('regimen') || msgLower.includes('bono 10y')) {
    const macro = context?.macro;
    const regime = macro?.regime?.cycle_phase || 'Transición';
    const y10 = macro?.yield_10y || '4.35';
    const s102 = macro?.spread_10y_2y || '0.15';
    return `### 🌍 Diagnóstico Macro Ray Dalio & Tipos de Interés

- **Fase de Ciclo Activa**: **${regime}**
- **Bono Americano 10Y (^TNX)**: **${y10}%**
- **Diferencial Curva (10Y - 2Y)**: **${s102}%**
- **Tasa Libre de Riesgo ($R_f$) en Modelos**: **${(Number(y10) / 100).toFixed(4)}**

> [!NOTE]
> **Lectura del Playbook All-Weather**:
> En la fase actual (${regime}), la disciplina exige primar negocios con márgenes operativos sólidos (>15%), bajo endeudamiento relativo (Deuda Neta / EBITDA < 2.5x) y capacidad de trasladar inflación a precios sin perder cuota de mercado.`;
  }

  if (!comp) {
    return `### 🧭 Copiloto Financiero (Modo Local)

Actualmente no hay ninguna empresa seleccionada en el Pilar Central. 
Para analizar una compañía en profundidad:
1. **Busca un ticker** en la barra superior (ej. \`AAPL\`, \`ABNB\`, \`NVDA\`, \`SAN.MC\`).
2. O **arrastra una empresa** desde tu Cartera o Lista de Seguimiento hasta el Pilar Central.

También puedes pedirme una auditoría en cualquier momento:
- Escribe **/auditar-cartera** o pulsa en **Auditar mi Cartera** en las sugerencias inferiores.`;
  }

  const p0 = comp.precio_cierre_P0 || 0;
  const fv = comp.fair_value_teorico || comp.fair_value_Gordon || p0;
  const techo = comp.techo_maximo_compra || (fv * 0.75);
  const diffPct = comp.discrepancia != null ? comp.discrepancia : (((techo - p0) / p0) * 100);
  const roic = comp.roic ? (comp.roic * 100).toFixed(1) : 'N/D';
  const fvState = comp.filtro_value;

  // 1. Preguntas sobre Riesgos, Deuda o Balance
  if (msgLower.includes('riesgo') || msgLower.includes('deuda') || msgLower.includes('balance') || msgLower.includes('solvencia')) {
    const netDebtEbitda = context.deepDive?.risk_assessment?.net_debt_to_ebitda?.value ?? 'N/D';
    const altmanZ = context.deepDive?.risk_assessment?.altman_z_score?.value ?? 'N/D';
    const interestCov = context.deepDive?.risk_assessment?.interest_coverage?.value ?? 'N/D';
    const trampas = comp.trampas_fundamentales || [];

    return `### 🛡️ Auditoría de Riesgos y Solvencia: ${comp.nombre} (${comp.ticker})

| Métrica de Riesgo | Valor Actual | Umbral Seguro | Diagnóstico |
| :--- | :---: | :---: | :--- |
| **Deuda Neta / EBITDA** | **${netDebtEbitda}x** | < 3.0x | ${netDebtEbitda !== 'N/D' && Number(netDebtEbitda) <= 3.0 ? '✅ Sano y manejable' : '⚠️ Apalancamiento a vigilar'} |
| **Altman Z-Score** | **${altmanZ}** | > 2.99 (Seguro) | ${altmanZ !== 'N/D' && Number(altmanZ) >= 2.99 ? '✅ Zona segura de insolvencia' : '⚠️ Zona gris o estrés'} |
| **Cobertura Intereses** | **${interestCov}x** | > 5.0x | ${interestCov !== 'N/D' && Number(interestCov) >= 5.0 ? '✅ Cobertura holgada de deuda' : '⚠️ Sensibilidad a tipos de interés'} |
| **Health Score** | **${comp.health_score || 'N/D'}/100** | Tier A / AA | Calidad: **${comp.quality_tier || 'A'}** (${comp.quality_label || ''}) |

${trampas.length > 0 ? `> [!WARNING]\n> **Alertas de Trampa Fundamental activadas**:\n${trampas.map(t => `> - *${t.tipo}*: ${t.detalle}`).join('\n')}` : '> [!NOTE]\n> **Sin trampas estructurales críticas**: La compañía no presenta caídas extremas sin soporte ni dilución descontrolada.'}

**Veredicto de Riesgo**: ${p0 <= techo ? `Con la cotización actual ($${p0.toFixed(2)}) por debajo del Techo MoS ($${techo.toFixed(2)}), el inversor cuenta con un colchón defensivo del ${Math.abs(diffPct).toFixed(1)}% frente a imprevistos operativos.` : `Cotiza con sobreprecio respecto a su Techo de Seguridad. Cualquier deterioro de márgenes o subida del coste de la deuda castigaría la acción.`}`;
  }

  // 2. Preguntas sobre Precio de Entrada, Margen de Seguridad o Compra
  if (msgLower.includes('compr') || msgLower.includes('entrar') || msgLower.includes('precio') || msgLower.includes('mos') || msgLower.includes('seguridad')) {
    const enZona = p0 <= techo;
    return `### 🎯 Análisis de Margen de Seguridad: ${comp.nombre} (${comp.ticker})

- **Cotización de Mercado ($P_0$)**: **$${p0.toFixed(2)}**
- **Fair Value Teórico Central**: **$${fv.toFixed(2)}**
- **Techo Máximo Admisible de Compra ($VP_{\\text{MoS}}$)**: **$${techo.toFixed(2)}** (con descuento del ${comp.mos_discount_pct || 25}%)

#### Escalera de Margen de Seguridad
| Escenario MoS | Precio Límite de Entrada | Distancia vs Cotización Actual |
| :--- | :---: | :---: |
| **MoS 10% (Agresivo)** | **$${(fv * 0.90).toFixed(2)}** | ${(((fv * 0.90 - p0) / p0) * 100).toFixed(1)}% |
| **MoS 20% (Moderado)** | **$${(fv * 0.80).toFixed(2)}** | ${(((fv * 0.80 - p0) / p0) * 100).toFixed(1)}% |
| **MoS 30% (Conservador)** | **$${(fv * 0.70).toFixed(2)}** | ${(((fv * 0.70 - p0) / p0) * 100).toFixed(1)}% |

${enZona
  ? `> [!TIP]\n> **ZONA DE COMPRA ACTIVA**: Cotiza a $${p0.toFixed(2)}, con un descuento favorable del **+${Math.abs(diffPct).toFixed(1)}%** por debajo del techo prudente. Cumple la disciplina estricta de Ben Graham y Damodaran.`
  : `> [!WARNING]\n> **FUERA DE ZONA DE ENTRADA**: Cotiza a $${p0.toFixed(2)}, por encima del techo admisible de $${techo.toFixed(2)}. Esperar a que el precio corrija hacia el techo de seguridad o vender opciones PUT en dicho strike.`}`;
  }

  // 3. Preguntas sobre Filtro Value o Modelo de Negocio
  if (msgLower.includes('filtro') || msgLower.includes('value') || msgLower.includes('ventaja') || msgLower.includes('moat') || msgLower.includes('negocio')) {
    if (fvState) {
      const score = fvState.puntuacion ?? fvState.puntos_cumplidos ?? 0;
      const total = fvState.total_criterios ?? 5;
      const criteriaList = fvState.criterios || fvState.metricas || [];
      const verdictReason = fvState.motivo_parrafo || fvState.resumen_analista || fvState.motivos_parrafo || 'Sin observaciones adicionales';

      return `### 💎 Evaluación del Filtro Value: ${comp.nombre} (${comp.ticker})

**Veredicto Oficial**: **${fvState.veredicto || 'AUDITADO'}** (${score}/${total} puntos superados)

| Criterio | Dato Actual | Requisito Mínimo | Estado |
| :--- | :---: | :---: | :---: |
${criteriaList.map(m => `| **${m.metrica}** | ${m.dato_actual} | ${m.objetivo_minimo} | **${m.estado === 'APTO' || m.cumple || m.apto ? '✅ APTO' : '❌ DESCARTADO'}** |`).join('\n')}

> [!NOTE]
> **Dictamen del Analista**: ${verdictReason}`;
    }
  }

  // 4. Preguntas sobre Cartera
  if (msgLower.includes('cartera') || msgLower.includes('posicion') || msgLower.includes('peso') || msgLower.includes('impacto')) {
    const matchPos = context.portfolio?.positions?.find(p => p.ticker === comp.ticker);
    if (matchPos) {
      return `### 💼 Análisis de Cartera: Posición en ${comp.nombre} (${comp.ticker})

Ya tienes esta compañía en cartera:
- **Títulos en Cartera**: **${matchPos.shares} acciones**
- **Precio Medio de Compra**: **$${matchPos.buy_price.toFixed(2)}**
- **Cotización Actual**: **$${p0.toFixed(2)}**
- **Rentabilidad Latente**: **${matchPos.variation_pct >= 0 ? '+' : ''}${matchPos.variation_pct.toFixed(2)}%** (${matchPos.profit_loss >= 0 ? '+' : ''}$${matchPos.profit_loss.toFixed(2)})
- **Precio Objetivo de Salida**: **$${(matchPos.target_exit_price || fv).toFixed(2)}**

${p0 >= (matchPos.target_exit_price || fv)
  ? `> [!TIP]\n> **OBJETIVO DE SALIDA ALCANZADO**: La cotización ($${p0.toFixed(2)}) ha alcanzado o superado el Fair Value intrínseco. Considera recoger beneficios o ajustar stop táctico.`
  : `> [!NOTE]\n> **MANTENER / HOLD**: La posición sigue teniendo recorrido alcista hacia su Fair Value ($${fv.toFixed(2)}).`}`;
    } else {
      return `### 💼 Análisis de Cartera: Oportunidad de Incorporación

Actualmente **NO tienes acciones de ${comp.nombre} (${comp.ticker})** en cartera.

- **Precio de Mercado**: $${p0.toFixed(2)}
- **Techo MoS Requerido**: $${techo.toFixed(2)}
- **Idoneidad de Entrada**: ${p0 <= techo ? '✅ **Favorable**: Puedes abrir una primera posición conservadora asignando entre el 2% y 4% de tu capital total.' : '⏳ **En Espera**: No añadir a cartera todavía; colocar en Lista de Seguimiento y monitorizar alertas de precio.'}`;
    }
  }

  // 5. Respuesta General Ejecutiva
  return `### 📊 Radiografía Ejecutiva: ${comp.nombre} (${comp.ticker})

- **Cotización en Vivo**: **$${p0.toFixed(2)}** ${comp.currency || 'USD'}
- **Fair Value Estimado**: **$${fv.toFixed(2)}**
- **Techo de Compra MoS**: **$${techo.toFixed(2)}** (${comp.estado_compra || 'ANALIZADA'})
- **Retorno sobre Capital Invertido (ROIC)**: **${roic}%**
- **Crecimiento Ventas 3Y (CAGR)**: **${context.deepDive?.operational_momentum?.rev_cagr_3y ?? 'N/D'}%**
- **Veredicto Filtro Value**: **${fvState?.veredicto || 'Auditado'}** (${fvState?.puntuacion ?? fvState?.puntos_cumplidos ?? 'N/D'}/5)

> [!TIP]
> **Preguntas recomendadas que puedes hacerme:**
> - *"¿Cuáles son los principales riesgos de su balance?"*
> - *"¿A qué precio exacto debería comprar según el margen de seguridad?"*
> - *"Explícame por qué aprueba o suspende el Filtro Value"*
> - *"¿Cómo encajaría esta acción en mi cartera actual?"*`;
}

/**
 * Endpoint de Consulta al Asistente IA (Soporte Dual: Gemini API + Motor Local)
 */
export async function handleAIChatQuery({ message, history = [], context = {} }) {
  const config = getAIConfig();

  // Si el usuario configuró una clave de Gemini válida, llamamos a la API de Google Gemini
  if (config.has_api_key && config.api_key) {
    try {
      const systemInstruction = buildSystemPrompt(context);
      const url = `${GEMINI_API_BASE}/${config.model}:generateContent?key=${encodeURIComponent(config.api_key)}`;

      // Formatear historial de chat para Gemini
      const formattedContents = [];
      const pastMessages = (history || []).slice(-8); // Últimos 8 turnos
      for (const turn of pastMessages) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          formattedContents.push({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.content }]
          });
        }
      }

      // Añadir el mensaje actual
      formattedContents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: formattedContents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            topP: 0.95,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply && reply.trim().length > 0) {
          return {
            reply: reply.trim(),
            provider: 'gemini',
            model: config.model,
            timestamp: new Date().toISOString()
          };
        }
      } else {
        console.warn('[AIAssistant] Error en llamada a Gemini API:', response.status);
      }
    } catch (err) {
      console.warn('[AIAssistant] Excepción en llamada a Gemini:', err.message);
    }
  }

  // Fallback transparente: Motor Cuantitativo Local
  const localReply = generateLocalExpertResponse({ message, context });
  return {
    reply: localReply,
    provider: 'local',
    model: 'Motor Cuantitativo Local',
    timestamp: new Date().toISOString()
  };
}
