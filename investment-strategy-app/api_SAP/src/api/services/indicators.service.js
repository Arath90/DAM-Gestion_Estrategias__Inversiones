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
