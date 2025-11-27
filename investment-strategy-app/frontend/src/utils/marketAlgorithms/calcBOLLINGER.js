let bbExecCount = 0;

/**
 * Calculates Bollinger Bands (SMA + StdDev)
 *
 * @param {Array<Object>} values - Candle array with { time, close }.
 * @param {number} [period=20] - Bollinger period.
 * @param {number} [multiplier=2] - Std deviation multiplier.
 * @returns {{
 *   middle: Array<{time: number, value: number}>,
 *   upper: Array<{time: number, value: number}>,
 *   lower: Array<{time: number, value: number}>
 * }}
 */
export const calcBollingerBands = (values, period = 20, multiplier = 2) => {
  bbExecCount += 1;
  console.debug(
    `[Analytics] BB exec #${bbExecCount} (period=${period}, multiplier=${multiplier}, candles=${values?.length || 0})`,
  );

  if (!Array.isArray(values) || values.length === 0) {
    return { middle: [], upper: [], lower: [] };
  }

  const effectivePeriod = Math.min(period, values.length);
  if (effectivePeriod <= 1) return { middle: [], upper: [], lower: [] };

  const window = [];
  const middle = [];
  const upper = [];
  const lower = [];

  for (let i = 0; i < values.length; i += 1) {
    const close = values[i].close;
    if (!Number.isFinite(close)) continue;

    // ventana deslizante
    window.push(close);
    if (window.length > effectivePeriod) window.shift();

    if (window.length < effectivePeriod) continue;

    // --- SMA ---
    const sum = window.reduce((acc, v) => acc + v, 0);
    const mean = sum / effectivePeriod;

    // --- StdDev ---
    const variance =
      window.reduce((acc, v) => acc + (v - mean) ** 2, 0) / effectivePeriod;
    const stdDev = Math.sqrt(variance);

    const up = mean + multiplier * stdDev;
    const low = mean - multiplier * stdDev;

    const t = values[i].time;

    middle.push({ time: t, value: mean });
    upper.push({ time: t, value: up });
    lower.push({ time: t, value: low });
  }

  return { middle, upper, lower };
};
