// src/api/services/indicators.service.js
// ============================================================================
// Servicio de indicadores técnicos
// ----------------------------------------------------------------------------
// Este módulo funciona como *capa de orquestación* para los indicadores:
//
//   • RSI + Divergencias precio–RSI
//   • Alertas basadas en niveles del RSI
//   • MACD (línea, señal, histograma) + alertas MACD
//
// Expone dos funciones públicas:
//
//   1) analyzeRSIAndDivergences(candles, opts, extra)
//      - Pensada para flujos centrados únicamente en RSI/divergencias.
//      - Se usa también desde la acción OData DetectDivergences.
//
//   2) analyzeIndicators(candles, opts, extra)
//      - Endpoint “completo” que combina RSI + Divergencias + MACD
//        y devuelve todo en formato amigable para el frontend (series {time,value}).
//      - Es lo que consume /api/indicators/analytics.
//
// Ambos pueden opcionalmente persistir señales en Mongo (colección `Signals`),
// pero en el flujo de analytics se está usando `persist: false` para no escribir.
// ============================================================================

// --- Servicios de análisis técnico de bajo nivel (cálculo puro) -------------
const { detectRSIDivergences } = require('./indicators/divergence.service'); // divergencias precio–RSI
const { rsiAlerts }            = require('./indicators/rsi.alerts');         // alertas por niveles RSI
const { computeMACD }          = require('./indicators/macd.service');       // cálculo MACD
const { macdAlerts }           = require('./indicators/macd.alerts');        // eventos MACD (cruces, etc.)
const { persistStrongSignalsFromDivergences } = require('./strongSignals.azureCosmos.service');

const { computeBollinger } = require('./indicators/bollinger.service'); //Importamos bandas de bollinger

// Modelo opcional de MongoDB para persistir señales
const Signals = require('../models/mongodb/Signal');

// ============================================================================
// 1) analyzeRSIAndDivergences
//    – Enfoque exclusivo en RSI y divergencias
// ============================================================================

/**
 * Analiza una serie de velas buscando divergencias precio–RSI
 * y generando alertas de niveles RSI (sobrecompra/sobreventa/cruces de 50).
 *
 * ⚙️ Parámetros de entrada:
 * @param {Array<Object>} candles
 *   Serie de velas en orden cronológico.
 *   Se espera que cada vela tenga, al menos:
 *     - close (precio de cierre)
 *     - opcionalmente ts/time/datetime para timestamp.
 *
 * @param {Object} opts
 *   Opciones específicas del análisis RSI/divergencias:
 *   @param {number} [opts.period=14]
 *     Periodo del RSI (por defecto 14).
 *   @param {number} [opts.swingLen=5]
 *     Ventana de pivotes para detectar máximos/mínimos locales.
 *   @param {number} [opts.minDistance=5]
 *     Separación mínima en número de velas entre pivotes consecutivos.
 *   @param {number} [opts.rsiHighAlert=80]
 *     Umbral de sobrecompra para alertas RSI.
 *   @param {number} [opts.rsiLowAlert=20]
 *     Umbral de sobreventa para alertas RSI.
 *   @param {number} [opts.rsiPreLow=30]
 *     Nivel “previo” de sobreventa (ej. 30 para avisar antes del 20).
 *   @param {boolean} [opts.useZones=false]
 *     Si es true, las divergencias exigen que el RSI esté en zona alta/baja.
 *
 * @param {Object} optionsExtra
 *   Configuración extra del servicio:
 *   @param {boolean} [optionsExtra.persist=false]
 *     Si true, persiste las señales en MongoDB (colección `Signals`).
 *   @param {string|null} [optionsExtra.instrument_id=null]
 *     Identificador del instrumento para enlazar las señales persistidas.
 *   @param {boolean} [optionsExtra.persistStrong=false]
 *     Si es true, replica divergencias fuertes hacia Cosmos DB.
 *   @param {number} [optionsExtra.minStrongScore=0.75]
 *     Puntaje minimo para considerar una divergencia como fuerte.
 *   @param {number} [optionsExtra.minStrongPriceDeltaPct=1]
 *     Umbral porcentual de precio usado como guardrail adicional.
 *   @param {string|null} [optionsExtra.timeframe=null]
 *     Marco temporal asociado a la serie evaluada (ej. 1h, 4h).
 *   @param {Object} [optionsExtra.strongExtra={}]
 *     Datos adicionales que se adjuntan al documento en Cosmos.
 *
 * 🧾 Respuesta:
 * @returns {Promise<{
 *   rsi: number[],
 *   signals: Array<object>,
 *   alerts: Array<object>
 * }>}
 *   - rsi: serie numérica completa del RSI (alineada 1:1 con candles).
 *   - signals: divergencias detectadas (bearish/bullish) con idx1/idx2.
 *   - alerts: eventos de niveles RSI (sobrecompra/sobreventa/cruce 50, etc.).
 */
