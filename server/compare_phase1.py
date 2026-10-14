import json
import statistics

def get_companies(snap_path):
    with open(snap_path, encoding='utf-8') as f:
        d = json.load(f)
    all_comps = []
    for c in d.get('resultados', []):
        all_comps.append(c)
    diag = d.get('diagnostico_pedagogico', {})
    for c in diag.get('no_calificadas_precio', []):
        all_comps.append(c)
    for c in diag.get('descartadas_trampa_valor', []):
        all_comps.append(c)
    return all_comps

before = get_companies('server/data/snapshots/scan_before_phase1.json')
after = get_companies('server/data/snapshots/scan_after_phase1.json')

def analyze(comps):
    by_arq = {}
    by_ticker = {}
    for c in comps:
        t = c.get('ticker')
        arq = c.get('arquetipo') or 'DESCONOCIDO'
        p0 = c.get('precio_cierre_P0')
        fv = c.get('fair_value_teorico')
        if fv is None:
            fv = (c.get('escenario_neutro') or {}).get('VP_teorico')
        if p0 and fv and p0 > 0:
            ratio = fv / p0
            by_arq.setdefault(arq, []).append(ratio)
            by_ticker[t] = {
                'p0': p0,
                'fv': fv,
                'ratio': round(ratio, 3),
                'arq': arq,
                'r': c.get('tasa_descuento_r'),
                'status': c.get('status')
            }
    medians = {a: round(statistics.median(r), 3) for a, r in sorted(by_arq.items())}
    counts = {a: len(r) for a, r in sorted(by_arq.items())}
    all_ratios = [r for sub in by_arq.values() for r in sub]
    overall = round(statistics.median(all_ratios), 3) if all_ratios else None
    return medians, counts, overall, by_ticker

med_b, cnt_b, ov_b, t_b = analyze(before)
med_a, cnt_a, ov_a, t_a = analyze(after)

print('=== COMPARATIVA FV / P (MEDIANA POR ARQUETIPO) ===')
print(f'{"Arquetipo":<25} | {"Antes":<10} | {"N (Ant)":<8} | {"Después":<10} | {"N (Dcs)":<8} | {"Delta":<8}')
print('-' * 78)
all_arqs = sorted(set(med_b.keys()) | set(med_a.keys()))
for a in all_arqs:
    b_val = med_b.get(a, 'N/A')
    a_val = med_a.get(a, 'N/A')
    nb = cnt_b.get(a, 0)
    na = cnt_a.get(a, 0)
    if isinstance(b_val, (int, float)) and isinstance(a_val, (int, float)):
        delta = round(a_val - b_val, 3)
        delta_str = f'+{delta}' if delta > 0 else str(delta)
    else:
        delta_str = '-'
    print(f'{a:<25} | {str(b_val):<10} | {nb:<8} | {str(a_val):<10} | {na:<8} | {delta_str:<8}')
print('-' * 78)
delta_ov = round(ov_a - ov_b, 3) if ov_a and ov_b else '-'
print(f'{"GLOBAL (MEDIANA TOTAL)":<25} | {str(ov_b):<10} | {len(before):<8} | {str(ov_a):<10} | {len(after):<8} | +{delta_ov}')

print('\n=== EMPRESAS DE AUDITORÍA Y CONTROL (PUNTO 3) ===')
control_tickers = ['ABBV', 'AMGN', 'VRTX', 'LLY', 'ISRG', 'BSX', 'MMM', 'HON', 'CEG', 'TSLA', 'WM', 'RSG', 'CTAS', 'NFLX', 'BLK', 'KKR', 'MSFT', 'AAPL', 'KO', 'JPM']
print(f'{"Ticker":<6} | {"Arquetipo Ant":<22} | {"Arquetipo Dcs":<22} | {"P0":<8} | {"FV Ant":<8} | {"FV Dcs":<8} | {"r Ant":<7} | {"r Dcs":<7} | {"FV/P Ant":<8} | {"FV/P Dcs":<8}')
print('-' * 115)
for t in control_tickers:
    b = t_b.get(t, {})
    a = t_a.get(t, {})
    p0 = a.get('p0') or b.get('p0') or '-'
    fv_b = b.get('fv', '-')
    fv_a = a.get('fv', '-')
    r_b = f'{round(b.get("r", 0)*100, 1)}%' if b.get('r') else '-'
    r_a = f'{round(a.get("r", 0)*100, 1)}%' if a.get('r') else '-'
    rat_b = b.get('ratio', '-')
    rat_a = a.get('ratio', '-')
    arq_b = b.get('arq', 'N/A')
    arq_a = a.get('arq', 'N/A')
    print(f'{t:<6} | {arq_b:<22} | {arq_a:<22} | {str(p0):<8} | {str(fv_b):<8} | {str(fv_a):<8} | {r_b:<7} | {r_a:<7} | {str(rat_b):<8} | {str(rat_a):<8}')
