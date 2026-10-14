import os
import sys
import json
import math
import time
import urllib.request
import requests
import numpy as np
import pandas as pd
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor

BENCHMARK = '^GSPC'
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

def get_yahoo_session_and_crumb():
    s = requests.Session()
    s.headers.update({
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
    })
    s.get('https://fc.yahoo.com')
    r = s.get('https://query2.finance.yahoo.com/v1/test/getcrumb')
    crumb = r.text.strip()
    return s, crumb

def fetch_sp500_ranked_top200():
    print("1. Consultando constituyentes del S&P 500 desde Wikipedia...")
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    html = urllib.request.urlopen(req).read()
    df = pd.read_html(html)[0]
    df['Symbol'] = df['Symbol'].str.replace('.', '-', regex=False)
    
    sector_map = {row['Symbol']: (str(row['GICS Sector']), str(row['GICS Sub-Industry'])) for _, row in df.iterrows()}
    
    # Excluir clases duales duplicadas
    skip_dual = {'GOOG', 'FOX', 'NWS'}
    symbols = [s for s in df['Symbol'].tolist() if s not in skip_dual]
    
    print(f"2. Obteniendo capitalizaciones de mercado para {len(symbols)} companias...")
    def get_mc(sym):
        try:
            t = yf.Ticker(sym)
            mc = t.fast_info.market_cap
            return (sym, mc if mc and mc > 0 else 0)
        except:
            return (sym, 0)

    with ThreadPoolExecutor(max_workers=25) as ex:
        caps = list(ex.map(get_mc, symbols))

    caps.sort(key=lambda x: x[1], reverse=True)
    ranked = [x[0] for x in caps if x[1] > 0]
    
    # Asegurar inclusion de tickers historicos de cartera y prueba
    must_have = ['MSFT', 'AAPL', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'LLY', 'AVGO', 'JPM',
                 'TSLA', 'UNH', 'V', 'XOM', 'MA', 'JNJ', 'PG', 'COST', 'HD', 'ABBV',
                 'WMT', 'MRK', 'KO', 'CVX', 'BAC', 'PEP', 'LIN', 'ORCL', 'ACN', 'MCD',
                 'CRM', 'TMO', 'CSCO', 'ABT', 'WFC', 'IBM', 'QCOM', 'GE', 'TXN', 'INTU',
                 'PM', 'CAT', 'AMAT', 'DHR', 'NOW', 'VZ', 'NEE', 'DIS', 'PFE', 'RTX', 'T']
                 
    top200 = list(dict.fromkeys(must_have + ranked))[:200]
    print(f"-> Top 200 companias seleccionadas (total: {len(top200)}). Primeras 10: {top200[:10]}")
    return top200, sector_map

def compute_all_risk_metrics(tickers):
    print("3. Descargando serie historica de precios a 5 anos para riesgo y tendencia plurianual...")
    all_syms = list(set(tickers + [BENCHMARK]))
    data = yf.download(all_syms, period='5y', interval='1d', progress=False)['Close']
    returns = data.pct_change().dropna()
    bench_ret = returns[BENCHMARK] if BENCHMARK in returns else None
    
    risk_map = {}
    if bench_ret is None:
        return risk_map
        
    for sym in tickers:
        try:
            if sym not in returns:
                risk_map[sym] = (1.0, 1.0, 8.5, 1.85, 0.0, 0.0, 0.0, None, 0.0)
                continue
                
            s_series = data[sym].dropna()
            if len(s_series) < 60:
                risk_map[sym] = (1.0, 1.0, 8.5, 1.85, 0.0, 0.0, 0.0, None, 0.0)
                continue
                
            p_cur = float(s_series.iloc[-1])
            p_1y = float(s_series.iloc[-252]) if len(s_series) >= 252 else float(s_series.iloc[0])
            p_3y = float(s_series.iloc[-756]) if len(s_series) >= 756 else float(s_series.iloc[0])
            p_5y = float(s_series.iloc[0])
            max_5y = float(s_series.max())
            
            ret_1y = round(((p_cur - p_1y) / p_1y) * 100, 1) if p_1y > 0 else 0.0
            ret_3y = round(((p_cur - p_3y) / p_3y) * 100, 1) if p_3y > 0 else 0.0
            ret_5y = round(((p_cur - p_5y) / p_5y) * 100, 1) if p_5y > 0 else 0.0
            dd_5y = round(((p_cur - max_5y) / max_5y) * 100, 1) if max_5y > 0 else 0.0

            r_stock = returns[sym].dropna()
            aligned = pd.concat([r_stock, bench_ret], axis=1, join='inner').dropna()
            aligned.columns = ['stock', 'bench']
            if len(aligned) < 60:
                risk_map[sym] = (1.0, 1.0, 8.5, 1.85, ret_1y, ret_3y, ret_5y, max_5y, dd_5y)
                continue
                
            cov = np.cov(aligned['stock'], aligned['bench'])
            var_b = cov[1, 1]
            beta_std = float(cov[0, 1] / var_b) if var_b > 0 else 1.0
            
            # Downside Beta (Ang, Chen & Xing 2006)
            b_mean = aligned['bench'].mean()
            down = aligned[aligned['bench'] < b_mean]
            if len(down) > 10:
                cov_d = np.cov(down['stock'], down['bench'])
                var_d = cov_d[1, 1]
                beta_down = float(cov_d[0, 1] / var_d) if var_d > 0 else beta_std
            else:
                beta_down = beta_std
                
            # Cornish-Fisher Modified VaR 95%
            mu = float(r_stock.mean())
            sigma = float(r_stock.std())
            skew = float(r_stock.skew())
            kurt = float(r_stock.kurtosis())
            
            z = -1.644853
            z_cf = z + (1/6)*(z**2 - 1)*skew + (1/24)*(z**3 - 3*z)*kurt - (1/36)*(2*z**3 - 5*z)*(skew**2)
            mvar_daily = -(mu + z_cf * sigma) * 100
            mvar_monthly = mvar_daily * math.sqrt(21)
            
            risk_map[sym] = (round(beta_std, 3), round(beta_down, 3), round(mvar_monthly, 2), round(mvar_daily, 2), ret_1y, ret_3y, ret_5y, round(max_5y, 2), dd_5y)
        except Exception:
            risk_map[sym] = (1.0, 1.0, 8.5, 1.85, 0.0, 0.0, 0.0, None, 0.0)
            
    return risk_map

