/**
 * Cálculo de Precio Objetivo de Salida (Take Profit) Prudente y Realista
 *
 * Aplica dos salvaguardas institucionales frente a objetivos inflados:
 * 1. Compresión Táctica de Recorrido (Reversión Parcial al Valor Justo):
 *    - Si no hay Fair Value o el margen teórico es <= 3%: objetivo conservador base del +10%.
 *    - Si el recorrido al Fair Value es moderado (3% a 12%): aplica un margen de ejecución del 1% antes del Fair Value (mín. +4%).
 *    - Si el Fair Value está muy alejado (> 12%, habitual por consenso alcista de analistas): captura el tramo central seguro
 *      (9% + 40% del recorrido excedente sobre el 10%), acotado a un techo táctico máximo del +22% sobre compra.
 * 2. Respeto a la Resistencia Anual (52W High Cap):
 *    - Si el máximo de 52 semanas supera al menos en un 4% al precio de compra, acota la salida un 1.2% por debajo
 *      de la resistencia de 52 semanas (high52 * 0.988), evitando exigir rupturas de máximos anuales para vender.
 */
export function calculatePrudentTargetExitNumber(
  buyPrice?: number | null,
  high52?: number | null,
  fairValue?: number | null
): number | null {
  const bp = buyPrice && buyPrice > 0 ? Number(buyPrice) : null;
  const fv = fairValue && fairValue > 0 ? Number(fairValue) : null;
  const h52 = high52 && high52 > 0 ? Number(high52) : null;

  if (!bp) {
    if (!fv) return null;
    const baseExit = Number((fv * 0.92).toFixed(2));
    return h52 ? Number(Math.min(baseExit, h52 * 0.988).toFixed(2)) : baseExit;
  }

  const rawUpside = fv ? (fv - bp) / bp : 0.10;
  let prudentUpside: number;

  if (!fv || rawUpside <= 0.03) {
    prudentUpside = 0.10;
  } else if (rawUpside <= 0.12) {
    prudentUpside = Math.max(0.04, rawUpside - 0.01);
  } else {
    prudentUpside = 0.09 + (rawUpside - 0.10) * 0.40;
    prudentUpside = Math.min(prudentUpside, 0.22);
  }

  let target = bp * (1 + prudentUpside);

  if (h52 && h52 > bp * 1.04) {
    target = Math.min(target, h52 * 0.988);
  }

  return Number(target.toFixed(2));
}

export function calculatePrudentTargetExit(
  buyPrice?: number | null,
  high52?: number | null,
  fairValue?: number | null
): string {
  const res = calculatePrudentTargetExitNumber(buyPrice, high52, fairValue);
  return res != null && res > 0 ? res.toFixed(2) : '';
}

/**
 * Salida Fundamental Directa (100% Fair Value teórico sin compresión táctica)
 */
export function getFundamentalTargetExit(fairValue?: number | null): string {
  if (fairValue && fairValue > 0) {
    return fairValue.toFixed(2);
  }
  return '';
}
