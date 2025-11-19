// frontend/src/utils/events.js
// Construye eventos combinando divergencias, señales RSI/MACD y velas

const clamp = (val, min = 0, max = 1) => Math.min(max, Math.max(min, val));

export function buildEvents({
  candles = [],
  indicators = {},
  divergences = [],
  signals = [],
  cfg = {},
}) {
  if (!Array.isArray(candles) || !candles.length) return [];

  const {
    rsi: rsiSeries = [],
    macd: macdStruct = {},
  } = indicators || {};

  const macdArr = macdStruct?.macd || [];
  const macdSigArr = macdStruct?.signal || [];
  const macdHistArr = macdStruct?.hist || [];

  const rsiOversold = cfg.rsiOversold ?? 30;
  const rsiOverbought = cfg.rsiOverbought ?? 70;
  const confirmBars = cfg.confirmBars ?? 1;
  const cooldownBars = cfg.cooldownBars ?? 5;

  const events = [];

  const getPrice = (i) =>
    candles[i]?.close ?? candles[i]?.c ?? candles[i]?.price ?? null;

  const getTime = (i) =>
    candles[i]?.time ?? candles[i]?.ts ?? candles[i]?.datetime ?? null;

  // 1) Eventos de setup por divergencia
  (divergences || []).forEach((d) => {
    const idx = d?.p2Index ?? d?.p1Index;
    if (idx == null || !candles[idx]) return;
    const time = getTime(idx);
    const price = getPrice(idx);
    if (!time || !Number.isFinite(price)) return;
    const side =
      d.type === 'bullish' || d.type === 'bullish_divergence' ? 'LONG' : 'SHORT';
    const score = Number(d.score ?? 0);

    events.push({
      time,
      side,
      kind: 'SETUP_DIVERGENCE',
      label: side === 'LONG' ? 'Setup: Divergencia alcista' : 'Setup: Divergencia bajista',
      description: `Divergencia ${side === 'LONG' ? 'alcista' : 'bajista'} entre precio y RSI (score ${score.toFixed(
        2,
      )}).`,
      price,
      strength: clamp(score, 0, 1),
      meta: { divergence: d },
    });
  });

  // 2) Entradas MACD + RSI con confirmación
  let lastLongIndex = -Infinity;
  let lastShortIndex = -Infinity;

  (signals || []).forEach((s) => {
    if (!s) return;
    const signalIndex = Number(s.index);
    if (!Number.isFinite(signalIndex) || !candles[signalIndex]) return;

    const rsiVal = rsiSeries[signalIndex];
    if (!Number.isFinite(rsiVal)) return;

    const macdVal = macdArr[signalIndex];
    const macdSigVal = macdSigArr[signalIndex];
    const histVal = macdHistArr[signalIndex];
    const priceSignal = getPrice(signalIndex);
    if (!Number.isFinite(priceSignal)) return;

    let side = null;
    let reason = '';

    if (s.type === 'macd_cross_up') {
      if (rsiVal < 50 && rsiVal > rsiOversold - 10) {
        side = 'LONG';
        reason = 'MACD cruzó al alza y RSI acompaña desde zona baja.';
      }
    } else if (s.type === 'macd_cross_down') {
      if (rsiVal > 50 && rsiVal < rsiOverbought + 10) {
        side = 'SHORT';
        reason = 'MACD cruzó a la baja y RSI confirma debilidad.';
      }
    }

    if (!side) return;

    if (side === 'LONG' && signalIndex - lastLongIndex < cooldownBars) return;
    if (side === 'SHORT' && signalIndex - lastShortIndex < cooldownBars) return;

    const entryIndex = Math.min(signalIndex + confirmBars, candles.length - 1);
    const entryTime = getTime(entryIndex);
    const entryPrice = getPrice(entryIndex);
    if (!entryTime || !Number.isFinite(entryPrice)) return;

    if (side === 'LONG') lastLongIndex = entryIndex;
    if (side === 'SHORT') lastShortIndex = entryIndex;

    const distRsi = clamp(Math.abs(rsiVal - 50) / 50);
    const slopeMacd =
      Number.isFinite(macdVal) && Number.isFinite(macdSigVal)
        ? Math.abs(macdVal - macdSigVal)
        : 0;
    const normSlope = clamp(slopeMacd / 2);
    const strength = clamp(0.4 + 0.3 * distRsi + 0.3 * normSlope);

    events.push({
      time: entryTime,
      side,
      kind: 'ENTRY_MACD_RSI',
      label: side === 'LONG' ? 'Entrada LONG (MACD+RSI)' : 'Entrada SHORT (MACD+RSI)',
      description: reason,
      price: entryPrice,
      strength,
      meta: {
        signalIndex,
        entryIndex,
        rsi: rsiVal,
        macd: macdVal,
        macdSignal: macdSigVal,
        hist: histVal,
        rawSignal: s,
      },
    });
  });

  return events
    .filter((e) => e && Number.isFinite(e.price) && Number.isFinite(e.time))
    .sort((a, b) => a.time - b.time);
}

export function exportCSV(rows = [], filename = 'events.csv') {
  if (!Array.isArray(rows) || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h] == null ? '' : String(row[h]);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(','),
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
