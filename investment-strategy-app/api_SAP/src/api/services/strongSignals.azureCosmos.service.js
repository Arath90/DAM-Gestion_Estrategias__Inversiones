// src/api/services/strongSignals.azureCosmos.service.js
// CRUD básico contra Azure Cosmos DB para las señales más fuertes.

const { randomUUID } = require('crypto');
const { conectionAzureCosmosDB } = require('../../config/conectionToAzureCosmosDB');
const cfg = require('../../config/dotenvXConfig');

const DEFAULT_CONTAINER = cfg.COSMOSDB_CONTAINER || 'signals';
const PARTITION_FIELD = 'strategy_code';

const cleanCosmosItem = (item = {}) => {
  const {
    _rid,
    _self,
    _etag,
    _attachments,
    _ts,
    ...clean
  } = item || {};
  return clean;
};

const assertContainerReady = () => {
  if (!DEFAULT_CONTAINER) {
    throw new Error('COSMOSDB_CONTAINER no está configurado.');
  }
  return conectionAzureCosmosDB(DEFAULT_CONTAINER);
};

const ensureIsoString = (value) => {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const normalizeSignalPayload = (raw = {}) => {
  if (!raw || typeof raw !== 'object') return {};
  const payload = { ...raw };

  if (payload.ID && !payload.id) payload.id = payload.ID;
  delete payload.ID;

  if (payload.instrument_ID && !payload.instrument_id) payload.instrument_id = payload.instrument_ID;
  delete payload.instrument_ID;

  if (payload.ts) payload.ts = ensureIsoString(payload.ts);

  if (typeof payload.features_json === 'string') {
    try {
      payload.features_json = JSON.parse(payload.features_json);
    } catch (_) {
      // se deja como string si no es JSON válido
    }
  }

  ['score', 'price_delta_pct', 'indicator_delta_pct', 'confidence'].forEach((field) => {
    if (payload[field] != null) {
      const num = Number(payload[field]);
      if (Number.isFinite(num)) payload[field] = num;
    }
  });

  return payload;
};

const computeDeltaPct = (p1, p2) => {
  if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 === 0) return null;
  return ((p2 - p1) / Math.abs(p1)) * 100;
};

const resolveTimestampFromCandles = (candles = [], primaryIdx, fallbackIdx) => {
  const pick = (idx) => (idx != null && candles[idx]) ? candles[idx] : null;
  const candle = pick(primaryIdx) || pick(fallbackIdx) || {};
  const raw = candle.ts || candle.time || candle.datetime || Date.now();
  return ensureIsoString(raw);
};

async function getAllStrongSignals(req = {}) {
  try {
    const container = assertContainerReady();
    const data = req.data || {};
    const resolvedInstrument = data.instrument_id || data.instrument_ID;
    const resolvedId = data.id || data.ID;
    const minScoreNum = Number(data.minScore);
    const limitNum = Number(data.limit);
    const offsetNum = Number(data.offset);
    const orderByTs =
      typeof data.orderByTs === 'string' ? data.orderByTs.toUpperCase() : null;

    const clauses = [];
    const parameters = [];
    const addClause = (field, value, paramName = field) => {
      if (value === undefined || value === null || value === '') return;
      clauses.push(`c.${field} = @${paramName}`);
      parameters.push({ name: `@${paramName}`, value });
    };

    addClause('instrument_id', resolvedInstrument, 'instrument_id');
    addClause('strategy_code', data.strategy_code, 'strategy_code');
    addClause('divergence_type', data.divergence_type, 'divergence_type');
    addClause('timeframe', data.timeframe, 'timeframe');
    addClause('id', resolvedId, 'id');

    if (Number.isFinite(minScoreNum)) {
      clauses.push('c.score >= @minScore');
      parameters.push({ name: '@minScore', value: minScoreNum });
    }

    let query = 'SELECT * FROM c';
    if (clauses.length) {
      query += ` WHERE ${clauses.join(' AND ')}`;
    }

    const { resources } = await container.items.query({ query, parameters }).fetchAll();
    let rows = Array.isArray(resources) ? resources.map(cleanCosmosItem) : [];

    if (orderByTs === 'DESC' || orderByTs === 'ASC') {
      rows = rows.sort((a, b) => {
        const ta = new Date(a.ts).getTime();
        const tb = new Date(b.ts).getTime();
        return orderByTs === 'DESC' ? tb - ta : ta - tb;
      });
    }

    if (Number.isFinite(offsetNum) && offsetNum > 0) {
      rows = rows.slice(offsetNum);
    }
    if (Number.isFinite(limitNum) && limitNum > 0) {
      rows = rows.slice(0, limitNum);
    }

    return { value: rows };
  } catch (error) {
    console.error('[CosmosDB] Error obteniendo señales:', error);
    return { error: 'No se pudieron obtener los datos de Cosmos DB' };
  }
}

