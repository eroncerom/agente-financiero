"""
CONSTRUCTOR DEL UNIVERSO AUDITADO (Fase 1 - AuditorÃ­a del Motor de ValoraciÃ³n)

Fuentes:
  - Fundamentales: SEC EDGAR XBRL companyfacts (TTM o Ãºltimo 10-K) -> server/data_sources/sec_edgar.py
  - Mercado (precio, rango 52s, dividendo anual, serie de precios, EPS forward de consenso): Yahoo Finance
  - TaxonomÃ­a: GICS Sub-Industry (lista de constituyentes S&P 500) -> server/config/archetype_map.json
  - ERP implÃ­cita: Damodaran -> server/data_sources/damodaran_erp.py

PolÃ­tica "Cero InvenciÃ³n":
  - NingÃºn valor por defecto numÃ©rico. Si falta un dato obligatorio del arquetipo, la empresa se marca con
    'datos_faltantes' y D1_o_FCFA1 = None (el motor la descarta por datos insuficientes, con motivo).
  - Cada valor fundamental lleva su procedencia (etiqueta XBRL, periodo, accession).
"""
import json
import math
import os
import sqlite3
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
import requests
import yfinance as yf

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
sys.path.insert(0, os.path.join(BASE_DIR, 'data_sources'))
import sec_edgar  # noqa: E402
import damodaran_erp  # noqa: E402

BENCHMARK = '^GSPC'
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
ARCHETYPE_MAP_PATH = os.path.join(BASE_DIR, 'config', 'archetype_map.json')
PARAMS_PATH = os.path.join(BASE_DIR, 'config', 'market_params.json')
OUT_PATH = os.path.join(BASE_DIR, 'data', 'sp500_universe.json')
TOP_N = 503

MUST_HAVE = ['MSFT', 'AAPL', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'LLY', 'AVGO', 'JPM',
             'TSLA', 'UNH', 'V', 'XOM', 'MA', 'JNJ', 'PG', 'COST', 'HD', 'ABBV',
             'WMT', 'MRK', 'KO', 'CVX', 'BAC', 'PEP', 'LIN', 'ORCL', 'ACN', 'MCD',
             'CRM', 'TMO', 'CSCO', 'ABT', 'WFC', 'IBM', 'QCOM', 'GE', 'TXN', 'INTU',
             'PM', 'CAT', 'AMAT', 'DHR', 'NOW', 'VZ', 'NEE', 'DIS', 'PFE', 'RTX', 'T',
             'VICI',
             # Casos de control de la auditoría
             'AMGN', 'VRTX', 'ISRG', 'BSX', 'MMM', 'HON', 'CEG', 'WM', 'RSG', 'CTAS', 'NFLX', 'BLK', 'KKR']

# Campos obligatorios (ademÃ¡s de precio, acciones y beneficio neto) por arquetipo
REQUIRED = {
    'HOLDING_CONGLOMERADO': ['equity'],
    'BANCA_FINANCIERA': ['equity', 'tbv'],
    'GESTORA_ACTIVOS': ['ocf', 'capex', 'sbc'],
    'INFRAESTRUCTURA_DEUDA': ['dividend'],
    'COMPOUNDER_TECH': ['ocf', 'capex', 'sbc'],
    'CICLICA_INDUSTRIAL': ['ocf', 'capex'],
    'DEFENSIVA_CONSUMO': ['ocf', 'capex', 'sbc'],
}


