const express = require('express');
const router  = express.Router();
const { analyzeRSIAndDivergences } = require('../services/indicators.service');
const { detectResistanceLevels } = require('../services/indicators/resistance.service');
const { computeMACD } = require('../services/indicators/macd.service');
const { fetchCandlesForInstrument } = require('../services/candlesExternal.service'); // ya lo tienes

router.use(express.json({ limit: '1mb' }));

// GET /api/indicators/divergences?symbol=AAPL&tf=1D&period=14&swing=5&minDistance=5&rsiHigh=70&rsiLow=30&useZones=true
router.get('/indicators/divergences', async (req, res) => {
  try {
    const {
      symbol, tf = '1D', period = 14, swing = 5,
      minDistance = 5, rsiHigh = 70, rsiLow = 30, useZones = true
    } = req.query;

    if (!symbol) return res.status(400).json({ success: false, message: 'symbol requerido' });

    const candles = await fetchCandlesForInstrument({ symbol, tf, limit: 1000 }); // o lo que uses
    const result = await analyzeRSIAndDivergences(candles, {
      period: +period,
      swingLen: +swing,
      minDistance: +minDistance,
      rsiHigh: +rsiHigh,
      rsiLow: +rsiLow,
      useZones: String(useZones) === 'true'
    }, { persist: false });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/indicators/resistances
router.post('/indicators/resistances', async (req, res) => {
  try {
    const { candles = [], swingLen = 1, limit = 3, precision = 4 } = req.body || {};
    if (!Array.isArray(candles)) {
      return res.status(400).json({ success: false, message: 'candles debe ser un arreglo' });
    }

    const { levels, segments } = detectResistanceLevels(candles, {
      swingLen: Number(swingLen) || 1,
      limit: Number(limit) || 3,
      precision: Number(precision) || 4,
    });

    return res.json({
      success: true,
      resistances: levels,
      segments,
    });
  } catch (err) {
    console.error('[indicators] resistances error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/indicators/macd?symbol=AAPL&tf=1D&fast=12&slow=26&signal=9&limit=500
router.get('/indicators/macd', async (req, res) => {
  try {
    const {
      symbol,
      tf = '1D',
      fast = 12,
      slow = 26,
      signal = 9,
      limit = 500,
      source = 'close',
    } = req.query;

    if (!symbol) return res.status(400).json({ success: false, message: 'symbol requerido' });

    const candles = await fetchCandlesForInstrument({ symbol, tf, limit: Number(limit) || 500 });
    const { macd, signal: sigLine, histogram } = computeMACD(candles, {
      fastPeriod: Number(fast) || 12,
      slowPeriod: Number(slow) || 26,
      signalPeriod: Number(signal) || 9,
      source: String(source || 'close'),
    });

    const mapSeries = (series) =>
      series.map((v, idx) => (v == null ? null : ({
        value: v,
        time: candles[idx]?.ts || candles[idx]?.time || candles[idx]?.datetime || null,
      }))).filter(Boolean);

    return res.json({
      success: true,
      macdLine: mapSeries(macd),
      signalLine: mapSeries(sigLine),
      histogram: mapSeries(histogram),
    });
  } catch (err) {
    console.error('[indicators] macd error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
