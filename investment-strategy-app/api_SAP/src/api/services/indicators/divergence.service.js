// src/api/services/indicators/divergence.service.js
// ---------------------------------------------------
// Servicio encargado de detectar divergencias entre el precio y el RSI.
// ---------------------------------------------------
//
// Una divergencia ocurre cuando el precio y el RSI (Relative Strength Index)
// muestran direcciones opuestas, lo que puede anticipar un cambio de tendencia.
//
// • Divergencia bajista (bearish): el precio hace "Higher High" (HH) pero el RSI hace "Lower High" (LH)
// • Divergencia alcista (bullish): el precio hace "Lower Low" (LL) pero el RSI hace "Higher Low" (HL)
//
// Este servicio se usa en los módulos de análisis técnico y generación de señales.
// ---------------------------------------------------

// Dependencias: módulos auxiliares de indicadores técnicos
const { computeRSI } = require('./rsi.service');     // Calcula el RSI sobre las velas
const { findPivots }  = require('./pivots.service'); // Encuentra máximos y mínimos locales

/**
 * Detecta divergencias entre el precio y el RSI.
 *
 * @param {Array<Object>} candles - Serie de velas con al menos un campo "close".
 * @param {Object} options - Configuración de detección.
 * @param {number} [options.period=14]       - Periodo del RSI.
 * @param {string} [options.source='close']  - Campo del candle a analizar.
 * @param {number} [options.swingLen=5]      - Ventana de pivotes (velas a cada lado).
 * @param {number} [options.minDistance=5]   - Separación mínima entre pivotes consecutivos.
 * @param {number} [options.rsiHigh=70]      - Umbral de sobrecompra.
 * @param {number} [options.rsiLow=30]       - Umbral de sobreventa.
 * @param {boolean}[options.useZones=false]  - Si true, exige que los pivotes RSI estén dentro de zonas extremas.
 *
 * @returns {Object} { rsi: Array<number>, signals: Array<Object> }
 */