async function addStrongSignal(req = {}) {
  try {
    const container = assertContainerReady();
    const payload = normalizeSignalPayload(req.data?.signal || req.data || {});

    const requiredFields = ['strategy_code', 'instrument_id', 'divergence_type', 'ts'];
    const missingFields = requiredFields.filter((field) => !payload[field]);
    if (missingFields.length) {
      throw new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
    }

    payload.id = payload.id || randomUUID();
    payload.ts = ensureIsoString(payload.ts);
    payload.createdAt = payload.createdAt || new Date().toISOString();
    payload.updatedAt = payload.updatedAt || payload.createdAt;

    const { resource } = await container.items.create(payload);
    return [cleanCosmosItem(resource)];
  } catch (error) {
    console.error('[CosmosDB] Error creando señal:', error);
    throw new Error(`Error Cosmos DB: ${error.message}`);
  }
}

async function updateStrongSignalById(req = {}) {
  try {
    const data = normalizeSignalPayload(req.data || {});
    const docId = data.id;
    if (!docId) return { error: 'El campo id es requerido' };

    const container = assertContainerReady();
    const query = {
      query: data.strategy_code
        ? 'SELECT * FROM c WHERE c.id = @id AND c.strategy_code = @strategy_code'
        : 'SELECT * FROM c WHERE c.id = @id',
      parameters: data.strategy_code
        ? [
            { name: '@id', value: docId },
            { name: '@strategy_code', value: data.strategy_code },
          ]
        : [{ name: '@id', value: docId }],
    };

    const { resources } = await container.items.query(query).fetchAll();
    if (!resources || resources.length === 0) return { error: 'Registro no encontrado' };

    const itemToUpdate = { ...resources[0] };
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'id') return;
      itemToUpdate[key] = value;
    });
    itemToUpdate.updatedAt = new Date().toISOString();

    const partitionKey = itemToUpdate[PARTITION_FIELD];
    const { resource } = await container.item(itemToUpdate.id, partitionKey).replace(itemToUpdate);
    return [cleanCosmosItem(resource)];
  } catch (error) {
    console.error('[CosmosDB] Error al actualizar señal:', error);
    return { error: 'No se pudo actualizar el dato en Cosmos DB' };
  }
}

async function deleteStrongSignalById(req = {}) {
  try {
    const data = req.data || {};
    const docId = data.id || data.ID;
    if (!docId) return { error: 'El campo id es requerido' };

    const container = assertContainerReady();
    const query = {
      query: data.strategy_code
        ? 'SELECT * FROM c WHERE c.id = @id AND c.strategy_code = @strategy_code'
        : 'SELECT * FROM c WHERE c.id = @id',
      parameters: data.strategy_code
        ? [
            { name: '@id', value: docId },
            { name: '@strategy_code', value: data.strategy_code },
          ]
        : [{ name: '@id', value: docId }],
    };

    const { resources } = await container.items.query(query).fetchAll();
    if (!resources || resources.length === 0) return { error: 'Registro no encontrado' };

    const itemToDelete = resources[0];
    const partitionKey = itemToDelete[PARTITION_FIELD];

    await container.item(itemToDelete.id, partitionKey).delete();
    return { success: true, message: 'Registro eliminado correctamente' };
  } catch (error) {
    console.error('[CosmosDB] Error al eliminar señal:', error);
    return { error: 'No se pudo eliminar el dato en Cosmos DB' };
  }
}

async function persistStrongSignalsFromDivergences({
  divergences = [],
  candles = [],
  instrument_id = null,
  strategy_code = 'RSI_DIVERGENCE',
  timeframe = null,
  minScore = 0.75,
  minPriceDeltaPct = 1,
  extra = {},
} = {}) {
  if (!instrument_id || !Array.isArray(divergences) || divergences.length === 0) {
    return { inserted: 0 };
  }

  const container = assertContainerReady();
  const now = new Date().toISOString();

  const docs = divergences
    .map((div, idx) => {
      const priceDelta = computeDeltaPct(div?.price?.p1, div?.price?.p2);
      const indicatorDelta = computeDeltaPct(div?.rsi?.r1, div?.rsi?.r2);
      const ts = resolveTimestampFromCandles(candles, div?.idx2, div?.idx1);
      const score = Number.isFinite(div?.strength) ? div.strength : 0;

      const qualifies =
        (Number.isFinite(score) && score >= minScore) ||
        (priceDelta != null && Math.abs(priceDelta) >= minPriceDeltaPct);

      if (!qualifies) return null;

      const divergenceType = div?.type?.includes('bull') ? 'bullish' : 'bearish';
      const id = `${instrument_id}-${divergenceType || 'div'}-${new Date(ts).getTime()}-${idx}`;

      return {
        id,
        strategy_code,
        instrument_id,
        divergence_type: divergenceType,
        timeframe,
        ts,
        score,
        price_delta_pct: priceDelta,
        indicator_delta_pct: indicatorDelta,
        confidence: Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0.5)),
        features_json: {
          divergence: div,
          extra,
        },
        createdAt: now,
        updatedAt: now,
      };
    })
    .filter(Boolean);

  if (!docs.length) return { inserted: 0 };

  try {
    await Promise.allSettled(docs.map((doc) => container.items.upsert(doc)));
    return { inserted: docs.length };
  } catch (err) {
    console.error('[CosmosDB] Error al persistir divergencias fuertes:', err);
    return { inserted: 0, error: err };
  }
}

module.exports = {
  getAllStrongSignals,
  addStrongSignal,
  updateStrongSignalById,
  deleteStrongSignalById,
  persistStrongSignalsFromDivergences,
};
