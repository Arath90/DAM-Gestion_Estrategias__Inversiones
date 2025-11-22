/**
 * Utilidades para procesamiento de analytics de mercado
 * Funciones puras extraídas de useMarketData para mejor testabilidad y reutilización
 */

/**
 * Alinea valores de RSI con índices de candles
 * @param {Array} candles - Array de velas
 * @param {Array} rsi14 - Array de valores RSI con {time, value}
 * @returns {Array} Array de valores RSI alineados por índice de candles
 */
export const alignRSIWithCandles = (candles, rsi14) => {
  const rsiValuesByIndex = new Array(candles.length).fill(undefined);
  
  if (!Array.isArray(rsi14) || rsi14.length === 0) {
    return rsiValuesByIndex;
  }
  
  const rsiTimeMap = new Map(rsi14.map((r) => [r.time, r.value]));
  
  for (let i = 0; i < candles.length; i++) {
    rsiValuesByIndex[i] = rsiTimeMap.get(candles[i].time);
  }
  
  return rsiValuesByIndex;
};

/**
 * Extrae series de precios para análisis de divergencias
 * @param {Array} candles - Array de velas
 * @returns {Object} Objeto con priceHighSeries y priceLowSeries
 */
export const extractPriceSeries = (candles) => {
  return {
    priceHighSeries: candles.map((c) => c.high),
    priceLowSeries: candles.map((c) => c.low),
  };
};

/**
 * Construye objeto de indicadores para el motor de señales
 * @param {Object} params - Parámetros
 * @param {Array} params.rsiValuesByIndex - RSI alineado por índice
 * @param {Array} params.macdLine - Línea MACD
 * @param {Array} params.macdSignal - Señal MACD
 * @param {Array} params.macdHistogram - Histograma MACD
 * @param {Array} params.ema20 - EMA 20
 * @param {Array} params.ema50 - EMA 50
 * @returns {Object} Objeto de indicadores formateado
 */
export const buildIndicatorsObject = ({
  rsiValuesByIndex,
  macdLine = [],
  macdSignal = [],
  macdHistogram = [],
  ema20 = [],
  ema50 = [],
}) => {
  return {
    rsi: rsiValuesByIndex,
    bb: null, // Para futuras bandas de Bollinger
    macd: {
      macd: macdLine.map((m) => m.value),
      signal: macdSignal.map((s) => s.value),
      hist: macdHistogram.map((h) => h.value),
    },
    ema20: ema20.map((e) => e.value),
    ema50: ema50.map((e) => e.value),
  };
};

/**
 * Enriquece señales con contexto de símbolo e intervalo
 * @param {Array} signals - Señales generadas
 * @param {string} symbol - Símbolo del instrumento
 * @param {string} interval - Intervalo temporal
 * @returns {Array} Señales enriquecidas
 */
export const enrichSignalsWithContext = (signals, symbol, interval) => {
  if (!Array.isArray(signals)) return [];
  return signals.map((s) => ({ ...s, symbol, interval }));
};

/**
 * Parsea y valida parámetros de algoritmos con valores por defecto
 * @param {Object} mergedAlgo - Algoritmos mergeados
 * @returns {Object} Parámetros parseados y validados
 */
export const parseAlgorithmParams = (mergedAlgo) => {
  return {
    emaFastPeriod: Number(mergedAlgo.emaFast) || 20,
    emaSlowPeriod: Number(mergedAlgo.emaSlow) || 50,
    smaLongPeriod: Number(mergedAlgo.smaLong) || 200,
    rsiPeriod: Number(mergedAlgo.rsiPeriod) || 14,
    macdFastPeriod: Number(mergedAlgo.macdFast) || 12,
    macdSlowPeriod: Number(mergedAlgo.macdSlow) || 26,
    macdSignalPeriod: Number(mergedAlgo.macdSignal) || 9,
  };
};

/**
 * Parsea configuración de divergencias con valores por defecto
 * @param {Object} divergenceConfig - Configuración de divergencias
 * @returns {Object} Configuración parseada
 */
export const parseDivergenceConfig = (divergenceConfig = {}) => {
  return {
    peakWindow: Number(divergenceConfig.peakWindow) || 3,
    maxBarsBetweenPeaks: Number(divergenceConfig.maxBarsBetweenPeaks) || 60,
    minPriceChangePct: Number(divergenceConfig.minPriceChangePct) || 0.002,
    minIndicatorChangePct: Number(divergenceConfig.minIndicatorChangePct) || 0.01,
    maxPeakDistance: Number(divergenceConfig.maxPeakDistance) || 8,
  };
};

/**
 * Formatea fecha para logging
 * @param {Date} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
export const formatDateForLog = (date) => {
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Calcula estadísticas de período de velas
 * @param {Array} candles - Array de velas
 * @returns {Object} Estadísticas del período
 */
export const calculatePeriodStats = (candles) => {
  if (!candles || candles.length === 0) {
    return null;
  }
  
  const firstTime = new Date(candles[0].time * 1000);
  const lastTime = new Date(candles[candles.length - 1].time * 1000);
  const daysCovered = (lastTime - firstTime) / (1000 * 60 * 60 * 24);
  
  return {
    firstTime,
    lastTime,
    daysCovered: Math.round(daysCovered),
    count: candles.length,
  };
};

/**
 * Construye resultado vacío de analytics
 * @param {Object} mergedAlgo - Parámetros de algoritmos
 * @returns {Object} Objeto de analytics vacío
 */
export const createEmptyAnalytics = (mergedAlgo) => {
  return {
    ema20: [],
    ema50: [],
    sma200: [],
    rsi14: [],
    macdLine: [],
    macdSignal: [],
    macdHistogram: [],
    signals: [],
    tradeSignals: [],
    divergences: [],
    appliedAlgoParams: mergedAlgo,
  };
};