# ----------------------------------------------------------------------------
# TaxonomÃ­a
# ----------------------------------------------------------------------------
def load_archetype_map():
    with open(ARCHETYPE_MAP_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def classify(ticker, sub_industry, amap):
    ov = amap['overrides_ticker'].get(ticker)
    if ov:
        return ov['arquetipo'], f"Override documentado: {ov['justificacion']}"
    m = amap['sub_industries'].get(sub_industry)
    if m:
        return m['arquetipo'], m['justificacion']
    return None, f'Sub-industria GICS no mapeada: "{sub_industry}"'


# ----------------------------------------------------------------------------
# Universo y mercado
# ----------------------------------------------------------------------------
def fetch_sp500_constituents():
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    html = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': USER_AGENT})).read()
    df = pd.read_html(html)[0]
    df['Symbol'] = df['Symbol'].str.replace('.', '-', regex=False)
    return {row['Symbol']: (str(row['GICS Sector']), str(row['GICS Sub-Industry'])) for _, row in df.iterrows()}


def rank_top(symbols):
    def get_mc(sym):
        try:
            mc = yf.Ticker(sym).fast_info.market_cap
            return sym, mc if mc and mc > 0 else 0
        except Exception:
            return sym, 0
    with ThreadPoolExecutor(max_workers=25) as ex:
        caps = list(ex.map(get_mc, symbols))
    caps.sort(key=lambda x: x[1], reverse=True)
    ranked = [s for s, c in caps if c > 0]
    unranked = [s for s, c in caps if c <= 0]
    return list(dict.fromkeys([m for m in MUST_HAVE if m in symbols] + ranked + unranked))[:TOP_N]


def compute_market_metrics(tickers):
    """Î² y Î²â» con la MISMA serie (semanal, 5 aÃ±os) frente al S&P 500; mVaR y rendimientos plurianuales."""
    data = yf.download(list(set(tickers + [BENCHMARK])), period='5y', interval='1d', progress=False, auto_adjust=True)['Close']
    weekly = data.resample('W-FRI').last()
    wret = weekly.pct_change()
    dret = data.pct_change()
    out = {}
    bench_w = wret[BENCHMARK]
    for sym in tickers:
        res = {'beta': None, 'downside_beta': None, 'mvar_monthly_95': None, 'mvar_daily_95': None,
               'perf_1y_pct': None, 'perf_3y_pct': None, 'perf_5y_pct': None, 'max_5y': None, 'drawdown_5y_pct': None,
               'beta_observaciones': 0}
        if sym not in data:
            out[sym] = res
            continue
        s = data[sym].dropna()
        if len(s) >= 60:
            p = float(s.iloc[-1])
            def ret(n):
                return round((p / float(s.iloc[-n]) - 1) * 100, 1) if len(s) >= n else None
            res['perf_1y_pct'] = ret(252)
            res['perf_3y_pct'] = ret(756)
            res['perf_5y_pct'] = round((p / float(s.iloc[0]) - 1) * 100, 1)
            mx = float(s.max())
            res['max_5y'] = round(mx, 2)
            res['drawdown_5y_pct'] = round((p / mx - 1) * 100, 1)
        al = pd.concat([wret[sym], bench_w], axis=1, join='inner').dropna()
        al.columns = ['s', 'b']
        if len(al) >= 104:  # mÃ­nimo 2 aÃ±os de semanas
            c = np.cov(al['s'], al['b'])
            res['beta'] = round(float(c[0, 1] / c[1, 1]), 3)
            down = al[al['b'] < al['b'].mean()]
            if len(down) >= 40:
                cd = np.cov(down['s'], down['b'])
                res['downside_beta'] = round(float(cd[0, 1] / cd[1, 1]), 3)
            res['beta_observaciones'] = int(len(al))
        # mVaR Cornish-Fisher (mÃ©todo heredado; se revisa en Fase 2, auditorÃ­a M1)
        r = dret[sym].dropna()
        if len(r) >= 250:
            mu, sg, sk, ku = float(r.mean()), float(r.std()), float(r.skew()), float(r.kurtosis())
            z = -1.644853
            zcf = z + (1 / 6) * (z ** 2 - 1) * sk + (1 / 24) * (z ** 3 - 3 * z) * ku - (1 / 36) * (2 * z ** 3 - 5 * z) * sk ** 2
            md = -(mu + zcf * sg) * 100
            res['mvar_daily_95'] = round(md, 2)
            res['mvar_monthly_95'] = round(md * math.sqrt(21), 2)
        out[sym] = res
    return out


def yahoo_session():
    s = requests.Session()
    s.headers.update({'User-Agent': USER_AGENT})
    s.get('https://fc.yahoo.com')
    crumb = s.get('https://query2.finance.yahoo.com/v1/test/getcrumb').text.strip()
    return s, crumb


def raw(v):
    if isinstance(v, dict):
        return v.get('raw')
    return v


def fetch_yahoo_market(session, crumb, sym):
    url = (f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{sym}'
           f'?modules=price,summaryDetail,defaultKeyStatistics,financialData&crumb={crumb}')
    try:
        r = session.get(url, timeout=12)
        if r.status_code != 200:
            return None
        res = r.json()['quoteSummary']['result'][0]
    except Exception:
        return None
    pr, sd, ks, fd = res.get('price', {}), res.get('summaryDetail', {}), res.get('defaultKeyStatistics', {}), res.get('financialData', {})
    return {
        'price': raw(pr.get('regularMarketPrice')),
        'name': pr.get('longName') or pr.get('shortName') or sym,
        'currency': (pr.get('currency') or 'USD').upper(),
        'low52': raw(sd.get('fiftyTwoWeekLow')),
        'high52': raw(sd.get('fiftyTwoWeekHigh')),
        'dividend_rate': raw(sd.get('dividendRate')),
        'trailing_eps_yahoo': raw(ks.get('trailingEps')),
        'forward_eps_yahoo': raw(ks.get('forwardEps')),
        'implied_shares': raw(ks.get('impliedSharesOutstanding')),
        'shares_outstanding': raw(ks.get('sharesOutstanding')),
        'target_mean': raw(fd.get('targetMeanPrice')),
    }


# ----------------------------------------------------------------------------
# Ensamblado por empresa
# ----------------------------------------------------------------------------
def per_share(v, sh):
    return None if (v is None or not sh) else round(v / sh, 4)


def build_entry(sym, sector, sub_ind, amap, cik_map, mkt, ymkt, blume_w):
    arquetipo, just = classify(sym, sub_ind, amap)
    entry = {'ticker': sym, 'sector': sector, 'industry': sub_ind, 'gics_sub_industry': sub_ind,
             'arquetipo': arquetipo, 'nombre_arquetipo': amap['arquetipos'].get(arquetipo) if arquetipo else None,
             'justificacion_arquetipo': just, 'datos_faltantes': [], 'avisos': []}
    if ymkt is None or not ymkt.get('price'):
        entry['datos_faltantes'].append('precio (Yahoo)')
        entry.update({'nombre': sym, 'precio_cierre_P0': None, 'D1_o_FCFA1': None, 'beta': None, 'g_hist': None})
        return entry
    entry.update({
        'nombre': ymkt['name'], 'currency': ymkt['currency'],
        'precio_cierre_P0': round(float(ymkt['price']), 2),
        'fifty_two_week_low': ymkt['low52'], 'fifty_two_week_high': ymkt['high52'],
        'dividend_rate': round(float(ymkt['dividend_rate']), 4) if ymkt.get('dividend_rate') else 0.0,
        'forward_eps': ymkt.get('forward_eps_yahoo'),
        'target_mean_analysts': ymkt.get('target_mean'),
    })
    if arquetipo is None:
        entry['datos_faltantes'].append('arquetipo (GICS no mapeado)')

    # --- Fundamentales SEC ---
    cik = cik_map.get(sym)
    vals, prov = {}, {}
    if cik is None:
        entry['datos_faltantes'].append('CIK SEC')
    else:
        cf = sec_edgar.fetch_companyfacts(cik)
        if cf is None:
            entry['datos_faltantes'].append('companyfacts SEC')
        else:
            vals, prov = sec_edgar.build_fundamentals(cf, ticker=sym)
            entry['cik'] = cik

    sh = vals.get('shares_diluted')
    if not sh:
        # Fallback documentado a dato de mercado (no inventado): acciones implÃ­citas/en circulaciÃ³n de Yahoo
        y_sh = ymkt.get('implied_shares') or ymkt.get('shares_outstanding')
        if y_sh:
            sh = float(y_sh)
            prov['shares_diluted'] = {'fuente': 'Yahoo Finance (impliedSharesOutstanding/sharesOutstanding)',
                                      'motivo': 'La SEC no publica serie estÃ¡ndar de acciones para este emisor'}
            entry['avisos'].append('Acciones tomadas de Yahoo (sin serie XBRL estÃ¡ndar en SEC)')
    if not sh:
        entry['datos_faltantes'].append('acciones diluidas')
    if vals.get('net_income') is None:
        entry['datos_faltantes'].append('beneficio neto')

    # SBC: 0 documentado SOLO si la empresa nunca ha reportado ninguna etiqueta de SBC
    if vals.get('sbc') is None and cik and not prov.get('sbc'):
        cf = sec_edgar.fetch_companyfacts(cik)
        if cf and not any(t in cf['facts'] for t in sec_edgar.TAGS_FLOW['sbc']):
            vals['sbc'] = 0.0
            prov['sbc'] = {'derivado': 'Ninguna etiqueta de SBC reportada en XBRL -> 0 (documentado)'}
            if vals.get('fcf') is not None:
                vals['owner_cf'] = vals['fcf']

    ps = {
        'eps_diluted': per_share(vals.get('net_income'), sh),
        'ocf_per_share': per_share(vals.get('ocf'), sh),
        'capex_per_share': per_share(vals.get('capex'), sh),
        'fcf_per_share': per_share(vals.get('fcf'), sh),
        'sbc_per_share': per_share(vals.get('sbc'), sh),
        'owner_cf_per_share': per_share(vals.get('owner_cf'), sh),
        'book_value_per_share': per_share(vals.get('equity'), sh),
        'tbv_per_share': per_share(vals.get('tbv'), sh),
        'net_debt_per_share': per_share(vals.get('net_debt'), sh),
        'dividends_paid_per_share': per_share(vals.get('dividends_paid'), sh),
    }
    entry.update(ps)
    entry['shares_diluted'] = sh

    # Métricas avanzadas Fase 2: ROIC, Reinvestment, Márgenes 10Y, Calidad Contable
    entry['roic'] = vals.get('roic')
    entry['reinvestment_rate'] = vals.get('reinvestment_rate')
    entry['nopat_per_share'] = per_share(vals.get('nopat'), sh)
    entry['ebitda_per_share'] = per_share(vals.get('ebitda'), sh)
    entry['revenue_per_share'] = per_share(vals.get('revenue'), sh)
    entry['invested_capital_per_share'] = per_share(vals.get('invested_capital'), sh)
    entry['tax_rate_effective'] = vals.get('tax_rate_effective')
    entry['cyclical_normalized_margin_10y'] = vals.get('avg_net_margin_10y')
    entry['cyclical_normalized_eps'] = per_share(vals.get('normalized_mid_cycle_net_income'), sh)
    entry['interest_coverage'] = vals.get('interest_coverage')
    entry['net_debt_ebitda'] = vals.get('net_debt_ebitda')
    entry['gross_profitability'] = vals.get('gross_profitability')
    entry['sloan_accruals'] = vals.get('sloan_accruals')
    entry['piotroski_f_score'] = vals.get('piotroski_f_score')

    p0 = entry.get('precio_cierre_P0')
    t_liab = vals.get('total_liabilities')
    if p0 and sh and t_liab and t_liab > 0 and vals.get('total_assets'):
        mkt_cap = p0 * sh
        x4 = mkt_cap / t_liab
        x1 = vals.get('altman_x1') or 0.0
        x2 = vals.get('altman_x2') or 0.0
        x3 = vals.get('altman_x3') or 0.0
        x5 = vals.get('altman_x5') or 0.0
        entry['altman_z_score'] = round(1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 0.999 * x5, 2)
    else:
        entry['altman_z_score'] = None

    # Rentabilidades sobre fondos propios medios
    ni, eq, eq0 = vals.get('net_income'), vals.get('equity'), vals.get('equity_prev')
    if ni is not None and eq:
        avg_eq = (eq + eq0) / 2 if eq0 else eq
        entry['roe'] = round(ni / avg_eq, 4) if avg_eq > 0 else None
        tbv, gw0 = vals.get('tbv'), vals.get('goodwill_prev')
        if tbv is not None and tbv > 0:
            ia = vals.get('intangibles') or 0.0
            tbv0 = (eq0 - gw0 - ia) if (eq0 is not None and gw0 is not None) else None
            avg_tbv = (tbv + tbv0) / 2 if (tbv0 and tbv0 > 0) else tbv
            entry['rote'] = round(ni / avg_tbv, 4)
        else:
            entry['rote'] = None
    else:
        entry['roe'] = None
        entry['rote'] = None

    # Mercado/riesgo
    m = mkt.get(sym, {})
    entry.update({k: m.get(k) for k in ['downside_beta', 'mvar_monthly_95', 'mvar_daily_95', 'perf_1y_pct',
                                         'perf_3y_pct', 'perf_5y_pct', 'max_5y', 'drawdown_5y_pct', 'beta_observaciones']})
    entry['beta_raw'] = m.get('beta')
    if m.get('beta') is None:
        entry['datos_faltantes'].append('beta (historial semanal < 2 años)')
        entry['beta'] = None
    else:
        entry['beta'] = round(blume_w * m['beta'] + (1 - blume_w), 3)
        if not (-0.5 <= m['beta'] <= 3.5):
            entry['avisos'].append(f'Beta bruta {m["beta"]} fuera de rango razonable [-0.5, 3.5]')
    entry['beta_metodo'] = 'Blume (0.67·β + 0.33) sobre β semanal 5 años vs ^GSPC'

    # Campos obligatorios por arquetipo
    if arquetipo:
        for req in REQUIRED[arquetipo]:
            if req == 'dividend':
                if not entry['dividend_rate'] or entry['dividend_rate'] <= 0:
                    entry['datos_faltantes'].append('dividendo (DDM)')
            elif vals.get(req) is None:
                entry['datos_faltantes'].append(req)

    # Base de flujo por arquetipo (Fase 2: si es cíclica y hay margen 10Y, la base normalizada es el beneficio mid-cycle)
    eps = ps['eps_diluted']
    ocf_base = ps['owner_cf_per_share']
    base = None
    if not entry['datos_faltantes'] and arquetipo:
        if arquetipo in ('HOLDING_CONGLOMERADO', 'BANCA_FINANCIERA'):
            base = eps
        elif arquetipo == 'CICLICA_INDUSTRIAL':
            # Punto 7: Normalización cíclica real
            base = entry.get('cyclical_normalized_eps') or eps
        elif arquetipo == 'INFRAESTRUCTURA_DEUDA':
            base = entry['dividend_rate']
        elif arquetipo in ('COMPOUNDER_TECH', 'GESTORA_ACTIVOS', 'DEFENSIVA_CONSUMO'):
            base = min(ocf_base, eps) if (ocf_base is not None and eps is not None) else None
    entry['D1_o_FCFA1'] = round(base, 4) if base is not None else None
    entry['base_flujo_regla'] = {
        'HOLDING_CONGLOMERADO': 'EPS (NI/acciones)', 'BANCA_FINANCIERA': 'EPS (NI/acciones)',
        'CICLICA_INDUSTRIAL': 'Mid-Cycle Normalized EPS (10Y margin × Sales)', 'INFRAESTRUCTURA_DEUDA': 'Dividendo anual',
        'COMPOUNDER_TECH': 'min(OCF−Capex−SBC, NI) por acción', 'GESTORA_ACTIVOS': 'min(OCF−Capex−SBC, NI) por acción',
        'DEFENSIVA_CONSUMO': 'min(OCF−Capex−SBC, NI) por acción'}.get(arquetipo)

    # Crecimiento ligado a fundamentales (Fase 2, punto 5: g = reinversión × ROIC)
    if arquetipo == 'BANCA_FINANCIERA':
        divs = vals.get('dividends_paid') or 0.0
        ni_val = vals.get('net_income') or 1.0
        payout = min(1.0, max(0.0, divs / ni_val)) if ni_val > 0 else 0.0
        retention = 1.0 - payout
        roe_val = entry.get('roe') or 0.12
        g_fund = max(0.015, min(0.065, roe_val * retention))
        gn = 0.025
    elif arquetipo == 'INFRAESTRUCTURA_DEUDA':
        g_fund = 0.025
        gn = 0.020
    elif arquetipo == 'HOLDING_CONGLOMERADO':
        g_fund = 0.040
        gn = 0.025
    else:
        roic_val = vals.get('roic')
        reinv_val = vals.get('reinvestment_rate')
        if roic_val is not None and reinv_val is not None:
            g_raw = roic_val * reinv_val
            if arquetipo in ('COMPOUNDER_TECH', 'GESTORA_ACTIVOS'):
                g_fund = max(0.04, min(0.15, g_raw))
            elif arquetipo == 'DEFENSIVA_CONSUMO':
                g_fund = max(0.02, min(0.06, g_raw))
            else:  # CICLICA_INDUSTRIAL
                g_fund = max(0.02, min(0.06, g_raw))
        else:
            te, fe = ymkt.get('trailing_eps_yahoo'), ymkt.get('forward_eps_yahoo')
            g_fund = min(0.10, max(0.04, (fe - te) / te)) if (te and fe and te > 0 and fe > te) else 0.05
        gn = 0.025

    entry['g_fundamental'] = round(g_fund, 4)
    entry['g_hist'] = round(g_fund, 4)
    entry['gn_terminal'] = gn

    entry['procedencia_datos'] = prov
    entry['fuente_auditada'] = 'SEC EDGAR XBRL companyfacts (TTM/10-K) + Yahoo Finance (mercado)'
    return entry


def main():
    t0 = time.time()
    with open(PARAMS_PATH, 'r', encoding='utf-8') as f:
        params = json.load(f)
    blume_w = params.get('blume_peso_beta', 0.67)
    print('0. Actualizando ERP implÃ­cita de Damodaran...')
    damodaran_erp.update_params()

    print('1. Constituyentes S&P 500 (GICS)...')
    gics = fetch_sp500_constituents()
    amap = load_archetype_map()
    unmapped = sorted({sub for _, sub in gics.values() if sub not in amap['sub_industries']})
    if unmapped:
        print(f'   AVISO: sub-industrias sin mapear (se descartarÃ¡n): {unmapped}')

    print('2. Ranking por capitalizaciÃ³n...')
    tickers = rank_top(list(gics.keys()))
    print(f'   {len(tickers)} empresas')

    print('3. MÃ©tricas de mercado (5 aÃ±os, Î² semanal)...')
    mkt = compute_market_metrics(tickers)

    print('4. Datos de mercado Yahoo...')
    sess, crumb = yahoo_session()
    with ThreadPoolExecutor(max_workers=8) as ex:
        ymkts = dict(zip(tickers, ex.map(lambda s: fetch_yahoo_market(sess, crumb, s), tickers)))

    print('5. Fundamentales SEC EDGAR...')
    cik_map = sec_edgar.load_ticker_cik_map()
    def safe_build(s):
        try:
            return build_entry(s, gics[s][0], gics[s][1], amap, cik_map, mkt, ymkts.get(s), blume_w)
        except Exception as ex:
            print(f'   ERROR {s}: {ex}')
            return {'ticker': s, 'nombre': s, 'sector': gics[s][0], 'industry': gics[s][1], 'gics_sub_industry': gics[s][1],
                    'precio_cierre_P0': None, 'D1_o_FCFA1': None, 'beta': None, 'g_hist': None,
                    'datos_faltantes': [f'error de construcción: {ex}'], 'avisos': []}

    with ThreadPoolExecutor(max_workers=3) as ex:
        entries = list(ex.map(safe_build, tickers))

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=1, ensure_ascii=False)

    falt = [e for e in entries if e['datos_faltantes']]
    print(f'\n[OK] {len(entries)} empresas -> {OUT_PATH} ({round(time.time() - t0, 1)} s)')
    print(f'     Con datos faltantes (se descartarÃ¡n con motivo): {len(falt)}')
    for e in falt:
        print(f'       {e["ticker"]:<6} {e.get("arquetipo") or "-":<22} {", ".join(e["datos_faltantes"])}')

    # Sincronizar cotizaciones en SQLite
    try:
        conn = sqlite3.connect(os.path.join(BASE_DIR, '..', 'portfolio.db'))
        cur = conn.cursor()
        for e in entries:
            if e.get('precio_cierre_P0'):
                cur.execute("""
                    INSERT INTO market_quotes (ticker, current_price, currency, fifty_two_week_low, fifty_two_week_high, change_pct)
                    VALUES (?, ?, ?, ?, ?, 0.0)
                    ON CONFLICT(ticker) DO UPDATE SET current_price = excluded.current_price,
                      fifty_two_week_low = excluded.fifty_two_week_low, fifty_two_week_high = excluded.fifty_two_week_high
                """, (e['ticker'], e['precio_cierre_P0'], e.get('currency', 'USD'), e.get('fifty_two_week_low'), e.get('fifty_two_week_high')))
        conn.commit()
        conn.close()
        print('[OK] market_quotes sincronizada.')
    except Exception as ex:
        print('Nota: no se sincronizÃ³ SQLite:', ex)


if __name__ == '__main__':
    main()
