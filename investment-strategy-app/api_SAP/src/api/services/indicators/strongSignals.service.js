const StrongSignal = require('../../models/mongodb/StrongSignal');

const DEFAULT_MIN_SCORE = 0.75;
const DEFAULT_MIN_PRICE_DELTA = 1;

const numericOrNull = (value) => (Number.isFinite(value) ? value : null);

const resolveTimestamp = (candles, primaryIdx, fallbackIdx) => {
  const candle =
    (primaryIdx != null && candles[primaryIdx])
      ? candles[primaryIdx]
      : (fallbackIdx != null && candles[fallbackIdx])
      ? candles[fallbackIdx]
      : null;

  const rawTs = candle?.ts || candle?.time || candle?.datetime || Date.now();
  return rawTs instanceof Date ? rawTs : new Date(rawTs);
};

const computeDeltaPct = (p1, p2) => {
  if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 === 0) return null;
  return ((p2 - p1) / Math.abs(p1)) * 100;
};

/**
 * Persiste las divergencias "fuertes" en el contenedor StrongSignals de Cosmos DB.
 */
async function persistStrongSignals({
  divergences = [],
  candles = [],
  instrument_id = null,
  strategy_code = 'RSI_DIVERGENCE',
  timeframe = null,
  minScore = DEFAULT_MIN_SCORE,
  minPriceDeltaPct = DEFAULT_MIN_PRICE_DELTA,
  extra = {},
} = {}) {
  if (!instrument_id || !StrongSignal) return { inserted: 0 };

  const docs = divergences
    .map((div) => {
      const priceDelta = computeDeltaPct(div.price?.p1, div.price?.p2);
      const indicatorDelta = computeDeltaPct(div.rsi?.r1, div.rsi?.r2);
      const ts = resolveTimestamp(candles, div.idx2, div.idx1);
      const score = numericOrNull(div.strength) ?? 0;

      const qualifies =
        (Number.isFinite(score) && score >= minScore) ||
        (priceDelta != null && Math.abs(priceDelta) >= minPriceDeltaPct);

      if (!qualifies) return null;

      return {
        filter: {
          strategy_code,
          instrument_id,
          divergence_type: div.type?.includes('bull') ? 'bullish' : 'bearish',
          ts,
        },
        update: {
          $set: {
            strategy_code,
            instrument_id,
            divergence_type: div.type?.includes('bull') ? 'bullish' : 'bearish',
            ts,
            timeframe,
            score,
            price_delta_pct: priceDelta,
            indicator_delta_pct: indicatorDelta,
            confidence: Math.min(Math.max(score, 0), 1),
            features_json: {
              divergence: div,
              extra,
            },
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
      };
    })
    .filter(Boolean);

  if (!docs.length) return { inserted: 0 };

  try {
    const result = await StrongSignal.bulkWrite(
      docs.map((doc) => ({
        updateOne: {
          filter: doc.filter,
          update: doc.update,
          upsert: true,
        },
      })),
      { ordered: false },
    );

    const upserts = Object.values(result?.upsertedIds || {}).length;
    return { inserted: upserts, matched: result?.matchedCount ?? 0 };
  } catch (err) {
    console.error('[StrongSignals] Error al persistir divergencias fuertes:', err);
    return { inserted: 0, error: err };
  }
}

module.exports = {
  persistStrongSignals,
};
