// frontend/src/utils/events.js
// utilidades para detectar eventos (cruces, extremos, divergencias) y exportar CSV

export function detectLocalPeaks(series = [], window = 3, type = 'max') {
  const peaks = [];
  const n = series.length;
  if (n === 0) return peaks;
  for (let i = window; i < n - window; i++) {
    const center = series[i];
    if (center == null || Number.isNaN(center)) continue;
    let ok = true;
    for (let j = 1; j <= window; j++) {
      if (type === 'max') {
        if (!(center > series[i - j] && center > series[i + j])) { ok = false; break; }
      } else {
        if (!(center < series[i - j] && center < series[i + j])) { ok = false; break; }
      }
    }
    if (ok) peaks.push({ index: i, value: center });
  }
  return peaks;
}

export function detectCrosses(candles = [], indicators = {}, cfg = {}) {
  // indicators: { ema20: [ {time, value} ] or [value], ema50, rsi: [value] or [{time,value}], macd: {macd:[], signal:[]}, bb: {upper,lower}}
  const events = [];
  if (!Array.isArray(candles) || candles.length < 2) return events;

  const rsiOversold = cfg.rsiOversold ?? 30;
  const rsiOverbought = cfg.rsiOverbought ?? 70;

  // Helper: get indicator value aligned by index
  const getByIndex = (arr, i) => {
    if (!arr) return null;
    // if array of objects {time,value}
    if (arr[0] && typeof arr[0] === 'object') return arr[i] ? arr[i].value ?? null : null;
    return arr[i] ?? null;
  };

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];

    // EMA cross (ejemplo EMA20 vs close)
    const ema20Prev = getByIndex(indicators.ema20, i - 1);
    const ema20Cur = getByIndex(indicators.ema20, i);
    if (ema20Prev != null && ema20Cur != null) {
      if (prev.close < ema20Prev && cur.close >= ema20Cur) {
        events.push({
          type: 'CROSS_UP',
          indicator: 'EMA20',
          time: cur.time,
          timeIndex: i,
          price: cur.close,
          indicator_value: ema20Cur,
          reason: 'Close crossed above EMA20'
        });
      } else if (prev.close > ema20Prev && cur.close <= ema20Cur) {
        events.push({
          type: 'CROSS_DOWN',
          indicator: 'EMA20',
          time: cur.time,
          timeIndex: i,
          price: cur.close,
          indicator_value: ema20Cur,
          reason: 'Close crossed below EMA20'
        });
      }
    }

    // EMA50
    const ema50Prev = getByIndex(indicators.ema50, i - 1);
    const ema50Cur = getByIndex(indicators.ema50, i);
    if (ema50Prev != null && ema50Cur != null) {
      if (prev.close < ema50Prev && cur.close >= ema50Cur) {
        events.push({
          type: 'CROSS_UP',
          indicator: 'EMA50',
          time: cur.time,
          timeIndex: i,
          price: cur.close,
          indicator_value: ema50Cur,
          reason: 'Close crossed above EMA50'
        });
      } else if (prev.close > ema50Prev && cur.close <= ema50Cur) {
        events.push({
          type: 'CROSS_DOWN',
          indicator: 'EMA50',
          time: cur.time,
          timeIndex: i,
          price: cur.close,
          indicator_value: ema50Cur,
          reason: 'Close crossed below EMA50'
        });
      }
    }

    // RSI threshold crosses
    const rsiPrev = getByIndex(indicators.rsi, i - 1);
    const rsiCur = getByIndex(indicators.rsi, i);
    if (rsiPrev != null && rsiCur != null) {
      if (rsiPrev < rsiOversold && rsiCur >= rsiOversold) {
        events.push({
          type: 'RSI_UP',
          indicator: 'RSI',
          time: cur.time,
          timeIndex: i,
          price: cur.close,
          indicator_value: rsiCur,
          reason: `RSI crossed above ${rsiOversold}`
        });
      } else if (rsiPrev > rsiOverbought && rsiCur <= rsiOverbought) {
        events.push({
          type: 'RSI_DOWN',
          indicator: 'RSI',
          time: cur.time,
          timeIndex: i,
          price: cur.close,
          indicator_value: rsiCur,
          reason: `RSI crossed below ${rsiOverbought}`
        });
      }
    }

    // MACD cross (macd vs signal) si existen
    if (indicators.macd && Array.isArray(indicators.macd.macd) && Array.isArray(indicators.macd.signal)) {
      const macdPrev = indicators.macd.macd[i - 1];
      const macdCur = indicators.macd.macd[i];
      const sigPrev = indicators.macd.signal[i - 1];
      const sigCur = indicators.macd.signal[i];
      if (macdPrev != null && macdCur != null && sigPrev != null && sigCur != null) {
        if (macdPrev < sigPrev && macdCur >= sigCur) {
          events.push({
            type: 'MACD_CROSS_UP',
            indicator: 'MACD',
            time: cur.time,
            timeIndex: i,
            price: cur.close,
            indicator_value: macdCur,
            reason: 'MACD crossed above signal'
          });
        } else if (macdPrev > sigPrev && macdCur <= sigCur) {
          events.push({
            type: 'MACD_CROSS_DOWN',
            indicator: 'MACD',
            time: cur.time,
            timeIndex: i,
            price: cur.close,
            indicator_value: macdCur,
            reason: 'MACD crossed below signal'
          });
        }
      }
    }

    // Bollinger (si está en indicators.bb)
    if (indicators.bb && indicators.bb.lower && indicators.bb.upper) {
      const lowerPrev = indicators.bb.lower[i - 1];
      const lowerCur = indicators.bb.lower[i];
      const upperPrev = indicators.bb.upper[i - 1];
      const upperCur = indicators.bb.upper[i];
      if (lowerPrev != null && lowerCur != null) {
        if (prev.close < lowerPrev && cur.close >= lowerCur) {
          events.push({
            type: 'BB_BOUNCE',
            indicator: 'Bollinger',
            time: cur.time,
            timeIndex: i,
            price: cur.close,
            indicator_value: lowerCur,
            reason: 'Bounce from lower Bollinger band'
          });
        } else if (prev.close > upperPrev && cur.close <= upperCur) {
          events.push({
            type: 'BB_REJECT',
            indicator: 'Bollinger',
            time: cur.time,
            timeIndex: i,
            price: cur.close,
            indicator_value: upperCur,
            reason: 'Rejection from upper Bollinger band'
          });
        }
      }
    }
  }

  return events;
}

