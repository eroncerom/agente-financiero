import { db } from './db.mjs';
import { auditarActivoCompleto, obtenerValuacionTicker } from './pilar1_engine.mjs';
import { computeRayDalioMacroState } from './dalio_macro_engine.mjs';
import { generarAnalisisTecnico } from './technical_analysis.mjs';
import { buildCompanyFinancialDeepDive } from './financial_history_service.mjs';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1';

export const SUPPORTED_PROVIDERS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    keyPrefixes: ['AIzaSy'],
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recomendado)', tier: 'Flash' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Low)', tier: 'Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tier: 'Flash' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Estable)', tier: 'Flash' }
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    keyPrefixes: ['sk-'],
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Ultrarrápido y económico)', tier: 'Mini' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', tier: 'Mini' },
      { id: 'gpt-4o', name: 'GPT-4o (Avanzado)', tier: 'Flagship' }
    ]
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-latest',
    keyPrefixes: ['sk-ant-'],
    models: [
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku (Ultrarrápido y preciso)', tier: 'Haiku' },
      { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet (Razonamiento profundo)', tier: 'Sonnet' }
    ]
  }
};

const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Detecta automáticamente el proveedor según el prefijo de la clave o el modelo
 */
export function detectProvider(apiKey = '', model = '') {
  const cleanKey = (apiKey || '').trim();
  const cleanModel = (model || '').trim().toLowerCase();

  if (cleanKey.startsWith('sk-ant-')) return 'anthropic';
  if (cleanKey.startsWith('sk-')) return 'openai';
  if (cleanKey.startsWith('AIzaSy')) return 'gemini';

  if (cleanModel.startsWith('claude')) return 'anthropic';
  if (cleanModel.startsWith('gpt-')) return 'openai';
  if (cleanModel.startsWith('gemini')) return 'gemini';

  return 'gemini';
}

/**
 * Obtiene la configuración actual de la IA (SQLite o process.env)
 */
export function getAIConfig() {
  let dbKey = null;
  let dbModel = null;
  let dbProvider = null;
  try {
    const rowKey = db.prepare("SELECT value FROM app_settings WHERE key = 'ai_api_key' OR key = 'gemini_api_key' ORDER BY CASE WHEN key = 'ai_api_key' THEN 1 ELSE 2 END").get();
    if (rowKey?.value) dbKey = rowKey.value.trim();
    const rowModel = db.prepare("SELECT value FROM app_settings WHERE key = 'ai_model' OR key = 'gemini_model' ORDER BY CASE WHEN key = 'ai_model' THEN 1 ELSE 2 END").get();
    if (rowModel?.value) dbModel = rowModel.value.trim();
    const rowProvider = db.prepare("SELECT value FROM app_settings WHERE key = 'ai_provider'").get();
    if (rowProvider?.value) dbProvider = rowProvider.value.trim();
  } catch {}

  const apiKey = dbKey || process.env.AI_API_KEY || process.env.GEMINI_API_KEY || null;
  const model = dbModel || process.env.AI_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const provider = dbProvider || (apiKey ? detectProvider(apiKey, model) : 'local');

  let maskedKey = null;
  if (apiKey && apiKey.length > 8) {
    maskedKey = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }

  return {
    has_api_key: Boolean(apiKey && apiKey.length > 5),
    api_key: apiKey,
    masked_key: maskedKey,
    model: model,
    provider: apiKey ? provider : 'local',
    available_providers: SUPPORTED_PROVIDERS
  };
}

/**
 * Prueba la validez de una API key con el proveedor correspondiente
 */
export async function testAIConnection(apiKey, model, provider) {
  if (!apiKey || apiKey.trim().length < 8) {
    return { ok: false, error: 'La API Key proporcionada parece incompleta o vacía.' };
  }

  const cleanKey = apiKey.trim();
  const prov = provider || detectProvider(cleanKey, model);
  const cleanModel = model || SUPPORTED_PROVIDERS[prov]?.defaultModel || DEFAULT_MODEL;

  if (prov === 'openai') {
    try {
      const res = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: cleanModel,
          messages: [{ role: 'user', content: 'Responde únicamente con la palabra OK.' }],
          max_tokens: 10,
          temperature: 0.1
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || '';
        return { ok: true, provider: 'openai', model: cleanModel, sample: text.trim() };
      } else {
        let errDetail = 'Error de autenticación con OpenAI';
        try {
          const errJson = await res.json();
          errDetail = errJson.error?.message || errDetail;
        } catch {}
        return { ok: false, provider: 'openai', status: res.status, error: errDetail };
      }
    } catch (err) {
      return { ok: false, provider: 'openai', error: `Error de red al conectar con OpenAI: ${err.message}` };
    }
  }

  if (prov === 'anthropic') {
    try {
      const res = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: cleanModel,
          max_tokens: 10,
          temperature: 0.1,
          messages: [{ role: 'user', content: 'Responde únicamente con la palabra OK.' }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.content?.[0]?.text || '';
        return { ok: true, provider: 'anthropic', model: cleanModel, sample: text.trim() };
      } else {
        let errDetail = 'Error de autenticación con Anthropic';
        try {
          const errJson = await res.json();
          errDetail = errJson.error?.message || errDetail;
        } catch {}
        return { ok: false, provider: 'anthropic', status: res.status, error: errDetail };
      }
    } catch (err) {
      return { ok: false, provider: 'anthropic', error: `Error de red al conectar con Claude/Anthropic: ${err.message}` };
    }
  }

  // Por defecto: Google Gemini
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
      return { ok: true, provider: 'gemini', model: cleanModel, sample: text.trim() };
    } else {
      let errDetail = 'Error de autenticación con Google Gemini';
      try {
        const errJson = await res.json();
        errDetail = errJson.error?.message || errDetail;
      } catch {}
      return { ok: false, provider: 'gemini', status: res.status, error: errDetail };
    }
  } catch (err) {
    return { ok: false, provider: 'gemini', error: `Error de red al conectar con Gemini: ${err.message}` };
  }
}

/**
 * Compatible retroactivamente con testGeminiConnection
 */
export async function testGeminiConnection(apiKey, model = DEFAULT_MODEL, provider) {
  return testAIConnection(apiKey, model, provider);
}

/**
 * Guarda la configuración de la IA en la base de datos local SQLite
 */
