// src/api/services/indicators.service.js
// -----------------------------------------------------------
// Servicio: Análisis combinado RSI + Divergencias + Alertas
// -----------------------------------------------------------
//
// Este módulo es el *coordinador central* de análisis técnico.
// Combina los resultados de los servicios individuales:
//
//   • detectRSIDivergences → identifica divergencias entre precio y RSI
//   • rsiAlerts            → genera alertas por cruces de niveles del RSI
//
// Opcionalmente puede persistir las señales detectadas en la colección `Signals`
// de MongoDB para registro o backtesting.
//
// Flujo general:
//  1. Calcula el RSI y las divergencias usando las velas (candles).
//  2. Genera alertas de niveles RSI (sobrecompra/sobreventa, cruces 50).
//  3. Si `persist` es true, guarda las señales en la base de datos.
//
// -----------------------------------------------------------

// Importa los servicios de análisis técnico
const { detectRSIDivergences } = require('./indicators/divergence.service'); // divergencias RSI-precio
const { rsiAlerts } = require('./indicators/rsi.alerts');                    // alertas RSI por niveles
const { computeMACD } = require('./indicators/macd.service');
const { macdAlerts } = require('./indicators/macd.alerts');

// Modelo opcional para guardar señales en la base de datos (Mongo)
const Signals = require('../models/mongodb/Signal');

/**
 * Analiza una serie de velas en busca de divergencias y alertas RSI.
 *
 * @param {Array<Object>} candles - Serie de velas (debe incluir campos como close, ts/time, etc.).
 * @param {Object} opts - Opciones de configuración para el análisis técnico.
 * @param {number} [opts.period=14] - Periodo RSI.
 * @param {number} [opts.swingLen=5] - Ventana de pivotes (para divergencias).
 * @param {number} [opts.minDistance=5] - Separación mínima entre pivotes consecutivos.
 * @param {number} [opts.rsiHighAlert=80] - Umbral superior de sobrecompra para alertas.
 * @param {number} [opts.rsiLowAlert=20] - Umbral inferior de sobreventa para alertas.
 * @param {number} [opts.rsiPreLow=30] - Nivel intermedio de sobreventa.
 * @param {boolean}[opts.useZones=false] - Exigir zonas altas/bajas para divergencias.
 *
 * @param {Object} optionsExtra - Configuración adicional del servicio.
 * @param {boolean}[optionsExtra.persist=false] - Si true, guarda las señales en MongoDB.
 * @param {string} [optionsExtra.instrument_id=null] - ID del instrumento asociado.
 *
 * @returns {Promise<Object>} 
 *   {
 *     rsi: Array<number>,       // serie completa RSI
 *     signals: Array<Object>,   // divergencias detectadas
 *     alerts: Array<Object>     // alertas RSI
 *   }
 */
async function analyzeRSIAndDivergences(
  candles,
  opts = {},
  { persist = true, instrument_id = null } = {}
) {
  // -----------------------------------------------------------
  // 1️⃣ Calcula RSI y divergencias (sobre serie completa)
  // -----------------------------------------------------------
  // detectRSIDivergences devuelve:
  //  { rsi: <array de RSI>, signals: <divergencias encontradas> }
  // -----------------------------------------------------------
  const { rsi, signals } = detectRSIDivergences(candles, opts);

  // -----------------------------------------------------------
  // 2️⃣ Genera alertas RSI por niveles (sobrecompra/sobreventa/cruce 50)
  // -----------------------------------------------------------
  // Usa los valores configurables, con defaults de 80/20/30.
  // Devuelve un array de alertas con índice y tipo.
  // -----------------------------------------------------------
  const alerts = rsiAlerts(rsi, {
    high: opts.rsiHighAlert ?? 80,
    low:  opts.rsiLowAlert  ?? 20,
    preLow: opts.rsiPreLow ?? 30,
    usePreLow: true,
    watch50: true
  });

  // -----------------------------------------------------------
  // 3️⃣ Guardado opcional de señales (persistencia en Mongo Signals)
  // -----------------------------------------------------------
  // Si `persist` está activo y existe el modelo Signals,
  // se almacenan todas las divergencias detectadas como
  // registros individuales en la colección Mongo.
  // -----------------------------------------------------------
  if (persist && Signals && signals.length) {
    if (!instrument_id) {
      console.warn('[analyzeRSIAndDivergences] Persist requested without instrument_id, skipping save.');
    } else {
      const now = new Date();
      const docs = signals.map((s) => {
        const candle = candles[s.idx2] || candles[s.idx1] || {};
        const tsRaw = candle.ts || candle.time || candle.datetime || Date.now();
        const ts = tsRaw instanceof Date ? tsRaw : new Date(tsRaw);
        const action = s.type === 'bullish_divergence' ? 'BUY' : 'SELL';
        const confidence = Number.isFinite(s.strength) ? Math.min(Math.max(s.strength, 0), 1) : 0.5;

        return {
          strategy_code: 'RSI_DIVERGENCE',
          instrument_id,
          ts,
          action,
          moneyness: 'ATM',
          confidence,
          features_json: {
            divergence: s,
            candle,
            options: opts
          },
          rationale: action === 'BUY'
            ? 'Bullish RSI divergence detected.'
            : 'Bearish RSI divergence detected.',
          createdAt: now,
          updatedAt: now
        };
      });

      try {
        await Signals.insertMany(docs, { ordered: false });
      } catch (err) {
        console.error('[analyzeRSIAndDivergences] Failed to persist RSI signals', err);
      }
    }
  }

  // -----------------------------------------------------------
  // 4️⃣ Devuelve resultados para visualización o análisis posterior
  // -----------------------------------------------------------
  return { rsi, signals, alerts };
}