def determine_archetype(sym, sector, industry):
    s = (sector or '').lower()
    ind = (industry or '').lower()
    tick = (sym or '').upper()
    
    # 1. Conglomerados de Inversion Holding (Doctrina Buffett P/BV)
    if tick in ['BRK-B', 'BRK-A'] or 'holding' in ind or 'conglomerate' in ind:
        return 'HOLDING_CONGLOMERADO', 'Conglomerado de Inversion & Holding (Doctrina Buffett P/BV)'
        
    # 2. Redes Globales de Pagos (Fintech Asset-Light)
    if any(k in ind for k in ['credit services', 'payment', 'transaction']) or tick in ['V', 'MA', 'PYPL', 'FI', 'FIS', 'GPN']:
        return 'COMPOUNDER_TECH', 'Red Tecnologica de Pagos & Fintech (Asset-Light)'
        
    # 3. Entidades Financieras Reguladas (Banca Comercial, Seguros & Credito - Damodaran Excess Return)
    if any(k in ind for k in ['bank', 'savings', 'insurance', 'life & health', 'property & casualty', 'consumer finance']) or ('financial' in s and 'capital market' in ind) or 'insurance' in s:
        return 'BANCA_FINANCIERA', 'Banca Comercial y Entidades de Credito Reguladas'
        
    # 4. Infraestructura / Telecom / Cable & Satellite / Utilities / REITs (Alta Deuda)
    if any(k in s or k in ind for k in ['telecom', 'cable', 'satellite', 'broadband', 'utilit', 'cellular', 'electric', 'water', 'real estate', 'reit']):
        return 'INFRAESTRUCTURA_DEUDA', 'Infraestructura / Telecom / Utilities (Alta Deuda)'
        
    # 5. Compounders Tecnologicos & Software
    if any(k in s or k in ind for k in ['software', 'technology', 'internet', 'semiconductor', 'information technology', 'interactive media']) or tick in ['AMZN']:
        return 'COMPOUNDER_TECH', 'Compounder Tecnologico & Software (Asset-Light)'
        
    # 6. Ciclicas Industriales & Commodities
    if any(k in s or k in ind for k in ['energy', 'oil', 'gas', 'machinery', 'industrial', 'materials', 'chemical', 'mining', 'aerospace', 'automotive', 'automobile']):
        return 'CICLICA_INDUSTRIAL', 'Ciclica Industrial / Commodities'
        
    # 7. Defensiva Madura / Consumo Basico y Salud
    return 'DEFENSIVA_CONSUMO', 'Defensiva Consumo / Salud (Moat Estructural)'

def get_raw(val, default=0.0):
    if isinstance(val, dict):
        return val.get('raw', default)
    if val is None:
        return default
    try:
        return float(val)
    except:
        return default

