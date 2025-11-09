const { computeRSI } = require('./rsi.service');
const { findPivots }  = require('./pivots.service');

/**
 * Detecta divergencias precio vs RSI.
 * - Bearish: precio HH y RSI LH (máximos consecutivos).
 * - Bullish: precio LL y RSI HL (mínimos consecutivos).
 *
 * Params:
 *  period: RSI (p.ej. 14)
 *  swingLen: ventana para pivotes (p.ej. 3-8)
 *  minDistance: separación mínima entre pivotes (velas) para evitar ruido
 *  rsiHigh/rsiLow: umbrales 70/30 u 80/20 para filtrar pivotes "en zona"
 *  useZones: si true, exige que el pivote de rsi esté > rsiHigh (bearish) o < rsiLow (bullish)
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
  if (!Array.isArray(candles) || candles.length < period + swingLen + 2) return { rsi: [], signals: [] };

  const closeArr = candles.map(c => c[source] ?? c.close);
  const rsi = computeRSI(candles, { period, source });
  const pricePiv = findPivots(closeArr, { swingLen });
  const rsiPiv   = findPivots(rsi,       { swingLen });

  const signals = [];

  // ---- Bearish divergence (HH price / LH RSI) ----
  for (let i = 1; i < pricePiv.highs.length; i++) {
    const p1 = pricePiv.highs[i - 1], p2 = pricePiv.highs[i];
    if (p2.idx - p1.idx < minDistance) continue;               // demasiado cerca
    if (!(p2.val > p1.val)) continue;                          // no hay HH en precio

    // Busca highs de RSI cercanos temporalmente a p1 y p2
    const r1 = nearestPivot(rsiPiv.highs, p1.idx);
    const r2 = nearestPivot(rsiPiv.highs, p2.idx);
    if (!r1 || !r2) continue;
    if (useZones && !((r1.val >= rsiHigh) || (r2.val >= rsiHigh))) continue; // exigir zona alta

    if (r2.val < r1.val) {
      signals.push({
        type: 'bearish_divergence',
        idx1: p1.idx, idx2: p2.idx,
        price: { p1: p1.val, p2: p2.val },
        rsi:   { r1: r1.val, r2: r2.val },
        strength: divergenceStrength({ a1: p1.val, a2: p2.val, b1: r1.val, b2: r2.val }),
        meta: { period, swingLen, minDistance, rsiHigh, rsiLow }
      });
    }
  }

  // ---- Bullish divergence (LL price / HL RSI) ----
  for (let i = 1; i < pricePiv.lows.length; i++) {
    const p1 = pricePiv.lows[i - 1], p2 = pricePiv.lows[i];
    if (p2.idx - p1.idx < minDistance) continue;
    if (!(p2.val < p1.val)) continue;                           // no hay LL en precio

    const r1 = nearestPivot(rsiPiv.lows, p1.idx);
    const r2 = nearestPivot(rsiPiv.lows, p2.idx);
    if (!r1 || !r2) continue;
    if (useZones && !((r1.val <= rsiLow) || (r2.val <= rsiLow))) continue; // exigir zona baja

    if (r2.val > r1.val) {
      signals.push({
        type: 'bullish_divergence',
        idx1: p1.idx, idx2: p2.idx,
        price: { p1: p1.val, p2: p2.val },
        rsi:   { r1: r1.val, r2: r2.val },
        strength: divergenceStrength({ a1: p1.val, a2: p2.val, b1: r1.val, b2: r2.val }),
        meta: { period, swingLen, minDistance, rsiHigh, rsiLow }
      });
    }
  }

  return { rsi, signals };
}

// Pivot de rsi más cercano a un índice temporal de precio
function nearestPivot(pivots, idx, maxLag = 5) {
  let best = null, bestD = Infinity;
  for (const p of pivots) {
    const d = Math.abs(p.idx - idx);
    if (d < bestD && d <= maxLag) { best = p; bestD = d; }
  }
  return best;
}

// Métrica simple de fuerza de divergencia (normalizada 0..1 aprox)
function divergenceStrength({ a1, a2, b1, b2 }) {
  const priceSlope = (a2 - a1) / Math.abs(a1);
  const rsiSlope   = (b2 - b1) / 100; // RSI 0..100
  const opp = Math.max(0, Math.abs(priceSlope) + Math.abs(rsiSlope));
  return Math.min(1, opp); // 0..1
}

module.exports = { detectRSIDivergences };
