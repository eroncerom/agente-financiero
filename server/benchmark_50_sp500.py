import json
import math
import sys
import yfinance as yf

# Top 50 S&P 500 Tickers
TICKERS = [
    'MSFT', 'AAPL', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'LLY', 'AVGO', 'JPM',
    'TSLA', 'UNH', 'V', 'XOM', 'MA', 'JNJ', 'PG', 'COST', 'HD', 'ABBV',
    'WMT', 'MRK', 'KO', 'CVX', 'BAC', 'PEP', 'LIN', 'ORCL', 'ACN', 'MCD',
    'CRM', 'TMO', 'CSCO', 'ABT', 'WFC', 'IBM', 'QCOM', 'GE', 'TXN', 'INTU',
    'PM', 'CAT', 'AMAT', 'DHR', 'NOW', 'VZ', 'NEE', 'DIS', 'PFE', 'RTX'
]

RF = 0.0410  # 4.10% US 10-Year Treasury
ERP = 0.055  # 5.50% Equity Risk Premium

def calculate_capm(beta):
    b = beta if (beta is not None and beta > 0.2) else 1.0
    # Clamping beta within reasonable market bounds
    b = min(max(b, 0.55), 1.65)
    return RF + (b * ERP)

def classify_profile_and_growth(ticker_sym, sector, industry, beta, trailing_eps, forward_eps):
    s = (sector or '').lower()
    ind = (industry or '').lower()
    
    # Estimate growth from Forward EPS vs Trailing EPS if positive
    g_forward = 0.0
    if trailing_eps > 0 and forward_eps > trailing_eps:
        g_forward = (forward_eps - trailing_eps) / trailing_eps
        
    is_telecom_utility = any(k in s or k in ind for k in ['telecom', 'cellular', 'utilit', 'electric', 'water', 'gas utility'])
    is_staple_health = any(k in s or k in ind for k in ['staple', 'consum', 'health', 'pharma', 'food', 'beverage', 'tobacco'])
    is_financial = 'financial' in s or 'bank' in ind or 'insurance' in ind
    is_consulting = 'consulting' in ind or 'it services' in ind
    is_semis_hyperscale = any(k in s or k in ind for k in ['semiconductor', 'software - infrastructure', 'internet content', 'software - application'])
    
    if is_telecom_utility:
        profile = 'DEFENSIVA_INFRAESTRUCTURA'
        min_g1, max_g1 = 0.025, 0.045
        gn = 0.0225
    elif is_staple_health:
        profile = 'DEFENSIVA_MADURA'
        min_g1, max_g1 = 0.040, 0.065
        gn = 0.025
    elif is_financial:
        profile = 'FINANCIERA_BANCARIA'
        min_g1, max_g1 = 0.050, 0.080
        gn = 0.0275
    elif is_consulting:
        profile = 'SERVICIOS_CONSULTORIA'
        min_g1, max_g1 = 0.060, 0.090
        gn = 0.0275
    elif is_semis_hyperscale:
        profile = 'TECH_ALTO_CRECIMIENTO'
        min_g1, max_g1 = 0.090, 0.145
        gn = 0.030
    else:
        # Industrials, Materials (e.g. Linde LIN), Consumer Discretionary
        profile = 'CALIDAD_CRECIMIENTO'
        min_g1, max_g1 = 0.070, 0.115
        gn = 0.030
        
    # Calibrate g1: combine forward expectation and profile boundaries
    if g_forward > 0:
        g1 = min(max_g1, max(min_g1, g_forward))
    else:
        g1 = (min_g1 + max_g1) / 2.0
        
    return profile, g1, gn

def run_two_stage_dcf(cf_base, r, g1, gn, n=5):
    # Stage 1: Explicit Competitive Advantage Growth Period (5 years)
    pv_stage1 = 0.0
    cf_t = cf_base
    for t in range(1, n + 1):
        cf_t = cf_t * (1.0 + g1)
        pv_stage1 += cf_t / ((1.0 + r) ** t)
    
    # Stage 2: Terminal Perpetual Value at Year n (Damodaran DCF)
    spread = max(0.0225, r - gn)
    cf_terminal_next = cf_t * (1.0 + gn)
    tv_n = cf_terminal_next / spread
    pv_tv = tv_n / ((1.0 + r) ** n)
    
    return pv_stage1 + pv_tv