function detectRSIDivergences(candles, {
  period = 14,
  source = 'close',
  swingLen = 5,
  minDistance = 5,
  rsiHigh = 70,
  rsiLow = 30,
  useZones = false
} = {}) {

  // Si no hay suficientes velas, no se puede calcular RSI ni pivotes
  if (!Array.isArray(candles) || candles.length < period + swingLen + 2)
    return { rsi: [], signals: [] };

  // Extrae los precios de cierre (u otro campo definido)
  const closeArr = candles.map(c => c[source] ?? c.close);

  // Calcula RSI para cada vela
  const rsi = computeRSI(candles, { period, source });

  // Detecta máximos y mínimos locales en precio y en RSI
  const pricePiv = findPivots(closeArr, { swingLen });
  const rsiPiv   = findPivots(rsi,       { swingLen });

  // Array donde se guardarán las divergencias encontradas
  const signals = [];

  // ============================================================
  // DIVERGENCIAS BAJISTAS (Bearish): Precio HH / RSI LH
  // ============================================================
  for (let i = 1; i < pricePiv.highs.length; i++) {
    // p1 y p2 son dos máximos consecutivos del precio
    const p1 = pricePiv.highs[i - 1], p2 = pricePiv.highs[i];

    // Ignorar si están demasiado cerca (ruido)
    if (p2.idx - p1.idx < minDistance) continue;

    // Requiere que el segundo máximo sea más alto (Higher High)
    if (!(p2.val > p1.val)) continue;

    // Busca los pivotes RSI más cercanos temporalmente a esos picos
    const r1 = nearestPivot(rsiPiv.highs, p1.idx);
    const r2 = nearestPivot(rsiPiv.highs, p2.idx);
    if (!r1 || !r2) continue;

    // Si se usan zonas, validar que RSI esté en sobrecompra
    if (useZones && !((r1.val >= rsiHigh) || (r2.val >= rsiHigh))) continue;

    // Confirmar divergencia: RSI hace un Lower High
    if (r2.val < r1.val) {
      signals.push({
        type: 'bearish_divergence',      // tipo de divergencia
        idx1: p1.idx, idx2: p2.idx,      // índices de las velas correspondientes
        price: { p1: p1.val, p2: p2.val },
        rsi:   { r1: r1.val, r2: r2.val },
        strength: divergenceStrength({   // métrica 0..1 de fuerza
          a1: p1.val, a2: p2.val, b1: r1.val, b2: r2.val
        }),
        meta: { period, swingLen, minDistance, rsiHigh, rsiLow } // contexto del cálculo
      });
    }
  }

  // ============================================================
  // DIVERGENCIAS ALCISTAS (Bullish): Precio LL / RSI HL
  // ============================================================
  for (let i = 1; i < pricePiv.lows.length; i++) {
    // p1 y p2 son dos mínimos consecutivos del precio
    const p1 = pricePiv.lows[i - 1], p2 = pricePiv.lows[i];

    // Evitar ruido (pivotes muy próximos)
    if (p2.idx - p1.idx < minDistance) continue;

    // Requiere Lower Low en el precio
    if (!(p2.val < p1.val)) continue;

    // Busca los pivotes del RSI más cercanos
    const r1 = nearestPivot(rsiPiv.lows, p1.idx);
    const r2 = nearestPivot(rsiPiv.lows, p2.idx);
    if (!r1 || !r2) continue;

    // Si se usan zonas, validar que RSI esté en sobreventa
    if (useZones && !((r1.val <= rsiLow) || (r2.val <= rsiLow))) continue;

    // Confirmar divergencia: RSI hace un Higher Low
    if (r2.val > r1.val) {
      signals.push({
        type: 'bullish_divergence',
        idx1: p1.idx, idx2: p2.idx,
        price: { p1: p1.val, p2: p2.val },
        rsi:   { r1: r1.val, r2: r2.val },
        strength: divergenceStrength({
          a1: p1.val, a2: p2.val, b1: r1.val, b2: r2.val
        }),
        meta: { period, swingLen, minDistance, rsiHigh, rsiLow }
      });
    }
  }

  // Devuelve la serie RSI completa y las señales encontradas
  return { rsi, signals };
}

/**
 * Busca el pivote (máximo o mínimo) más cercano a un índice de precio.
 *
 * @param {Array<Object>} pivots - Lista de pivotes [{ idx, val }]
 * @param {number} idx - Índice de referencia (por ejemplo, de un pivote de precio)
 * @param {number} [maxLag=5] - Distancia máxima permitida (en velas)
 * @returns {Object|null} pivote más cercano o null si no hay ninguno dentro del rango
 */
function nearestPivot(pivots, idx, maxLag = 5) {
  let best = null, bestD = Infinity;
  for (const p of pivots) {
    const d = Math.abs(p.idx - idx);     // diferencia temporal
    // Elige el más cercano dentro del rango permitido
    if (d < bestD && d <= maxLag) { best = p; bestD = d; }
  }
  return best;
}

/**
 * Calcula una métrica simple de "fuerza" de divergencia.
 * Se basa en la diferencia relativa entre las pendientes del precio y del RSI.
 *
 * @param {Object} params
 * @param {number} params.a1 - Primer valor de precio
 * @param {number} params.a2 - Segundo valor de precio
 * @param {number} params.b1 - Primer valor de RSI
 * @param {number} params.b2 - Segundo valor de RSI
 *
 * @returns {number} fuerza normalizada (0..1)
 */
function divergenceStrength({ a1, a2, b1, b2 }) {
  const priceSlope = (a2 - a1) / Math.abs(a1); // pendiente del precio
  const rsiSlope   = (b2 - b1) / 100;          // pendiente del RSI (escala 0–100)
  const opp = Math.max(0, Math.abs(priceSlope) + Math.abs(rsiSlope));
  return Math.min(1, opp);                     // normaliza a 0..1
}

// Exporta la función principal para que pueda ser usada por otros módulos
module.exports = { detectRSIDivergences };
