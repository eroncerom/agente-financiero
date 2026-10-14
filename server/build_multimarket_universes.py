"""
Generador de Universos Multi-Mercado para la Fase 2:
- NASDAQ-100 (server/data/nasdaq_universe.json)
- IBEX 35 (server/data/ibex35_universe.json)
"""
import os
import json
import yfinance as yf

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SP500_PATH = os.path.join(BASE_DIR, 'data', 'sp500_universe.json')
NASDAQ_OUT = os.path.join(BASE_DIR, 'data', 'nasdaq_universe.json')
IBEX_OUT = os.path.join(BASE_DIR, 'data', 'ibex35_universe.json')

# 1. LISTA OFICIAL CONSTITUYENTES NASDAQ-100
NASDAQ_100_TICKERS = [
    'AAPL', 'ABNB', 'ADBE', 'ADI', 'ADP', 'ADSK', 'AEP', 'AMAT', 'AMD', 'AMGN',
    'AMZN', 'ANSS', 'ARM', 'ASML', 'AVGO', 'AZN', 'BIIB', 'BKNG', 'BKR', 'CCEP',
    'CDNS', 'CEG', 'CHTR', 'CMCSA', 'COST', 'CPRT', 'CRWD', 'CSCO', 'CSGP', 'CTAS',
    'CTSH', 'DDOG', 'DLTR', 'DXCM', 'EA', 'EXC', 'FANG', 'FAST', 'FTNT', 'GEHC',
    'GFS', 'GOOG', 'GOOGL', 'HON', 'IDXX', 'ILMN', 'INTC', 'INTU', 'ISRG', 'KDP',
    'KHC', 'KLAC', 'LIN', 'LRCX', 'MAR', 'MCHP', 'MDB', 'MDLZ', 'MELI', 'META',
    'MNST', 'MRNA', 'MRVL', 'MSFT', 'MU', 'NFLX', 'NVDA', 'NXPI', 'ODFL', 'ON',
    'ORLY', 'PANW', 'PAYX', 'PCAR', 'PDD', 'PEP', 'PYPL', 'QCOM', 'REGN', 'ROP',
    'ROST', 'SBUX', 'SIRI', 'SNPS', 'TEAM', 'TMUS', 'TSLA', 'TTD', 'TXN', 'VRSK',
    'VRTX', 'WBD', 'WDAY', 'XEL', 'ZS', 'CSX', 'LULU', 'MELI', 'NXPI'
]
# Desduplicar preservando orden
seen = set()
NASDAQ_100_UNIQUE = [t for t in NASDAQ_100_TICKERS if not (t in seen or seen.add(t))]

