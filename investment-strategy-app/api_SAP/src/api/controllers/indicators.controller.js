// ============================================================================
// Indicators Analytics Controller
// ---------------------------------------------------------------------------
// Endpoint HTTP "plano" (Express) que expone el cálculo de analytics técnicos
// para el frontend:
//
//   POST /api/indicators/analytics
//
// Body esperado:
//   {
//     candles: [
//       { time | ts | datetime, open, high, low, close, volume, ... },
//       ...
//     ],
//     params: {
//        parámetros opcionales para los indicadores
//        (rsiPeriod, macdOptions, divergenceOptions, instrument_id, etc.)
//     }
//   }
//
// Responsabilidad de este controlador:
//   - Validar que vengan velas.
//   - Normalizar los timestamps a segundos UNIX (número).
//   - Delegar el cálculo pesado a analyzeIndicators (servicio de dominio).
//   - Normalizar la respuesta al formato que el front espera:
//       * series: [{ time: unixSeconds, value: number }]
//       * divergences, signals, tradeSignals como arrays planos.
//       * appliedAlgoParams con resumen de parámetros usados.
//
// NO hace persistencia ni lógica de negocio; solo orquesta entrada/salida.
// ============================================================================

const { analyzeIndicators } = require('../services/indicators.service');

/**
 * Calcula analytics completos (RSI, divergencias, MACD, etc.) para el frontend.
 *
 * Este handler está pensado para ser montado directamente en Express:
 *   router.post('/api/indicators/analytics', analytics);
 */
async function analytics(req, res) {
  try {
    const { candles = [], params = {} } = req.body || {};

    // Validación mínima: sin velas no hay nada que calcular.
    if (!Array.isArray(candles) || candles.length === 0) {
      return res.status(400).json({ message: 'Se requieren velas para calcular analytics' });
    }

    /**
     * Normaliza un valor de tiempo a "segundos desde epoch" (UNIX time).
     *
     * Acepta:
     *   - number en milisegundos (>= 1e12)  -> divide entre 1000.
     *   - number en segundos (< 1e12)      -> se usa como viene.
     *   - string parseable por Date.parse  -> se convierte a segundos.
     *   - null/undefined / inválido        -> usa ahora (Date.now()).
     */
    const normalizeTime = (raw) => {
      if (raw == null) return Math.floor(Date.now() / 1000);
      if (typeof raw === 'number') {
        // Si parece timestamp en ms, convertir a segundos
        return raw > 1e12 ? Math.floor(raw / 1000) : raw;
      }
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
      return Math.floor(Date.now() / 1000);
    };

    // ------------------------------------------------------------------------
    // Normalización de velas de entrada
    // ------------------------------------------------------------------------
    // El servicio de indicadores espera un campo "time" numérico coherente.
    // Aquí alineamos todas las variantes posibles (time, ts, datetime).
    const normCandles = candles.map((c) => ({
      ...c,
      time: normalizeTime(c.time ?? c.ts ?? c.datetime ?? null),
    }));

    // ------------------------------------------------------------------------
    // Cálculo central: delegar al servicio de indicadores
    // ------------------------------------------------------------------------
    // analyzeIndicators se encarga de:
    //   - computeRSI
    //   - computeMACD
    //   - detectar divergencias
    //   - generar señales / tradeSignals
    //
    // Aquí indicamos persist=false para no guardar nada en Mongo desde este endpoint.
    const strongExtra = {
      ...(params?.strongExtra || {}),
      source: params?.strongExtra?.source || 'analytics_endpoint',
    };

    const result = await analyzeIndicators(normCandles, params, {
      persist: false,
      instrument_id: params?.instrument_id ?? null,
      persistStrong: Boolean(params?.persistStrong),
      minStrongScore: params?.minStrongScore,
      minStrongPriceDeltaPct: params?.minStrongPriceDeltaPct,
      timeframe: params?.timeframe ?? params?.tf ?? null,
      strongExtra,
    });

    /**
     * Normaliza una serie al formato:
     *   [{ time: unixSeconds, value: number }, ...]
     *
     * - Fuerza time a ser segundos (normalizeTime).
     * - Fuerza value a Number.
     * - Filtra entradas con time/value no numéricos.
     */
    const fixSeries = (series = []) =>
      Array.isArray(series)
        ? series
            .map((p) => ({
              time: normalizeTime(p.time),
              value: Number(p.value),
            }))
            .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
        : [];

    // ------------------------------------------------------------------------
    // Construcción de la respuesta hacia el frontend
    // ------------------------------------------------------------------------
    // Nota: por ahora EMA/SMA vienen vacías; se pueden rellenar más adelante
    // desde analyzeIndicators sin cambiar el contrato del endpoint.
    const response = {
      ema20: [], // reservado para futuras implementaciones
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

    // Log de diagnóstico: solo se muestra un preview pequeño para no llenar consola.
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
    // Cualquier error no controlado se loguea y se responde 500 genérico.
    console.error('[analytics] error:', err);
    res.status(500).json({ message: 'Error calculando analytics', error: err?.message });
  }
}

module.exports = { analytics };
