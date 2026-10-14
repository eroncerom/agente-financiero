import requests
import json

try:
    r = requests.get('http://localhost:3001/api/pilar1/scan?mos=0.25').json()
    print('=== RESULTADOS DEL BARRIDO PILAR 1 (200 COMPANIAS) ===')
    print('Universo analizado:', r.get('universo_analizado'))
    print('Calificadas (MoS >= 25%):', r.get('empresas_calificadas_pilar1'))
    print('Descartadas datos:', r.get('empresas_descartadas_datos_insuficientes'))
    print('Descartadas techo r:', len(r.get('diagnostico_pedagogico', {}).get('descartadas_techo_r', [])))
    print('Descartadas trampa valor:', len(r.get('diagnostico_pedagogico', {}).get('descartadas_trampa_valor', [])))
    print('No calificadas por precio:', len(r.get('diagnostico_pedagogico', {}).get('no_calificadas_precio', [])))

    calif = r.get('resultados', [])
    if calif:
        print('\n*** COMPANIAS CALIFICADAS ***:')
        for c in calif:
            print(f"- {c['ticker']} ({c['nombre']}): P0: ${c['precio_cierre_P0']} | FairVal: ${c['escalera_mos']['fair_value']} | Techo MoS: ${c['techo_maximo_compra']} | Holgura: {c['discrepancia_porcentual_neutra']}")
    else:
        print('\nNinguna compania califica con MoS 25% (Mercado en Maximos).')

    print('\nTop 15 companias MAS CERCANAS a zona de compra (menor sobreprecio):')
    no_calif = r.get('diagnostico_pedagogico', {}).get('no_calificadas_precio', [])
    top15 = [{
        'ticker': x['ticker'],
        'nombre': x['nombre'],
        'sector': x['sector'],
        'arquetipo': x['nombre_arquetipo'],
        'P0': x['precio_cierre_P0'],
        'fair_value': x['escalera_mos']['fair_value'],
        'techo_mos_25': x['techo_maximo_compra'],
        'discrepancia_pct': x['discrepancia'],
        'estado': x['estado_compra']
    } for x in no_calif[:15]]
    print(json.dumps(top15, indent=2))

    trampas = r.get('diagnostico_pedagogico', {}).get('descartadas_trampa_valor', [])
    if trampas:
        print(f"\nDescartadas preventivas por riesgo de trampa de valor ({len(trampas)}):")
        for t in trampas[:8]:
            print(f"- {t['ticker']} ({t['nombre']}): Caida 52W: -{t['caida_desde_maximo_52w_pct']}% | Motivo: {t.get('tipo_descarte')}")
except Exception as e:
    print('Error al consultar scan:', e)