def evaluate_ticker(ticker_sym):
    try:
        t = yf.Ticker(ticker_sym)
        info = t.info
        
        p0 = info.get('currentPrice') or info.get('regularMarketPrice')
        if not p0 or p0 <= 0:
            return None
            
        beta = info.get('beta') or 1.0
        sector = info.get('sector') or 'General'
        industry = info.get('industry') or ''
        trailing_eps = info.get('trailingEps') or 0.0
        forward_eps = info.get('forwardEps') or trailing_eps
        div_rate = info.get('dividendRate') or 0.0
        fcf = info.get('freeCashflow') or 0.0
        shares = info.get('sharesOutstanding') or 0.0
        low52 = info.get('fiftyTwoWeekLow')
        high52 = info.get('fiftyTwoWeekHigh')
        
        fcf_per_share = (fcf / shares) if (shares > 0 and fcf > 0) else 0.0
        
        # Determine Owners' Cash Flow Base (Damodaran & Buffett Owner Earnings)
        is_financial = 'financial' in sector.lower() or 'bank' in industry.lower()
        if is_financial:
            cf_base = max(trailing_eps, forward_eps * 0.85)
        else:
            if fcf_per_share > 0 and trailing_eps > 0:
                cf_base = max(fcf_per_share, trailing_eps * 0.90)
            elif fcf_per_share > 0:
                cf_base = fcf_per_share
            elif trailing_eps > 0:
                cf_base = trailing_eps * 0.90
            else:
                cf_base = forward_eps * 0.75 if forward_eps > 0 else 1.0
                
        if cf_base <= 0:
            cf_base = max(div_rate * 1.5, 1.0)
            
        # CAPM discount rate
        r = calculate_capm(beta)
        
        # Profile and Growth
        profile, g1, gn = classify_profile_and_growth(ticker_sym, sector, industry, beta, trailing_eps, forward_eps)
        
        # 1. Old Model: Gordon DDM with Dividend only
        old_g = min(0.035, r - 0.0225)
        old_div = div_rate if div_rate > 0 else 0.01
        old_fv = old_div / max(0.01, r - old_g)
        old_mos30 = old_fv * 0.70
        old_disc = ((old_fv - p0) / p0) * 100
        
        # 2. New Model: Two-Stage Owners' Earnings / FCFE DCF
        new_fv = run_two_stage_dcf(cf_base, r, g1, gn, n=5)
        new_mos20 = new_fv * 0.80
        new_mos30 = new_fv * 0.70
        new_disc = ((new_fv - p0) / p0) * 100
        mos20_disc = ((new_mos20 - p0) / p0) * 100
        mos30_disc = ((new_mos30 - p0) / p0) * 100
        
        # Check if Fair Value is within or near 52-week trading range
        within_52w = False
        if low52 and high52:
            within_52w = (new_fv >= low52 * 0.85) and (new_fv <= high52 * 1.25)
            
        return {
            'ticker': ticker_sym,
            'name': info.get('shortName') or ticker_sym,
            'sector': sector,
            'industry': industry,
            'profile': profile,
            'p0': round(p0, 2),
            'low52': round(low52, 2) if low52 else None,
            'high52': round(high52, 2) if high52 else None,
            'beta': round(beta, 2),
            'r': round(r * 100, 2),
            'div_rate': round(div_rate, 2),
            'eps': round(trailing_eps, 2),
            'fcf_share': round(fcf_per_share, 2),
            'cf_base': round(cf_base, 2),
            'g1': round(g1 * 100, 1),
            'gn': round(gn * 100, 1),
            'old_fv': round(old_fv, 2),
            'old_mos30': round(old_mos30, 2),
            'old_disc': round(old_disc, 1),
            'new_fv': round(new_fv, 2),
            'new_mos20': round(new_mos20, 2),
            'new_mos30': round(new_mos30, 2),
            'new_disc': round(new_disc, 1),
            'mos20_disc': round(mos20_disc, 1),
            'mos30_disc': round(mos30_disc, 1),
            'within_52w': within_52w
        }
    except Exception as e:
        print(f"Error processing {ticker_sym}: {e}", file=sys.stderr)
        return None

