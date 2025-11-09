import api from '../config/apiClient';

/**
 * Servicio centralizado para persistir las senales de trading generadas en el frontend.
 *
 * Proposito pedagico:
 *  - Ilustrar como se traduce una se�al visual en un registro auditable dentro de Signal.js.
 *  - Mostrar el patron de cache local para evitar consultas redundantes al catalogo.
 *  - Servir como punto unico para futuras integraciones (orders, logs, webhooks).
 *
 * Flujo de alto nivel:
 *  1. Mercado.jsx detecta nuevas senales (tradeMode === 'auto').
 *  2. Se resuelve instrument_id asociado al simbolo consultando /Instruments una sola vez y cacheando.
 *  3. Se crea el registro en /Signals para auditar o disparar pipelines server-side.
 *
 * TODO: incorporar un mecanismo de reintento/backoff cuando la API responda con errores temporales
 *  y registrar las incidencias en una coleccion de bitacora.
 */

const BASE_PARAMS = {
  dbServer: 'MongoDB',
  ProcessType: 'READ',
  $top: 1,
};

// Cache local: reduce round-trips al catalogo OData cuando se repite el mismo simbolo.
const instrumentCache = new Map();

const unwrapOData = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload.value)) return payload.value;
  if (Array.isArray(payload)) return payload;
  if (payload.value) return [payload.value];
  if (payload.data) return unwrapOData(payload.data);
  return [payload];
};

const fetchInstrumentId = async (symbol) => {
  if (!symbol) return null;
  if (instrumentCache.has(symbol)) return instrumentCache.get(symbol);

  try {
    const { data } = await api.get('/Instruments', {
      params: { ...BASE_PARAMS, symbol },
    });
    const [instrument] = unwrapOData(data);
    const id = instrument?.ID || instrument?._id || null;
    if (id) instrumentCache.set(symbol, id);
    return id;
  } catch (err) {
    console.warn('[signals] no se pudo resolver instrument_id para', symbol, err?.message);
    return null;
  }
};

export const persistTradeSignals = async (signals = [], options = {}) => {
  if (!Array.isArray(signals) || signals.length === 0) return { persisted: 0, errors: [] };

  const {
    symbol,
    interval,
    mode = 'auto',
    strategyCode = 'FRONTEND_MACD_RSI',
    moneyness = 'ATM',
  } = options;

  const errors = [];
  let persisted = 0;

  for (const signal of signals) {
    try {
      const instrumentId =
        signal.instrumentId || (await fetchInstrumentId(signal.symbol || symbol));
      if (!instrumentId) {
        errors.push({ signal, reason: 'instrument_id no encontrado' });
        continue;
      }

      const payload = {
        strategy_code: strategyCode,
        instrument_id: instrumentId,
        ts: new Date((signal.time || 0) * 1000).toISOString(),
        action: signal.action,
        moneyness,
        confidence: Number(signal.confidence ?? 0),
        rationale: signal.reasons?.join(' | ') || 'Sin detalle',
        features_json: {
          reasons: signal.reasons,
          context: signal.context,
          price: signal.price,
          symbol: signal.symbol || symbol,
          interval: signal.interval || interval,
          mode,
        },
      };

      await api.post(
        '/Signals',
        payload,
        { params: { dbServer: 'MongoDB', ProcessType: 'CREATE' } },
      );
      persisted += 1;
    } catch (err) {
      errors.push({ signal, reason: err?.response?.data?.message || err?.message });
    }
  }

  return { persisted, errors };
};