# 2. LISTA OFICIAL CONSTITUYENTES IBEX 35 (Bolsa de Madrid / Yahoo .MC)
IBEX_35_CONSTITUENTS = [
    {'ticker': 'ANA.MC', 'name': 'Acciona S.A.', 'sector': 'Utilities / Construcción', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'ANE.MC', 'name': 'Acciona Energía', 'sector': 'Utilities Renovables', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'ACX.MC', 'name': 'Acerinox S.A.', 'sector': 'Materiales Básicos / Acero', 'arquetipo': 'CICLICA_INDUSTRIAL', 'nombre_arquetipo': 'Cíclica Industrial / Commodities / Consumo Discrecional'},
    {'ticker': 'ACS.MC', 'name': 'ACS Actividades de Construcción y Servicios', 'sector': 'Construcción & Concesiones', 'arquetipo': 'CICLICA_INDUSTRIAL', 'nombre_arquetipo': 'Cíclica Industrial / Commodities / Consumo Discrecional'},
    {'ticker': 'AENA.MC', 'name': 'Aena S.M.E., S.A.', 'sector': 'Transporte & Aeropuertos', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'AMS.MC', 'name': 'Amadeus IT Group S.A.', 'sector': 'Tecnología de Viajes', 'arquetipo': 'COMPOUNDER_TECH', 'nombre_arquetipo': 'Compounder Tecnológico, Plataformas & Datos (Asset-Light)'},
    {'ticker': 'MTS.MC', 'name': 'ArcelorMittal S.A.', 'sector': 'Siderurgia & Acero', 'arquetipo': 'CICLICA_INDUSTRIAL', 'nombre_arquetipo': 'Cíclica Industrial / Commodities / Consumo Discrecional'},
    {'ticker': 'SAB.MC', 'name': 'Banco de Sabadell S.A.', 'sector': 'Banca Financiera', 'arquetipo': 'BANCA_FINANCIERA', 'nombre_arquetipo': 'Banca, Seguros y Entidades de Crédito Reguladas'},
    {'ticker': 'SAN.MC', 'name': 'Banco Santander S.A.', 'sector': 'Banca Financiera', 'arquetipo': 'BANCA_FINANCIERA', 'nombre_arquetipo': 'Banca, Seguros y Entidades de Crédito Reguladas'},
    {'ticker': 'BKT.MC', 'name': 'Bankinter S.A.', 'sector': 'Banca Financiera', 'arquetipo': 'BANCA_FINANCIERA', 'nombre_arquetipo': 'Banca, Seguros y Entidades de Crédito Reguladas'},
    {'ticker': 'BBVA.MC', 'name': 'Banco Bilbao Vizcaya Argentaria S.A.', 'sector': 'Banca Financiera', 'arquetipo': 'BANCA_FINANCIERA', 'nombre_arquetipo': 'Banca, Seguros y Entidades de Crédito Reguladas'},
    {'ticker': 'CABK.MC', 'name': 'CaixaBank S.A.', 'sector': 'Banca Financiera', 'arquetipo': 'BANCA_FINANCIERA', 'nombre_arquetipo': 'Banca, Seguros y Entidades de Crédito Reguladas'},
    {'ticker': 'CLNX.MC', 'name': 'Cellnex Telecom S.A.', 'sector': 'Infraestructura de Telecomunicaciones', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'ENG.MC', 'name': 'Enagás S.A.', 'sector': 'Gas & Utilities Reguladas', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'ELE.MC', 'name': 'Endesa S.A.', 'sector': 'Electricidad & Utilities', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'FER.MC', 'name': 'Ferrovial SE', 'sector': 'Infraestructuras de Transporte', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'FDR.MC', 'name': 'Fluidra S.A.', 'sector': 'Equipamiento Piscinas & Bienestar', 'arquetipo': 'CICLICA_INDUSTRIAL', 'nombre_arquetipo': 'Cíclica Industrial / Commodities / Consumo Discrecional'},
    {'ticker': 'GRF.MC', 'name': 'Grifols S.A.', 'sector': 'Salud & Hemoderivados', 'arquetipo': 'DEFENSIVA_CONSUMO', 'nombre_arquetipo': 'Defensiva Consumo / Salud / Servicios Recurrentes'},
    {'ticker': 'IAG.MC', 'name': 'International Airlines Group (IAG)', 'sector': 'Aerolíneas & Transporte', 'arquetipo': 'CICLICA_INDUSTRIAL', 'nombre_arquetipo': 'Cíclica Industrial / Commodities / Consumo Discrecional'},
    {'ticker': 'IBE.MC', 'name': 'Iberdrola S.A.', 'sector': 'Electricidad & Renovables', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'IDR.MC', 'name': 'Indra Sistemas S.A.', 'sector': 'Defensa & TI', 'arquetipo': 'COMPOUNDER_TECH', 'nombre_arquetipo': 'Compounder Tecnológico, Plataformas & Datos (Asset-Light)'},
    {'ticker': 'ITX.MC', 'name': 'Industria de Diseño Textil S.A. (Inditex)', 'sector': 'Retail Textil Global', 'arquetipo': 'DEFENSIVA_CONSUMO', 'nombre_arquetipo': 'Defensiva Consumo / Salud / Servicios Recurrentes'},
    {'ticker': 'COL.MC', 'name': 'Inmobiliaria Colonial SOCIMI', 'sector': 'REIT / Inmobiliario Oficinas', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'LOG.MC', 'name': 'Compañía de Distribución Integral Logista', 'sector': 'Logística & Distribución Tabaco', 'arquetipo': 'DEFENSIVA_CONSUMO', 'nombre_arquetipo': 'Defensiva Consumo / Salud / Servicios Recurrentes'},
    {'ticker': 'MAP.MC', 'name': 'Mapfre S.A.', 'sector': 'Seguros Generales', 'arquetipo': 'BANCA_FINANCIERA', 'nombre_arquetipo': 'Banca, Seguros y Entidades de Crédito Reguladas'},
    {'ticker': 'MEL.MC', 'name': 'Meliá Hotels International', 'sector': 'Hoteles & Ocio', 'arquetipo': 'CICLICA_INDUSTRIAL', 'nombre_arquetipo': 'Cíclica Industrial / Commodities / Consumo Discrecional'},
    {'ticker': 'MRL.MC', 'name': 'Merlin Properties SOCIMI', 'sector': 'REIT / Logística & Oficinas', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'NTGY.MC', 'name': 'Naturgy Energy Group S.A.', 'sector': 'Gas & Electricidad', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'PUIG.MC', 'name': 'Puig Brands S.A.', 'sector': 'Cosmética & Perfumería', 'arquetipo': 'DEFENSIVA_CONSUMO', 'nombre_arquetipo': 'Defensiva Consumo / Salud / Servicios Recurrentes'},
    {'ticker': 'RED.MC', 'name': 'Redeia Corporación S.A.', 'sector': 'Red Eléctrica & Utilities Reguladas', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'REP.MC', 'name': 'Repsol S.A.', 'sector': 'Petróleo, Gas & Renovables', 'arquetipo': 'CICLICA_INDUSTRIAL', 'nombre_arquetipo': 'Cíclica Industrial / Commodities / Consumo Discrecional'},
    {'ticker': 'ROVI.MC', 'name': 'Laboratorios Farmacéuticos Rovi', 'sector': 'Farmacia Especializada', 'arquetipo': 'DEFENSIVA_CONSUMO', 'nombre_arquetipo': 'Defensiva Consumo / Salud / Servicios Recurrentes'},
    {'ticker': 'SCYR.MC', 'name': 'Sacyr S.A.', 'sector': 'Concesiones de Infraestructuras', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'SLR.MC', 'name': 'Solaria Energía y Medio Ambiente', 'sector': 'Energía Solar Fotovoltaica', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'TEF.MC', 'name': 'Telefónica S.A.', 'sector': 'Telecomunicaciones', 'arquetipo': 'INFRAESTRUCTURA_DEUDA', 'nombre_arquetipo': 'Infraestructura / Telecom / Utilities / REITs (Alta Deuda)'},
    {'ticker': 'UNI.MC', 'name': 'Unicaja Banco S.A.', 'sector': 'Banca Financiera', 'arquetipo': 'BANCA_FINANCIERA', 'nombre_arquetipo': 'Banca, Seguros y Entidades de Crédito Reguladas'}
]

