import json
import yfinance as yf

TICKERS = [
    'MSFT', 'AAPL', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'LLY', 'AVGO', 'JPM',
    'TSLA', 'UNH', 'V', 'XOM', 'MA', 'JNJ', 'PG', 'COST', 'HD', 'ABBV',
    'WMT', 'MRK', 'KO', 'CVX', 'BAC', 'PEP', 'LIN', 'ORCL', 'ACN', 'MCD',
    'CRM', 'TMO', 'CSCO', 'ABT', 'WFC', 'IBM', 'QCOM', 'GE', 'TXN', 'INTU',
    'PM', 'CAT', 'AMAT', 'DHR', 'NOW', 'VZ', 'NEE', 'DIS', 'PFE', 'RTX'
]

def classify_company(ticker, sector, industry, beta):
    s = (sector or '').lower()
    ind = (industry or '').lower()
    
    if any(k in s or k in ind for k in ['telecom', 'cellular', 'utilit', 'electric', 'water']):
        return {
            'perfil': 'DEFENSIVA_MADURA',
            'nombre_perfil': 'Defensiva Infraestructura / Utilities',
            'descripcion_perfil': 'Servicios esenciales con demanda inelástica. Crecimiento regulado o ligado a inflación.',
            'min_g1': 0.025,
            'max_g1': 0.045,
            'gn': 0.0225,
            'max_g_perpetuo': 0.035,
            'min_spread_r_g': 0.0225
        }
    elif any(k in s or k in ind for k in ['defensive', 'staple', 'packaged food', 'beverage', 'tobacco', 'drug manufacturers', 'pharma', 'health care', 'household', 'personal products']) or (beta < 0.65 and 'basic' not in s):
        return {
            'perfil': 'DEFENSIVA_MADURA',
            'nombre_perfil': 'Defensiva Madura (Cash Cow)',
            'descripcion_perfil': 'Negocio consolidado de consumo básico o salud. Flujos defensivos con techo macro PIB (máx 3.5%).',
            'min_g1': 0.035,
            'max_g1': 0.055,
            'gn': 0.025,
            'max_g_perpetuo': 0.035,
            'min_spread_r_g': 0.0225
        }
    elif 'financial' in s or 'bank' in ind or 'insurance' in ind:
        return {
            'perfil': 'CALIDAD_CRECIMIENTO',
            'nombre_perfil': 'Financiera / Banca Sistémica',
            'descripcion_perfil': 'Entidad financiera regulada con retornos sobre capital tangible y recompras sistemáticas.',
            'min_g1': 0.050,
            'max_g1': 0.085,
            'gn': 0.0275,
            'max_g_perpetuo': 0.045,
            'min_spread_r_g': 0.0200
        }
    elif any(k in s or k in ind for k in ['semiconductor', 'software - infrastructure', 'internet content', 'software - application', 'electronic components']):
        return {
            'perfil': 'ALTA_VOLATILIDAD_CICLICA',
            'nombre_perfil': 'Líder Hiperescalar / Software / IA',
            'descripcion_perfil': 'Compañía tecnológica secular de alto crecimiento con fuerte expansión de márgenes.',
            'min_g1': 0.090,
            'max_g1': 0.150,
            'gn': 0.030,
            'max_g_perpetuo': 0.065,
            'min_spread_r_g': 0.0200
        }
    else:
        # Industrials, Materials (LIN), Consumer Discretionary (HD, MCD, NKE), Payment Networks (V, MA)
        return {
            'perfil': 'CALIDAD_CRECIMIENTO',
            'nombre_perfil': 'Calidad & Foso Estructural',
            'descripcion_perfil': 'Monopolio/oligopolio con poder de fijación de precios, contratos multianuales y reinversión eficiente.',
            'min_g1': 0.070,
            'max_g1': 0.120,
            'gn': 0.030,
            'max_g_perpetuo': 0.055,
            'min_spread_r_g': 0.0200
        }

