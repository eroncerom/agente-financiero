"""
Actualiza la ERP implícita del S&P 500 desde la web oficial de Aswath Damodaran (NYU Stern).

Fuente: https://pages.stern.nyu.edu/~adamodar/New_Home_Page/home.htm
Se extrae "Implied ERP on <fecha> = X% (Trailing 12 month, with adjusted payout)" y el
tipo del Tesoro usado como libre de riesgo en ese cálculo.

Política: solo se actualiza market_params.json si el valor extraído está en [2%, 8%].
Si la extracción falla, se conserva el último valor válido y se informa.
"""
import json
import os
import re
from datetime import datetime

import requests

URL = 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/home.htm'
PARAMS_PATH = os.path.join(os.path.dirname(__file__), '..', 'config', 'market_params.json')


def _strip_tags(html: str) -> str:
    txt = re.sub(r'<[^>]+>', '', html)
    txt = txt.replace('&amp;', '&').replace('&nbsp;', ' ')
    return re.sub(r'\s+', ' ', txt)


def fetch_implied_erp():
    resp = requests.get(URL, timeout=20, headers={'User-Agent': 'Mozilla/5.0 AgenteFinanciero'})
    resp.raise_for_status()
    text = _strip_tags(resp.text)
    m = re.search(r'Implied ERP on ([A-Za-z]+ \d{1,2}, \d{4})\s*=\s*([\d.]+)\s*%', text)
    if not m:
        raise ValueError('Patrón "Implied ERP on <fecha> = X%" no encontrado en la página de Damodaran')
    fecha = datetime.strptime(m.group(1), '%B %d, %Y').date().isoformat()
    erp = float(m.group(2)) / 100.0
    rf = None
    m_rf = re.search(r'treasury rate of ([\d.]+)\s*%', text[m.end():m.end() + 800], re.IGNORECASE)
    if m_rf:
        rf = float(m_rf.group(1)) / 100.0
    return {'erp': erp, 'fecha': fecha, 'rf': rf}


def update_params():
    with open(PARAMS_PATH, 'r', encoding='utf-8') as f:
        params = json.load(f)
    try:
        data = fetch_implied_erp()
    except Exception as e:
        print(f'[ERP] AVISO: no se pudo actualizar la ERP ({e}). Se conserva {params.get("erp")} del {params.get("erp_fecha")}.')
        return params, False
    if not (0.02 <= data['erp'] <= 0.08):
        print(f'[ERP] AVISO: ERP extraída {data["erp"]:.4f} fuera de rango [2%, 8%]. Se conserva el último valor válido.')
        return params, False
    params['erp'] = round(data['erp'], 4)
    params['erp_fecha'] = data['fecha']
    if data['rf'] is not None:
        params['erp_rf_referencia'] = round(data['rf'], 4)
    with open(PARAMS_PATH, 'w', encoding='utf-8') as f:
        json.dump(params, f, indent=2, ensure_ascii=False)
    print(f'[ERP] ERP implícita Damodaran {params["erp"]*100:.2f}% a {params["erp_fecha"]} (rf ref. {params.get("erp_rf_referencia")}).')
    return params, True


if __name__ == '__main__':
    update_params()