async function analyzeRSIAndDivergences(
  candles,
  opts = {},
  {
    persist = true,
    instrument_id = null,
    persistStrong = false,
    minStrongScore = 0.75,
    minStrongPriceDeltaPct = 1,
    timeframe = null,
    strongExtra = {},
  } = {},
) {
  // --------------------------------------------------------------------------
  // 1️⃣ Calcular RSI + Divergencias
  // --------------------------------------------------------------------------
  // detectRSIDivergences encapsula:
  //   - computeRSI
  //   - findPivots
  //   - lógica HH/LL vs LH/HL para divergencias.
  const { rsi, signals } = detectRSIDivergences(candles, opts);

  // --------------------------------------------------------------------------
  // 2️⃣ Generar alertas RSI por niveles (sobrecompra/sobreventa/cruces)
  // --------------------------------------------------------------------------
  const alerts = rsiAlerts(rsi, {
    high:   opts.rsiHighAlert ?? 80,
    low:    opts.rsiLowAlert  ?? 20,
    preLow: opts.rsiPreLow    ?? 30,
    usePreLow: true,
    watch50:  true,
  });

  // --------------------------------------------------------------------------
  // 3️⃣ Persistencia opcional de señales de divergencia en MongoDB
  // --------------------------------------------------------------------------
  if (persist && Signals && signals.length) {
    if (!instrument_id) {
      console.warn(
        '[analyzeRSIAndDivergences] Persist requested without instrument_id, skipping save.',
      );
    } else {
      const now = new Date();

      const docs = signals.map((s) => {
        // Se toma la vela idx2 como referencia temporal (pivote más reciente)
        const candle = candles[s.idx2] || candles[s.idx1] || {};
        const tsRaw = candle.ts || candle.time || candle.datetime || Date.now();
        const ts = tsRaw instanceof Date ? tsRaw : new Date(tsRaw);

        const action =
          s.type === 'bullish_divergence'
            ? 'BUY'
            : 'SELL';

        // Normalizar fuerza en rango [0,1]
        const confidence = Number.isFinite(s.strength)
          ? Math.min(Math.max(s.strength, 0), 1)
          : 0.5;

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
            options: opts,
          },
          rationale:
            action === 'BUY'
              ? 'Bullish RSI divergence detected.'
              : 'Bearish RSI divergence detected.',
          createdAt: now,
          updatedAt: now,
        };
      });

      try {
        await Signals.insertMany(docs, { ordered: false });
      } catch (err) {
        console.error(
          '[analyzeRSIAndDivergences] Failed to persist RSI signals',
          err,
        );
      }
    }
  }

  if (persistStrong && instrument_id) {
    try {
      await persistStrongSignalsFromDivergences({
        divergences: signals,
        candles,
        instrument_id,
        strategy_code: 'RSI_DIVERGENCE',
        timeframe,
        minScore: minStrongScore,
        minPriceDeltaPct: minStrongPriceDeltaPct,
        extra: { source: 'analyzeRSIAndDivergences', options: opts, ...strongExtra },
      });
    } catch (err) {
      console.error('[analyzeRSIAndDivergences] Failed to persist strong divergence signals', err);
    }
  } else if (persistStrong && !instrument_id) {
    console.warn('[analyzeRSIAndDivergences] persistStrong requiere instrument_id.');
  }

  // --------------------------------------------------------------------------
  // 4️⃣ Resultado para consumo externo (ej. acción OData o servicios internos)
  // --------------------------------------------------------------------------
  return { rsi, signals, alerts };
}

// ============================================================================
// 2) analyzeIndicators
//    – RSI + Divergencias + MACD para /api/indicators/analytics
// ============================================================================

