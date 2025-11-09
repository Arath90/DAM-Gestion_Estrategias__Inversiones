// Detecta pivotes con una ventana izquierda/derecha (swingLen)
function findPivots(series, { swingLen = 3 }) {
  const highs = [], lows = [];
  const n = series.length;
  const L = Math.max(1, swingLen);

  for (let i = L; i < n - L; i++) {
    const v = series[i];
    if (v == null) continue;

    let isHigh = true, isLow = true;
    for (let k = 1; k <= L; k++) {
      if (series[i - k] == null || series[i + k] == null) { isHigh = isLow = false; break; }
      if (series[i - k] >= v || series[i + k] >= v) isHigh = false;
      if (series[i - k] <= v || series[i + k] <= v) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push({ idx: i, val: v });
    if (isLow)  lows.push ({ idx: i, val: v });
  }
  return { highs, lows };
}

module.exports = { findPivots };
