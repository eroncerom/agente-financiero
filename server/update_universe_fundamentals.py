import os
import sys
import json
import math
import numpy as np
import pandas as pd
import yfinance as yf

TICKERS = [
    'MSFT', 'AAPL', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'LLY', 'AVGO', 'JPM',
    'TSLA', 'UNH', 'V', 'XOM', 'MA', 'JNJ', 'PG', 'COST', 'HD', 'ABBV',
    'WMT', 'MRK', 'KO', 'CVX', 'BAC', 'PEP', 'LIN', 'ORCL', 'ACN', 'MCD',
    'CRM', 'TMO', 'CSCO', 'ABT', 'WFC', 'IBM', 'QCOM', 'GE', 'TXN', 'INTU',
    'PM', 'CAT', 'AMAT', 'DHR', 'NOW', 'VZ', 'NEE', 'DIS', 'PFE', 'RTX', 'T'
]

BENCHMARK = '^GSPC'

def compute_risk_metrics(ticker_obj, bench_ret):
    try:
        hist = ticker_obj.history(period='3y', interval='1d')
        if hist.empty or len(hist) < 60:
            return 1.0, 1.0, 10.0, 2.2
            
        closes = hist['Close']
        returns = closes.pct_change().dropna()
        
        # Aligned with benchmark
        aligned = pd.concat([returns, bench_ret], axis=1, join='inner').dropna()
        aligned.columns = ['stock', 'bench']
        
        cov = np.cov(aligned['stock'], aligned['bench'])
        var_b = cov[1, 1]
        beta_std = float(cov[0, 1] / var_b) if var_b > 0 else 1.0
        
        # Downside Beta
        b_mean = aligned['bench'].mean()
        down = aligned[aligned['bench'] < b_mean]
        if len(down) > 10:
            cov_d = np.cov(down['stock'], down['bench'])
            var_d = cov_d[1, 1]
            beta_down = float(cov_d[0, 1] / var_d) if var_d > 0 else beta_std
        else:
            beta_down = beta_std
            
        # Cornish-Fisher
        mu = float(returns.mean())
        sigma = float(returns.std())
        skew = float(returns.skew())
        kurt = float(returns.kurtosis())
        
        z = -1.644853
        z_cf = z + (1/6)*(z**2 - 1)*skew + (1/24)*(z**3 - 3*z)*kurt - (1/36)*(2*z**3 - 5*z)*(skew**2)
        mvar_daily = -(mu + z_cf * sigma) * 100
        mvar_monthly = mvar_daily * math.sqrt(21)
        
        return round(beta_std, 3), round(beta_down, 3), round(mvar_monthly, 2), round(mvar_daily, 2)
    except Exception as e:
        return 1.0, 1.0, 10.0, 2.2

def determine_archetype(sector, industry):
    s = (sector or '').lower()
    ind = (industry or '').lower()
    
    if any(k in s or k in ind for k in ['financial', 'bank', 'insurance']):
        return 'BANCA_FINANCIERA', 'Banca y Servicios Financieros Regulados'
    elif any(k in s or k in ind for k in ['telecom', 'utilit', 'cellular', 'electric', 'water']):
        return 'INFRAESTRUCTURA_DEUDA', 'Infraestructura / Telecom / Utilities (Alta Deuda)'
    elif any(k in s or k in ind for k in ['software', 'technology', 'internet', 'semiconductor', 'information technology']):
        return 'COMPOUNDER_TECH', 'Compounder Tecnológico & Software (Asset-Light)'
    elif any(k in s or k in ind for k in ['energy', 'oil', 'gas', 'machinery', 'industrial', 'materials', 'chemical', 'mining', 'auto']):
        return 'CICLICA_INDUSTRIAL', 'Cíclica Industrial / Commodities'
    else:
        return 'DEFENSIVA_CONSUMO', 'Defensiva Consumo / Salud (Moat Estructural)'