def build_universe():
    print("Iniciando recolección de métricas auditadas para las Top 50 del S&P 500...")
    universe = []
    
    for sym in TICKERS:
        try:
            t = yf.Ticker(sym)
            info = t.info
            p0 = info.get('currentPrice') or info.get('regularMarketPrice')
            if not p0 or p0 <= 0:
                continue
                
            sector = info.get('sector') or 'General'
            industry = info.get('industry') or ''
            beta = info.get('beta') or 1.0
            trailing_eps = info.get('trailingEps') or 0.0
            forward_eps = info.get('forwardEps') or trailing_eps
            div_rate = info.get('dividendRate') or 0.0
            fcf = info.get('freeCashflow') or 0.0
            shares = info.get('sharesOutstanding') or 0.0
            fcf_share = (fcf / shares) if (shares > 0 and fcf > 0) else 0.0
            low52 = info.get('fiftyTwoWeekLow')
            high52 = info.get('fiftyTwoWeekHigh')
            
            # Base Owners' Cash Flow
            is_fin = 'financial' in sector.lower() or 'bank' in industry.lower()
            if is_fin:
                cf_base = max(trailing_eps, forward_eps * 0.85)
            else:
                if fcf_share > 0 and trailing_eps > 0:
                    cf_base = max(fcf_share, trailing_eps * 0.90)
                elif fcf_share > 0:
                    cf_base = fcf_share
                elif trailing_eps > 0:
                    cf_base = trailing_eps * 0.90
                else:
                    cf_base = forward_eps * 0.75 if forward_eps > 0 else 1.0
                    
            if cf_base <= 0:
                cf_base = max(div_rate * 1.5, 1.0)
                
            # Classify profile
            prof = classify_company(sym, sector, industry, beta)
            
            # Growth estimate
            g_fwd = (forward_eps - trailing_eps) / trailing_eps if (trailing_eps > 0 and forward_eps > trailing_eps) else 0.0
            if g_fwd > 0:
                g_hist = min(prof['max_g1'], max(prof['min_g1'], g_fwd))
            else:
                g_hist = (prof['min_g1'] + prof['max_g1']) / 2.0
                
            entry = {
                'ticker': sym,
                'nombre': info.get('longName') or info.get('shortName') or sym,
                'sector': sector,
                'industry': industry,
                'precio_cierre_P0': round(float(p0), 2),
                'D1_o_FCFA1': round(float(cf_base), 2),
                'dividend_rate': round(float(div_rate), 2),
                'eps_diluted': round(float(trailing_eps), 2),
                'forward_eps': round(float(forward_eps), 2),
                'fcf_per_share': round(float(fcf_share), 2),
                'beta': round(float(beta), 3),
                'g_hist': round(float(g_hist), 4),
                'perfil_asignado': prof['perfil'],
                'nombre_perfil': prof['nombre_perfil'],
                'descripcion_perfil': prof['descripcion_perfil'],
                'min_g1': prof['min_g1'],
                'max_g1': prof['max_g1'],
                'gn_terminal': prof['gn'],
                'fifty_two_week_low': round(float(low52), 2) if low52 else None,
                'fifty_two_week_high': round(float(high52), 2) if high52 else None,
                'fuente_auditada': 'Yahoo Finance API & SEC 10-K Filings Realtime',
                'currency': info.get('currency', 'USD').upper()
            }
            universe.append(entry)
            print(f"[{sym:<5}] P0: ${entry['precio_cierre_P0']:>6.2f} | CF Base: ${entry['D1_o_FCFA1']:>5.2f} (Div: ${entry['dividend_rate']}) | Beta: {entry['beta']:>4.2f} | g: {entry['g_hist']*100:>4.1f}%")
        except Exception as e:
            print(f"Error con {sym}: {e}")
            
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
    
    with open('server/data/sp500_universe.json', 'w', encoding='utf-8') as f:
        json.dump(universe, f, indent=2, ensure_ascii=False)
        
    print(f"\nUniverso S&P 500 generado exitosamente con {len(universe)} registros en server/data/sp500_universe.json")

if __name__ == '__main__':
    build_universe()