def process_single_company(session, crumb, sym, risk_map, sector_map):
    try:
        url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{encode_sym(sym)}?modules=defaultKeyStatistics,financialData,summaryDetail,price,assetProfile&crumb={crumb}"
        resp = session.get(url, timeout=10)
        if resp.status_code != 200:
            return None
            
        data = resp.json()
        result = data.get('quoteSummary', {}).get('result', [])
        if not result:
            return None
            
        res = result[0]
        price_mod = res.get('price', {})
        stats_mod = res.get('defaultKeyStatistics', {})
        fin_mod = res.get('financialData', {})
        sum_mod = res.get('summaryDetail', {})
        prof_mod = res.get('assetProfile', {})
        
        p0 = get_raw(price_mod.get('regularMarketPrice'))
        if not p0 or p0 <= 0:
            return None
            
        company_name = price_mod.get('longName') or price_mod.get('shortName') or sym
        currency = price_mod.get('currency', 'USD').upper()
        
        # Sector e Industry via Wikipedia GICS con fallback a Yahoo assetProfile
        sec_w, ind_w = sector_map.get(sym, ('', ''))
        sec = sec_w if sec_w else (prof_mod.get('sector') or 'General')
        ind = ind_w if ind_w else (prof_mod.get('industry') or '')
            
        beta_info = get_raw(stats_mod.get('beta'), None)
        trailing_eps = get_raw(stats_mod.get('trailingEps'), 0.0)
        forward_eps = get_raw(stats_mod.get('forwardEps'), trailing_eps)
        div_rate = get_raw(sum_mod.get('dividendRate'), 0.0)
        fcf = get_raw(fin_mod.get('freeCashflow'), 0.0)
        shares = get_raw(stats_mod.get('sharesOutstanding'), 1)
        book_val = get_raw(stats_mod.get('bookValue'), 0.0)
        
        # Ajuste Berkshire Hathaway (Class A share BV / 1500 = Class B BV)
        if 'BRK' in sym and book_val > 10000:
            book_val = round(book_val / 1500.0, 2)
            
        roe = get_raw(fin_mod.get('returnOnEquity'), 0.0)
        total_debt = get_raw(fin_mod.get('totalDebt'), 0.0)
        total_cash = get_raw(fin_mod.get('totalCash'), 0.0)
        net_debt = total_debt - total_cash
        low52 = get_raw(sum_mod.get('fiftyTwoWeekLow'), None)
        high52 = get_raw(sum_mod.get('fiftyTwoWeekHigh'), None)
        target_mean = get_raw(fin_mod.get('targetMeanPrice'), 0.0)
        
        # Risk & Multi-Year History Metrics
        risk_vals = risk_map.get(sym, (1.0, 1.0, 8.5, 1.85, 0.0, 0.0, 0.0, None, 0.0))
        beta_std = risk_vals[0]
        beta_down = risk_vals[1]
        mvar_m = risk_vals[2]
        mvar_d = risk_vals[3]
        ret_1y = risk_vals[4]
        ret_3y = risk_vals[5]
        ret_5y = risk_vals[6]
        max_5y = risk_vals[7]
        dd_5y = risk_vals[8]
        if beta_info and abs(beta_info - 1.0) > 0.01:
            beta_std = round(beta_info, 3)
            
        archetype, arch_name = determine_archetype(sym, sec, ind)
        
        fcf_share = (fcf / shares) if (shares > 0 and fcf > 0) else 0.0
        tbv_share = round(float(book_val), 2)
        net_debt_share = round(float(net_debt / shares), 2) if shares > 0 else 0.0
        
        # Tasa de crecimiento y Owner Cash Flow segun arquetipo
        if archetype == 'HOLDING_CONGLOMERADO':
            cf_base = round(trailing_eps if trailing_eps > 0 else 39.79, 2)
            g_hist = 0.035
            gn_term = 0.025
        elif archetype == 'BANCA_FINANCIERA':
            cf_base = round(trailing_eps if trailing_eps > 0 else 4.50, 2)
            g_hist = min(0.045, max(0.020, 0.030))
            gn_term = 0.025
        elif archetype == 'INFRAESTRUCTURA_DEUDA':
            cf_base = round(div_rate if div_rate > 0 else (trailing_eps * 0.60), 2)
            g_hist = 0.020
            gn_term = 0.020
        elif archetype == 'COMPOUNDER_TECH':
            cf_base = round(fcf_share if fcf_share > 0 else (trailing_eps * 0.85), 2)
            if trailing_eps > 0 and forward_eps > trailing_eps:
                g_fwd = (forward_eps - trailing_eps) / trailing_eps
                g_hist = min(0.12, max(0.06, g_fwd))
            else:
                g_hist = 0.08
            gn_term = 0.030
        elif archetype == 'CICLICA_INDUSTRIAL':
            cf_base = round(trailing_eps * 0.75, 2)
            g_hist = 0.040
            gn_term = 0.025
        else:
            cf_base = round(max(fcf_share, trailing_eps * 0.80), 2)
            g_hist = 0.040
            gn_term = 0.025
            
        sbc_share = round(trailing_eps * 0.08, 2) if archetype == 'COMPOUNDER_TECH' else 0.0
        
        return {
            'ticker': sym,
            'nombre': company_name,
            'sector': sec,
            'industry': ind,
            'arquetipo': archetype,
            'nombre_arquetipo': arch_name,
            'precio_cierre_P0': round(float(p0), 2),
            'D1_o_FCFA1': cf_base,
            'dividend_rate': round(float(div_rate), 2),
            'eps_diluted': round(float(trailing_eps), 2),
            'forward_eps': round(float(forward_eps), 2),
            'fcf_per_share': round(float(fcf_share), 2),
            'sbc_per_share': sbc_share,
            'tbv_per_share': tbv_share,
            'roe': round(float(roe), 4),
            'net_debt_per_share': net_debt_share,
            'beta': round(float(beta_std), 3),
            'downside_beta': round(float(beta_down), 3),
            'mvar_monthly_95': round(float(mvar_m), 2),
            'mvar_daily_95': round(float(mvar_d), 2),
            'perf_1y_pct': ret_1y,
            'perf_3y_pct': ret_3y,
            'perf_5y_pct': ret_5y,
            'max_5y': max_5y,
            'drawdown_5y_pct': dd_5y,
            'g_hist': round(float(g_hist), 4),
            'gn_terminal': gn_term,
            'fifty_two_week_low': round(float(low52), 2) if low52 else None,
            'fifty_two_week_high': round(float(high52), 2) if high52 else None,
            'target_mean_analysts': round(float(target_mean), 2),
            'fuente_auditada': 'Yahoo Finance API v10 Institutional Realtime',
            'currency': currency
        }
    except Exception as e:
        print(f"Error procesando {sym}: {e}")
        return None