export function detectExtremes(candles = [], window = 3) {
  if (!Array.isArray(candles) || !candles.length) return [];
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const topPeaks = detectLocalPeaks(highs, window, 'max').map(p => ({
    type: 'MAX',
    indicator: null,
    timeIndex: p.index,
    time: candles[p.index].time,
    price: p.value,
    indicator_value: null,
    reason: 'Local maximum'
  }));
  const lowPeaks = detectLocalPeaks(lows, window, 'min').map(p => ({
    type: 'MIN',
    indicator: null,
    timeIndex: p.index,
    time: candles[p.index].time,
    price: p.value,
    indicator_value: null,
    reason: 'Local minimum'
  }));
  return [...topPeaks, ...lowPeaks];
}

/**
 * buildEvents: junta cruces, extremos y divergencias
 * - candles: array de velas (time en segundos)
 * - indicators: estructura con ema20, ema50, rsi, macd, bb (arrays alineados por índice o valores)
 * - divergences: array tal como devuelve findDivergences (usa p2Index/r2Index)
 */
export function buildEvents({ candles = [], indicators = {}, divergences = [], cfg = {} }) {
  const crosses = detectCrosses(candles, indicators, cfg);
  const extremes = detectExtremes(candles, cfg.extremesWindow ?? 3);

  const divEvents = (divergences || []).map(d => {
    const idx = d.p2Index;
    return {
      type: d.type === 'bullish' ? 'DIVERGENCE_BULL' : 'DIVERGENCE_BEAR',
      indicator: 'RSI',
      timeIndex: idx,
      time: candles[idx]?.time,
      price: candles[idx]?.close ?? candles[idx]?.high ?? null,
      indicator_value: null,
      reason: `Divergence ${d.type}`
    };
  });

  const all = [...crosses, ...extremes, ...divEvents];

  const normalized = all
    .filter(e => e && e.time)
    .map(e => ({ 
      ...e, 
      time: e.time, 
      timeIndex: e.timeIndex ?? candles.findIndex(c => c.time === e.time)
    }))
    .sort((a,b) => a.time - b.time);

  return normalized;
}

export function exportCSV(rows = [], filename = 'events.csv') {
  if (!rows || !rows.length) return;
  const header = Object.keys(rows[0]);
  const lines = rows.map(r => header.map(h => {
    const v = r[h] == null ? '' : String(r[h]);
    return `"${v.replace(/"/g,'""')}"`;
  }).join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}