def main():
    print(f"=== BARRIDO Y BENCHMARK EMPÍRICO CALIBRADO TOP 50 S&P 500 ===")
    print(f"Bono 10Y Rf: {RF*100:.2f}% | ERP: {ERP*100:.2f}%\n")
    
    results = []
    for sym in TICKERS:
        res = evaluate_ticker(sym)
        if res:
            results.append(res)
            print(f"[{res['ticker']:<5}] P0: ${res['p0']:>6.2f} | CF: ${res['cf_base']:>5.2f} | g1: {res['g1']:>4.1f}% | r: {res['r']:>4.1f}% -> NEW FV: ${res['new_fv']:>6.2f} (Disc: {res['new_disc']:>5.1f}% | MoS20: ${res['new_mos20']:>6.2f} | MoS30: ${res['new_mos30']:>6.2f})")
    
    print("\n" + "="*80)
    print("DETALLE ESPECÍFICO LINDE (LIN):")
    print("="*80)
    lin = next((r for r in results if r['ticker'] == 'LIN'), None)
    if lin:
        print(f"Cotización Actual P0:     ${lin['p0']}")
        print(f"Rango 52 Semanas:         ${lin['low52']} - ${lin['high52']}")
        print(f"Dividendo Anual (D1):     ${lin['div_rate']}")
        print(f"Trailing EPS:             ${lin['eps']}")
        print(f"FCF por Acción:           ${lin['fcf_share']}")
        print(f"Base Flujo Caja Propiet.: ${lin['cf_base']}")
        print(f"Tasa Descuento r:         {lin['r']}% (Beta: {lin['beta']})")
        print(f"Crecimiento Etapa 1 g1:   {lin['g1']}% (5 años)")
        print(f"Crecimiento Terminal gn:  {lin['gn']}% (Perpetuo)")
        print(f"--- MODELO ANTIGUO (Gordon Solo Dividendo) ---")
        print(f"Fair Value Teórico:       ${lin['old_fv']} (Desfase: {lin['old_disc']}%)")
        print(f"Techo MoS 30%:            ${lin['old_mos30']}")
        print(f"--- MODELO NUEVO (DCF 2-Etapas FCFE/Owners Cash) ---")
        print(f"Fair Value Teórico:       ${lin['new_fv']} (Desfase: {lin['new_disc']}%)")
        print(f"Techo MoS 20%:            ${lin['new_mos20']} (Desfase: {lin['mos20_disc']}%)")
        print(f"Techo MoS 30%:            ${lin['new_mos30']} (Desfase: {lin['mos30_disc']}%)")
        print(f"Alineado con Rango 52W:   {'SÍ' if lin['within_52w'] else 'NO'}")
        
    print("\n" + "="*80)
    print("ESTADÍSTICAS GLOBALES DEL UNIVERSO TOP 50:")
    print("="*80)
    in_range = [r for r in results if r['within_52w']]
    old_absurd = [r for r in results if r['old_disc'] < -60]
    new_absurd = [r for r in results if r['new_disc'] < -60]
    
    print(f"Total compañías analizadas: {len(results)}/50")
    print(f"Compañías con Fair Value alineado al rango realista de cotización (52 semanas): {len(in_range)} de {len(results)} ({len(in_range)/len(results)*100:.1f}%)")
    print(f"Modelo Antiguo: Compañías con infravaloración artificial absurda (> 60% de error): {len(old_absurd)} ({len(old_absurd)/len(results)*100:.1f}%)")
    print(f"Modelo Nuevo DCF: Compañías con infravaloración artificial absurda (> 60% de error): {len(new_absurd)} ({len(new_absurd)/len(results)*100:.1f}%)")
    
    with open('benchmark_results_calibrated_v2.json', 'w') as f:
        json.dump(results, f, indent=2)

if __name__ == '__main__':
    main()
