/**
 * Doctrina Financiera y Valoración Fundamental (Graham-Dodd / Klarman / Damodaran)
 * 
 * En finanzas corporativas rigurosas, el precio objetivo de salida natural de una inversión en valor
 * es la convergencia hacia su Valor Intrínseco Justo (Fair Value).
 * No se inventan multiplicadores arbitrarios (+8%, +12%, 98%) ni techos ad-hoc sobre cotizaciones pasadas.
 * 
 * - Si disponemos del Fair Value intrínseco: retorna ese valor exacto.
 * - Si no disponemos de modelo fundamental para el activo: retorna vacío para que el inversor
 *   defina su propio objetivo manualmente o lo deje sin asignar.
 */
export function calculatePrudentTargetExit(
  _buyPrice?: number | null,
  _high52?: number | null,
  fairValue?: number | null
): string {
  if (fairValue && fairValue > 0) {
    return fairValue.toFixed(2);
  }
  return '';
}

/**
 * Salida Fundamental Directa
 */
export function getFundamentalTargetExit(fairValue?: number | null): string {
  if (fairValue && fairValue > 0) {
    return fairValue.toFixed(2);
  }
  return '';
}