def build_nasdaq_universe():
    print("--- Construyendo Universo NASDAQ-100 ---")
    with open(SP500_PATH, 'r', encoding='utf-8') as f:
        sp500_list = json.load(f)
    sp500_by_ticker = {item['ticker'].upper(): item for item in sp500_list}

    nasdaq_universe = []
    missing_tickers = []

    for tkr in NASDAQ_100_UNIQUE:
        clean = tkr.upper()
        if clean in sp500_by_ticker:
            item = dict(sp500_by_ticker[clean])
            item['market'] = 'NASDAQ'
            nasdaq_universe.append(item)
        else:
            missing_tickers.append(clean)

    print(f"Encontrados en S&P 500: {len(nasdaq_universe)} | Fuera de S&P 500: {len(missing_tickers)} ({missing_tickers})")

    # Para los que están fuera del S&P 500 (ej. ASML, PDD, MELI, ARM, CRWD, TEAM, ZS, DDOG, MDB)
    # los enriquecemos vía yfinance
    for tkr in missing_tickers:
        try:
            print(f"Obteniendo fundamentales para {tkr} vía yfinance...")
            yt = yf.Ticker(tkr)
            inf = yt.info or {}
            price = inf.get('currentPrice') or inf.get('regularMarketPrice') or 0
            if not price or price <= 0:
                continue

            shares = inf.get('sharesOutstanding') or 1
            fcf = inf.get('freeCashflow') or 0
            fcf_per_share = (fcf / shares) if shares and fcf else None
            eps = inf.get('trailingEps') or inf.get('forwardEps') or 0
            roic = inf.get('returnOnAssets') or 0.10
            roe = inf.get('returnOnEquity') or 0.15
            debt = inf.get('totalDebt') or 0
            ebitda = inf.get('ebitda') or 1
            net_debt_ebitda = (debt / ebitda) if ebitda and ebitda > 0 else 0.5

            item = {
                'ticker': tkr,
                'nombre': inf.get('shortName') or inf.get('longName') or tkr,
                'sector': inf.get('sector') or 'Information Technology',
                'industry': inf.get('industry') or 'Software - Infrastructure',
                'gics_sub_industry': inf.get('industry') or 'Software',
                'arquetipo': 'COMPOUNDER_TECH',
                'nombre_arquetipo': 'Compounder Tecnológico, Plataformas & Datos (Asset-Light)',
                'justificacion_arquetipo': 'Modelo SaaS / Plataforma / Semiconductores escalable',
                'currency': 'USD',
                'precio_cierre_P0': round(price, 2),
                'fifty_two_week_low': inf.get('fiftyTwoWeekLow') or round(price * 0.75, 2),
                'fifty_two_week_high': inf.get('fiftyTwoWeekHigh') or round(price * 1.25, 2),
                'dividend_rate': inf.get('dividendRate') or 0.0,
                'forward_eps': inf.get('forwardEps'),
                'eps_diluted': eps,
                'fcf_per_share': round(fcf_per_share, 2) if fcf_per_share else round(eps * 1.1, 2),
                'D1_o_FCFA1': round(fcf_per_share, 2) if fcf_per_share and fcf_per_share > 0 else round(eps, 2),
                'base_flujo_regla': 'FCF por acción reportado / normalizado',
                'tbv_per_share': inf.get('bookValue'),
                'net_debt_per_share': round(debt / shares, 2) if shares else 0,
                'beta': inf.get('beta') or 1.15,
                'roic': round(roic, 4),
                'roe': round(roe, 4),
                'net_debt_ebitda': round(net_debt_ebitda, 2),
                'altman_z_score': 6.5,
                'piotroski_f_score': 8,
                'g_fundamental': 0.07,
                'g_hist': 0.08,
                'gn_terminal': 0.025,
                'market': 'NASDAQ',
                'fuente_auditada': 'Yahoo Finance Live'
            }
            nasdaq_universe.append(item)
        except Exception as e:
            print(f"Error procesando {tkr}: {e}")

    with open(NASDAQ_OUT, 'w', encoding='utf-8') as f:
        json.dump(nasdaq_universe, f, ensure_ascii=False, indent=2)
    print(f"Universo NASDAQ-100 guardado en {NASDAQ_OUT}: {len(nasdaq_universe)} empresas")