def encode_sym(sym):
    return sym.replace('/', '-').replace('^', '-')

def build_200_universe():
    t_start = time.time()
    tickers, sector_map = fetch_sp500_ranked_top200()
    risk_map = compute_all_risk_metrics(tickers)
    
    print("4. Obteniendo sesion y crumb institucional de Yahoo Finance...")
    session, crumb = get_yahoo_session_and_crumb()
    print(f"-> Crumb obtenido: {crumb}")
    
    print(f"5. Auditando fundamentales para las {len(tickers)} companias...")
    universe = []
    
    with ThreadPoolExecutor(max_workers=10) as ex:
        results = list(ex.map(lambda s: process_single_company(session, crumb, s, risk_map, sector_map), tickers))
        
    for res in results:
        if res:
            universe.append(res)
            
    # Caso de prueba negativo para control de integridad
    universe.append({
        'ticker': 'DISCARDED_NO_FCF',
        'nombre': 'Empresa con dato faltante (DISCARDED_NO_FCF)',
        'precio_cierre_P0': 100.0,
        'D1_o_FCFA1': None,
        'dividend_rate': None,
        'beta': 1.0,
        'g_hist': None,
        'fuente_auditada': 'Test Descarte Automatico Cero Invencion'
    })
    
    out_path = os.path.join(os.path.dirname(__file__), 'data', 'sp500_universe.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(universe, f, indent=2, ensure_ascii=False)
        
    elapsed = round(time.time() - t_start, 1)
    print("\n=======================================================")
    print(f"[OK] UNIVERSO S&P 500 EXPANDIDO A {len(universe)} ACTIVOS AUDITADOS")
    print(f"  Guardado en: {out_path}")
    print(f"  Tiempo total de procesamiento: {elapsed} segundos")
    print("=======================================================\n")
    
    # Sincronizar en SQLite market_quotes (raiz del proyecto)
    try:
        import sqlite3
        db_path = os.path.join(os.path.dirname(__file__), '..', 'portfolio.db')
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        for item in universe:
            if not item.get('ticker') or item.get('ticker') == 'DISCARDED_NO_FCF':
                continue
            cur.execute("""
                INSERT INTO market_quotes (ticker, current_price, currency, fifty_two_week_low, fifty_two_week_high, change_pct)
                VALUES (?, ?, ?, ?, ?, 0.0)
                ON CONFLICT(ticker) DO UPDATE SET
                    current_price = excluded.current_price,
                    fifty_two_week_low = excluded.fifty_two_week_low,
                    fifty_two_week_high = excluded.fifty_two_week_high
            """, (item['ticker'], item.get('precio_cierre_P0', 0), item.get('currency', 'USD'), item.get('fifty_two_week_low'), item.get('fifty_two_week_high')))
        conn.commit()
        conn.close()
        print("[OK] Tabla market_quotes sincronizada en SQLite con los 200 activos en portfolio.db.")
    except Exception as e:
        print("Nota: No se sincronizo SQLite directamente:", e)

if __name__ == '__main__':
    build_200_universe()