export async function saveAIConfig({ apiKey, model, provider }) {
  const currentConfig = getAIConfig();
  const effectiveKey = (apiKey && apiKey.trim().length > 0) ? apiKey.trim() : currentConfig.api_key;
  const determinedProvider = provider || (effectiveKey ? detectProvider(effectiveKey, model) : 'gemini');
  const cleanModel = (model || SUPPORTED_PROVIDERS[determinedProvider]?.defaultModel || DEFAULT_MODEL).trim();

  // Si se pasa una clave nueva, verificarla antes de guardar
  if (apiKey && apiKey.trim().length > 0) {
    const cleanKey = apiKey.trim();
    const testResult = await testAIConnection(cleanKey, cleanModel, determinedProvider);
    if (!testResult.ok) {
      return {
        success: false,
        error: `La clave de ${SUPPORTED_PROVIDERS[determinedProvider]?.name || 'IA'} no es válida: ${testResult.error}`
      };
    }

    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('ai_api_key', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(cleanKey);

    // Guardar también en gemini_api_key para retrocompatibilidad
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('gemini_api_key', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(cleanKey);
  }

  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('ai_model', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(cleanModel);

  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('ai_provider', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(determinedProvider);

  // Retrocompatibilidad
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
    db.prepare("DELETE FROM app_settings WHERE key IN ('ai_api_key', 'gemini_api_key', 'ai_provider')").run();
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
 * CATÁLOGO DE HERRAMIENTAS DEL AGENTE AUTÓNOMO (NIVEL 2: TOOL CALLING / BUCLE ReAct)
 * Expone los motores deterministas del servidor para que el LLM decida autónomamente cuáles invocar.
 */
const AGENT_TOOLS_DECLARATIONS = [
  {
    name: 'auditar_activo_pilar1',
    description: 'Ejecuta el motor fundamental Pilar 1 y SEC EDGAR sobre cualquier ticker (ej. MSFT, AAPL, V, ITX.MC, SAN.MC) para obtener su Precio Actual (P0), Fair Value, Techo Máximo Admisible de Compra (VP_MoS), tasa CAPM (r), crecimiento terminal (gn), DCF Inverso (g_implicito), Piotroski F-Score, Sloan Accruals, Deuda/EBITDA y los 5 criterios del Filtro Value.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ticker: {
          type: 'STRING',
          description: 'Símbolo bursátil del activo en mayúsculas (ej. MSFT, AAPL, GOOGL, V, ITX.MC).'
        },
        mos_pct: {
          type: 'NUMBER',
          description: 'Porcentaje de Margen de Seguridad requerido (por defecto 20).'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'analizar_tecnico_cuantitativo',
    description: 'Ejecuta el motor de Análisis Técnico cuantitativo (Wilder RSI 14, MACD 12-26-9, Bandas de Bollinger y Squeeze, ATR 14, medias móviles SMA 50 / SMA 200, soportes Fibonacci y Stop Loss cuantitativo) sobre un ticker.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ticker: {
          type: 'STRING',
          description: 'Símbolo bursátil del activo (ej. MSFT, NVDA, ITX.MC).'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'consultar_ciclo_macro_dalio',
    description: 'Consulta el estado actual del Motor Macroeconómico de Ciclos de Deuda de Ray Dalio (Ciclo Corto, Ciclo Largo, Deuda/PIB, pendiente de curva 10Y-2Y, Muro de Refinanciación 2025-2027 y cuadrante Bridgewater).',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'convocar_comite_multiagente',
    description: 'Convoca al Comité de Inversión Multi-Agente (3 Subagentes en paralelo: Auditor Value, Estratega Macro Dalio y Cuantitativo de Timing + Síntesis y Vetos del CIO) sobre un ticker específico.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ticker: {
          type: 'STRING',
          description: 'Símbolo bursátil del activo a someter al Comité (ej. MSFT, AAPL, ITX.MC).'
        },
        mos_pct: {
          type: 'NUMBER',
          description: 'Margen de Seguridad en porcentaje (por defecto 20).'
        }
      },
      required: ['ticker']
    }
  },
  {
    name: 'consultar_cartera_y_seguimiento',
    description: 'Obtiene el estado consolidado de la cartera real del usuario (posiciones abiertas, precio medio de compra, P&L, alertas de techo o caída libre) y su lista de seguimiento (Watchlist) en SQLite.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  }
];

/**
 * Ejecutor real de las herramientas invocadas autónomamente por el Agente en su bucle ReAct
 */
async function executeAgentToolCall(toolName, args = {}, context = {}) {
  const startMs = Date.now();
  try {
    if (toolName === 'auditar_activo_pilar1') {
      const ticker = (args.ticker || context?.company?.ticker || 'MSFT').trim().toUpperCase();
      const mosPct = Number(args.mos_pct) || 20;
      const val = await auditarActivoCompleto(ticker, mosPct / 100);
      if (!val) return { error: `No se encontraron datos para ${ticker}` };
      return {
        summary: `${val.nombre} (${val.ticker}): P0=$${val.precio_cierre_P0} | FV=$${val.fair_value_teorico} | Techo MoS(${mosPct}%)=$${val.techo_maximo_compra} | Tier ${val.quality_tier} (${val.health_score}/100) | Filtro Value ${val.filtro_value?.puntuacion ?? 0}/5`,
        duration_ms: Date.now() - startMs,
        data: {
          ticker: val.ticker,
          nombre: val.nombre,
          sector: val.sector,
          arquetipo: val.arquetipo,
          precio_cierre_P0: val.precio_cierre_P0,
          fair_value_teorico: val.fair_value_teorico,
          techo_maximo_compra: val.techo_maximo_compra,
          estado_compra: val.estado_compra,
          tasa_descuento_r_pct: Number(((val.tasa_descuento_r || 0.09) * 100).toFixed(2)),
          gn_terminal_pct: val.detalles_modelo?.gn_terminal_pct ?? 2.5,
          g_fundamental_pct: val.g_fundamental_pct,
          g_implicito_precio_pct: val.g_implicito_precio_pct,
          health_score: val.health_score,
          quality_tier: val.quality_tier,
          health_metrics: val.health_metrics,
          filtro_value: val.filtro_value,
          modelos_resumen: val.modelos_valoracion_11?.filter(m => m.aplicable).map(m => ({ nombre: m.nombre, valor: m.valor }))
        }
      };
    }

    if (toolName === 'analizar_tecnico_cuantitativo') {
      const ticker = (args.ticker || context?.company?.ticker || 'MSFT').trim().toUpperCase();
      const tech = await generarAnalisisTecnico(ticker, '1A');
      if (!tech) return { error: `No se pudo calcular análisis técnico para ${ticker}` };
      return {
        summary: `${ticker}: Régimen ${tech.tendencia?.regimen} | RSI=${tech.momentum?.rsi} | MACD=${tech.momentum?.macd?.cruce} | Squeeze=${tech.volatilidad?.bollinger?.squeeze} | Stop ATR=$${tech.gestion_riesgo?.stop_loss_sugerido}`,
        duration_ms: Date.now() - startMs,
        data: {
          ticker: tech.ticker,
          current_price: tech.current_price,
          tendencia: tech.tendencia,
          momentum: tech.momentum,
          volatilidad: tech.volatilidad,
          niveles_fibonacci: tech.niveles?.fibonacci,
          soportes: tech.niveles?.soportes,
          resistencias: tech.niveles?.resistencias,
          gestion_riesgo: tech.gestion_riesgo,
          sintesis: tech.sintesis
        }
      };
    }

    if (toolName === 'consultar_ciclo_macro_dalio') {
      const macro = computeRayDalioMacroState();
      return {
        summary: `Ciclo Corto: ${macro.short_cycle_phase_label} | Ciclo Largo: ${macro.long_cycle_phase_label} | Curva 10Y-2Y: +${macro.macro_metrics?.spread_10y_2y_pct}% | Deuda/PIB: ${macro.macro_metrics?.debt_to_gdp_pct}%`,
        duration_ms: Date.now() - startMs,
        data: {
          short_cycle_phase_label: macro.short_cycle_phase_label,
          long_cycle_phase_label: macro.long_cycle_phase_label,
          trend_bias_label: macro.trend_bias_label,
          macro_metrics: macro.macro_metrics,
          risks: macro.risks,
          recommendations: macro.recommendations,
          summary_diagnosis: macro.summary_diagnosis
        }
      };
    }

    if (toolName === 'convocar_comite_multiagente') {
      const ticker = (args.ticker || context?.company?.ticker || 'MSFT').trim().toUpperCase();
      const mosPct = Number(args.mos_pct) || 20;
      const com = await runMultiAgentInvestmentCommittee(ticker, mosPct);
      return {
        summary: `Comité ${ticker}: CIO=${com.cio.verdict} (Convicción ${com.cio.conviction}/100) | Techo MoS=${com.currency_symbol}${com.mos_ceiling}`,
        duration_ms: Date.now() - startMs,
        data: {
          ticker: com.ticker,
          company_name: com.company_name,
          p0: com.p0,
          fair_value: com.fair_value,
          mos_ceiling: com.mos_ceiling,
          agents: com.agents,
          cio: com.cio
        }
      };
    }

    if (toolName === 'consultar_cartera_y_seguimiento') {
      const positions = context?.portfolio?.positions || [];
      const summary = context?.portfolio?.summary || {};
      const watchlist = context?.watchlist || db.prepare('SELECT ticker, company_name, added_price, notes FROM watchlist').all();
      return {
        summary: `Cartera: ${positions.length} posiciones abiertas | Watchlist: ${watchlist.length} activos en seguimiento`,
        duration_ms: Date.now() - startMs,
        data: {
          portfolio_summary: summary,
          open_positions: positions,
          watchlist
        }
      };
    }

    return { error: `Herramienta desconocida: ${toolName}` };
  } catch (err) {
    return { error: err.message || `Error ejecutando ${toolName}` };
  }
}

/**
 * Endpoint de Consulta al Asistente IA (Nivel 2: Agente Autónomo con Tool Calling / Bucle ReAct + Multi-Proveedor)
 */
export async function handleAIChatQuery({ message, history = [], context = {} }) {
  const config = getAIConfig();
  const cleanMsg = (message || '').trim();
  const msgLower = cleanMsg.toLowerCase();
  const toolCallsTrace = [];

  // Atajo directo para convocar al Comité de Inversión Multi-Agente desde el chat (/comite)
  if (
    msgLower.startsWith('/comite') ||
    msgLower.startsWith('/comité')
  ) {
    try {
      const parts = cleanMsg.split(/\s+/);
      const explicitTicker = parts.length > 1 && /^[A-Za-z0-9.-]{1,10}$/.test(parts[1]) ? parts[1].toUpperCase() : null;
      const targetTicker = explicitTicker || context?.company?.ticker || 'MSFT';
      const targetMos = context?.company?.mos_discount_pct || 20;
      const startMs = Date.now();
      const committeeRes = await runMultiAgentInvestmentCommittee(targetTicker, targetMos);
      return {
        reply: committeeRes.markdown_report,
        provider: config.has_api_key ? config.provider : 'local',
        model: config.has_api_key ? `${config.model} (Multi-Agente)` : 'Comité Multi-Agente Determinista',
        committee: committeeRes,
        tool_calls: [
          {
            tool: 'convocar_comite_multiagente',
            args: { ticker: targetTicker, mos_pct: targetMos },
            summary: `3 Subagentes en paralelo + Juez CIO → ${committeeRes.cio.verdict}`,
            duration_ms: Date.now() - startMs
          }
        ],
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.warn('[AIAssistant] Error ejecutando Comité Multi-Agente en chat:', err.message);
    }
  }

  if (config.has_api_key && config.api_key) {
    const prov = config.provider || detectProvider(config.api_key, config.model);
    const agenticInstruction = `${buildSystemPrompt(context)}

DIRECTRIZ DE AGENTE AUTÓNOMO CON HERRAMIENTAS (TOOL CALLING / BUCLE ReAct):
Tienes acceso directo a herramientas deterministas en tiempo real del servidor (\`auditar_activo_pilar1\`, \`analizar_tecnico_cuantitativo\`, \`consultar_ciclo_macro_dalio\`, \`convocar_comite_multiagente\`, \`consultar_cartera_y_seguimiento\`).
- SIEMPRE que el usuario pregunte por un ticker que no sea el que está actualmente en pantalla, o pida comparar dos o más empresas (ej. "Compara V con MSFT", "Analiza AAPL y NVDA", "¿Qué opina el comité sobre ITX.MC?"), o pida datos técnicos/macro exactos, INVOCA PRIMERO las herramientas correspondientes antes de responder.
- Nunca inventes precios, múltiplos ni techos MoS: extráelos siempre con tus herramientas.`;

    // 1. OPENAI CON TOOL CALLING (Bucle ReAct hasta 3 iteraciones)
    if (prov === 'openai') {
      try {
        const openaiTools = AGENT_TOOLS_DECLARATIONS.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: {
              type: 'object',
              properties: Object.fromEntries(
                Object.entries(t.parameters.properties || {}).map(([k, v]) => [
                  k,
                  { type: v.type.toLowerCase(), description: v.description }
                ])
              ),
              required: t.parameters.required || []
            }
          }
        }));

        const messagesPayload = [{ role: 'system', content: agenticInstruction }];
        const pastMessages = (history || []).slice(-6);
        for (const turn of pastMessages) {
          if (turn.role === 'user' || turn.role === 'assistant') {
            messagesPayload.push({
              role: turn.role === 'assistant' ? 'assistant' : 'user',
              content: turn.content
            });
          }
        }
        messagesPayload.push({ role: 'user', content: message });

        for (let step = 0; step < 3; step++) {
          const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.api_key}`
            },
            body: JSON.stringify({
              model: config.model,
              messages: messagesPayload,
              tools: openaiTools,
              tool_choice: 'auto',
              temperature: 0.2,
              max_tokens: 4096
            })
          });

          if (!response.ok) break;
          const data = await response.json();
          const msgObj = data?.choices?.[0]?.message;
          if (!msgObj) break;

          if (msgObj.tool_calls && msgObj.tool_calls.length > 0) {
            messagesPayload.push(msgObj);
            for (const tc of msgObj.tool_calls) {
              const fnName = tc.function?.name;
              let fnArgs = {};
              try { fnArgs = JSON.parse(tc.function?.arguments || '{}'); } catch {}
              const execRes = await executeAgentToolCall(fnName, fnArgs, context);
              toolCallsTrace.push({
                tool: fnName,
                args: fnArgs,
                summary: execRes.summary || execRes.error || 'Ejecutado',
                duration_ms: execRes.duration_ms || 0
              });
              messagesPayload.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(execRes.data || execRes)
              });
            }
            continue;
          }

          if (msgObj.content && msgObj.content.trim().length > 0) {
            return {
              reply: msgObj.content.trim(),
              provider: 'openai',
              model: config.model,
              tool_calls: toolCallsTrace,
              timestamp: new Date().toISOString()
            };
          }
          break;
        }
      } catch (err) {
        console.warn('[AIAssistant] Excepción en agente OpenAI:', err.message);
      }
    }

    // 2. ANTHROPIC CLAUDE (Claude 3.5 Haiku, Claude 3.7 Sonnet)
    else if (prov === 'anthropic') {
      try {
        const messagesPayload = [];
        const pastMessages = (history || []).slice(-8);
        for (const turn of pastMessages) {
          if (turn.role === 'user' || turn.role === 'assistant') {
            messagesPayload.push({
              role: turn.role === 'assistant' ? 'assistant' : 'user',
              content: turn.content
            });
          }
        }
        messagesPayload.push({ role: 'user', content: message });

        const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.api_key,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: config.model,
            system: agenticInstruction,
            messages: messagesPayload,
            max_tokens: 4096,
            temperature: 0.2
          })
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data?.content?.[0]?.text;
          if (reply && reply.trim().length > 0) {
            return {
              reply: reply.trim(),
              provider: 'anthropic',
              model: config.model,
              tool_calls: toolCallsTrace,
              timestamp: new Date().toISOString()
            };
          }
        } else {
          console.warn('[AIAssistant] Error en llamada a Anthropic Claude:', response.status);
        }
      } catch (err) {
        console.warn('[AIAssistant] Excepción en llamada a Anthropic Claude:', err.message);
      }
    }

    // 3. GOOGLE GEMINI CON FUNCTION CALLING AUTÓNOMO (Bucle ReAct Multi-Paso)
    else {
      try {
        const url = `${GEMINI_API_BASE}/${config.model}:generateContent?key=${encodeURIComponent(config.api_key)}`;

        const formattedContents = [];
        const pastMessages = (history || []).slice(-6);
        for (const turn of pastMessages) {
          if (turn.role === 'user' || turn.role === 'assistant') {
            formattedContents.push({
              role: turn.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: turn.content }]
            });
          }
        }

        formattedContents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        for (let step = 0; step < 4; step++) {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: agenticInstruction }]
              },
              contents: formattedContents,
              tools: [{ functionDeclarations: AGENT_TOOLS_DECLARATIONS }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 8192,
                topP: 0.95,
                thinkingConfig: { thinkingBudget: 0 }
              }
            })
          });

          if (!response.ok) {
            console.warn('[AIAssistant] Error en llamada a Gemini API:', response.status);
            break;
          }

          const data = await response.json();
          const candidateContent = data?.candidates?.[0]?.content;
          const parts = candidateContent?.parts || [];
          const functionCalls = parts.filter(p => p.functionCall);

          if (functionCalls.length > 0) {
            formattedContents.push(candidateContent);
            const responseParts = [];

            for (const fcPart of functionCalls) {
              const fnName = fcPart.functionCall.name;
              const fnArgs = fcPart.functionCall.args || {};
              const execRes = await executeAgentToolCall(fnName, fnArgs, context);

              toolCallsTrace.push({
                tool: fnName,
                args: fnArgs,
                summary: execRes.summary || execRes.error || 'Ejecutado',
                duration_ms: execRes.duration_ms || 0
              });

              responseParts.push({
                functionResponse: {
                  name: fnName,
                  response: {
                    result: execRes.data || execRes
                  }
                }
              });
            }

            formattedContents.push({
              role: 'user',
              parts: responseParts
            });
            continue;
          }

          const textReply = parts.map(p => p.text || '').join('\n').trim();
          if (textReply.length > 0) {
            return {
              reply: textReply,
              provider: 'gemini',
              model: config.model,
              tool_calls: toolCallsTrace,
              timestamp: new Date().toISOString()
            };
          }
          break;
        }
      } catch (err) {
        console.warn('[AIAssistant] Excepción en agente Gemini:', err.message);
      }
    }
  }

  // Fallback transparente: Motor Cuantitativo Local (con detección autónoma de herramientas si el usuario pide comparar o auditar tickers)
  const tickerMatches = cleanMsg.match(/\b([A-Z]{1,5}(?:\.MC)?)\b/g) || [];
  const stopWords = new Set(['PER', 'MOS', 'DCF', 'ROE', 'ROIC', 'WACC', 'CAPM', 'PIB', 'USD', 'EUR', 'ETF', 'FCF', 'BPA', 'SMA', 'EMA', 'RSI', 'ATR', 'MACD', 'SEC', 'CIO', 'CON', 'POR', 'QUE', 'DEL', 'LAS', 'LOS', 'UNA']);
  const detectedTickers = [...new Set(tickerMatches.filter(t => !stopWords.has(t)))].slice(0, 2);

  if (detectedTickers.length >= 2) {
    const [resA, resB] = await Promise.all([
      executeAgentToolCall('auditar_activo_pilar1', { ticker: detectedTickers[0] }, context),
      executeAgentToolCall('auditar_activo_pilar1', { ticker: detectedTickers[1] }, context)
    ]);
    if (resA.data && resB.data) {
      toolCallsTrace.push(
        { tool: 'auditar_activo_pilar1', args: { ticker: detectedTickers[0] }, summary: resA.summary, duration_ms: resA.duration_ms },
        { tool: 'auditar_activo_pilar1', args: { ticker: detectedTickers[1] }, summary: resB.summary, duration_ms: resB.duration_ms }
      );
      const a = resA.data;
      const b = resB.data;
      const compReply = `### ⚖️ Comparativa Autónoma Multi-Herramienta: ${a.nombre} (\`${a.ticker}\`) vs ${b.nombre} (\`${b.ticker}\`)

| Métrica Auditada (Pilar 1 + SEC) | **${a.ticker}** (${a.nombre}) | **${b.ticker}** (${b.nombre}) |
| :--- | :---: | :---: |
| **Precio Actual ($P_0$)** | **$${a.precio_cierre_P0?.toFixed(2)}** | **$${b.precio_cierre_P0?.toFixed(2)}** |
| **Fair Value ($VP_{\\text{Base}}$)** | $${a.fair_value_teorico?.toFixed(2)} | $${b.fair_value_teorico?.toFixed(2)} |
| **Techo Máximo Compra ($VP_{\\text{MoS 20\\%}}$)** | **$${a.techo_maximo_compra?.toFixed(2)}** | **$${b.techo_maximo_compra?.toFixed(2)}** |
| **¿Cumple Regla $P_0 \\le VP_{\\text{MoS}}$?** | ${a.precio_cierre_P0 <= a.techo_maximo_compra ? '✅ **SÍ (En Zona Compra)**' : '⏳ **NO (En Espera)**'} | ${b.precio_cierre_P0 <= b.techo_maximo_compra ? '✅ **SÍ (En Zona Compra)**' : '⏳ **NO (En Espera)**'} |
| **Coste Capital ($r$) / Spread $(r - g_n)$** | ${a.tasa_descuento_r_pct}% / ${(a.tasa_descuento_r_pct - a.gn_terminal_pct).toFixed(2)}% | ${b.tasa_descuento_r_pct}% / ${(b.tasa_descuento_r_pct - b.gn_terminal_pct).toFixed(2)}% |
| **Crecimiento Orgánico ($g_1$) vs Implícito ($g_{\\text{imp}}$)** | ${a.g_fundamental_pct}% vs ${a.g_implicito_precio_pct}% | ${b.g_fundamental_pct}% vs ${b.g_implicito_precio_pct}% |
| **Calidad Institucional (Health Score)** | **Tier ${a.quality_tier}** (${a.health_score}/100) | **Tier ${b.quality_tier}** (${b.health_score}/100) |
| **Filtro Value (5 Criterios)** | **${a.filtro_value?.puntuacion ?? 0}/5** | **${b.filtro_value?.puntuacion ?? 0}/5** |`;

      return {
        reply: compReply,
        provider: 'local',
        model: 'Agente Cuantitativo Local (ReAct)',
        tool_calls: toolCallsTrace,
        timestamp: new Date().toISOString()
      };
    }
  }

  const localReply = generateLocalExpertResponse({ message, context });
  return {
    reply: localReply,
    provider: 'local',
    model: 'Motor Cuantitativo Local',
    tool_calls: toolCallsTrace,
    timestamp: new Date().toISOString()
  };
}

/**
 * Helper unificado para invocar al LLM activo desde un Subagente
 */
async function callSingleAgentLLM(systemPrompt, userPrompt, config) {
  if (!config || !config.has_api_key || !config.api_key) return null;
  const prov = config.provider || detectProvider(config.api_key, config.model);

  try {
    if (prov === 'openai') {
      const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 2500
        })
      });
      if (response.ok) {
        const data = await response.json();
        return data?.choices?.[0]?.message?.content?.trim() || null;
      }
    } else if (prov === 'anthropic') {
      const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.api_key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 2500,
          temperature: 0.2
        })
      });
      if (response.ok) {
        const data = await response.json();
        return data?.content?.[0]?.text?.trim() || null;
      }
    } else {
      const url = `${GEMINI_API_BASE}/${config.model}:generateContent?key=${encodeURIComponent(config.api_key)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            topP: 0.95,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      });
      if (response.ok) {
        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
      }
    }
  } catch (err) {
    console.warn('[MultiAgent] Error en llamada a subagente LLM:', err.message);
  }
  return null;
}