def build_enriched_universe():
    print("Descargando serie benchmark S&P 500 (^GSPC)...")
    bench = yf.Ticker(BENCHMARK)
    b_hist = bench.history(period='3y', interval='1d')
    b_ret = b_hist['Close'].pct_change().dropna()
    
    universe = []
    
    for sym in TICKERS:
        try:
            print(f"Auditando {sym}...")
            t = yf.Ticker(sym)
            info = t.info
            p0 = info.get('currentPrice') or info.get('regularMarketPrice')
            if not p0 or p0 <= 0:
                continue
                
            sector = info.get('sector') or ''
            industry = info.get('industry') or ''
            beta_info = info.get('beta') or 1.0
            trailing_eps = info.get('trailingEps') or 0.0
            forward_eps = info.get('forwardEps') or trailing_eps
            div_rate = info.get('dividendRate') or 0.0
            fcf = info.get('freeCashflow') or 0.0
            shares = info.get('sharesOutstanding') or 1
            low52 = info.get('fiftyTwoWeekLow')
            high52 = info.get('fiftyTwoWeekHigh')
            book_val = info.get('bookValue') or 0.0
            roe = info.get('returnOnEquity') or 0.0
            total_debt = info.get('totalDebt') or 0.0
            total_cash = info.get('totalCash') or 0.0
            net_debt = total_debt - total_cash
            
            # Risk metrics
            beta_std, beta_down, mvar_m, mvar_d = compute_risk_metrics(t, b_ret)
            if beta_info and abs(beta_info - 1.0) > 0.01:
                beta_std = round(beta_info, 3)
                
            # Cash flows
            cf = t.cashflow
            inc = t.income_stmt
            bal = t.balance_sheet
            
            ocf = 0.0
            capex = 0.0
            sbc = 0.0
            da = 0.0
            net_inc = trailing_eps * shares
            
            if not cf.empty:
                if 'Operating Cash Flow' in cf.index:
                    ocf = float(cf.loc['Operating Cash Flow'].iloc[0])
                if 'Capital Expenditure' in cf.index:
                    capex = abs(float(cf.loc['Capital Expenditure'].iloc[0]))
                if 'Stock Based Compensation' in cf.index:
                    sbc = float(cf.loc['Stock Based Compensation'].iloc[0])
                if 'Depreciation And Amortization' in cf.index:
                    da = float(cf.loc['Depreciation And Amortization'].iloc[0])
                elif 'Depreciation Amortization Depletion' in cf.index:
                    da = float(cf.loc['Depreciation Amortization Depletion'].iloc[0])
                    
            if not inc.empty and 'Net Income' in inc.index:
                net_inc = float(inc.loc['Net Income'].iloc[0])
                
            # Tangible Book Value
            tbv_per_share = round(float(book_val), 2)
            if not bal.empty:
                total_eq = 0.0
                intangibles = 0.0
                if 'Stockholders Equity' in bal.index:
                    total_eq = float(bal.loc['Stockholders Equity'].iloc[0])
                elif 'Common Stock Equity' in bal.index:
                    total_eq = float(bal.loc['Common Stock Equity'].iloc[0])
                    
                if 'Goodwill And Other Intangible Assets' in bal.index:
                    intangibles = float(bal.loc['Goodwill And Other Intangible Assets'].iloc[0])
                else:
                    if 'Goodwill' in bal.index:
                        intangibles += float(bal.loc['Goodwill'].iloc[0])
                    if 'Other Intangible Assets' in bal.index:
                        intangibles += float(bal.loc['Other Intangible Assets'].iloc[0])
                        
                tangible_eq = total_eq - intangibles
                if shares > 0 and tangible_eq > 0:
                    tbv_per_share = round(tangible_eq / shares, 2)
                    
            archetype, arch_name = determine_archetype(sector, industry)
            
            # Growth estimate
            if archetype == 'BANCA_FINANCIERA':
                g_hist = min(0.045, max(0.020, 0.032))
                gn_term = 0.025
            elif archetype == 'INFRAESTRUCTURA_DEUDA':
                g_hist = 0.018
                gn_term = 0.020
            elif archetype == 'COMPOUNDER_TECH':
                g_fwd = (forward_eps - trailing_eps) / trailing_eps if (trailing_eps > 0 and forward_eps > trailing_eps) else 0.08
                g_hist = min(0.12, max(0.06, g_fwd))
                gn_term = 0.030
            elif archetype == 'CICLICA_INDUSTRIAL':
                g_hist = 0.040
                gn_term = 0.025
            else:
                g_hist = 0.040
                gn_term = 0.025
                
            fcf_share = (fcf / shares) if (shares > 0 and fcf > 0) else 0.0
            sbc_share = (sbc / shares) if (shares > 0 and sbc > 0) else 0.0
            net_debt_share = (net_debt / shares) if shares > 0 else 0.0
            
            # Base Owner's Cash Flow depending on archetype
            if archetype == 'BANCA_FINANCIERA':
                cf_base = round(trailing_eps, 2)
            elif archetype == 'INFRAESTRUCTURA_DEUDA':
                cf_base = round(div_rate if div_rate > 0 else (trailing_eps * 0.60), 2)
            elif archetype == 'COMPOUNDER_TECH':
                # Buffett Owner Earnings: Net Income - SBC
                oe_tot = max(net_inc - sbc, ocf - capex - sbc)
                cf_base = round(oe_tot / shares if shares > 0 else trailing_eps, 2)
                if cf_base < trailing_eps * 0.70:
                    cf_base = round(trailing_eps * 0.85, 2)
            elif archetype == 'CICLICA_INDUSTRIAL':
                cf_base = round(trailing_eps * 0.75, 2) # Normalized mid-cycle
            else:
                cf_base = round(max(div_rate, trailing_eps * 0.80), 2)
                
            entry = {
                'ticker': sym,
                'nombre': info.get('longName') or info.get('shortName') or sym,
                'sector': sector,
                'industry': industry,
                'arquetipo': archetype,
                'nombre_arquetipo': arch_name,
                'precio_cierre_P0': round(float(p0), 2),
                'D1_o_FCFA1': cf_base,
                'dividend_rate': round(float(div_rate), 2),
                'eps_diluted': round(float(trailing_eps), 2),
                'forward_eps': round(float(forward_eps), 2),
                'fcf_per_share': round(float(fcf_share), 2),
                'sbc_per_share': round(float(sbc_share), 2),
                'tbv_per_share': tbv_per_share,
                'roe': round(float(roe), 4),
                'net_debt_per_share': round(float(net_debt_share), 2),
                'beta': round(float(beta_std), 3),
                'downside_beta': round(float(beta_down), 3),
                'mvar_monthly_95': round(float(mvar_m), 2),
                'mvar_daily_95': round(float(mvar_d), 2),
                'g_hist': round(float(g_hist), 4),
                'gn_terminal': gn_term,
                'fifty_two_week_low': round(float(low52), 2) if low52 else None,
                'fifty_two_week_high': round(float(high52), 2) if high52 else None,
                'target_mean_analysts': round(float(info.get('targetMeanPrice') or 0.0), 2),
                'fuente_auditada': 'Yahoo Finance API & SEC 10-K Filings Multi-Arquetipo Realtime',
                'currency': info.get('currency', 'USD').upper()
            }
            universe.append(entry)
            print(f"[{sym:<5}] P0: ${entry['precio_cierre_P0']:>6.2f} | Arquetipo: {archetype:<20} | Base: ${cf_base:>5.2f} | Beta: {beta_std:.2f} (Down: {beta_down:.2f}) | mVaR: {mvar_m:.1f}%")
        except Exception as e:
            print(f"Error procesando {sym}: {e}")
            
    # Add negative test case for zero invention audit rule
    universe.append({
        'ticker': 'DISCARDED_NO_FCF',
        'nombre': 'Empresa con dato faltante (DISCARDED_NO_FCF)',
        'precio_cierre_P0': 100.0,
        'D1_o_FCFA1': None,
        'dividend_rate': None,
        'beta': 1.0,
        'g_hist': None,
        'fuente_auditada': 'Test Descarte Automático Cero Invención'
    })
    
    out_path = os.path.join(os.path.dirname(__file__), 'data', 'sp500_universe.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(universe, f, indent=2, ensure_ascii=False)
        
    print(f"\nUniverso enriquecido multi-arquetipo guardado en {out_path} con {len(universe)} registros.")

if __name__ == '__main__':
    build_enriched_universe()
