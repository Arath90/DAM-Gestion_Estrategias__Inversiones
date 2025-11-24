// src/utils/divergences.js

// detecta picos locales
export function detectLocalPeaks(series = [], window = 3, type = 'max') {
  const peaks = [];
  const n = series.length;
  if (n === 0) return peaks;
  for (let i = window; i < n - window; i++) {
    const center = series[i];
    let isPeak = true;
    for (let j = 1; j <= window; j++) {
      if (type === 'max') {
        if (!(center > series[i - j] && center > series[i + j])) { isPeak = false; break; }
      } else {
        if (!(center < series[i - j] && center < series[i + j])) { isPeak = false; break; }
      }
    }
    if (isPeak) peaks.push({ index: i, value: center });
  }
  return peaks;
}

function findNearestPeak(peaksArray, targetIndex, maxDistance = 10) {
  if (!peaksArray || !peaksArray.length) return null;
  let best = null;
  let bestDist = Infinity;
  for (const pk of peaksArray) {
    const dist = Math.abs(pk.index - targetIndex);
    if (dist < bestDist && dist <= maxDistance) {
      bestDist = dist;
      best = pk;
    }
  }
  return best;
}

// encuentra divergencias entre priceSeries (por ejemplo highs o lows) y indicatorSeries (RSI)
export function findDivergences(priceSeries = [], indicatorSeries = [], options = {}) {
  const {
    peakWindow = 5, // Aumentado: Un pico debe ser el extremo en una ventana de 5 velas a cada lado (más significativo)
    maxBarsBetweenPeaks = 60, // Mantenido o ajustado. Un rango de 40 a 60 barras es razonable.
    minBarsBetweenPeaks = 5, // Aumentado: Se requiere al menos 5 barras entre picos para filtrar ruido.
    minPriceChangePct = 0.005, // Aumentado a 0.5%: El cambio de precio debe ser más significativo.
    minIndicatorChangePct = 0.02, // Aumentado a 2%: El cambio de indicador (RSI) debe ser más notable.
    maxPeakDistance = 5
  } = options;

  const priceHighPeaks = detectLocalPeaks(priceSeries, peakWindow, 'max');
  const priceLowPeaks  = detectLocalPeaks(priceSeries, peakWindow, 'min');
  const indHighPeaks   = detectLocalPeaks(indicatorSeries, peakWindow, 'max');
  const indLowPeaks    = detectLocalPeaks(indicatorSeries, peakWindow, 'min');

  const divergences = [];

  // Bearish (price HH, indicator LH)
  for (let i = 0; i < priceHighPeaks.length - 1; i++) {
    const p1 = priceHighPeaks[i];
    for (let j = i + 1; j < priceHighPeaks.length; j++) {
      const p2 = priceHighPeaks[j];
      const barsBetween = p2.index - p1.index;
      if (barsBetween < minBarsBetweenPeaks) continue;
      if (barsBetween > maxBarsBetweenPeaks) break;

      const r1 = findNearestPeak(indHighPeaks, p1.index, maxPeakDistance);
      const r2 = findNearestPeak(indHighPeaks, p2.index, maxPeakDistance);
      if (!r1 || !r2) continue;

      if (p2.value <= p1.value * (1 + minPriceChangePct)) continue; // price not higher enough
      if (r2.value >= r1.value * (1 - minIndicatorChangePct)) continue; // indicator not lower enough

      const priceDeltaPct = (p2.value - p1.value) / (Math.abs(p1.value) || 1);
      const indDeltaPct = (r1.value - r2.value) / (Math.abs(r1.value) || 1);
      const score = priceDeltaPct * indDeltaPct;

      divergences.push({
        type: 'bearish',
        p1Index: p1.index, p2Index: p2.index,
        r1Index: r1.index, r2Index: r2.index,
        priceDeltaPct, indDeltaPct, score
      });
    }
  }

  // Bullish (price LL, indicator HL)
  for (let i = 0; i < priceLowPeaks.length - 1; i++) {
    const p1 = priceLowPeaks[i];
    for (let j = i + 1; j < priceLowPeaks.length; j++) {
      const p2 = priceLowPeaks[j];
      const barsBetween = p2.index - p1.index;
      if (barsBetween < minBarsBetweenPeaks) continue;
      if (barsBetween > maxBarsBetweenPeaks) break;

      const r1 = findNearestPeak(indLowPeaks, p1.index, maxPeakDistance);
      const r2 = findNearestPeak(indLowPeaks, p2.index, maxPeakDistance);
      if (!r1 || !r2) continue;

      if (p2.value >= p1.value * (1 - minPriceChangePct)) continue; // price not lower enough
      if (r2.value <= r1.value * (1 + minIndicatorChangePct)) continue; // indicator not higher enough

      const priceDeltaPct = (p1.value - p2.value) / (Math.abs(p1.value) || 1);
      const indDeltaPct = (r2.value - r1.value) / (Math.abs(r1.value) || 1);
      const score = priceDeltaPct * indDeltaPct;

      divergences.push({
        type: 'bullish',
        p1Index: p1.index, p2Index: p2.index,
        r1Index: r1.index, r2Index: r2.index,
        priceDeltaPct, indDeltaPct, score
      });
    }
  }

  return divergences;
}