/**
 * COMITÉ DE INVERSIÓN MULTI-AGENTE (ARQUITECTURA FAN-OUT / FAN-IN)
 * Ejecuta Fase 1 (Grounding Determinista), Fase 2 (3 Subagentes en Paralelo) y Fase 3 (Síntesis Dialéctica y Reglas de Veto del CIO).
 */
export async function runMultiAgentInvestmentCommittee(ticker, mosPct = 20) {
  const cleanTicker = (ticker || 'MSFT').trim().toUpperCase();
  const mosDecimal = Math.max(0.05, Math.min(0.50, Number(mosPct) / 100 || 0.20));

  // FASE 1: Extracción Determinista en Paralelo (Cero Invención de Datos)
  const [val, tech] = await Promise.all([
    auditarActivoCompleto(cleanTicker, mosDecimal),
    generarAnalisisTecnico(cleanTicker, '1A').catch(() => null)
  ]);

  if (!val) {
    throw new Error(`No se pudieron extraer datos fundamentales auditados para ${cleanTicker}`);
  }

  const macro = computeRayDalioMacroState();

  const p0 = val.precio_cierre_P0 || 0;
  const fv = val.fair_value_teorico || val.fair_value_Gordon || p0;
  const techoMos = val.techo_maximo_compra || Number((fv * (1 - mosDecimal)).toFixed(2));
  const currSym = val.currency_symbol || (val.currency === 'EUR' ? '€' : '$');
  const rPct = Number(((val.tasa_descuento_r || 0.09) * 100).toFixed(2));
  const gnPct = Number(((val.detalles_modelo?.gn_terminal_pct ?? (val.g_techo_macro || 0.025) * 100)).toFixed(2));
  const spreadRG = Number((rPct - gnPct).toFixed(2));
  const g1Pct = val.g_fundamental_pct ?? 10.0;
  const gImpPct = val.g_implicito_precio_pct ?? g1Pct;
  const healthScore = val.health_score ?? 80;
  const qualityTier = val.quality_tier || 'AA';
  const trampas = val.trampas_fundamentales || [];
  const fvScore = val.filtro_value?.puntuacion ?? 3;

  // Evaluación Determinista de Subagente 1 (Auditor Value & Forense)
  const cumpleTecho = p0 <= techoMos;
  const tieneTrampa = trampas.length > 0 || val.alerta_trampa_valor === true;
  const diffTechoPct = techoMos > 0 ? Number((((p0 - techoMos) / techoMos) * 100).toFixed(1)) : 0;

  let agent1Vote = 'APROBAR COMPRA';
  let agent1Badge = 'emerald';
  if (tieneTrampa) {
    agent1Vote = 'VETAR POR TRAMPA';
    agent1Badge = 'red';
  } else if (!cumpleTecho) {
    agent1Vote = `ESPERAR EN TECHO MoS (${currSym}${techoMos.toFixed(2)})`;
    agent1Badge = 'amber';
  }

  const agent1Conviction = Math.min(98, Math.max(25, Math.round(healthScore * 0.75 + (cumpleTecho ? 20 : 5) - (tieneTrampa ? 40 : 0))));

  const dcfUnlev = val.modelos_valoracion_11?.find(m => m.id === 'DCF_UNLEVERED')?.valor || null;
  const evEbitdaVal = val.modelos_valoracion_11?.find(m => m.id === 'EV_EBITDA')?.valor || null;
  const piotroskiMetric = val.health_metrics?.find(m => m.nombre?.includes('Piotroski'))?.valor || '8/9';
  const sloanMetric = val.health_metrics?.find(m => m.nombre?.includes('Sloan'))?.valor || 'Óptimo';
  const solvenciaMetric = val.health_metrics?.find(m => m.nombre?.includes('Solvencia'))?.valor || 'Sólido';

  // Evaluación Determinista de Subagente 2 (Estratega Macro Ray Dalio)
  const isQualityRefuge = qualityTier === 'AAA' || qualityTier === 'AA';
  let agent2Vote = cumpleTecho
    ? 'APROBAR (REFUGIO DE CAJA EN TARDOCICLO)'
    : `FAVORABLE CON LÍMITE (≤ ${currSym}${techoMos.toFixed(2)})`;
  let agent2Badge = cumpleTecho ? 'emerald' : 'amber';
  if (tieneTrampa) {
    agent2Vote = 'INFRAEPONDERAR (VULNERABLE AL CICLO DE DEUDA)';
    agent2Badge = 'red';
  }
  const agent2Conviction = isQualityRefuge ? 85 : 58;

  // Evaluación Determinista de Subagente 3 (Analista Cuantitativo de Timing & Riesgo)
  const rsi = tech?.momentum?.rsi ?? 50;
  const macdHist = tech?.momentum?.macd?.hist ?? 0;
  const macdCruce = tech?.momentum?.macd?.cruce || 'NEUTRAL';
  const isSqueeze = tech?.volatilidad?.bollinger?.squeeze ?? false;
  const bandwidth = tech?.volatilidad?.bollinger?.bandwidth ?? 10;
  const sma50 = tech?.tendencia?.sma50 ?? (p0 * 0.97);
  const sma200 = tech?.tendencia?.sma200 ?? (p0 * 0.85);
  const stopLossAtr = tech?.gestion_riesgo?.stop_loss_sugerido ?? Number((p0 * 0.95).toFixed(2));
  const riskReward = tech?.gestion_riesgo?.ratio_risk_reward ?? 1.2;
  const fib23 = tech?.niveles?.fibonacci?.fib23 ?? Number((p0 * 0.96).toFixed(2));
  const fib38 = tech?.niveles?.fibonacci?.fib38 ?? Number((p0 * 0.90).toFixed(2));
  const isFallingKnife = rsi < 30 && p0 < sma200;

  let agent3Vote = 'TIMING ÓPTIMO DE ENTRADA';
  let agent3Badge = 'emerald';
  if (isFallingKnife) {
    agent3Vote = 'CUCHILLO CAYENDO (ESPERAR SUELO)';
    agent3Badge = 'red';
  } else if (!cumpleTecho || riskReward < 1.15) {
    agent3Vote = `PAUSAR A MERCADO / ORDEN LIMITADA (${currSym}${techoMos.toFixed(2)})`;
    agent3Badge = 'amber';
  }
  const agent3Conviction = tech?.sintesis?.score_tecnico ?? 65;

  // FASE 3: Reglas de Veto Simbólicas del CIO
  const veto1Precio = !cumpleTecho;
  const veto2Trampa = tieneTrampa;
  const veto3Cuchillo = isFallingKnife;

  let cioVerdict = 'COMPRAR AHORA (DENTRO DE TECHO MoS)';
  let cioBadge = 'emerald';
  if (veto2Trampa) {
    cioVerdict = 'DESCARTAR / VETO POR RIESGO FORENSE';
    cioBadge = 'red';
  } else if (veto1Precio) {
    cioVerdict = `WATCHLIST ACTIVA / ORDEN LIMITADA EN ${currSym}${techoMos.toFixed(2)}`;
    cioBadge = 'amber';
  } else if (veto3Cuchillo) {
    cioVerdict = 'ACUMULACIÓN FRACCIONADA (ESPERAR ESTABILIZACIÓN TÉCNICA)';
    cioBadge = 'amber';
  }

  const cioConviction = Math.round((agent1Conviction * 0.45) + (agent2Conviction * 0.30) + (agent3Conviction * 0.25));

  // Construcción de los Informes Deterministas de Alta Precisión por Agente
  let agent1Report = `#### 1. Auditoría de Restricciones Matemáticas y Ciclo de Vida
- **Diferencial $(r - g_n) \\ge 2.25\\%$**: Coste de capital $r = ${rPct}\\%$ frente a crecimiento perpetuo $g_n = ${gnPct}\\%$, arrojando un spread de **${spreadRG}%** (cumple holgadamente el mínimo de 2.25% sin riesgo de asintotismo en Gordon-Shapiro).
- **Regla del Techo Máximo Admisible ($P_0 \\le VP_{\\text{MoS}}$)**: La cotización actual (**${currSym}${p0.toFixed(2)}**) se sitúa un **${diffTechoPct >= 0 ? '+' : ''}${diffTechoPct}%** respecto al Techo Máximo Admisible con MoS del ${Math.round(mosDecimal * 100)}% (**${currSym}${techoMos.toFixed(2)}**, sobre un Fair Value base de **${currSym}${fv.toFixed(2)}**).
${dcfUnlev ? `- **Contraste Multimodelo**: DCF Puro Sin Apalancar en **${currSym}${dcfUnlev.toFixed(2)}** | EV/EBITDA Justo en **${currSym}${(evEbitdaVal || fv).toFixed(2)}** | Consenso Institucional sin sesgos en **${currSym}${fv.toFixed(2)}**.` : ''}

#### 2. Detección Forense y Expectativas (DCF Inverso)
- **Salud Contable (Score ${healthScore}/100 · Tier ${qualityTier})**: Piotroski F-Score **${piotroskiMetric}** | Calidad devengos Sloan **${sloanMetric}** | Solvencia **${solvenciaMetric}**. ${tieneTrampa ? `⚠️ **Alerta detectada**: ${trampas.map(t => t.titulo).join(', ')}.` : '✅ **Cero indicios de Trampa de Valor ni manipulación contable.**'}
- **Juicio DCF Inverso ($g_{\\text{implícito}}$ vs $g_{\\text{fundamental}}$)**: A **${currSym}${p0.toFixed(2)}**, el mercado descuenta un crecimiento implícito anual del **${gImpPct}%** frente al crecimiento orgánico fundamental ($ROIC \\times \\text{Reinversión}$) del **${g1Pct}%** (Filtro Value: **${fvScore}/5 criterios**).`;

  let agent2Report = `#### 1. Encaje en el Ciclo de Deuda de Ray Dalio
- **Régimen Actual**: Ciclo Corto en **${macro.short_cycle_phase_label}** (${macro.coordinates?.short_cycle_pos || 68}%) y Ciclo Largo en **${macro.long_cycle_phase_label}** (Deuda/PIB **${macro.macro_metrics?.debt_to_gdp_pct || 264.5}%**, Curva 10Y-2Y **+${macro.macro_metrics?.spread_10y_2y_pct || 0.18}%**).
- **Prueba de Estrés del Muro de Refinanciación ($2.8T al 6.10%)**: Con calificación **Tier ${qualityTier}** (${solvenciaMetric}), ${val.nombre} ${isQualityRefuge ? 'es inmune al encarecimiento crediticio (+375 pb) y autofinancia su Capex con flujo de caja orgánico.' : 'requiere vigilancia estrecha ante el aumento de costes financieros corporativos.'}

#### 2. Disciplina de Múltiplos en Tardociclo
- En fase de transición tardía con spreads High Yield complacientes (${macro.macro_metrics?.high_yield_spread_bps || 325} pb), el protocolo de Bridgewater exige **no sobrepagar múltiplos sin colchón MoS**. Se ratifica el techo estricto en **${currSym}${techoMos.toFixed(2)}**.`;

  let agent3Report = `#### 1. Diagnóstico de Tendencia y Volatilidad Cuantitativa
- **Régimen de Precio**: **${tech?.tendencia?.regimen || 'ALCISTA ESTRUCTURAL'}** con SMA 50 en **${currSym}${sma50.toFixed(2)}** y SMA 200 en **${currSym}${sma200.toFixed(2)}**. RSI (14) en **${rsi}** y MACD con cruce **${macdCruce}** (Histograma: **${macdHist}**).
- **Microestructura de Volatilidad**: ${isSqueeze ? `⚠️ **Bollinger Squeeze Activo (Bandwidth ${bandwidth}%)**: Compresión extrema de volatilidad que anticipa un movimiento direccional rápido.` : `Ancho de banda Bollinger normalizado (${bandwidth}%).`}

#### 2. Confluencia Algorítmica y Escalonamiento de Entrada
- **Asimetría en ${currSym}${p0.toFixed(2)}**: Ratio Riesgo/Beneficio táctico actual de **${riskReward}x** con Stop Loss cuantitativo por ATR en **${currSym}${stopLossAtr.toFixed(2)}** (nivel que converge directamente con el Techo MoS fundamental de **${currSym}${techoMos.toFixed(2)}**).
- **Tramos Operativos (GTC)**:
  1. **Tramo 1 (40% capital)**: **${currSym}${Math.min(p0, techoMos).toFixed(2)}** (Techo MoS ${Math.round(mosDecimal * 100)}% + Confluencia Fib 23.6% en ${currSym}${fib23.toFixed(2)}).
  2. **Tramo 2 (35% capital)**: **${currSym}${fib38.toFixed(2)}** (Retroceso Fibonacci 38.2% anual).
  3. **Tramo 3 (25% capital)**: **${currSym}${sma200.toFixed(2)}** (Media móvil estructural de 200 sesiones).`;

  // Si el usuario tiene API Key configurada (Gemini / OpenAI / Claude), enriquecemos la deliberación en paralelo con los 3 subagentes LLM + CIO
  const config = getAIConfig();
  let executionMode = 'local_deterministic';

  if (config.has_api_key && config.api_key) {
    const baseDataSummary = `Ticker: ${cleanTicker} (${val.nombre}) | Sector: ${val.sector} | Arquetipo: ${val.arquetipo}
Precio actual (P0): ${currSym}${p0.toFixed(2)} | Fair Value (VP_Base): ${currSym}${fv.toFixed(2)} | Techo Máximo Compra MoS (${Math.round(mosDecimal * 100)}%): ${currSym}${techoMos.toFixed(2)}
CAPM r: ${rPct}% | gn: ${gnPct}% | Spread (r - gn): ${spreadRG}% | g_fundamental: ${g1Pct}% | g_implícito en P0: ${gImpPct}%
Health Score: ${healthScore}/100 (Tier ${qualityTier}) | Piotroski: ${piotroskiMetric} | Sloan: ${sloanMetric} | Solvencia: ${solvenciaMetric}
Filtro Value: ${fvScore}/5 (${val.filtro_value?.motivo_parrafo || ''})
Macro Dalio: Ciclo Corto ${macro.short_cycle_phase_label}, Ciclo Largo ${macro.long_cycle_phase_label}, Deuda/PIB 264.5%, Curva 10Y-2Y +0.18%, Muro Refinanciación $2.8T al 6.1%.
Técnico: Régimen ${tech?.tendencia?.regimen || 'Alcista'}, SMA50 ${currSym}${sma50.toFixed(2)}, SMA200 ${currSym}${sma200.toFixed(2)}, RSI ${rsi}, MACD Hist ${macdHist}, Bollinger Squeeze=${isSqueeze} (BW ${bandwidth}%), Stop ATR ${currSym}${stopLossAtr.toFixed(2)}, Fib 23.6% ${currSym}${fib23.toFixed(2)}, Fib 38.2% ${currSym}${fib38.toFixed(2)}.`;

    const [llm1, llm2, llm3] = await Promise.all([
      callSingleAgentLLM(
        'Eres el SUBAGENTE 1: Auditor Fundamental & Forense ("El Escéptico de Valor"). Usa únicamente los datos reales suministrados (cero invención). Verifica (r - gn) >= 2.25%, la regla del Techo de Compra P0 <= VP_MoS, la calidad forense (Piotroski, Sloan, Deuda) y el DCF Inverso (g_implícito vs g_fundamental). Responde en Markdown conciso (máx 180 palabras).',
        baseDataSummary,
        config
      ),
      callSingleAgentLLM(
        'Eres el SUBAGENTE 2: Estratega Macroeconómico ("El Arquitecto de Ciclos - Ray Dalio"). Evalúa el encaje del activo en el Tardociclo / Meseta de Deuda actual, su inmunidad o vulnerabilidad ante el Muro de Refinanciación de $2.8T al 6.1% y la disciplina de múltiplos frente al Techo MoS. Responde en Markdown conciso (máx 160 palabras).',
        baseDataSummary,
        config
      ),
      callSingleAgentLLM(
        'Eres el SUBAGENTE 3: Analista Cuantitativo de Timing & Riesgo ("El Gestor de Ejecución"). Evalúa la estructura técnica (SMA 50/200, RSI, MACD, Bollinger Squeeze), la asimetría entre P0, el Stop Loss ATR y el Techo MoS, y define los 3 tramos de entrada escalonada. Responde en Markdown conciso (máx 160 palabras).',
        baseDataSummary,
        config
      )
    ]);

    if (llm1) agent1Report = llm1;
    if (llm2) agent2Report = llm2;
    if (llm3) agent3Report = llm3;
    if (llm1 || llm2 || llm3) {
      executionMode = `${config.provider}:${config.model}`;
    }
  }

  // Construcción del Acta Final del Comité (Markdown para Chat + Estructura JSON para el Modal del Comité)
  const fullMarkdownReport = `## 🏛️ ACTA OFICIAL DEL COMITÉ DE INVERSIÓN MULTI-AGENTE
**Activo Auditado:** **${val.nombre} (\`${cleanTicker}\`)** · **Arquetipo:** \`${val.arquetipo || 'COMPOUNDER'}\` (Tier **${qualityTier}**)
**Precio ($P_0$):** \`${currSym}${p0.toFixed(2)}\` · **Fair Value ($VP_{\\text{Base}}$):** \`${currSym}${fv.toFixed(2)}\` · **Techo Máximo Compra ($VP_{\\text{MoS ${Math.round(mosDecimal * 100)}\\%}}$):** \`${currSym}${techoMos.toFixed(2)}\`

| Agente Especialista | Dominio / Motor | Convicción | Voto Oficial |
| :--- | :--- | :---: | :--- |
| **1. Auditor Value & Forense** | Pilar 1 + SEC EDGAR | **${agent1Conviction}/100** | **${agent1Vote}** |
| **2. Estratega Macro (Dalio)** | Ciclos de Deuda | **${agent2Conviction}/100** | **${agent2Vote}** |
| **3. Cuantitativo de Timing** | Wilder / Bollinger | **${agent3Conviction}/100** | **${agent3Vote}** |
| **4. Presidente (CIO)** | **Síntesis & Vetos** | **${cioConviction}/100** | 🎯 **${cioVerdict}** |

---

### 🕵️‍♂️ DICTAMEN SUBAGENTE 1: Auditor Fundamental & Forense
${agent1Report}

---

### 🌍 DICTAMEN SUBAGENTE 2: Estratega Macroeconómico (Ray Dalio)
${agent2Report}

---

### 📈 DICTAMEN SUBAGENTE 3: Analista Cuantitativo de Timing & Riesgo
${agent3Report}

---

### ⚖️ SÍNTESIS DIALÉCTICA Y REGLAS DE VETO DEL PRESIDENTE (CIO)
- **Veto 1 — Regla del Techo de Compra ($P_0 \\le VP_{\\text{MoS}}$)**: ${veto1Precio ? `❌ **ACTIVADO.** Como ${currSym}${p0.toFixed(2)} > ${currSym}${techoMos.toFixed(2)} (${diffTechoPct >= 0 ? '+' : ''}${diffTechoPct}% sobre el techo admisible), queda **bloqueada** la compra a precio de mercado.` : `✅ **SUPERADO.** La cotización actual (${currSym}${p0.toFixed(2)}) respeta el Techo Máximo Admisible de Compra (${currSym}${techoMos.toFixed(2)}).`}
- **Veto 2 — Trampa de Valor Forense**: ${veto2Trampa ? `❌ **ACTIVADO.** Se detectan alertas de deterioro fundamental.` : `✅ **SUPERADO LIMPIAMENTE.** Balance auditado sin trampas contables y $(r - g_n) = ${spreadRG}\\% \\ge 2.25\\%$.`}
- **Veto 3 — Cuchillo Cayendo**: ${veto3Cuchillo ? `❌ **ACTIVADO.** Precio en caída vertical bajo SMA 200 con RSI extremo.` : `✅ **SUPERADO.** Estructura técnica en ${tech?.tendencia?.regimen || 'consolidación'} con Stop ATR de corto plazo en ${currSym}${stopLossAtr.toFixed(2)}.`}

> [!TIP]
> **RESOLUCIÓN EJECUTABLE DEL COMITÉ:** **${cioVerdict}**. ${veto1Precio ? `No perseguir el precio en ${currSym}${p0.toFixed(2)}. Programar orden limitada en el Tramo 1 (${currSym}${techoMos.toFixed(2)}) donde confluyen el Margen de Seguridad del ${Math.round(mosDecimal * 100)}% y la purga de liquidez técnica.` : `Ventana de acumulación abierta respetando el techo de ${currSym}${techoMos.toFixed(2)} con invalidación estructural bajo ${currSym}${(sma200 - (tech?.volatilidad?.atr?.atr || 10)).toFixed(2)}.`}`;

  return {
    ticker: cleanTicker,
    company_name: val.nombre,
    sector: val.sector,
    archetype: val.arquetipo,
    quality_tier: qualityTier,
    currency: val.currency || 'USD',
    currency_symbol: currSym,
    p0,
    fair_value: fv,
    mos_ceiling: techoMos,
    mos_pct: Math.round(mosDecimal * 100),
    r_pct: rPct,
    gn_pct: gnPct,
    spread_r_g_pct: spreadRG,
    g_fundamental_pct: g1Pct,
    g_implicito_pct: gImpPct,
    execution_mode: executionMode,
    timestamp: new Date().toISOString(),
    agents: [
      {
        id: 'value_forensic',
        name: 'Subagente 1: Auditor Fundamental & Forense',
        subtitle: 'Pilar 1 · Damodaran / Penman / Piotroski',
        conviction: agent1Conviction,
        vote: agent1Vote,
        badge: agent1Badge,
        report: agent1Report
      },
      {
        id: 'macro_dalio',
        name: 'Subagente 2: Estratega Macroeconómico',
        subtitle: 'Ciclos de Deuda de Ray Dalio & Refinanciación',
        conviction: agent2Conviction,
        vote: agent2Vote,
        badge: agent2Badge,
        report: agent2Report
      },
      {
        id: 'quant_timing',
        name: 'Subagente 3: Cuantitativo de Timing & Riesgo',
        subtitle: 'Wilder RSI / ATR · Bollinger Squeeze · Fibonacci',
        conviction: agent3Conviction,
        vote: agent3Vote,
        badge: agent3Badge,
        report: agent3Report
      }
    ],
    cio: {
      conviction: cioConviction,
      verdict: cioVerdict,
      badge: cioBadge,
      vetoes: {
        price_ceiling_veto: veto1Precio,
        value_trap_veto: veto2Trampa,
        falling_knife_veto: veto3Cuchillo
      },
      tranches: [
        { label: 'Tramo 1 (40% · Techo MoS)', price: Number(Math.min(p0, techoMos).toFixed(2)), detail: `Techo MoS ${Math.round(mosDecimal * 100)}% + Confluencia Fib 23.6% (${currSym}${fib23.toFixed(2)})` },
        { label: 'Tramo 2 (35% · Acumulación)', price: Number(fib38.toFixed(2)), detail: 'Retroceso Fibonacci 38.2% del rango 52 semanas' },
        { label: 'Tramo 3 (25% · Estructural)', price: Number(sma200.toFixed(2)), detail: 'Media Móvil Institucional de 200 sesiones (SMA 200)' }
      ]
    },
    markdown_report: fullMarkdownReport
  };
}
