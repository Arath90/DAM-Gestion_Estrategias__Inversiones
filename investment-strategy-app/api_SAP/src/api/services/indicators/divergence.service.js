const { computeRSI } = require('./rsi.service');
const { findPivots } = require('./pivots.service');

/**
 * Detecta divergencias precio vs RSI y expone indices de pivotes de precio (idx1/idx2) y RSI (r1Idx/r2Idx).
 */
function detectRSIDivergences(
  candles,
  {
    period = 14,
    source = 'close',
    swingLen = 5,
    minDistance = 5,
    rsiHigh = 70,
    rsiLow = 30,
    useZones = false,
  } = {},
) {
  if (!Array.isArray(candles) || candles.length < period + swingLen + 2) {
    return { rsi: [], signals: [] };
  }

  const closeArr = candles.map((c) => c[source] ?? c.close);
  const rsi = computeRSI(candles, { period, source });
  const pricePiv = findPivots(closeArr, { swingLen });
  const rsiPiv = findPivots(rsi, { swingLen });

  const signals = [];

  // Bearish: Higher High en precio / Lower High en RSI
  for (let i = 1; i < pricePiv.highs.length; i += 1) {
    const p1 = pricePiv.highs[i - 1];
    const p2 = pricePiv.highs[i];
    if (p2.idx - p1.idx < minDistance) continue;
    if (!(p2.val > p1.val)) continue;

    const r1 = nearestPivot(rsiPiv.highs, p1.idx);
    const r2 = nearestPivot(rsiPiv.highs, p2.idx);
    if (!r1 || !r2) continue;

    if (useZones && !((r1.val >= rsiHigh) || (r2.val >= rsiHigh))) continue;

    if (r2.val < r1.val) {
      signals.push({
        kind: 'bearish_divergence',
        type: 'bearish',
        idx1: p1.idx,
        idx2: p2.idx,
        r1Idx: r1.idx,
        r2Idx: r2.idx,
        price: { p1: p1.val, p2: p2.val },
        rsi: { r1: r1.val, r2: r2.val },
        strength: divergenceStrength({ a1: p1.val, a2: p2.val, b1: r1.val, b2: r2.val }),
        meta: { period, swingLen, minDistance, rsiHigh, rsiLow },
      });
    }
  }

  // Bullish: Lower Low en precio / Higher Low en RSI
  for (let i = 1; i < pricePiv.lows.length; i += 1) {
    const p1 = pricePiv.lows[i - 1];
    const p2 = pricePiv.lows[i];
    if (p2.idx - p1.idx < minDistance) continue;
    if (!(p2.val < p1.val)) continue;

    const r1 = nearestPivot(rsiPiv.lows, p1.idx);
    const r2 = nearestPivot(rsiPiv.lows, p2.idx);
    if (!r1 || !r2) continue;

    if (useZones && !((r1.val <= rsiLow) || (r2.val <= rsiLow))) continue;

    if (r2.val > r1.val) {
      signals.push({
        kind: 'bullish_divergence',
        type: 'bullish',
        idx1: p1.idx,
        idx2: p2.idx,
        r1Idx: r1.idx,
        r2Idx: r2.idx,
        price: { p1: p1.val, p2: p2.val },
        rsi: { r1: r1.val, r2: r2.val },
        strength: divergenceStrength({ a1: p1.val, a2: p2.val, b1: r1.val, b2: r2.val }),
        meta: { period, swingLen, minDistance, rsiHigh, rsiLow },
      });
    }
  }

  return { rsi, signals };
}

function nearestPivot(pivots, idx, maxLag = 5) {
  let best = null;
  let bestD = Infinity;
  for (const p of pivots) {
    const d = Math.abs(p.idx - idx);
    if (d < bestD && d <= maxLag) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

function divergenceStrength({ a1, a2, b1, b2 }) {
  const priceSlope = (a2 - a1) / Math.abs(a1 || 1);
  const rsiSlope = (b2 - b1) / 100;
  const opp = Math.max(0, Math.abs(priceSlope) + Math.abs(rsiSlope));
  return Math.min(1, opp);
}

module.exports = { detectRSIDivergences };
