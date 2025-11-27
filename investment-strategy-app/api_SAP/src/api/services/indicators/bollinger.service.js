// src/api/services/indicators/bollinger.service.js

/**
 * Calcula Bandas de Bollinger a partir de velas.
 * Bollinger clásica: media móvil simple + N desviaciones estándar.
 *
 * @param {Array<Object>} candles  Arreglo de velas (debe tener close o el campo source)
 * @param {Object} opts
 * @param {number} opts.period     Longitud de la ventana (default 20)
 * @param {number} opts.stdDev     Multiplicador de desviación estándar (default 2)
 * @param {string} opts.source     Campo a usar como precio (default 'close')
 *
 * @returns {{ middle: number[], upper: number[], lower: number[] }}
 */
function computeBollinger(candles, opts = {}) {
  const {
    period = 20,
    stdDev = 2,
    source = 'close',
  } = opts;

  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      middle: [],
      upper: [],
      lower: [],
    };
  }

  const prices = candles.map(c => {
    const value = c?.[source] ?? c?.close;
    const num = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(num) ? num : null;
  });

  const n = prices.length;
  const middle = new Array(n).fill(null);
  const upper = new Array(n).fill(null);
  const lower = new Array(n).fill(null);

  // Ventana móvil simple + desviación estándar (no optimizado pero claro)
  for (let i = 0; i < n; i++) {
    // Hasta que no tengamos "period" datos válidos, dejamos null
    if (i < period - 1) continue;

    let sum = 0;
    let count = 0;
    let window = [];

    for (let j = i - period + 1; j <= i; j++) {
      const p = prices[j];
      if (p == null) {
        // Si hay datos inválidos en la ventana, cancelamos el cálculo
        window = null;
        break;
      }
      sum += p;
      count++;
      window.push(p);
    }

    if (!window || count !== period) {
      continue;
    }

    const mean = sum / period;

    // varianza poblacional simple
    let varSum = 0;
    for (const p of window) {
      const diff = p - mean;
      varSum += diff * diff;
    }

    const variance = varSum / period;
    const sigma = Math.sqrt(variance);

    middle[i] = mean;
    upper[i] = mean + stdDev * sigma;
    lower[i] = mean - stdDev * sigma;
  }

  return { middle, upper, lower };
}

module.exports = {
  computeBollinger,
};