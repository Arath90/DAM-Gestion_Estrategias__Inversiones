const { detectRSIDivergences } = require('./indicators/divergence.service');
const { rsiAlerts } = require('./indicators/rsi.alerts');
const Signals = require('../models/mongodb/Signal'); // si quieres guardar
//Algoritmo
async function analyzeRSIAndDivergences(candles, opts = {}, { persist = false, instrument_id = null } = {}) {
  const { rsi, signals } = detectRSIDivergences(candles, opts);
  const alerts = rsiAlerts(rsi, {
    high: opts.rsiHighAlert ?? 80,
    low:  opts.rsiLowAlert  ?? 20,
    preLow: opts.rsiPreLow ?? 30,
    usePreLow: true,
    watch50: true
  });

  if (persist && Signals) {
    for (const s of signals) {
      await Signals.create({
        strategy_code: 'RSI_DIVERGENCE',
        instrument_id,
        ts: candles[s.idx2]?.ts || candles[s.idx2]?.time || new Date(),
        signal: s.type === 'bullish_divergence' ? 'BUY' : 'SELL',
        confidence: s.strength,
        meta: { ...s.meta, price: s.price, rsi: s.rsi }
      });
    }
  }

  return { rsi, signals, alerts };
}

module.exports = { analyzeRSIAndDivergences };
