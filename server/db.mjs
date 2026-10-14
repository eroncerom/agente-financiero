import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '..', 'portfolio.db');

export const db = new DatabaseSync(DB_PATH);

export function initDatabase() {
  // 1. Portfolio Trades Table (Manual Purchases without Broker)
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      company_name TEXT NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('EUR', 'USD')),
      shares REAL NOT NULL,
      buy_price REAL NOT NULL,
      fees REAL DEFAULT 0,
      execution_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  try { db.exec("ALTER TABLE portfolio_trades ADD COLUMN status TEXT DEFAULT 'OPEN'"); } catch {}
  try { db.exec("ALTER TABLE portfolio_trades ADD COLUMN sell_price REAL"); } catch {}
  try { db.exec("ALTER TABLE portfolio_trades ADD COLUMN sell_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE portfolio_trades ADD COLUMN sell_fees REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE portfolio_trades ADD COLUMN realized_pnl REAL"); } catch {}
  try { db.exec("ALTER TABLE portfolio_trades ADD COLUMN realized_pnl_eur REAL"); } catch {}
  try { db.exec("ALTER TABLE portfolio_trades ADD COLUMN realized_roi_pct REAL"); } catch {}
  try { db.exec("ALTER TABLE portfolio_trades ADD COLUMN closing_notes TEXT"); } catch {}
  try { db.exec("ALTER TABLE portfolio_trades ADD COLUMN target_exit_price REAL"); } catch {}
  try { db.exec("ALTER TABLE portfolio_trades ADD COLUMN target_exit_notes TEXT"); } catch {}
  try { db.exec("UPDATE portfolio_trades SET target_exit_price = ROUND(buy_price * 1.15, 2) WHERE target_exit_price IS NULL AND buy_price > 0"); } catch {}

  // 2. Market Quotes Cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_quotes (
      ticker TEXT PRIMARY KEY,
      current_price REAL NOT NULL,
      currency TEXT NOT NULL,
      change_pct REAL DEFAULT 0,
      fifty_two_week_low REAL,
      fifty_two_week_high REAL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  try {
    db.exec('ALTER TABLE market_quotes ADD COLUMN fifty_two_week_low REAL');
  } catch {}
  try {
    db.exec('ALTER TABLE market_quotes ADD COLUMN fifty_two_week_high REAL');
  } catch {}
  try {
    db.exec('ALTER TABLE market_quotes ADD COLUMN target_mean REAL');
  } catch {}
  try {
    db.exec('ALTER TABLE market_quotes ADD COLUMN target_median REAL');
  } catch {}

  // 3. Macro Yield Curve Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS macro_yield_curve (
      maturity TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL,
      yield_rate REAL NOT NULL,
      prev_yield_rate REAL NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Macro Regime
  db.exec(`
    CREATE TABLE IF NOT EXISTS macro_regime (
      id INTEGER PRIMARY KEY,
      spread_10y_2y REAL NOT NULL,
      cycle_phase TEXT NOT NULL,
      description TEXT NOT NULL
    );
  `);

  // 5. Screened Opportunities (Fundamental Pillar)
  db.exec(`
    CREATE TABLE IF NOT EXISTS screened_opportunities (
      ticker TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('EUR', 'USD')),
      filter_badge TEXT NOT NULL,
      catalyst_label TEXT NOT NULL,
      catalyst_value TEXT NOT NULL,
      catalyst_subtext TEXT NOT NULL,
      roic REAL NOT NULL,
      roe REAL NOT NULL,
      roce REAL NOT NULL,
      ev_fcf REAL NOT NULL,
      pe_ntm REAL NOT NULL,
      net_debt_ebitda REAL NOT NULL,
      ebit_margin REAL NOT NULL,
      gross_margin REAL NOT NULL,
      fcf_conversion REAL NOT NULL,
      capex_sales REAL NOT NULL,
      piotroski_score INTEGER NOT NULL,
      altman_z REAL NOT NULL,
      thesis_points_json TEXT NOT NULL
    );
  `);

  // 6. Growth Metrics Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS growth_metrics (
      ticker TEXT PRIMARY KEY,
      rev_growth_yoy REAL NOT NULL,
      rev_cagr_3y REAL NOT NULL,
      eps_growth_yoy REAL NOT NULL,
      eps_qoq_accel REAL NOT NULL,
      efficiency_score REAL NOT NULL,
      momentum_tier TEXT NOT NULL
    );
  `);

  // 7. FX Reference Rates
  db.exec(`
    CREATE TABLE IF NOT EXISTS fx_rates (
      pair TEXT PRIMARY KEY,
      rate REAL NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 8. Watchlist Table (Empresas en Seguimiento)
  db.exec(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      currency TEXT DEFAULT 'USD',
      added_price REAL NOT NULL,
      target_price REAL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default watchlist positions if empty
  const countWatchlist = db.prepare('SELECT COUNT(*) as count FROM watchlist').get().count;
  if (countWatchlist === 0) {
    const insertWatch = db.prepare(`
      INSERT OR IGNORE INTO watchlist (ticker, company_name, currency, added_price, target_price, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertWatch.run('VICI', 'VICI Properties Inc.', 'USD', 22.58, 23.39, 'Seguimiento por alto dividendo y suelo de valoración NAV');
    insertWatch.run('EG', 'Everest Group Ltd.', 'USD', 361.88, 297.62, 'Seguimiento de ciclo de reaseguro y disciplina de entrada');
    insertWatch.run('LEN', 'Lennar Corporation', 'USD', 76.37, 151.17, 'Cíclica de calidad cotizando bajo Techo MoS');
  }

  // Seed default seed positions if empty
  const countTrades = db.prepare('SELECT COUNT(*) as count FROM portfolio_trades').get().count;
  if (countTrades === 0) {
    const insertTrade = db.prepare(`
      INSERT INTO portfolio_trades (ticker, company_name, currency, shares, buy_price, fees, execution_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTrade.run('MSFT', 'Microsoft Corp.', 'USD', 25, 342.10, 5.0, '2025-11-15', 'Posición tecnológica en la nube');
    insertTrade.run('ASML', 'ASML Holding N.V.', 'EUR', 18, 710.00, 4.5, '2025-12-02', 'Líder en litografía EUV');
    insertTrade.run('ADBE', 'Adobe Inc.', 'USD', 12, 540.00, 3.0, '2026-01-20', 'Software creativo & SaaS');
    insertTrade.run('GOOGL', 'Alphabet Inc.', 'USD', 30, 175.50, 4.0, '2026-02-14', 'Buscador y Cloud');
    insertTrade.run('NVO', 'Novo Nordisk A/S', 'USD', 40, 128.00, 3.5, '2026-03-01', 'Sector farmacéutico');
  }

  // Seed market quotes cache
  const countQuotes = db.prepare('SELECT COUNT(*) as count FROM market_quotes').get().count;
  if (countQuotes === 0) {
    const insertQuote = db.prepare(`
      INSERT OR REPLACE INTO market_quotes (ticker, current_price, currency, change_pct)
      VALUES (?, ?, ?, ?)
    `);

    insertQuote.run('MSFT', 428.50, 'USD', 1.45);
    insertQuote.run('ASML', 864.20, 'EUR', 2.15);
    insertQuote.run('ADBE', 488.10, 'USD', -0.85);
    insertQuote.run('GOOGL', 175.50, 'USD', 0.00);
    insertQuote.run('NVO', 124.80, 'USD', -1.20);
    insertQuote.run('V', 288.40, 'USD', 0.65);
    insertQuote.run('LIN', 452.10, 'USD', 0.90);
  }

  // Seed Macro Curve
  const countMacro = db.prepare('SELECT COUNT(*) as count FROM macro_yield_curve').get().count;
  if (countMacro === 0) {
    const insertPoint = db.prepare(`
      INSERT OR REPLACE INTO macro_yield_curve (maturity, sort_order, yield_rate, prev_yield_rate)
      VALUES (?, ?, ?, ?)
    `);

    insertPoint.run('3M', 1, 4.30, 5.25);
    insertPoint.run('2Y', 2, 3.92, 4.88);
    insertPoint.run('5Y', 3, 3.84, 4.35);
    insertPoint.run('10Y', 4, 4.10, 4.22);
    insertPoint.run('30Y', 5, 4.42, 4.38);

    db.prepare(`
      INSERT OR REPLACE INTO macro_regime (id, spread_10y_2y, cycle_phase, description)
      VALUES (1, 0.18, 'Curva Normalizándose (Desinversión)', 'Fase Tardía del Ciclo: el diferencial 10Y-2Y vuelve a terreno positivo tras periodo invertido.')
    `).run();
  }

  // Seed Screened Opportunities (Fundamental)
  const countOpp = db.prepare('SELECT COUNT(*) as count FROM screened_opportunities').get().count;
  if (countOpp === 0) {
    const insertOpp = db.prepare(`
      INSERT OR REPLACE INTO screened_opportunities (
        ticker, name, sector, currency, filter_badge, catalyst_label, catalyst_value, catalyst_subtext,
        roic, roe, roce, ev_fcf, pe_ntm, net_debt_ebitda, ebit_margin, gross_margin,
        fcf_conversion, capex_sales, piotroski_score, altman_z, thesis_points_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOpp.run(
      'ASML',
      'ASML Holding N.V.',
      'Semiconductores / Litografía EUV',
      'EUR',
      'Calidad Triple A + Foso Monopólico + FCF Sólido',
      'Catalizador Fundamental',
      'ROIC: 36.4%',
      'Ventaja competitiva crítica y monopolio EUV',
      36.4, 54.2, 41.1, 28.5, 31.2, 0.12, 32.8, 51.3, 94.0, 7.2, 8, 7.8,
      JSON.stringify([
        'Monopolio Global en Litografía EUV: Único fabricante mundial de los equipos indispensables para nodos de 3nm y 2nm.',
        'Retorno sobre Capital Orgánico (ROIC 36.4%): Capacidad de fijación de precios sin requerir deuda neta significativa.',
        'Resiliencia Macro: Cartera de pedidos (backlog) multianual que amortigua desaceleraciones cíclicas de demanda.'
      ])
    );

    insertOpp.run(
      'MSFT',
      'Microsoft Corporation',
      'Software Infraestructura & Cloud / IA',
      'USD',
      'Líder Hiperescalar + Monetización IA + Solvencia AAA',
      'Eficiencia de Capital',
      'FCF Marg: 34.2%',
      'Generación de flujo libre de caja recurrente',
      31.8, 38.5, 33.2, 32.1, 30.5, 0.25, 44.1, 69.8, 91.5, 9.8, 9, 8.4,
      JSON.stringify([
        'Ecosistema Empresarial Cautivo: Suite Azure y Office 365 con costes de cambio extremos.',
        'Poder Financiero AAA: De las pocas compañías mundiales con rating crediticio superior al soberano de EE.UU.',
        'Aceleración de Flujos de IA: Inserción directa de copilots en bases de usuarios ya monetizadas.'
      ])
    );

    insertOpp.run(
      'V',
      'Visa Inc.',
      'Fintech / Redes Globales de Pagos',
      'USD',
      'Red Global Duopólica + Margen Operativo Sobresaliente',
      'Margen Operativo',
      'EBIT: 66.8%',
      'Economías de escala y coste marginal casi nulo',
      48.1, 52.0, 46.3, 24.8, 26.2, 0.58, 66.8, 79.4, 98.2, 2.1, 8, 9.2,
      JSON.stringify([
        'Efectos de Red Irreplicables: Miles de millones de tarjetas y comercios integrados a nivel global.',
        'Cobertura Natural contra la Inflación: Las comisiones se indexan al volumen nominal transaccionado.',
        'Conversión FCF del 98%: Casi la totalidad de los beneficios netos se transforman en caja líquida libre.'
      ])
    );

    insertOpp.run(
      'LIN',
      'Linde plc',
      'Gases Industriales / Infraestructura Crítica',
      'USD',
      'Contratos Take-or-Pay 15 Años + Fuerte Poder de Fijación de Precios',
      'Visibilidad de Flujos',
      'Contratos: 15Y Take-or-Pay',
      'Precios indexados a costes de energía',
      16.5, 18.2, 17.1, 23.4, 27.8, 1.42, 28.4, 46.8, 88.0, 8.5, 8, 5.1,
      JSON.stringify([
        'Modelo On-Site Take-or-Pay: Clientes industriales obligados por contrato a pagar volúmenes mínimos por 15 años.',
        'Paso Directo de Costes: Los incrementos en costes de electricidad se repercuten automáticamente en el precio final.',
        'Consolidación Oligopólica: Industria dominada por tres actores principales con disciplina de precios.'
      ])
    );
  }

  // Seed Growth Metrics
  const countGrowth = db.prepare('SELECT COUNT(*) as count FROM growth_metrics').get().count;
  if (countGrowth === 0) {
    const insertGrowth = db.prepare(`
      INSERT OR REPLACE INTO growth_metrics (ticker, rev_growth_yoy, rev_cagr_3y, eps_growth_yoy, eps_qoq_accel, efficiency_score, momentum_tier)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertGrowth.run('ASML', 18.4, 21.2, 24.6, 3.2, 48.2, 'Tier 1 Elite');
    insertGrowth.run('MSFT', 15.2, 14.8, 19.5, 2.8, 49.4, 'Tier 1 Elite');
    insertGrowth.run('V', 10.8, 12.1, 14.2, 1.9, 56.9, 'Tier 2 Sólido');
    insertGrowth.run('LIN', 8.5, 9.4, 12.0, 1.4, 36.9, 'Tier 2 Sólido');
  }

  // Seed FX Rates (EUR/USD)
  const countFx = db.prepare('SELECT COUNT(*) as count FROM fx_rates').get().count;
  if (countFx === 0) {
    db.prepare(`
      INSERT OR REPLACE INTO fx_rates (pair, rate)
      VALUES ('EUR_USD', 1.0850)
    `).run();
  }

  // 9. App Settings Table (Configuraciones de IA, API Keys y Preferencias)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