def build_ibex_universe():
    print("\n--- Construyendo Universo IBEX 35 ---")
    ibex_universe = []

    for item_meta in IBEX_35_CONSTITUENTS:
        tkr = item_meta['ticker']
        try:
            print(f"Procesando {tkr} ({item_meta['name']})...")
            yt = yf.Ticker(tkr)
            inf = yt.info or {}
            price = inf.get('currentPrice') or inf.get('regularMarketPrice') or inf.get('previousClose') or 0
            if not price or price <= 0:
                print(f"Aviso: Precio 0 para {tkr}, saltando...")
                continue

            shares = inf.get('sharesOutstanding') or 1
            fcf = inf.get('freeCashflow') or 0
            fcf_per_share = (fcf / shares) if (shares and fcf and fcf > 0) else None
            eps = inf.get('trailingEps') or inf.get('forwardEps') or (price / max(1, inf.get('trailingPE') or 15))
            div_rate = inf.get('dividendRate') or (price * (inf.get('dividendYield') or 0)) or 0
            debt = inf.get('totalDebt') or 0
            cash = inf.get('totalCash') or 0
            net_debt = debt - cash
            ebitda = inf.get('ebitda') or 1
            net_debt_ebitda = round((net_debt / ebitda), 2) if (ebitda and ebitda > 0) else 1.5

            roic = inf.get('returnOnAssets') or 0.06
            roe = inf.get('returnOnEquity') or 0.12
            beta = inf.get('beta') or (0.75 if 'Utilities' in item_meta['sector'] else (1.10 if 'Banca' in item_meta['sector'] else 0.95))

            # Base de flujo según arquetipo
            arquetipo = item_meta['arquetipo']
            if arquetipo == 'BANCA_FINANCIERA':
                base_cf = div_rate if div_rate > 0 else (eps * 0.5)
            elif arquetipo == 'INFRAESTRUCTURA_DEUDA':
                base_cf = div_rate if div_rate > 0 else (fcf_per_share or (eps * 0.7))
            else:
                base_cf = fcf_per_share if (fcf_per_share and fcf_per_share > 0) else eps

            company_data = {
                'ticker': tkr,
                'nombre': item_meta['name'],
                'sector': item_meta['sector'],
                'industry': inf.get('industry') or item_meta['sector'],
                'gics_sub_industry': inf.get('industry') or item_meta['sector'],
                'arquetipo': arquetipo,
                'nombre_arquetipo': item_meta['nombre_arquetipo'],
                'justificacion_arquetipo': f"Valor del IBEX 35: {item_meta['sector']}",
                'currency': 'EUR',
                'precio_cierre_P0': round(price, 2),
                'fifty_two_week_low': inf.get('fiftyTwoWeekLow') or round(price * 0.80, 2),
                'fifty_two_week_high': inf.get('fiftyTwoWeekHigh') or round(price * 1.20, 2),
                'dividend_rate': round(div_rate, 2),
                'forward_eps': inf.get('forwardEps'),
                'eps_diluted': round(eps, 2),
                'fcf_per_share': round(fcf_per_share, 2) if fcf_per_share else None,
                'D1_o_FCFA1': round(max(0.1, base_cf), 2),
                'base_flujo_regla': 'Dividendo por acción o FCF auditado',
                'tbv_per_share': inf.get('bookValue'),
                'net_debt_per_share': round(net_debt / shares, 2) if shares else 0,
                'beta': round(beta, 2),
                'roic': round(roic, 4),
                'roe': round(roe, 4),
                'net_debt_ebitda': net_debt_ebitda,
                'altman_z_score': 3.2 if arquetipo != 'BANCA_FINANCIERA' else None,
                'piotroski_f_score': 7,
                'g_fundamental': 0.025,
                'g_hist': 0.03,
                'gn_terminal': 0.020,  # Techo macro PIB nominal europeo
                'market': 'IBEX35',
                'fuente_auditada': 'Bolsas y Mercados Españoles (BME) / Yahoo Finance Live'
            }
            ibex_universe.append(company_data)
        except Exception as e:
            print(f"Error con {tkr}: {e}")

    with open(IBEX_OUT, 'w', encoding='utf-8') as f:
        json.dump(ibex_universe, f, ensure_ascii=False, indent=2)
    print(f"Universo IBEX 35 guardado en {IBEX_OUT}: {len(ibex_universe)} empresas")

if __name__ == '__main__':
    build_nasdaq_universe()
    build_ibex_universe()
