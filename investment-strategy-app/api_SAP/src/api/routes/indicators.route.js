const express = require('express');
const router  = express.Router();
const { analyzeRSIAndDivergences } = require('../services/indicators.service');
const { fetchCandlesForInstrument } = require('../services/candlesExternal.service'); // ya lo tienes

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

module.exports = router;
