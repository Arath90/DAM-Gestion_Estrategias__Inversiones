const { analyzeIndicators } = require('../services/indicators.service');

// Calcula analytics completos (RSI/divergencias/MACD) para el front
async function analytics(req, res) {
  try {
    const { candles = [], params = {} } = req.body || {};
    if (!Array.isArray(candles) || candles.length === 0) {
      return res.status(400).json({ message: 'Se requieren velas para calcular analytics' });
    }

    const normalizeTime = (raw) => {
      if (raw == null) return Math.floor(Date.now() / 1000);
      if (typeof raw === 'number') {
        return raw > 1e12 ? Math.floor(raw / 1000) : raw;
      }
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
      return Math.floor(Date.now() / 1000);
    };

    // Normalizar time a segundos (number) para series
    const normCandles = candles.map((c) => ({
      ...c,
      time: normalizeTime(c.time ?? c.ts ?? c.datetime ?? null),
    }));

    const result = await analyzeIndicators(normCandles, params, {
      persist: false,
      instrument_id: params?.instrument_id ?? null,
    });

    const fixSeries = (series = []) =>
      Array.isArray(series)
        ? series
            .map((p) => ({
              time: normalizeTime(p.time),
              value: Number(p.value),
            }))
            .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
        : [];

    const response = {
      ema20: [],
      ema50: [],
      sma200: [],
      rsi14: fixSeries(result.rsi14),
      macdLine: fixSeries(result.macdLine),
      macdSignal: fixSeries(result.macdSignal),
      macdHistogram: fixSeries(result.macdHistogram),
      divergences: Array.isArray(result.divergences) ? result.divergences : [],
      signals: Array.isArray(result.signals) ? result.signals : [],
      tradeSignals: Array.isArray(result.tradeSignals) ? result.tradeSignals : [],
      appliedAlgoParams: result.appliedAlgoParams || {},
    };

    // Log diagnóstico para revisar qué devuelve analytics
    console.log('[analytics] response preview:', {
      rsi14: response.rsi14?.slice?.(0, 3),
      macdLine: response.macdLine?.slice?.(0, 3),
      macdSignal: response.macdSignal?.slice?.(0, 3),
      macdHistogram: response.macdHistogram?.slice?.(0, 3),
      divergences: response.divergences?.slice?.(0, 3),
      appliedAlgoParams: response.appliedAlgoParams,
    });

    return res.json(response);
  } catch (err) {
    console.error('[analytics] error:', err);
    res.status(500).json({ message: 'Error calculando analytics', error: err?.message });
  }
}

module.exports = { analytics };
