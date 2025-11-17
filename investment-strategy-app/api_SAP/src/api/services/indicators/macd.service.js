// src/api/services/indicators/macd.service.js
// -----------------------------------------------------------
// Cálculo del MACD clásico (12, 26, 9 por defecto)
// -----------------------------------------------------------
//
// MACD line   = EMA(fastPeriod) - EMA(slowPeriod)
// Signal line = EMA( MACD line, signalPeriod )
// Histogram   = MACD line - Signal line
//
// Devuelve 3 arrays alineados con la serie de precios:
//   - macd[i]      → valor MACD en esa vela (o null si no hay datos suficientes)
//   - signal[i]    → valor de la línea de señal
//   - histogram[i] → diferencia macd - signal (momentum)
// -----------------------------------------------------------

/**
 * Calcula una EMA (Exponential Moving Average) sobre una serie de valores.
 * Usa como semilla la media simple de los primeros `period` valores no nulos.
 *
 * @param {number[]} values - Serie numérica (p.ej. cierres o MACD line).
 * @param {number} period - Periodo de suavizado.
 * @returns {Array<number|null>} Array de igual longitud con la EMA o null donde no hay suficiente data.
 */
function computeEMA(values, period) {
  if (!Array.isArray(values) || values.length < period) {
    return new Array(values?.length || 0).fill(null);
  }

  const out = new Array(values.length).fill(null);
  const alpha = 2 / (period + 1);

  let sum = 0;
  let count = 0;
  let ema = null;
  let startIdx = -1;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || Number.isNaN(v)) {
      out[i] = null;
      continue;
    }
    sum += v;
    count++;

    if (count === period) {
      ema = sum / period;
      out[i] = ema;
      startIdx = i + 1;
      break;
    }
  }

  if (ema == null) return out;

  for (let i = startIdx; i < values.length; i++) {
    const v = values[i];
    if (v == null || Number.isNaN(v)) {
      out[i] = ema;
      continue;
    }
    ema = (v - ema) * alpha + ema;
    out[i] = ema;
  }

  return out;
}

/**
 * Cálculo del MACD sobre una serie de velas.
 *
 * @param {Array<Object>} candles - Velas con campo `source` (p.ej. close) o al menos `close`.
 * @param {Object} options
 * @param {number} [options.fastPeriod=12]  - Periodo EMA rápido.
 * @param {number} [options.slowPeriod=26]  - Periodo EMA lento.
 * @param {number} [options.signalPeriod=9] - Periodo EMA de la línea de señal.
 * @param {string} [options.source='close'] - Campo de la vela a usar (close por defecto).
 *
 * @returns {{
 *   macd:      Array<number|null>,
 *   signal:    Array<number|null>,
 *   histogram: Array<number|null>
 * }}
 */
function computeMACD(
  candles,
  {
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9,
    source = 'close',
  } = {}
) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      macd: [],
      signal: [],
      histogram: [],
    };
  }

  const prices = candles.map((c) => {
    const v = c?.[source];
    if (v != null && Number.isFinite(Number(v))) return Number(v);
    if (c?.close != null && Number.isFinite(Number(c.close))) return Number(c.close);
    return null;
  });

  const emaFast = computeEMA(prices, fastPeriod);
  const emaSlow = computeEMA(prices, slowPeriod);

  const length = prices.length;
  const macd = new Array(length).fill(null);

  for (let i = 0; i < length; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];
    macd[i] = f == null || s == null ? null : f - s;
  }

  const signal = computeEMA(macd, signalPeriod);

  const histogram = new Array(length).fill(null);
  for (let i = 0; i < length; i++) {
    const m = macd[i];
    const sig = signal[i];
    histogram[i] = m == null || sig == null ? null : m - sig;
  }

  return { macd, signal, histogram };
}

module.exports = {
  computeEMA,
  computeMACD,
};
