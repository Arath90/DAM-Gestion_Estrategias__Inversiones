import { calcEMA } from './calcEMA';

let macdExecCount = 0;

/**
 * Calculates MACD (line, signal and histogram) using EMA building blocks.
 *
 * @param {Array<Object>} values - Candle array with { time, close }.
 * @param {number} [fastPeriod=12] - Fast EMA period.
 * @param {number} [slowPeriod=26] - Slow EMA period.
 * @param {number} [signalPeriod=9] - Signal EMA period.
 * @returns {{macdLine: Array, signalLine: Array, histogram: Array}} MACD components.
 */
export const calcMACD = (values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  macdExecCount += 1;
  console.debug(
    `[Analytics] MACD exec #${macdExecCount} (fast=${fastPeriod}, slow=${slowPeriod}, signal=${signalPeriod}, candles=${values?.length || 0})`,
  );

  if (!Array.isArray(values) || values.length === 0) {
    return { macdLine: [], signalLine: [], histogram: [] };
  }

  const fast = calcEMA(values, fastPeriod);
  const slow = calcEMA(values, slowPeriod);
  const slowMap = new Map(slow.map((entry) => [entry.time, entry.value]));

  const macdLine = fast
    .map((entry) => {
      const slowValue = slowMap.get(entry.time);
      if (!Number.isFinite(slowValue)) return null;
      return { time: entry.time, value: entry.value - slowValue };
    })
    .filter(Boolean);

  if (!macdLine.length) return { macdLine: [], signalLine: [], histogram: [] };

  const signalLine = calcEMA(macdLine, signalPeriod, (point) => point.value);
  const signalMap = new Map(signalLine.map((entry) => [entry.time, entry.value]));

  const histogram = macdLine
    .map((entry) => {
      const signalValue = signalMap.get(entry.time);
      if (!Number.isFinite(signalValue)) return null;
      return { time: entry.time, value: entry.value - signalValue };
    })
    .filter(Boolean);

  return { macdLine, signalLine, histogram };
};
