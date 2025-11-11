// src/utils/signals.js
export function computeSignals(candles, indicators, divergences = [], options = {}) {
  // candles: array with { time, open, high, low, close, volume }
  // indicators: { rsi, bb: {upper, mid, lower}, macd: {macd, signal, hist}, ema20, ema50 }
  const {
    rsiOversold = 30,
    rsiOverbought = 70,
    macdHistogramThreshold = 0.1,
    minReasons = 1
  } = options;

  const signals = [];
  const n = candles.length;

  // Precompute maps of divergences by index for quick lookup
  const divergencesByIndex = new Map();
  divergences.forEach(d => {
    divergencesByIndex.set(d.p2Index, d); // mark by p2Index (the later peak)
  });

  for (let i = 1; i < n; i++) {
    const reasons = [];
    let confidence = 0;

    const close = candles[i].close;
    const prevClose = candles[i - 1]?.close;

    const rsiVal = indicators.rsi?.[i];
    if (rsiVal !== undefined) {
      // RSI rules
      if (indicators.rsi[i - 1] < rsiOversold && rsiVal >= rsiOversold) {
        reasons.push('RSI oversold cross');
        confidence += 0.35;
      }
      if (indicators.rsi[i - 1] > rsiOverbought && rsiVal <= rsiOverbought) {
        reasons.push('RSI overbought cross');
        confidence += 0.35;
      }
    }

    // Bollinger bounce
    if (indicators.bb) {
      const lower = indicators.bb.lower?.[i];
      const upper = indicators.bb.upper?.[i];
      const prevLower = indicators.bb.lower?.[i - 1];
      const prevUpper = indicators.bb.upper?.[i - 1];

      if (prevClose < prevLower && close > lower) {
        reasons.push('Bollinger bounce lower');
        confidence += 0.30;
      }
      if (prevClose > prevUpper && close < upper) {
        reasons.push('Bollinger rejection upper');
        confidence += 0.30;
      }
    }

    // MACD cross
    if (indicators.macd) {
      const macd = indicators.macd.macd;
      const signalLine = indicators.macd.signal;
      if (macd && signalLine && macd[i - 1] < signalLine[i - 1] && macd[i] > signalLine[i]) {
        if ((indicators.macd.hist?.[i] ?? 0) > macdHistogramThreshold) {
          reasons.push('MACD bullish cross');
          confidence += 0.25;
        }
      } else if (macd && signalLine && macd[i - 1] > signalLine[i - 1] && macd[i] < signalLine[i]) {
        if ((indicators.macd.hist?.[i] ?? 0) < -macdHistogramThreshold) {
          reasons.push('MACD bearish cross');
          confidence += 0.25;
        }
      }
    }

    // Divergence
    const div = divergencesByIndex.get(i);
    if (div) {
      reasons.push(`Divergencia ${div.type}`);
      confidence += 0.45;
    }

    if (reasons.length >= minReasons) {
      // decide action: if any bearish reason present mark SELL, else BUY
      const isBearish = reasons.some(r => /bearish|overbought|rejection|sell|top/i.test(r));
      const action = isBearish ? 'SELL' : 'BUY';
      signals.push({
        id: `${candles[i].time}_${action}`,
        time: candles[i].time,
        timeIndex: i,
        action,
        reasons,
        confidence: Math.min(1, confidence),
        price: close
      });
    }
  }

  return signals;
}