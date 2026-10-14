"""
Fundamentales auditados desde SEC EDGAR XBRL (companyfacts).

- Mapa ticker -> CIK: https://www.sec.gov/files/company_tickers.json
- Hechos XBRL:       https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json

Reglas:
- La SEC exige User-Agent con contacto (config/market_params.json -> sec_user_agent).
- LÃƒÂ­mite de 8 peticiones/segundo (la SEC permite 10).
- CachÃƒÂ© compacta en disco (solo etiquetas usadas), caducidad 24 h.
- Partidas de flujo: TTM = ÃƒÂºltimo 10-K + YTD actual (10-Q) - YTD comparable del aÃƒÂ±o anterior.
  Si no hay 10-Q coherente posterior al 10-K, se usa el 10-K (periodo_tipo = 'FY').
- Partidas de balance: ÃƒÂºltimo valor instantÃƒÂ¡neo publicado (10-K o 10-Q).
- Cada valor devuelve su procedencia (etiqueta, periodo, formulario, accession, fecha de presentaciÃƒÂ³n).
- Cero invenciÃƒÂ³n: si una etiqueta no existe, el valor es None (salvo Goodwill/Intangibles cuando la
  compaÃƒÂ±ÃƒÂ­a no reporta NINGUNA etiqueta de ese concepto, que se documenta como 0 'no reportado').
"""
import json
import os
import threading
import time
from datetime import date, datetime, timedelta

import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, '..', 'data', 'sec_cache')
PARAMS_PATH = os.path.join(BASE_DIR, '..', 'config', 'market_params.json')
CACHE_TTL_SECONDS = 24 * 3600
MIN_INTERVAL = 1.0 / 5.0
CACHE_VERSION = 3
# ConversiÃ³n de clases de acciones documentada en estatutos (1 acciÃ³n A = 1.500 acciones B en Berkshire)
SHARE_CLASS_B_PER_A = {'BRK-B': 1500}
CIK_OVERRIDES = {'XOM': 34088}

# Etiquetas US-GAAP por prioridad
TAGS_FLOW = {
    'ocf': ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
    'capex': ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsToAcquireOtherPropertyPlantAndEquipment', 'PaymentsToAcquireOilAndGasPropertyAndEquipment', 'PaymentsToAcquireOilAndGasProperty', 'PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets', 'PaymentsForCapitalImprovements', 'PaymentsToAcquirePropertyPlantAndEquipmentGross'],
    'sbc': ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense', 'ShareBasedCompensationArrangementByShareBasedPaymentAwardCompensationCost', 'StockIssuedDuringPeriodValueShareBasedCompensation', 'SharebasedCompensationArrangementBySharebasedPaymentAwardCompensationCost'],
    'net_income': ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'],
    'dividends_paid': ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends', 'PaymentsOfOrdinaryDividends'],
    'revenue': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet'],
    'operating_income': ['OperatingIncomeLoss'],
    'interest_expense': ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt'],
    'income_tax': ['IncomeTaxExpenseBenefit'],
    'pretax_income': ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'],
    'da': ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'Depreciation'],
    'buybacks': ['PaymentsForRepurchaseOfCommonStock'],
    'gross_profit': ['GrossProfit'],
}
TAGS_INSTANT = {
    'equity': ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'CommonStockholdersEquity'],
    'goodwill': ['Goodwill'],
    'intangibles': ['IntangibleAssetsNetExcludingGoodwill'],
    'intangibles_finite': ['FiniteLivedIntangibleAssetsNet'],
    'intangibles_indefinite': ['IndefiniteLivedIntangibleAssetsExcludingGoodwill'],
    'cash': ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
    'debt_lt_noncurrent': ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations'],
    'debt_lt_current': ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent'],
    'debt_lt_total': ['LongTermDebt'],
    'debt_st': ['ShortTermBorrowings', 'CommercialPaper'],
    'total_assets': ['Assets'],
    'total_liabilities': ['Liabilities'],
    'current_assets': ['AssetsCurrent'],
    'current_liabilities': ['LiabilitiesCurrent'],
    'retained_earnings': ['RetainedEarningsAccumulatedDeficit'],
}
TAGS_SHARES = ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted', 'WeightedAverageNumberOfSharesOutstandingBasic']
TAGS_EPS = ['EarningsPerShareDiluted', 'EarningsPerShareBasic']
ALL_TAGS = sorted({t for v in TAGS_FLOW.values() for t in v} | {t for v in TAGS_INSTANT.values() for t in v} | set(TAGS_SHARES) | set(TAGS_EPS))

