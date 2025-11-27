/**
 * Calculates the Exponential Moving Average (EMA) for a time series.
 *
 * @param {Array<Object>} values - Candle array with { time, close } and optional extra fields.
 * @param {number} period - EMA period length.
 * @param {Function} accessor - Selector for the numeric value inside the candle (defaults to close).
 * @returns {Array<{time: number, value: number}>} EMA values aligned with input times.
 */
export const calcEMA = (values, period, accessor = (v) => v.close) => {
  if (!Array.isArray(values) || values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = [];
  let prev;

  values.forEach((entry, idx) => {
    const value = accessor(entry);
    if (!Number.isFinite(value)) return;
    if (idx === 0 || prev === undefined) {
      prev = value;
    } else {
      prev = value * k + prev * (1 - k);
    }
    ema.push({ time: entry.time, value: prev });
  });

  return ema;
};
