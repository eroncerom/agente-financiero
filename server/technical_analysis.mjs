/**
 * MOTOR DE ANÁLISIS TÉCNICO CUANTITATIVO Y SEGUIMIENTO DE ACTIVOS
 * Basado en literatura empírica de finanzas cuantitativas y análisis técnico riguroso:
 * - J. Welles Wilder (1978): Relative Strength Index (RSI 14) y Average True Range (ATR 14).
 * - Gerald Appel (1979): Moving Average Convergence Divergence (MACD 12, 26, 9).
 * - John Bollinger (2001): Bandas de Bollinger (20, 2σ), %B y Bandwidth (Volatility Squeeze).
 * - Andrew Lo & Craig MacKinlay: Regímenes de reversión a la media y persistencia de tendencia (SMA 50 / SMA 200).
 * - Fibonacci Retracements & Dynamic Pivots (38.2%, 50%, 61.8%).
 * - Estimación de varianza anualizada y Stop Loss cuantitativo basado en ATR.
 */

import { fetchChartHistory } from './market_service.mjs';
import { db } from './db.mjs';
import { obtenerValuacionTicker } from './pilar1_engine.mjs';

/**
 * Calcula SMA de un array
 */
function calcularSMA(valores, periodo) {
  if (!valores || valores.length < periodo) return null;
  const slice = valores.slice(valores.length - periodo);
  const suma = slice.reduce((a, b) => a + b, 0);
  return Number((suma / periodo).toFixed(2));
}

/**
 * Calcula serie EMA completa
 */
