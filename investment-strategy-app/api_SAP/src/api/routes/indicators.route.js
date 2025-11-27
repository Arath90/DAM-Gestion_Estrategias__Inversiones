const express = require('express');
const router = express.Router();
const { analytics } = require('../controllers/indicators.controller');
const { analyzeRSIAndDivergences } = require('../services/indicators.service');
const { detectResistanceLevels } = require('../services/indicators/resistance.service');
const { computeMACD } = require('../services/indicators/macd.service');
const { computeBollinger } = require('../services/indicators/bollinger.service'); //bollinger
const { fetchCandlesForInstrument } = require('../services/candlesExternal.service'); // ya lo tienes

// CORS headers defensivos para llamadas directas desde el front (Vite 5173)
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token, X-Session, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

router.use(express.json({ limit: '1mb' }));

// POST /api/indicators/analytics
// Devuelve RSI, MACD y divergencias listas para graficar.
router.post('/indicators/analytics', analytics);

// GET /api/indicators/divergences?symbol=AAPL&tf=1D&period=14&swing=5&minDistance=5&rsiHigh=70&rsiLow=30&useZones=true
// Calcula divergencias RSI-Precio en servidor (usa provider externo para velas).
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
// Calcula niveles de resistencia locales a partir de velas aportadas por el cliente.
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
// Devuelve MACD ya calculado para no sobrecargar al frontend; obtiene velas y aplica computeMACD.
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

/**
 * GET /api/indicators/bollinger
 * Query:
 *  - symbol   (requerido)
 *  - tf       (timeframe, ej: 1day, 1h, 5min)
 *  - period   (default 20)
 *  - stdDev   (default 2)
 *  - source   (default 'close')
 *  - limit    (default 200)
 */
router.get('/indicators/bollinger', async (req, res) => {
  try {
    const {
      symbol,
      tf = '1D',
      period,
      stdDev,
      source = 'close',
      limit,
    } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro "symbol" es requerido',
      });
    }

    const limitNum = Number(limit) || 200;
    const periodNum = Number(period) || 20;
    const stdDevNum = Number(stdDev) || 2;

    // 1) Obtener velas del proveedor externo
    
    const candles = await fetchCandlesForInstrument({
      symbol,
      tf,
      limit: limitNum,
    });

    if (!Array.isArray(candles) || candles.length === 0) {
      return res.status(200).json({
        success: true,
        symbol,
        tf,
        middle: [],
        upper: [],
        lower: [],
      });
    }

    // 2) Calcular Bollinger
    const { middle, upper, lower } = computeBollinger(candles, {
      period: periodNum,
      stdDev: stdDevNum,
      source,
    });

    const mapSeries = (valuesArr) =>
      valuesArr
        .map((v, i) => {
          if (v == null || !Number.isFinite(v)) return null;
          const c = candles[i];
          const t = c?.time ?? c?.ts ?? c?.datetime ?? null;
          if (!t) return null;
          return {
            time: t,
            value: v,
          };
        })
        .filter(Boolean);

    const middleSeries = mapSeries(middle);
    const upperSeries = mapSeries(upper);
    const lowerSeries = mapSeries(lower);

    return res.json({
      success: true,
      symbol,
      tf,
      params: {
        period: periodNum,
        stdDev: stdDevNum,
        source,
      },
      middle: middleSeries,
      upper: upperSeries,
      lower: lowerSeries,
    });
  } catch (err) {
    console.error('[Bollinger] error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error calculando Bandas de Bollinger',
      error: err.message,
    });
  }
});

module.exports = router;