// Exporta la función principal del servicio
module.exports = { analyzeRSIAndDivergences };

/**
 * Analiza RSI + divergencias + MACD en un solo paso.
 * Se usa desde /api/indicators/analytics.
 */
async function analyzeIndicators(
  candles,
  opts = {},
  { persist = false, instrument_id = null } = {},
) {
  const {
    rsiPeriod = 14,
    rsiHighAlert = 80,
    rsiLowAlert = 20,
    rsiPreLow = 30,
    rsiOptions = {},
    macdFast = 12,
    macdSlow = 26,
    macdSignal = 9,
    macdSource = 'close',
  } = opts || {};

  if (!Array.isArray(candles) || candles.length < 10) {
    return {
      rsi14: [],
      divergences: [],
      macdLine: [],
      macdSignal: [],
      macdHistogram: [],
      signals: [],
      tradeSignals: [],
      appliedAlgoParams: {},
    };
  }

  // --- RSI + divergencias ---
  const { rsi, signals: rsiDivs } = detectRSIDivergences(candles, {
    period: rsiPeriod,
    ...rsiOptions,
  });

  const rsiEvents = rsiAlerts(rsi, {
    high: rsiHighAlert,
    low: rsiLowAlert,
    preLow: rsiPreLow,
    usePreLow: true,
    watch50: true,
  });

  const rsiSeries = rsi
    .map((v, i) => {
      if (!Number.isFinite(v)) return null;
      const t = candles[i]?.time ?? candles[i]?.ts ?? candles[i]?.datetime;
      if (!t) return null;
      return { time: t, value: v };
    })
    .filter(Boolean);

  // --- MACD ---
  const { macd, signal, histogram } = computeMACD(candles, {
    fastPeriod: macdFast,
    slowPeriod: macdSlow,
    signalPeriod: macdSignal,
    source: macdSource,
  });

  const macdEvents = macdAlerts({
    macdLine: macd,
    signalLine: signal,
    histogram,
    candles,
  });

  const normalizedRsiEvents = (rsiEvents || []).map((ev) => ({
    ...ev,
    index: ev.index ?? ev.i ?? ev.timeIndex,
  }));

  const normalizedMacdEvents = (macdEvents || []).map((ev) => ({
    ...ev,
    index: ev.index,
  }));

  const allSignals = [...normalizedRsiEvents, ...normalizedMacdEvents];

  const mapSeries = (arr) =>
    arr
      .map((v, i) => {
        if (!Number.isFinite(v)) return null;
        const t = candles[i]?.time ?? candles[i]?.ts ?? candles[i]?.datetime;
        if (!t) return null;
        return { time: t, value: v };
      })
      .filter(Boolean);

  const macdLineSeries = mapSeries(macd);
  const macdSignalSeries = mapSeries(signal);
  const macdHistogramSeries = mapSeries(histogram);

  const divergences = rsiDivs.map((d) => {
    const priceDeltaPct =
      d.price && Number.isFinite(d.price.p1) && d.price.p1 !== 0 && Number.isFinite(d.price.p2)
        ? ((d.price.p2 - d.price.p1) / Math.abs(d.price.p1)) * 100
        : null;
    const indDeltaPct =
      d.rsi && Number.isFinite(d.rsi.r1) && d.rsi.r1 !== 0 && Number.isFinite(d.rsi.r2)
        ? ((d.rsi.r2 - d.rsi.r1) / Math.abs(d.rsi.r1)) * 100
        : null;
    return {
      type: d.type || (d.kind?.includes('bullish') ? 'bullish' : 'bearish'),
      p1Index: d.idx1,
      p2Index: d.idx2,
      r1Index: d.r1Idx,
      r2Index: d.r2Idx,
      priceDeltaPct,
      indDeltaPct,
      score: d.strength ?? 0,
    };
  });

  const signals = allSignals;
  const tradeSignals = [];

  if (persist && Signals) {
    const mergedEvents = [...normalizedMacdEvents];
    for (const ev of mergedEvents) {
      const ts = candles[ev.index]?.time || candles[ev.index]?.ts || new Date();
      const action =
        ev.type === 'macd_cross_up' || ev.type === 'macd_zero_up'
          ? 'BUY'
          : ev.type === 'macd_cross_down' || ev.type === 'macd_zero_down'
          ? 'SELL'
          : null;
      if (!action) continue;
      const doc = await Signals.create({
        strategy_code: 'MACD_CORE',
        instrument_id,
        ts,
        signal: action,
        confidence: 0.5,
        meta: { ...ev },
      });
      tradeSignals.push(doc);
    }
  }

  return {
    rsi14: rsiSeries,
    divergences,
    macdLine: macdLineSeries,
    macdSignal: macdSignalSeries,
    macdHistogram: macdHistogramSeries,
    signals,
    tradeSignals,
    appliedAlgoParams: {
      rsiPeriod,
      rsiHighAlert,
      rsiLowAlert,
      macdFast,
      macdSlow,
      macdSignal,
    },
  };
}

module.exports.analyzeIndicators = analyzeIndicators;