/**
 * Analiza de forma combinada:
 *   • RSI + divergencias precio–RSI
 *   • Eventos/alertas basados en RSI
 *   • MACD (línea, señal, histograma) + alertas MACD
 *
 * Este es el servicio que usa el endpoint HTTP:
 *   POST /api/indicators/analytics
 *
 * y devuelve las series normalizadas { time, value } listas para el frontend.
 *
 * @param {Array<Object>} candles
 *   Velas normalizadas (el endpoint ya las pasa con `time` en segundos).
 *
 * @param {Object} opts
 *   Configuración de indicadores y umbrales:
 *   @param {number} [opts.rsiPeriod=14]      Periodo del RSI.
 *   @param {number} [opts.rsiHighAlert=80]   Umbral RSI sobrecompra.
 *   @param {number} [opts.rsiLowAlert=20]    Umbral RSI sobreventa.
 *   @param {number} [opts.rsiPreLow=30]      Nivel previo de sobreventa.
 *   @param {Object} [opts.rsiOptions={}]     Opciones extra para divergencias RSI.
 *   @param {number} [opts.macdFast=12]       EMA rápida MACD.
 *   @param {number} [opts.macdSlow=26]       EMA lenta MACD.
 *   @param {number} [opts.macdSignal=9]      Periodo signal line MACD.
 *   @param {string} [opts.macdSource='close'] Campo de precio a usar para MACD.
 *
 * @param {Object} extra
 *   Parámetros extra de ejecución:
 *   @param {boolean} [extra.persist=false]
 *     Si true, persiste algunas señales MACD en `Signals` (opcional).
 *   @param {string|null} [extra.instrument_id=null]
 *     Instrumento asociado a las señales persistidas.
 *   @param {boolean} [extra.persistStrong=false]
 *     Replica divergencias fuertes hacia Cosmos DB.
 *   @param {number} [extra.minStrongScore=0.75]
 *     Puntaje minimo requerido para guardar en Cosmos.
 *   @param {number} [extra.minStrongPriceDeltaPct=1]
 *     Cambio porcentual minimo del precio para guardar aunque el score sea bajo.
 *   @param {string|null} [extra.timeframe=null]
 *     Marco temporal asociado al analisis actual.
 *   @param {Object} [extra.strongExtra={}]
 *     Payload adicional para adjuntar en el documento de Cosmos.
 *
 * @returns {Promise<{
 *   rsi14: Array<{time:number,value:number}>,
 *   divergences: Array<object>,
 *   macdLine: Array<{time:number,value:number}>,
 *   macdSignal: Array<{time:number,value:number}>,
 *   macdHistogram: Array<{time:number,value:number}>,
 *   signals: Array<object>,
 *   tradeSignals: Array<object>,
 *   appliedAlgoParams: Object
 * }>}
 */