function calcularSerieEMA(valores, periodo) {
  if (!valores || valores.length < periodo) return [];
  const k = 2 / (periodo + 1);
  const ema = [];
  
  // Primera EMA es el promedio simple
  let sumaInicial = 0;
  for (let i = 0; i < periodo; i++) sumaInicial += valores[i];
  ema[periodo - 1] = sumaInicial / periodo;

  for (let i = periodo; i < valores.length; i++) {
    ema[i] = valores[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

/**
 * Calcula RSI de 14 periodos con suavizado Wilder
 */
function calcularRSI(preciosCierre, periodo = 14) {
  if (!preciosCierre || preciosCierre.length <= periodo) return null;
  
  const cambios = [];
  for (let i = 1; i < preciosCierre.length; i++) {
    cambios.push(preciosCierre[i] - preciosCierre[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < periodo; i++) {
    if (cambios[i] >= 0) avgGain += cambios[i];
    else avgLoss += Math.abs(cambios[i]);
  }
  avgGain /= periodo;
  avgLoss /= periodo;

  for (let i = periodo; i < cambios.length; i++) {
    const gain = cambios[i] >= 0 ? cambios[i] : 0;
    const loss = cambios[i] < 0 ? Math.abs(cambios[i]) : 0;
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Number(rsi.toFixed(2));
}

/**
 * Calcula MACD (12, 26, 9)
 */
function calcularMACD(preciosCierre) {
  if (!preciosCierre || preciosCierre.length < 35) return null;
  const ema12 = calcularSerieEMA(preciosCierre, 12);
  const ema26 = calcularSerieEMA(preciosCierre, 26);

  const macdLineSeries = [];
  for (let i = 25; i < preciosCierre.length; i++) {
    if (ema12[i] != null && ema26[i] != null) {
      macdLineSeries.push(ema12[i] - ema26[i]);
    }
  }

  const signalSeries = calcularSerieEMA(macdLineSeries, 9);
  const ultMacd = macdLineSeries[macdLineSeries.length - 1];
  const ultSignal = signalSeries[signalSeries.length - 1];
  
  if (ultMacd == null || ultSignal == null) return null;
  const histograma = ultMacd - ultSignal;

  return {
    macd: Number(ultMacd.toFixed(2)),
    signal: Number(ultSignal.toFixed(2)),
    hist: Number(histograma.toFixed(2)),
    cruce: ultMacd > ultSignal ? 'ALCISTA' : 'BAJISTA',
    aceleracion: histograma > 0 ? 'IMPULSO_POSITIVO' : 'IMPULSO_NEGATIVO'
  };
}

/**
 * Calcula Bandas de Bollinger (20, 2σ)
 */
function calcularBollinger(preciosCierre, periodo = 20, numStd = 2) {
  if (!preciosCierre || preciosCierre.length < periodo) return null;
  const slice = preciosCierre.slice(preciosCierre.length - periodo);
  const media = slice.reduce((a, b) => a + b, 0) / periodo;
  
  const varianza = slice.reduce((a, b) => a + Math.pow(b - media, 2), 0) / periodo;
  const std = Math.sqrt(varianza);

  const upper = Number((media + numStd * std).toFixed(2));
  const lower = Number((media - numStd * std).toFixed(2));
  const middle = Number(media.toFixed(2));
  const currentPrice = preciosCierre[preciosCierre.length - 1];

  const pctB = (upper !== lower) ? Number(((currentPrice - lower) / (upper - lower)).toFixed(3)) : 0.5;
  const bandwidth = middle > 0 ? Number((((upper - lower) / middle) * 100).toFixed(2)) : 0;

  return {
    upper,
    middle,
    lower,
    pctB,
    bandwidth,
    squeeze: bandwidth < 8.0, // Bandwidth < 8% indica compresión extrema previa a movimiento
    posicion: pctB > 0.85 ? 'SOBRECOMPRA_SUPERIOR' : pctB < 0.15 ? 'SOBREVENTA_INFERIOR' : 'CANAL_CENTRAL'
  };
}

/**
 * Calcula ATR (Average True Range) 14
 */
function calcularATR(points, periodo = 14) {
  if (!points || points.length <= periodo) return null;
  
  const trSeries = [];
  for (let i = 1; i < points.length; i++) {
    const h = points[i].high;
    const l = points[i].low;
    const prevC = points[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trSeries.push(tr);
  }

  let atr = 0;
  for (let i = 0; i < periodo; i++) atr += trSeries[i];
  atr /= periodo;

  for (let i = periodo; i < trSeries.length; i++) {
    atr = (atr * (periodo - 1) + trSeries[i]) / periodo;
  }

  const currentPrice = points[points.length - 1].close;
  const atrPct = currentPrice > 0 ? Number(((atr / currentPrice) * 100).toFixed(2)) : 0;

  return {
    atr: Number(atr.toFixed(2)),
    atr_pct: atrPct
  };
}

/**
 * Calcula Varianza y Desviación Típica Histórica Anualizada
 */
function calcularVolatilidadHistorica(preciosCierre) {
  if (!preciosCierre || preciosCierre.length < 20) return null;
  
  const logReturns = [];
  for (let i = 1; i < preciosCierre.length; i++) {
    if (preciosCierre[i - 1] > 0 && preciosCierre[i] > 0) {
      logReturns.push(Math.log(preciosCierre[i] / preciosCierre[i - 1]));
    }
  }

  const media = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const varianzaDiaria = logReturns.reduce((a, b) => a + Math.pow(b - media, 2), 0) / (logReturns.length - 1);
  const stdDiaria = Math.sqrt(varianzaDiaria);
  const stdAnualizada = stdDiaria * Math.sqrt(252) * 100;

  return {
    varianza_diaria: Number(varianzaDiaria.toFixed(6)),
    volatilidad_anual_pct: Number(stdAnualizada.toFixed(2))
  };
}

/**
 * Calcula Niveles de Fibonacci sobre rango anual
 */
function calcularFibonacci(high52, low52, currentPrice) {
  if (!high52 || !low52 || high52 <= low52) return null;
  const diff = high52 - low52;

  const fib78 = Number((high52 - diff * 0.786).toFixed(2));
  const fib61 = Number((high52 - diff * 0.618).toFixed(2));
  const fib50 = Number((high52 - diff * 0.500).toFixed(2));
  const fib38 = Number((high52 - diff * 0.382).toFixed(2));
  const fib23 = Number((high52 - diff * 0.236).toFixed(2));

  let zonaFib = 'Por encima de Fib 23.6%';
  if (currentPrice <= fib78) zonaFib = 'Soporte Profundo (< Fib 78.6%)';
  else if (currentPrice <= fib61) zonaFib = 'Golden Pocket (Fib 61.8% - 78.6%)';
  else if (currentPrice <= fib50) zonaFib = 'Retroceso Medio (Fib 50.0% - 61.8%)';
  else if (currentPrice <= fib38) zonaFib = 'Zona Neutral (Fib 38.2% - 50.0%)';

  return {
    high52,
    low52,
    fib23,
    fib38,
    fib50,
    fib61,
    fib78,
    zona_actual: zonaFib
  };
}

/**
 * FUNCIÓN MAESTRA: ANÁLISIS TÉCNICO COMPLETO Y OBJETIVO
 */
export async function generarAnalisisTecnico(ticker, timeframe = '1A') {
  if (!ticker) return null;
  const cleanTicker = ticker.trim().toUpperCase();

  // 1. Obtener historial de velas
  // Traemos 1A por defecto para calcular SMA 50, SMA 200 y volatilidad robusta
  const chartData = await fetchChartHistory(cleanTicker, '1A');
  const points = chartData?.points || [];
  if (points.length < 20) {
    throw new Error(`Datos históricos insuficientes para análisis técnico de ${cleanTicker}`);
  }

  const closes = points.map(p => p.close);
  const currentPrice = chartData.current_price || closes[closes.length - 1];

  // 2. Medias Móviles y Tendencia
  const sma20 = calcularSMA(closes, 20);
  const sma50 = calcularSMA(closes, 50);
  const sma200 = closes.length >= 180 ? calcularSMA(closes, Math.min(200, closes.length)) : null;

  const precioVsSma20 = sma20 ? Number((((currentPrice - sma20) / sma20) * 100).toFixed(1)) : 0;
  const precioVsSma50 = sma50 ? Number((((currentPrice - sma50) / sma50) * 100).toFixed(1)) : 0;
  const precioVsSma200 = sma200 ? Number((((currentPrice - sma200) / sma200) * 100).toFixed(1)) : null;

  let regimenTendencia = 'NEUTRAL / LATERAL';
  if (sma200) {
    if (currentPrice > sma200 && (sma50 ? sma50 > sma200 : true)) {
      regimenTendencia = 'ALCISTA ESTRUCTURAL';
    } else if (currentPrice < sma200 && (sma50 ? sma50 < sma200 : true)) {
      regimenTendencia = 'BAJISTA ESTRUCTURAL';
    } else if (currentPrice > sma200) {
      regimenTendencia = 'RECUPERACIÓN SOBRE SMA 200';
    } else {
      regimenTendencia = 'CORRECCIÓN BAJO SMA 200';
    }
  } else if (sma50) {
    regimenTendencia = currentPrice > sma50 ? 'ALCISTA CORTO PLAZO' : 'BAJISTA CORTO PLAZO';
  }

  // Golden / Death Cross
  const goldenCross = sma50 && sma200 ? sma50 > sma200 : null;

  // 3. Osciladores de Momentum
  const rsi = calcularRSI(closes, 14) || 50;
  const macd = calcularMACD(closes);

  let estadoRsi = 'NEUTRAL';
  if (rsi <= 30) estadoRsi = 'SOBREVENTA_EXTREMA';
  else if (rsi <= 40) estadoRsi = 'ZONA_VALOR_SOBREVENTA';
  else if (rsi >= 70) estadoRsi = 'SOBRECOMPRA_EXTREMA';
  else if (rsi >= 60) estadoRsi = 'IMPULSO_ALTO';

  // 4. Volatilidad, Varianza y Bollinger
  const bollinger = calcularBollinger(closes, 20, 2);
  const atr = calcularATR(points, 14);
  const volHist = calcularVolatilidadHistorica(closes);

  // 5. Rango 52 Semanas y Caídas (Drawdown)
  let high52 = chartData.max_price;
  let low52 = chartData.min_price;
  try {
    const qRow = db.prepare('SELECT fifty_two_week_high, fifty_two_week_low FROM market_quotes WHERE UPPER(ticker) = ?').get(cleanTicker);
    if (qRow?.fifty_two_week_high) high52 = Math.max(high52, qRow.fifty_two_week_high);
    if (qRow?.fifty_two_week_low) low52 = Math.min(low52, qRow.fifty_two_week_low);
  } catch {}

  const dd52w = high52 > 0 ? Number((((currentPrice - high52) / high52) * 100).toFixed(1)) : 0;
  const distMin52w = low52 > 0 ? Number((((currentPrice - low52) / low52) * 100).toFixed(1)) : 0;
  const fibonacci = calcularFibonacci(high52, low52, currentPrice);

  // 6. Conexión con Valoración Intrínseca (Pilar 1) y Seguimiento
  const valPilar1 = obtenerValuacionTicker(cleanTicker, currentPrice);
  const fairValue = valPilar1?.fair_value_teorico || null;
  const techoMoS = valPilar1?.techo_maximo_compra || null;

  // Consultar datos de seguimiento en SQLite si existe
  let trackingInfo = null;
  try {
    const watchRow = db.prepare('SELECT added_price, created_at, notes, target_price FROM watchlist WHERE UPPER(ticker) = ?').get(cleanTicker);
    if (watchRow) {
      const addedP = watchRow.added_price;
      const chgSinceAddedPct = addedP > 0 ? Number((((currentPrice - addedP) / addedP) * 100).toFixed(2)) : 0;
      const chgSinceAddedAmount = Number((currentPrice - addedP).toFixed(2));
      trackingInfo = {
        added_price: addedP,
        created_at: watchRow.created_at,
        notes: watchRow.notes,
        target_price: watchRow.target_price || techoMoS,
        change_pct: chgSinceAddedPct,
        change_amount: chgSinceAddedAmount
      };
    }
  } catch {}

  // 7. Soportes y Resistencias Cuantitativos
  const soportes = [];
  const resistencias = [];

  if (bollinger?.lower) soportes.push({ tipo: 'Banda Bollinger Inferior', nivel: bollinger.lower });
  if (sma50 && sma50 < currentPrice) soportes.push({ tipo: 'Media Móvil SMA 50', nivel: sma50 });
  if (sma200 && sma200 < currentPrice) soportes.push({ tipo: 'Media Móvil Estructural SMA 200', nivel: sma200 });
  if (fibonacci?.fib61 && fibonacci.fib61 < currentPrice) soportes.push({ tipo: 'Soporte Fibonacci 61.8% (Golden Pocket)', nivel: fibonacci.fib61 });
  if (low52 && low52 < currentPrice) soportes.push({ tipo: 'Mínimo Anual 52W', nivel: low52 });

  if (bollinger?.upper) resistencias.push({ tipo: 'Banda Bollinger Superior', nivel: bollinger.upper });
  if (sma50 && sma50 > currentPrice) resistencias.push({ tipo: 'Media Móvil SMA 50', nivel: sma50 });
  if (sma200 && sma200 > currentPrice) resistencias.push({ tipo: 'Media Móvil Estructural SMA 200', nivel: sma200 });
  if (fibonacci?.fib38 && fibonacci.fib38 > currentPrice) resistencias.push({ tipo: 'Resistencia Fibonacci 38.2%', nivel: fibonacci.fib38 });
  if (high52 && high52 > currentPrice) resistencias.push({ tipo: 'Máximo Anual 52W', nivel: high52 });

  soportes.sort((a, b) => b.nivel - a.nivel); // El más cercano arriba
  resistencias.sort((a, b) => a.nivel - b.nivel); // La más cercana arriba

  const soporteInmediato = soportes[0]?.nivel || Number((currentPrice * 0.95).toFixed(2));
  const resistenciaInmediata = resistencias[0]?.nivel || Number((currentPrice * 1.08).toFixed(2));

  // 8. Dimensionamiento Cuantitativo de Riesgo: Stop Loss & Take Profit
  const atrVal = atr?.atr || Number((currentPrice * 0.03).toFixed(2));
  const stopLossSugerido = Number(Math.max(soporteInmediato * 0.98, currentPrice - 2.0 * atrVal).toFixed(2));
  const takeProfitSugerido = Number(Math.min(resistenciaInmediata, fairValue || currentPrice * 1.20).toFixed(2));
  
  const riesgoUnitario = Math.max(0.10, currentPrice - stopLossSugerido);
  const beneficioUnitario = Math.max(0.10, takeProfitSugerido - currentPrice);
  const ratioRiskReward = Number((beneficioUnitario / riesgoUnitario).toFixed(2));

  // 9. Score Técnico y Recomendación Sintética (0 a 100)
  let scoreTecnico = 50;

  // Tendencia (máx 25 pts)
  if (regimenTendencia === 'ALCISTA ESTRUCTURAL') scoreTecnico += 20;
  else if (regimenTendencia === 'RECUPERACIÓN SOBRE SMA 200') scoreTecnico += 15;
  else if (regimenTendencia === 'BAJISTA ESTRUCTURAL') scoreTecnico -= 20;
  else if (regimenTendencia === 'CORRECCIÓN BAJO SMA 200') scoreTecnico -= 10;

  // RSI (máx 30 pts)
  if (rsi <= 32) scoreTecnico += 25; // Sobreventa extrema = oportunidad de entrada técnica
  else if (rsi <= 42) scoreTecnico += 15;
  else if (rsi >= 72) scoreTecnico -= 25; // Sobrecompra extrema = riesgo de corrección inminente
  else if (rsi >= 62) scoreTecnico -= 10;

  // MACD (máx 15 pts)
  if (macd?.cruce === 'ALCISTA' && macd?.aceleracion === 'IMPULSO_POSITIVO') scoreTecnico += 15;
  else if (macd?.cruce === 'ALCISTA') scoreTecnico += 8;
  else if (macd?.cruce === 'BAJISTA' && macd?.aceleracion === 'IMPULSO_NEGATIVO') scoreTecnico -= 15;
  else if (macd?.cruce === 'BAJISTA') scoreTecnico -= 8;

  // Bollinger & Soporte (máx 15 pts)
  if (bollinger?.posicion === 'SOBREVENTA_INFERIOR') scoreTecnico += 15;
  else if (bollinger?.posicion === 'SOBRECOMPRA_SUPERIOR') scoreTecnico -= 15;

  // Valoración Pilar 1 (máx 15 pts)
  if (techoMoS && currentPrice <= techoMoS) scoreTecnico += 15;
  else if (fairValue && currentPrice <= fairValue) scoreTecnico += 5;
  else if (fairValue && currentPrice > fairValue * 1.25) scoreTecnico -= 10;

  scoreTecnico = Math.max(10, Math.min(95, scoreTecnico));

  // RECOMENDACIÓN FINAL TÉCNICA
  let recomendacion = 'ESPERAR';
  let badgeColor = 'accentYellow';
  let justificacionTecnica = '';

  if (scoreTecnico >= 70 && ratioRiskReward >= 1.5) {
    recomendacion = 'ENTRAR';
    badgeColor = 'statusGreen';
    justificacionTecnica = `Señales convergentes de entrada: Oscilador RSI en zona favorable (${rsi}), testeando soporte inmediato ($${soporteInmediato.toFixed(2)}) con ratio Riesgo/Beneficio positivo de ${ratioRiskReward}x. ${techoMoS && currentPrice <= techoMoS ? 'Alineado con Margen de Seguridad Fundamental.' : ''}`;
  } else if (scoreTecnico <= 35 || (regimenTendencia === 'BAJISTA ESTRUCTURAL' && rsi > 45)) {
    recomendacion = 'DESCARTAR';
    badgeColor = 'statusRed';
    justificacionTecnica = `Estructura técnica deteriorada: Presión bajista por debajo de medias clave, impulso negativo en MACD y riesgo de ruptura de soportes. Descartar compras hasta que consolide un suelo confirmado.`;
  } else if (rsi >= 70 || bollinger?.posicion === 'SOBRECOMPRA_SUPERIOR') {
    recomendacion = 'TOMAR_BENEFICIOS';
    badgeColor = 'accentYellow';
    justificacionTecnica = `Condición técnica de sobreextensión: RSI en sobrecompra (${rsi}) y cotización rozando la banda superior de Bollinger ($${bollinger?.upper || 0}). Alto riesgo de retroceso correctivo a corto plazo.`;
  } else {
    recomendacion = 'ESPERAR';
    badgeColor = 'accentSky';
    justificacionTecnica = `Fase de consolidación o rango lateral: Sin divergencias direccionales contundentes (RSI ${rsi}, MACD neutral). Esperar confirmación de ruptura de resistencia ($${resistenciaInmediata.toFixed(2)}) o retroceso hacia soporte ($${soporteInmediato.toFixed(2)}).`;
  }

  // 10. Matriz Detallada de Riesgos
  const alertasRiesgo = [];

  if (volHist && volHist.volatilidad_anual_pct > 35) {
    alertasRiesgo.push({
      nivel: 'ALTO',
      titulo: 'Alta Varianza y Dispersión de Retornos',
      detalle: `Volatilidad histórica anualizada del ${volHist.volatilidad_anual_pct}% (ATR diario del ${atr?.atr_pct}%). Requiere tamaño de posición moderado para absorber fluctuaciones bruscas.`
    });
  }

  if (currentPrice < (sma200 || 0)) {
    alertasRiesgo.push({
      nivel: 'MODERADO_ALTO',
      titulo: 'Régimen Bajo la Media Móvil de 200 Sesiones',
      detalle: `Cotiza un ${Math.abs(precioVsSma200 || 0)}% por debajo de su SMA 200 ($${sma200}). Cada rebote puede actuar como resistencia técnica de vendedores institucionales.`
    });
  }

  if (dd52w <= -35.0) {
    alertasRiesgo.push({
      nivel: 'ALTO',
      titulo: 'Drawdown Profundo (Riesgo de Falling Knife)',
      detalle: `Caída del ${Math.abs(dd52w)}% desde el máximo de 52 semanas ($${high52}). Aunque ofrece descuento, verificar que no exista deterioro estructural de solvencia.`
    });
  }

  if (bollinger?.squeeze) {
    alertasRiesgo.push({
      nivel: 'ATENCIÓN',
      titulo: 'Compresión Extrema de Volatilidad (Bollinger Squeeze)',
      detalle: `El ancho de banda de Bollinger está comprimido en ${bollinger.bandwidth}%. Históricamente precede a un movimiento de alta velocidad y ruptura direccional.`
    });
  }

  return {
    ticker: cleanTicker,
    current_price: currentPrice,
    currency: chartData.currency || 'USD',
    timeframe,
    tracking_info: trackingInfo,
    tendencia: {
      regimen: regimenTendencia,
      sma20,
      sma50,
      sma200,
      precio_vs_sma20_pct: precioVsSma20,
      precio_vs_sma50_pct: precioVsSma50,
      precio_vs_sma200_pct: precioVsSma200,
      golden_cross: goldenCross
    },
    momentum: {
      rsi,
      estado_rsi: estadoRsi,
      macd
    },
    volatilidad: {
      bollinger,
      atr,
      volatilidad_historica: volHist
    },
    niveles: {
      high_52w: high52,
      low_52w: low52,
      drawdown_52w_pct: dd52w,
      distancia_minimo_52w_pct: distMin52w,
      fibonacci,
      soportes,
      resistencias,
      soporte_inmediato: soporteInmediato,
      resistencia_inmediata: resistenciaInmediata
    },
    gestion_riesgo: {
      stop_loss_sugerido: stopLossSugerido,
      take_profit_sugerido: takeProfitSugerido,
      riesgo_unitario_usd: Number(riesgoUnitario.toFixed(2)),
      beneficio_unitario_usd: Number(beneficioUnitario.toFixed(2)),
      ratio_risk_reward: ratioRiskReward,
      distancia_stop_pct: Number((((currentPrice - stopLossSugerido) / currentPrice) * 100).toFixed(1)),
      potencial_take_profit_pct: Number((((takeProfitSugerido - currentPrice) / currentPrice) * 100).toFixed(1))
    },
    curva_valoracion: {
      fair_value: fairValue,
      techo_mos: techoMoS,
      estado_pilar1: valPilar1?.estado_compra || 'NO_DISPONIBLE',
      sobreprecio_vs_fair_pct: fairValue ? Number((((currentPrice - fairValue) / fairValue) * 100).toFixed(1)) : null
    },
    sintesis: {
      score_tecnico: scoreTecnico,
      recomendacion,
      badge_color: badgeColor,
      justificacion: justificacionTecnica,
      alertas_riesgo: alertasRiesgo
    }
  };
}