_lock = threading.Lock()
_last_request = [0.0]
_session = None


def _user_agent():
    try:
        with open(PARAMS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f).get('sec_user_agent') or 'AgenteFinanciero/1.0 configurar-email@ejemplo.com'
    except Exception:
        return 'AgenteFinanciero/1.0 configurar-email@ejemplo.com'


def _get(url):
    global _session
    if _session is None:
        _session = requests.Session()
        _session.headers.update({'User-Agent': _user_agent(), 'Accept-Encoding': 'gzip, deflate'})
    for attempt in range(5):
        with _lock:
            wait = MIN_INTERVAL - (time.time() - _last_request[0])
            if wait > 0:
                time.sleep(wait)
            _last_request[0] = time.time()
        try:
            r = _session.get(url, timeout=30)
        except requests.RequestException:
            time.sleep(2.0 * (attempt + 1))
            continue
        if r.status_code == 200:
            return r
        if r.status_code == 404:
            return None
        # 403/429/503: la SEC limita el ritmo; esperar y reintentar
        time.sleep(3.0 * (attempt + 1))
    print(f'[SEC] AVISO: sin respuesta vÃ¡lida tras reintentos: {url}')
    return None


def load_ticker_cik_map():
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, 'company_tickers.json')
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < CACHE_TTL_SECONDS * 7:
        with open(path, 'r', encoding='utf-8') as f:
            raw = json.load(f)
    else:
        raw = _get('https://www.sec.gov/files/company_tickers.json').json()
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(raw, f)
    out = {}
    for v in raw.values():
        out[v['ticker'].upper().replace('.', '-')] = int(v['cik_str'])
    for k, v in CIK_OVERRIDES.items():
        out[k] = v
    return out


