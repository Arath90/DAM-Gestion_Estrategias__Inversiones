// src/api/services/indicators/resistance.service.js
// Servicio: Cálculo de resistencias (crestas de velas)
const { findPivots } = require('./pivots.service');

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeTime = (candle) => {
  const raw = candle?.ts ?? candle?.time ?? candle?.datetime ?? candle?.date ?? candle?.t;
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? Math.floor(d.getTime() / 1000) : null;
};

const normalizeCandles = (candles = []) => (
  Array.isArray(candles)
    ? candles
        .map((c) => ({
          ...c,
          high: toNumber(c.high ?? c.h),
          low: toNumber(c.low ?? c.l),
          open: toNumber(c.open ?? c.o),
          close: toNumber(c.close ?? c.c),
          time: normalizeTime(c),
        }))
        .filter((c) => Number.isFinite(c.high) && Number.isFinite(c.time))
        .sort((a, b) => a.time - b.time)
    : []
);

/**
 * Detecta resistencias ubicadas en las crestas (máximos locales) de las velas.
 * @param {Array<Object>} candles
 * @param {Object} opts
 * @param {number} [opts.swingLen=1] - Ventana de comparación a cada lado.
 * @param {number} [opts.limit=3] - Máximo de resistencias a devolver.
 * @param {number} [opts.precision=4] - Decimales para agrupar duplicados.
 * @returns {{ levels: number[], crests: Array<{value:number,index:number,time:number}>, segments: Array<{level:number,from:number,to:number}> }}
 */
function detectResistanceLevels(candles, { swingLen = 1, limit = 3, precision = 4 } = {}) {
  const rows = normalizeCandles(candles);
  if (!rows.length) return { levels: [], crests: [], segments: [] };

  const highSeries = rows.map((c) => c.high);
  const { highs } = findPivots(highSeries, { swingLen: Math.max(1, swingLen) });

  const crests = highs
    .map(({ idx, val }) => ({
      value: val,
      index: idx,
      time: rows[idx]?.time,
    }))
    .filter((c) => Number.isFinite(c.value) && Number.isFinite(c.time))
    .sort((a, b) => b.value - a.value);

  const seen = new Set();
  const levels = [];
  for (const crest of crests) {
    const key = crest.value.toFixed(precision);
    if (seen.has(key)) continue;
    seen.add(key);
    levels.push(crest.value);
    if (levels.length >= limit) break;
  }

  const segments = levels.map((level) => {
    const closest = crests.find((c) => c.value.toFixed(precision) === level.toFixed(precision)) || crests[0];
    const fromIdx = Math.max((closest?.index ?? 0) - 1, 0);
    const toIdx = Math.min((closest?.index ?? 0) + 1, rows.length - 1);
    return {
      level,
      from: rows[fromIdx]?.time,
      to: rows[toIdx]?.time,
    };
  }).filter((s) => Number.isFinite(s.from) && Number.isFinite(s.to));

  return { levels, crests, segments };
}

module.exports = { detectResistanceLevels };