async function analyzeIndicators(
  candles,
  opts = {},
  {
    persist = false,
    instrument_id = null,
    persistStrong = false,
    minStrongScore = 0.75,
    minStrongPriceDeltaPct = 1,
    timeframe = null,
    strongExtra = {},
  } = {},
) {
  const {
    rsiPeriod   = 14,
    rsiHighAlert = 80,
    rsiLowAlert  = 20,
    rsiPreLow    = 30,
    rsiOptions   = {},

    macdFast   = 12,
    macdSlow   = 26,
    macdSignal = 9,
    macdSource = 'close',

    // NUEVOS parámetros de Bollinger
    bollingerPeriod = 20,
    bollingerStdDev = 2,
    bollingerSource = 'close',
  } = opts || {};

  // Guardrail mínimo: sin suficientes velas no vale la pena calcular nada.
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

  // --------------------------------------------------------------------------
  // 1️⃣ RSI + Divergencias + Eventos RSI
  // --------------------------------------------------------------------------
  const { rsi, signals: rsiDivs } = detectRSIDivergences(candles, {
    period: rsiPeriod,
    ...rsiOptions,
  });

  const rsiEvents = rsiAlerts(rsi, {
    high:   rsiHighAlert,
    low:    rsiLowAlert,
    preLow: rsiPreLow,
    usePreLow: true,
    watch50:  true,
  });

  // Serie RSI convertida a { time, value } respetando el índice de la vela.
  const rsiSeries = rsi
    .map((v, i) => {
      if (!Number.isFinite(v)) return null;
      const t = candles[i]?.time ?? candles[i]?.ts ?? candles[i]?.datetime;
      if (!t) return null;
      return { time: t, value: v };
    })
    .filter(Boolean);

  // --------------------------------------------------------------------------
  // 2️⃣ MACD (línea, señal, histograma) + eventos
  // --------------------------------------------------------------------------
  const { macd, signal, histogram } = computeMACD(candles, {
    fastPeriod:   macdFast,
    slowPeriod:   macdSlow,
    signalPeriod: macdSignal,
    source:       macdSource,
  });

  const macdEvents = macdAlerts({
    macdLine:   macd,
    signalLine: signal,
    histogram,
    candles,
  });

  // Normalizar eventos RSI para tener un campo index consistente
  const normalizedRsiEvents = (rsiEvents || []).map((ev) => ({
    ...ev,
    index: ev.index ?? ev.i ?? ev.timeIndex,
  }));

  // Normalizar eventos MACD
  const normalizedMacdEvents = (macdEvents || []).map((ev) => ({
    ...ev,
    index: ev.index,
  }));

  // Mezcla todas las “señales” de evento (no son órdenes de trading, solo eventos técnicos)
  const allSignals = [...normalizedRsiEvents, ...normalizedMacdEvents];

  // Helper: mapear cualquier array numérico a serie { time, value }
  const mapSeries = (arr) =>
    arr
      .map((v, i) => {
        if (!Number.isFinite(v)) return null;
        const t = candles[i]?.time ?? candles[i]?.ts ?? candles[i]?.datetime;
        if (!t) return null;
        return { time: t, value: v };
      })
      .filter(Boolean);

  const macdLineSeries      = mapSeries(macd);
  const macdSignalSeries    = mapSeries(signal);
  const macdHistogramSeries = mapSeries(histogram);


  // 🔹 3) Cálculo de Bandas de Bollinger
  let bollingerMiddleSeries = [];
  let bollingerUpperSeries = [];
  let bollingerLowerSeries = [];

  try {
    const { middle, upper, lower } = computeBollinger(candles, {
      period: bollingerPeriod,
      stdDev: bollingerStdDev,
      source: bollingerSource,
    });

    const mapBollingerSeries = (valuesArr) =>
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

    bollingerMiddleSeries = mapBollingerSeries(middle);
    bollingerUpperSeries = mapBollingerSeries(upper);
    bollingerLowerSeries = mapBollingerSeries(lower);
  } catch (err) {
    // No rompas el resto del análisis si algo sale mal
    console.error('[indicators] Error calculando Bollinger:', err.message);
    bollingerMiddleSeries = [];
    bollingerUpperSeries = [];
    bollingerLowerSeries = [];
  }

  // --------------------------------------------------------------------------
  // 3️⃣ Normalización de divergencias para el frontend
  // --------------------------------------------------------------------------
  const divergences = rsiDivs.map((d) => {
    const priceDeltaPct =
      d.price &&
      Number.isFinite(d.price.p1) &&
      d.price.p1 !== 0 &&
      Number.isFinite(d.price.p2)
        ? ((d.price.p2 - d.price.p1) / Math.abs(d.price.p1)) * 100
        : null;

    const indDeltaPct =
      d.rsi &&
      Number.isFinite(d.rsi.r1) &&
      d.rsi.r1 !== 0 &&
      Number.isFinite(d.rsi.r2)
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

  // Por ahora devolvemos todos los eventos como `signals`
  const signals = allSignals;

  // tradeSignals se reservaría para órdenes reales simuladas o ejecutadas
  const tradeSignals = [];

  // --------------------------------------------------------------------------
  // 4️⃣ Persistencia opcional de eventos MACD como señales de trading
  // --------------------------------------------------------------------------
  if (persist && Signals) {
    const mergedEvents = [...normalizedMacdEvents];
    for (const ev of mergedEvents) {
      const idx = ev.index;
      if (idx == null || !candles[idx]) continue;

      const ts = candles[idx]?.time || candles[idx]?.ts || new Date();

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

  if (persistStrong && instrument_id) {
    try {
      await persistStrongSignalsFromDivergences({
        divergences: rsiDivs,
        candles,
        instrument_id,
        strategy_code: 'RSI_DIVERGENCE',
        timeframe: timeframe ?? opts?.timeframe ?? null,
        minScore: minStrongScore,
        minPriceDeltaPct: minStrongPriceDeltaPct,
        extra: { source: 'analyzeIndicators', options: opts, ...strongExtra },
      });
    } catch (err) {
      console.error('[analyzeIndicators] Failed to persist strong divergence signals', err);
    }
  } else if (persistStrong && !instrument_id) {
    console.warn('[analyzeIndicators] persistStrong requiere instrument_id.');
  }

  // --------------------------------------------------------------------------
  // 5️⃣ Resultado completo para /api/indicators/analytics
  // --------------------------------------------------------------------------
  return {
    rsi14:          rsiSeries,
    divergences,
    macdLine:       macdLineSeries,
    macdSignal:     macdSignalSeries,
    macdHistogram:  macdHistogramSeries,
    signals,
    tradeSignals,
    appliedAlgoParams: {
      rsiPeriod,
      rsiHighAlert,
      rsiLowAlert,
      macdFast,
      macdSlow,
      macdSignal,
      
      // Nuevos de bollinger
      bollingerPeriod,
      bollingerStdDev,
      bollingerSource,
    },
    // 🔹 Nuevas series para el controller / frontend
    bollingerMiddle: bollingerMiddleSeries,
    bollingerUpper: bollingerUpperSeries,
    bollingerLower: bollingerLowerSeries,
  };
}

// Export público del módulo
module.exports = {
  analyzeRSIAndDivergences,
  analyzeIndicators,
};
