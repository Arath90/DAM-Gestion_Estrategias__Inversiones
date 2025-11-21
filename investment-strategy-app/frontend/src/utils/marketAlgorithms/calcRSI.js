let rsiExecCount = 0;

/**
 * Calculates Relative Strength Index (RSI) using Wilder's smoothing.
 *
 * Reduces the effective period automatically when there are not enough candles so we still
 * obtain useful values from short samples.
 *
 * @param {Array<Object>} values - Candle array with { time, close }.
 * @param {number} [period=14] - RSI period length.
 * @returns {Array<{time: number, value: number}>} RSI values between 0 and 100.
 */
export const calcRSI = (values, period = 14) => {
  rsiExecCount += 1;
  console.debug(
    `[Analytics] RSI exec #${rsiExecCount} (period=${period}, candles=${values?.length || 0})`,
  );
  if (!Array.isArray(values) || values.length < 2) return [];

  const effectivePeriod = Math.min(period, values.length - 1);
  if (effectivePeriod <= 0) return [];

  const rsi = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= effectivePeriod; i += 1) {
    const diff = values[i].close - values[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  gains /= effectivePeriod;
  losses /= effectivePeriod;

  const seedIndex = effectivePeriod;
  const rs = losses === 0 ? 100 : gains / (losses || 1e-9);
  rsi.push({ time: values[seedIndex].time, value: 100 - 100 / (1 + rs) });

  for (let i = seedIndex + 1; i < values.length; i += 1) {
    const diff = values[i].close - values[i - 1].close;
    let gain = 0;
    let loss = 0;
    if (diff >= 0) gain = diff;
    else loss = -diff;

    gains = (gains * (effectivePeriod - 1) + gain) / effectivePeriod;
    losses = (losses * (effectivePeriod - 1) + loss) / effectivePeriod;

    const rsStep = losses === 0 ? 100 : gains / (losses || 1e-9);
    rsi.push({ time: values[i].time, value: 100 - 100 / (1 + rsStep) });
  }

  return rsi;
};
