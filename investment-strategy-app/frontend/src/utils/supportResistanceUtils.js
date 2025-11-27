/**
 * Utility functions for support and resistance level detection and rendering
 */

const API_SAP_BASE =
  (import.meta?.env?.VITE_BACKEND_URL && String(import.meta.env.VITE_BACKEND_URL).trim()) ||
  'http://localhost:4004';

/**
 * Builds SAP API URL
 * @param {string} path - API path
 * @returns {string} Complete URL
 */
export const buildSapUrl = (path) => {
  return `${API_SAP_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

/**
 * Detects resistance levels by finding price crests (local maxima)
 * @param {Array} candles - Array of candle objects with {high, time}
 * @param {number} maxCount - Maximum number of crests to return
 * @returns {Array} Array of crest objects {value, index, time}
 */
export const detectCrestResistances = (candles, maxCount = 3) => {
  if (!Array.isArray(candles) || candles.length < 3) return [];

  const crests = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1].high;
    const curr = candles[i].high;
    const next = candles[i + 1].high;
    if (curr > prev && curr >= next) {
      crests.push({ value: curr, index: i, time: candles[i].time });
    }
  }

  const seen = new Set();
  const unique = [];
  crests
    .sort((a, b) => b.value - a.value)
    .forEach((crest) => {
      const key = crest.value.toFixed(4);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(crest);
      }
    });

  return unique.slice(0, maxCount);
};

/**
 * Finds time segments for drawing resistance levels based on nearest crests
 * @param {Array} candles - Array of candle objects
 * @param {Array} levels - Array of resistance level values
 * @returns {Array} Array of segment objects {level, from, to}
 */
export const findSegmentsForLevels = (candles, levels) => {
  if (!Array.isArray(candles) || !Array.isArray(levels)) return [];
  if (!candles.length || !levels.length) return [];

  const crests = detectCrestResistances(candles, candles.length);

  return levels.map((level) => {
    let closest = null;
    let minDiff = Number.POSITIVE_INFINITY;

    crests.forEach((crest) => {
      const diff = Math.abs(crest.value - level);
      if (diff < minDiff) {
        minDiff = diff;
        closest = crest;
      }
    });

    if (!closest) {
      return {
        level,
        from: candles[0].time,
        to: candles[candles.length - 1].time,
      };
    }

    const fromIdx = Math.max(closest.index - 1, 0);
    const toIdx = Math.min(closest.index + 1, candles.length - 1);

    return {
      level,
      from: candles[fromIdx].time,
      to: candles[toIdx].time,
    };
  });
};

/**
 * Fetches resistance levels from API_SAP backend
 * @param {Array} candles - Array of candle objects
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Array>} Array of resistance level values
 */
export const fetchResistanceLevelsFromApi = async (candles, signal) => {
  const body = {
    candles: candles.map(({ time, open, high, low, close, volume }) => ({
      time,
      open,
      high,
      low,
      close,
      volume,
    })),
  };

  const response = await fetch(buildSapUrl('/api/indicators/resistances'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API_SAP response ${response.status}`);
  }

  const payload = await response.json();
  const rawLevels =
    payload?.data?.resistances ||
    payload?.resistances ||
    payload?.data ||
    payload;

  if (!Array.isArray(rawLevels)) {
    throw new Error('API_SAP resistances payload is not an array');
  }

  return rawLevels
    .map((entry) =>
      typeof entry === 'number' ? entry : Number(entry?.level ?? entry?.value),
    )
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)
    .slice(0, 3);
};

/**
 * Creates line series configuration for support level
 * @param {number} level - Support level value
 * @returns {Object} Line series configuration
 */
export const createSupportLineConfig = (level) => ({
  color: '#00FF00',
  lineWidth: 2,
  lineStyle: 2,
  title: `Soporte ${level.toFixed(2)}`,
});

/**
 * Creates line series configuration for resistance level
 * @param {number} level - Resistance level value
 * @returns {Object} Line series configuration
 */
export const createResistanceLineConfig = (level) => ({
  color: '#FF0000',
  lineWidth: 2,
  lineStyle: 2,
  title: `Resistencia ${level.toFixed(2)}`,
});

/**
 * Creates data points for horizontal line across time range
 * @param {number} level - Price level
 * @param {number|string} fromTime - Start time
 * @param {number|string} toTime - End time
 * @returns {Array} Array of data points [{time, value}]
 */
export const createHorizontalLineData = (level, fromTime, toTime) => [
  { time: fromTime, value: level },
  { time: toTime, value: level },
];

/**
 * Removes chart series safely with error handling
 * @param {Object} chartRef - Chart instance
 * @param {Array} seriesArray - Array of series to remove
 */
export const removeChartSeries = (chartRef, seriesArray) => {
  if (!chartRef || !Array.isArray(seriesArray)) return;

  seriesArray.forEach((series) => {
    try {
      chartRef.removeSeries(series);
    } catch (e) {
      console.debug('[Support/Resistance] Error removiendo serie:', e.message);
    }
  });
};

/**
 * Draws support levels on chart
 * @param {Object} chartRef - Chart instance
 * @param {Array} supportLevels - Array of support level values
 * @param {Array} candles - Array of candle objects
 * @returns {Array} Array of created series
 */
export const drawSupportLevels = (chartRef, supportLevels, candles) => {
  if (!chartRef || !supportLevels.length || !candles.length) return [];

  const series = [];
  supportLevels.forEach((level) => {
    const lineSeries = chartRef.addLineSeries(createSupportLineConfig(level));
    lineSeries.setData(
      createHorizontalLineData(level, candles[0].time, candles[candles.length - 1].time)
    );
    series.push(lineSeries);
  });

  return series;
};

/**
 * Draws resistance levels on chart using segments
 * @param {Object} chartRef - Chart instance
 * @param {Array} resistanceSegments - Array of segment objects {level, from, to}
 * @returns {Array} Array of created series
 */
export const drawResistanceLevels = (chartRef, resistanceSegments) => {
  if (!chartRef || !resistanceSegments.length) return [];

  const series = [];
  resistanceSegments.forEach(({ level, from, to }) => {
    const lineSeries = chartRef.addLineSeries(createResistanceLineConfig(level));
    lineSeries.setData(createHorizontalLineData(level, from, to));
    series.push(lineSeries);
  });

  return series;
};
