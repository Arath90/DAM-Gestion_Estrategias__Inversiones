/**
 * Calculates the Simple Moving Average (SMA) for a series of candles.
 *
 * @param {Array<Object>} values - Candle array with { time, close }.
 * @param {number} period - Number of periods to average.
 * @returns {Array<{time: number, value: number}>} SMA values aligned with input times.
 */
export const calcSMA = (values, period) => {
  if (!Array.isArray(values) || !period) return [];

  const result = [];
  let sum = 0;

  for (let i = 0; i < values.length; i += 1) {
    sum += values[i].close;
    if (i >= period) sum -= values[i - period].close;

    if (i >= period - 1) {
      result.push({ time: values[i].time, value: sum / period });
    }
  }

  return result;
};