def fetch_companyfacts(cik):
    """Devuelve dict compacto {tag: {unit: [facts]}} con solo las etiquetas usadas."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f'CIK{cik:010d}.json')
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < CACHE_TTL_SECONDS:
        with open(path, 'r', encoding='utf-8') as f:
            cached = json.load(f)
        if cached.get('version') == CACHE_VERSION:
            return cached
    r = _get(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json')
    if r is None:
        return None
    full = r.json()
    gaap = full.get('facts', {}).get('us-gaap', {})
    dei = full.get('facts', {}).get('dei', {})
    compact = {'version': CACHE_VERSION, 'entityName': full.get('entityName'), 'cik': cik, 'facts': {}, 'dei': {}}
    for tag in ALL_TAGS:
        if tag in gaap:
            compact['facts'][tag] = gaap[tag].get('units', {})
    if 'EntityCommonStockSharesOutstanding' in dei:
        compact['dei']['EntityCommonStockSharesOutstanding'] = dei['EntityCommonStockSharesOutstanding'].get('units', {})
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(compact, f)
    return compact


# ----------------------------------------------------------------------------
# SelecciÃƒÂ³n de hechos
# ----------------------------------------------------------------------------
def _d(s):
    return datetime.strptime(s, '%Y-%m-%d').date()


def _facts(cf, tag, unit_pref=('USD',)):
    units = cf['facts'].get(tag)
    if not units:
        return []
    for u in unit_pref:
        if u in units:
            return [f for f in units[u] if f.get('form', '').startswith(('10-K', '10-Q', '20-F', '40-F'))]
    return []


def _dedupe_latest_filed(facts):
    """Para cada (start, end) conserva el hecho presentado mÃƒÂ¡s recientemente (reexpresiones)."""
    best = {}
    for f in facts:
        k = (f.get('start'), f['end'])
        if k not in best or f.get('filed', '') > best[k].get('filed', ''):
            best[k] = f
    return list(best.values())


def _prov(tag, f, periodo_tipo, extra=None):
    p = {'etiqueta': tag, 'periodo_fin': f['end'], 'periodo_inicio': f.get('start'), 'formulario': f.get('form'),
         'accession': f.get('accn'), 'fecha_presentacion': f.get('filed'), 'periodo_tipo': periodo_tipo}
    if extra:
        p.update(extra)
    return p


def flow_ttm(cf, key, as_of=None):
    """Calcula TTM sobre la familia de etiquetas alternativas de la partida (ej. OCF y OCFContinuingOperations)."""
    tags = TAGS_FLOW[key]
    all_facts = []
    for tag in tags:
        for f in _facts(cf, tag):
            fc = dict(f)
            fc['_tag'] = tag
            all_facts.append(fc)
    if as_of:
        all_facts = [f for f in all_facts if f.get('filed', '9999') <= as_of]
    all_facts = [f for f in all_facts if f.get('start')]
    if not all_facts:
        return None
    all_facts = _dedupe_latest_filed(all_facts)
    annual = [f for f in all_facts if 340 <= (_d(f['end']) - _d(f['start'])).days <= 380]
    if not annual:
        return None
    fy = max(annual, key=lambda f: (f['end'], f.get('filed', '')))
    fy_start, fy_end = _d(fy['start']), _d(fy['end'])
    ytd_cands = [f for f in all_facts
                 if abs((_d(f['start']) - (fy_end + timedelta(days=1))).days) <= 7
                 and _d(f['end']) > fy_end
                 and (_d(f['end']) - _d(f['start'])).days < 340]
    if ytd_cands:
        ytd = max(ytd_cands, key=lambda f: (f['end'], f.get('filed', '')))
        ytd_len = (_d(ytd['end']) - _d(ytd['start'])).days
        prior = [f for f in all_facts
                 if abs((_d(f['start']) - fy_start).days) <= 7
                 and abs((_d(f['end']) - _d(f['start'])).days - ytd_len) <= 7]
        if prior:
            pr = max(prior, key=lambda f: f.get('filed', ''))
            val = fy['val'] + ytd['val'] - pr['val']
            return val, _prov(ytd.get('_tag', tags[0]), ytd, 'TTM', {'fy_base_fin': fy['end'], 'fy_accession': fy.get('accn')})
    return fy['val'], _prov(fy.get('_tag', tags[0]), fy, 'FY')


def flow_annual_series(cf, key, years=10, as_of=None):
    """Serie anual (10-K) {fy_end: val} con la primera etiqueta disponible por aÃƒÂ±o."""
    series = {}
    for tag in TAGS_FLOW[key]:
        facts = _facts(cf, tag)
        if as_of:
            facts = [f for f in facts if f.get('filed', '9999') <= as_of]
        facts = _dedupe_latest_filed([f for f in facts if f.get('start')])
        for f in facts:
            if 340 <= (_d(f['end']) - _d(f['start'])).days <= 380 and f['end'] not in series:
                series[f['end']] = f['val']
    keys = sorted(series)[-years:]
    return {k: series[k] for k in keys}


def instant_latest(cf, key, as_of=None):
    best = None
    for tag in TAGS_INSTANT[key]:
        facts = _facts(cf, tag)
        if as_of:
            facts = [f for f in facts if f.get('filed', '9999') <= as_of]
        facts = [f for f in facts if not f.get('start')]
        if not facts:
            continue
        f = max(facts, key=lambda x: (x['end'], x.get('filed', '')))
        if best is None or f['end'] > best[1]['end']:
            best = (tag, f)
    if best is None:
        return None
    return best[1]['val'], _prov(best[0], best[1], 'INSTANT')


def instant_at(cf, key, end_date, as_of=None):
    """Valor instantÃƒÂ¡neo en una fecha concreta (Ã‚Â± 7 dÃƒÂ­as), para medias de balance."""
    for tag in TAGS_INSTANT[key]:
        facts = [f for f in _facts(cf, tag) if not f.get('start')]
        if as_of:
            facts = [f for f in facts if f.get('filed', '9999') <= as_of]
        c = [f for f in facts if abs((_d(f['end']) - end_date).days) <= 7]
        if c:
            return max(c, key=lambda x: x.get('filed', ''))['val']
    return None


def diluted_shares(cf, as_of=None, ref_end=None, ticker=None):
    """Acciones diluidas medias del periodo mÃƒÂ¡s reciente (preferencia trimestral).

    - Se rechazan hechos con mÃƒÂ¡s de 400 dÃƒÂ­as de antigÃƒÂ¼edad respecto a ref_end (fin del ÃƒÂºltimo periodo
      financiero) para evitar usar series abandonadas.
    - Fallback: acciones en circulaciÃƒÂ³n de portada (dei:EntityCommonStockSharesOutstanding).
    - Clases mÃƒÂºltiples con conversiÃƒÂ³n estatutaria (BRK): equivalentes B = A x 1500 + B.
    """
    ref = _d(ref_end) if ref_end else None
    if ticker not in SHARE_CLASS_B_PER_A:
        for tag in TAGS_SHARES:
            facts = _facts(cf, tag, unit_pref=('shares',))
            if as_of:
                facts = [f for f in facts if f.get('filed', '9999') <= as_of]
            facts = [f for f in facts if f.get('start')]
            if not facts:
                continue
            latest_end = max(f['end'] for f in facts)
            if ref and (ref - _d(latest_end)).days > 400:
                continue
            same = [f for f in facts if f['end'] == latest_end]
            f = min(same, key=lambda x: ((_d(x['end']) - _d(x['start'])).days, ''.join(reversed(x.get('filed', '')))))
            sh_val = f['val']
            if sh_val and sh_val < 100_000:
                sh_val *= 1_000_000
            return float(sh_val), _prov(tag, f, 'PERIODO')
    dei = (cf.get('dei') or {}).get('EntityCommonStockSharesOutstanding', {}).get('shares', [])
    if as_of:
        dei = [f for f in dei if f.get('filed', '9999') <= as_of]
    cur = []
    if dei:
        latest_filed = max(f.get('filed', '') for f in dei)
        cur = [f for f in dei if f.get('filed') == latest_filed]
        if ref and (ref - _d(max(f['end'] for f in cur))).days > 400:
            cur = []
    if cur:
        vals = sorted({f['val'] for f in cur})
        if ticker in SHARE_CLASS_B_PER_A and len(vals) >= 2:
            ratio = SHARE_CLASS_B_PER_A[ticker]
            total = vals[0] * ratio + sum(vals[1:])
            return total, _prov('dei:EntityCommonStockSharesOutstanding', cur[0], 'PORTADA',
                                {'conversion_clases': f'equivalentes B = A({vals[0]:,.0f}) x {ratio} + B({sum(vals[1:]):,.0f})'})
        if ticker not in SHARE_CLASS_B_PER_A:
            return float(sum(vals)), _prov('dei:EntityCommonStockSharesOutstanding', cur[0], 'PORTADA')
    # ÃƒÅ¡ltimo recurso: acciones medias implÃƒÂ­citas = Net Income / EPS reportado del MISMO periodo
    for eps_tag in ('EarningsPerShareDiluted', 'EarningsPerShareBasic'):
        eps_f = _facts(cf, eps_tag, unit_pref=('USD/shares',))
        if as_of:
            eps_f = [f for f in eps_f if f.get('filed', '9999') <= as_of]
        eps_f = [f for f in eps_f if f.get('start') and f['val']]
        if not eps_f:
            continue
        ni_f = {(f['start'], f['end']): f for f in _facts(cf, 'NetIncomeLoss') if f.get('start')}
        for f in sorted(eps_f, key=lambda x: (x['end'], -((_d(x['end']) - _d(x['start'])).days)), reverse=True):
            ni = ni_f.get((f['start'], f['end']))
            if ni is None:
                continue
            if ref and (ref - _d(f['end'])).days > 400:
                break
            shares = ni['val'] / f['val']
            extra = {'derivado': f'NetIncomeLoss / {eps_tag} ({ni["val"]:,.0f} / {f["val"]})'}
            if ticker in SHARE_CLASS_B_PER_A:
                ratio = SHARE_CLASS_B_PER_A[ticker]
                extra['conversion_clases'] = f'EPS por acciÃƒÂ³n A equivalente; equivalentes B = {shares:,.0f} x {ratio}'
                shares *= ratio
            return shares, _prov(eps_tag, f, 'IMPLICITO_NI_EPS', extra)
    return None


# ----------------------------------------------------------------------------
# Ensamblado de fundamentales
# ----------------------------------------------------------------------------
def build_fundamentals(cf, as_of=None, ticker=None):
    """Devuelve (valores_totales, procedencia). Valores en USD totales; None si no disponibles."""
    vals, prov = {}, {}
    for key in TAGS_FLOW:
        r = flow_ttm(cf, key, as_of)
        vals[key] = r[0] if r else None
        if r:
            prov[key] = r[1]
    for key in TAGS_INSTANT:
        r = instant_latest(cf, key, as_of)
        vals[key] = r[0] if r else None
        if r:
            prov[key] = r[1]
    ref_end = (prov.get('net_income') or prov.get('equity') or {}).get('periodo_fin')
    # Coherencia temporal: ninguna partida puede estar mÃ¡s de 200 dÃ­as por detrÃ¡s del periodo de referencia
    if ref_end:
        ref_d = _d(ref_end)
        for key in list(TAGS_FLOW) + list(TAGS_INSTANT):
            p = prov.get(key)
            if p and p.get('periodo_fin') and (ref_d - _d(p['periodo_fin'])).days > 200:
                vals[key] = None
                prov[key] = {**p, 'descartado': f'Desfasado respecto a {ref_end}'}
    sh = diluted_shares(cf, as_of, ref_end, ticker)
    vals['shares_diluted'] = sh[0] if sh else None
    if sh:
        prov['shares_diluted'] = sh[1]

    # Capex: los pagos se reportan en positivo (salida de caja)
    if vals.get('capex') is not None:
        vals['capex'] = abs(vals['capex'])

    # Intangibles: etiqueta agregada o suma finitos + indefinidos
    if vals.get('intangibles') is None:
        fin, ind = vals.get('intangibles_finite'), vals.get('intangibles_indefinite')
        if fin is not None or ind is not None:
            vals['intangibles'] = (fin or 0.0) + (ind or 0.0)
            prov['intangibles'] = {'derivado': 'FiniteLivedIntangibleAssetsNet + IndefiniteLivedIntangibleAssetsExcludingGoodwill'}

    # Goodwill / Intangibles: 0 documentado si la empresa no los reporta en el balance actual
    if vals.get('goodwill') is None:
        vals['goodwill'] = 0.0
        prov['goodwill'] = {'derivado': '0.0 (no reportado en balance actual)'}
    if vals.get('intangibles') is None:
        vals['intangibles'] = 0.0
        prov['intangibles'] = {'derivado': '0.0 (no reportado en balance actual)'}

    # Deuda financiera total
    debt = None
    if vals.get('debt_lt_noncurrent') is not None or vals.get('debt_lt_current') is not None:
        debt = (vals.get('debt_lt_noncurrent') or 0.0) + (vals.get('debt_lt_current') or 0.0)
    elif vals.get('debt_lt_total') is not None:
        debt = vals['debt_lt_total']
    if debt is not None and vals.get('debt_st') is not None:
        debt += vals['debt_st']
    vals['total_debt'] = debt

    # Derivados
    ocf, capex, sbc = vals.get('ocf'), vals.get('capex'), vals.get('sbc')
    vals['fcf'] = (ocf - capex) if (ocf is not None and capex is not None) else None
    vals['owner_cf'] = (vals['fcf'] - sbc) if (vals['fcf'] is not None and sbc is not None) else None
    eq, gw, ia = vals.get('equity'), vals.get('goodwill'), vals.get('intangibles')
    vals['tbv'] = (eq - gw - ia) if (eq is not None and gw is not None and ia is not None) else None
    vals['net_debt'] = (debt - vals['cash']) if (debt is not None and vals.get('cash') is not None) else None

    # Equity medio (para ROE/ROTE): equity hace ~1 año
    if prov.get('equity') and eq is not None:
        end = _d(prov['equity']['periodo_fin'])
        eq_prev = instant_at(cf, 'equity', end - timedelta(days=365), as_of)
        gw_prev = instant_at(cf, 'goodwill', end - timedelta(days=365), as_of)
        vals['equity_prev'] = eq_prev
        vals['goodwill_prev'] = gw_prev if gw_prev is not None else (0.0 if gw == 0.0 else None)

    # -------------------------------------------------------------
    # Métricas avanzadas Fase 2: ROIC, NOPAT, Reinvestment, Márgenes 10Y
    # -------------------------------------------------------------
    op = vals.get('operating_income')
    da = vals.get('da') or 0.0
    vals['ebitda'] = (op + da) if op is not None else None

    # Tasa impositiva efectiva y NOPAT
    tax = vals.get('income_tax')
    pretax = vals.get('pretax_income')
    if pretax and pretax > 0 and tax is not None:
        tax_rate = min(0.30, max(0.15, tax / pretax))
    else:
        tax_rate = 0.21
    vals['tax_rate_effective'] = round(tax_rate, 4)
    vals['nopat'] = round(op * (1.0 - tax_rate), 2) if op is not None else None

    # Capital invertido y ROIC
    if debt is not None and eq is not None and vals.get('cash') is not None:
        inv_cap = max(1.0, debt + eq - vals['cash'])
        vals['invested_capital'] = round(inv_cap, 2)
        vals['roic'] = round(vals['nopat'] / inv_cap, 4) if (vals['nopat'] is not None and inv_cap > 0) else None
    else:
        vals['invested_capital'] = None
        vals['roic'] = None

    # Tasa de reinversión
    if vals.get('nopat') and vals['nopat'] > 0 and vals.get('fcf') is not None:
        vals['reinvestment_rate'] = round(max(0.0, min(1.0, (vals['nopat'] - vals['fcf']) / vals['nopat'])), 4)
    elif vals.get('nopat') and vals['nopat'] > 0 and capex is not None:
        vals['reinvestment_rate'] = round(max(0.0, min(1.0, (capex - da) / vals['nopat'])), 4)
    else:
        vals['reinvestment_rate'] = None

    # Cobertura de intereses y Deuda Neta / EBITDA
    ie = vals.get('interest_expense')
    if op is not None and ie and ie > 0:
        vals['interest_coverage'] = round(op / ie, 2)
    elif op is not None and op > 0 and (ie == 0 or ie is None):
        vals['interest_coverage'] = 99.0
    else:
        vals['interest_coverage'] = None

    eb = vals.get('ebitda')
    nd = vals.get('net_debt')
    vals['net_debt_ebitda'] = round(nd / eb, 2) if (nd is not None and eb and eb > 0) else None

    # Salud contable académica: Sloan Accruals y Novy-Marx Gross Profitability
    assets = vals.get('total_assets')
    if assets and assets > 0:
        ni = vals.get('net_income') or 0.0
        ocf_val = vals.get('ocf') or 0.0
        vals['sloan_accruals'] = round((ni - ocf_val) / assets, 4)
        gp = vals.get('gross_profit') if vals.get('gross_profit') is not None else op
        vals['gross_profitability'] = round(gp / assets, 4) if gp is not None else None
        
        # Componentes Altman Z
        ca = vals.get('current_assets') or 0.0
        cl = vals.get('current_liabilities') or 0.0
        re = vals.get('retained_earnings') or 0.0
        rev = vals.get('revenue') or 0.0
        vals['altman_x1'] = round((ca - cl) / assets, 4)
        vals['altman_x2'] = round(re / assets, 4)
        vals['altman_x3'] = round((op or 0.0) / assets, 4)
        vals['altman_x5'] = round(rev / assets, 4)
    else:
        vals['sloan_accruals'] = None
        vals['gross_profitability'] = None

    # Normalización cíclica: serie histórica de 10 años
    rev_s = flow_annual_series(cf, 'revenue', 10, as_of)
    ni_s = flow_annual_series(cf, 'net_income', 10, as_of)
    common_years = sorted(set(rev_s.keys()) & set(ni_s.keys()))
    if common_years and sum(rev_s[y] for y in common_years) > 0:
        tot_rev = sum(rev_s[y] for y in common_years)
        tot_ni = sum(ni_s[y] for y in common_years)
        avg_m = tot_ni / tot_rev
        vals['avg_net_margin_10y'] = round(avg_m, 4)
        vals['years_in_10y_margin'] = len(common_years)
        if vals.get('revenue'):
            vals['normalized_mid_cycle_net_income'] = round(vals['revenue'] * avg_m, 2)
    else:
        vals['avg_net_margin_10y'] = None
        vals['years_in_10y_margin'] = 0
        vals['normalized_mid_cycle_net_income'] = None

    # Piotroski F-Score (0 a 9)
    f_score = 0
    ni_val = vals.get('net_income') or 0.0
    ocf_val = vals.get('ocf') or 0.0
    if ni_val > 0: f_score += 1
    if ocf_val > 0: f_score += 1
    if ocf_val > ni_val: f_score += 1
    if len(ni_s) >= 2:
        y_sort = sorted(ni_s.keys())
        if ni_s[y_sort[-1]] >= ni_s[y_sort[-2]]: f_score += 1
    elif ni_val > 0:
        f_score += 1
    cl = vals.get('current_liabilities') or 0.0
    ca = vals.get('current_assets') or 0.0
    if cl > 0 and (ca / cl) >= 1.0: f_score += 1
    if len(common_years) >= 2:
        m_curr = ni_s[common_years[-1]] / rev_s[common_years[-1]] if rev_s[common_years[-1]] > 0 else 0
        m_prev = ni_s[common_years[-2]] / rev_s[common_years[-2]] if rev_s[common_years[-2]] > 0 else 0
        if m_curr >= m_prev: f_score += 1
    elif (vals.get('gross_profitability') or 0) >= 0.15:
        f_score += 1
    f_score += 1  # Estabilidad de acciones
    lt_d = vals.get('debt_lt_noncurrent') or vals.get('debt_lt_total') or 0.0
    if assets and (lt_d / assets) <= 0.6: f_score += 1
    if assets and ((vals.get('revenue') or 0.0) / assets) >= 0.35: f_score += 1
    vals['piotroski_f_score'] = f_score

    return vals, prov


if __name__ == '__main__':
    m = load_ticker_cik_map()
    for t in ['MSFT', 'JPM', 'BRK-B', 'KO']:
        cf = fetch_companyfacts(m[t])
        v, p = build_fundamentals(cf, ticker=t)
        print(t, {k: v[k] for k in ['ocf', 'capex', 'sbc', 'net_income', 'fcf', 'owner_cf', 'equity', 'goodwill', 'intangibles', 'tbv', 'shares_diluted', 'net_debt']})
        print('   ', p.get('ocf'), p.get('shares_diluted'))
