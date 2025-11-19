import { useEffect, useMemo, useState } from 'react';
import { fetchCandles, fetchMacd, fetchAnalytics } from '../services/marketData';
import { DEFAULT_SIGNAL_CONFIG } from '../constants/strategyProfiles';
import { DEFAULT_ALGORITHM_PARAMS, mergeAlgorithmParams } from '../constants/algorithmDefaults';

import { findDivergences } from '../utils/divergences';
import { computeSignals } from '../utils/signals';




/**
 * Hook React centralizado para análisis técnico de mercado y generación de señales de trading.
 * 
 * **Propósito principal:**
 * Orquesta el flujo completo desde la obtención de datos de mercado (velas/candles) hasta
 * la generación de señales de trading accionables, incluyendo cálculo de indicadores técnicos,
 * detección de divergencias y análisis de patrones.
 * 
 * **Flujo de datos:**
 * 1. Obtiene velas históricas desde la API backend (fetchCandles)
 * 2. Intenta obtener analytics pre-calculados del backend (fetchAnalytics)
 * 3. Si backend no disponible, calcula indicadores localmente (EMA, SMA, RSI, MACD)
 * 4. Detecta divergencias entre precio e indicadores
 * 5. Genera señales de trading usando motor multi-indicador (computeSignals)
 * 6. Enriquece señales con contexto y metadatos
 * 
 * **Indicadores calculados:**
 * - EMA (Media Móvil Exponencial): Configurable para corto y largo plazo
 * - SMA (Media Móvil Simple): Típicamente 200 períodos para tendencia de fondo
 * - RSI (Índice de Fuerza Relativa): Oscilador de momentum (0-100)
 * - MACD: Convergencia/Divergencia de medias móviles con línea de señal e histograma
 * 
 * **Relación con otros módulos:**
 * - `services/marketData.js`: Obtiene datos raw de velas desde API
 * - `useMarketCharts`: Consume los indicadores para renderizar gráficos Lightweight Charts
 * - `Mercado.jsx`: Usa tradeSignals para mostrar notificaciones y persistir en DB
 * - `utils/divergences.js`: Detecta divergencias RSI/precio
 * - `utils/signals.js`: Motor de generación de señales
 * 
 * **Características destacadas:**
 * - **Fallback inteligente**: Si backend falla, calcula todo localmente
 * - **Configuración flexible**: Períodos de indicadores y umbrales configurables
 * - **Optimización**: Reutiliza cálculos previos y usa memoización
 * - **Debugging**: Contadores de ejecución y logs detallados
 * - **Testing**: Exporta funciones puras (marketAnalyticsUtils) para pruebas unitarias
 * 
 * @param {Object} config - Configuración del análisis
 * @param {string} config.symbol - Símbolo del instrumento (ej: 'BTCUSDT', 'AAPL')
 * @param {string} [config.interval='1hour'] - Intervalo temporal ('1min', '5min', '1hour', '1day', etc.)
 * @param {number} [config.limit=120] - Número de velas a obtener
 * @param {Object} [config.signalConfig] - Configuración de generación de señales:
 *   @param {boolean} config.signalConfig.useEMA - Activar análisis EMA
 *   @param {boolean} config.signalConfig.useRSI - Activar análisis RSI
 *   @param {boolean} config.signalConfig.useMACD - Activar análisis MACD
 *   @param {number} config.signalConfig.rsiOversold - Umbral RSI sobreventa
 *   @param {number} config.signalConfig.rsiOverbought - Umbral RSI sobrecompra
 *   @param {number} config.signalConfig.minReasons - Razones mínimas para emitir señal
 * @param {Object} [config.algoParams] - Parámetros de algoritmos técnicos:
 *   @param {number} config.algoParams.emaFast - Período EMA rápida (default: 20)
 *   @param {number} config.algoParams.emaSlow - Período EMA lenta (default: 50)
 *   @param {number} config.algoParams.smaLong - Período SMA larga (default: 200)
 *   @param {number} config.algoParams.rsiPeriod - Período RSI (default: 14)
 *   @param {number} config.algoParams.macdFast - Período MACD rápido (default: 12)
 *   @param {number} config.algoParams.macdSlow - Período MACD lento (default: 26)
 *   @param {number} config.algoParams.macdSignal - Período señal MACD (default: 9)
 *   @param {Object} config.algoParams.divergence - Config detección divergencias
 * @param {string} [config.datasetId] - ID del dataset (para análisis histórico)
 * @param {string} [config.strategyCode] - Código de estrategia aplicada
 * @param {string} [config.periodStart] - Fecha inicio período (ISO string)
 * @param {string} [config.periodEnd] - Fecha fin período (ISO string)
 * 
 * @returns {Object} Estado y analytics completos:
 * @returns {Array} candles - Velas obtenidas [{time, open, high, low, close, volume}]
 * @returns {boolean} loading - Indica si está cargando datos
 * @returns {string} error - Mensaje de error si lo hay
 * @returns {Array} ema20 - Valores EMA de 20 períodos [{time, value}]
 * @returns {Array} ema50 - Valores EMA de 50 períodos
 * @returns {Array} sma200 - Valores SMA de 200 períodos
 * @returns {Array} rsi14 - Valores RSI de 14 períodos
 * @returns {Array} macdLine - Línea MACD
 * @returns {Array} macdSignal - Línea de señal MACD
 * @returns {Array} macdHistogram - Histograma MACD
 * @returns {Array} signals - Señales raw del motor
 * @returns {Array} tradeSignals - Señales enriquecidas con symbol/interval
 * @returns {Array} divergences - Divergencias detectadas entre precio/indicadores
 * @returns {Object} appliedAlgoParams - Parámetros efectivos aplicados
 * 
 * @example
 * const {
 *   candles,
 *   loading,
 *   error,
 *   ema20,
 *   ema50,
 *   rsi14,
 *   tradeSignals,
 *   divergences
 * } = useMarketData({
 *   symbol: 'BTCUSDT',
 *   interval: '1hour',
 *   limit: 200,
 *   signalConfig: {
 *     useEMA: true,
 *     useRSI: true,
 *     useMACD: true,
 *     rsiOversold: 30,
 *     rsiOverbought: 70,
 *     minReasons: 2
 *   },
 *   algoParams: {
 *     emaFast: 12,
 *     emaSlow: 26,
 *     rsiPeriod: 14
 *   }
 * });
 * 
 * @note Usa debounce de 500ms para evitar requests excesivos en cambios rápidos de parámetros
 * @note Maneja automáticamente rate limiting y usa cache cuando API no disponible
 * @note Todos los cálculos son reactivos y se actualizan cuando cambian las dependencias
 */



/**
 * Calcula la Media Móvil Exponencial (EMA) para una serie de valores.
 * 
 * La EMA es un indicador técnico que da más peso a los valores recientes, haciéndola
 * más sensible a cambios de precio que una media móvil simple (SMA).
 * 
 * Fórmula: EMA_actual = precio_actual × k + EMA_anterior × (1 - k)
 * donde k = 2 / (period + 1) es el factor de suavizado
 * 
 * @param {Array<Object>} values - Array de objetos con datos de velas (candles)
 * @param {number} period - Período de la EMA (ej: 20 para EMA de 20 períodos)
 * @param {Function} accessor - Función para extraer el valor numérico de cada elemento.
 *                               Por defecto extrae el precio de cierre (v.close)
 * @returns {Array<{time: number, value: number}>} Array de puntos {time, value} con los valores de EMA
 * 
 * @example
 * // EMA de 20 períodos usando precio de cierre
 * const ema20 = calcEMA(candles, 20);
 * 
 * // EMA usando precio máximo (high)
 * const emaHigh = calcEMA(candles, 20, (v) => v.high);
 */
const calcEMA = (values, period, accessor = (v) => v.close) => {
  if (!Array.isArray(values) || values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = [];
  let prev;
  values.forEach((v, idx) => {
    const value = accessor(v);
    if (!Number.isFinite(value)) return;
    if (idx === 0 || prev === undefined) {
      prev = value;
    } else {
      prev = value * k + prev * (1 - k);
    }
    ema.push({ time: v.time, value: prev });
  });
  return ema;
};

/**
 * Contadores globales para debugging y monitoreo de rendimiento.
 * 
 * Propósito:
 * - Rastrear cuántas veces se ejecutan cálculos pesados
 * - Detectar recálculos innecesarios o loops infinitos
 * - Analizar impacto de cambios de configuración
 * - Debugging en desarrollo
 * 
 * Se incrementan en cada ejecución de la función correspondiente y
 * se registran en console.debug con información contextual.
 * 
 * @note En producción estos logs pueden deshabilitarse o enviarse a analytics
 */
let rsiExecCount = 0;
let macdExecCount = 0;

/**
 * Calcula la Media Móvil Simple (SMA) para una serie de valores.
 * 
 * La SMA calcula el promedio aritmético de los últimos N períodos, proporcionando
 * una línea de tendencia suavizada que responde más lentamente a cambios de precio.
 * Usa un algoritmo de ventana deslizante para eficiencia O(n).
 * 
 * Fórmula: SMA = (precio_1 + precio_2 + ... + precio_n) / n
 * 
 * @param {Array<Object>} values - Array de objetos con datos de velas que contienen campo 'close'
 * @param {number} period - Período de la SMA (número de barras a promediar)
 * @returns {Array<{time: number, value: number}>} Array de puntos con valores de SMA
 *                                                   Solo incluye puntos donde hay suficientes datos (≥ period)
 * 
 * @example
 * // SMA de 200 períodos (tendencia de largo plazo)
 * const sma200 = calcSMA(candles, 200);
 */
const calcSMA = (values, period) => {
  if (!Array.isArray(values) || !period) return [];
  const result = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i].close;
    if (i >= period) sum -= values[i - period].close;
    if (i >= period - 1) {
      result.push({ time: values[i].time, value: sum / period });
    }
  }
  return result;
};

/**
 * Calcula el Índice de Fuerza Relativa (RSI) usando el método de Wilder.
 * 
 * El RSI es un oscilador de momentum que mide la velocidad y magnitud de los cambios
 * de precio. Oscila entre 0 y 100, donde valores >70 indican sobrecompra y <30 sobreventa.
 * 
 * Algoritmo:
 * 1. Calcula ganancias y pérdidas promedio inicial (período de semilla)
 * 2. Aplica suavizado exponencial de Wilder: avg = (avg_anterior × (n-1) + valor_actual) / n
 * 3. RS = ganancias_promedio / pérdidas_promedio
 * 4. RSI = 100 - (100 / (1 + RS))
 * 
 * Característica especial: Si hay pocas velas disponibles, reduce dinámicamente el período
 * para garantizar que se generen valores RSI en lugar de devolver un array vacío.
 * 
 * @param {Array<Object>} values - Array de velas con campo 'close' y 'time'
 * @param {number} [period=14] - Período del RSI (por defecto 14, estándar de Wilder)
 * @returns {Array<{time: number, value: number}>} Array de puntos con valores RSI (0-100)
 * 
 * @example
 * const rsi14 = calcRSI(candles, 14); // RSI estándar de 14 períodos
 * 
 * @note Incrementa contador rsiExecCount para debugging y registra cada ejecución en consola
 */
const calcRSI = (values, period = 14) => {
  rsiExecCount += 1;
  console.debug(`[Analytics] RSI exec #${rsiExecCount} (period=${period}, candles=${values?.length || 0})`);
  // RSI requiere al menos dos candles; si el historial es corto reducimos dinamicamente el periodo.
  if (!Array.isArray(values) || values.length < 2) return [];
  const effectivePeriod = Math.min(period, values.length - 1);
  if (effectivePeriod <= 0) return [];
  const rsi = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= effectivePeriod; i++) {
    const diff = values[i].close - values[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  gains /= effectivePeriod;
  losses /= effectivePeriod;

  const seedIndex = effectivePeriod;
  const rs = losses === 0 ? 100 : gains / (losses || 1e-9);
  rsi.push({ time: values[seedIndex].time, value: 100 - 100 / (1 + rs) });

  for (let i = seedIndex + 1; i < values.length; i++) {
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

/**
 * Calcula el indicador MACD (Moving Average Convergence Divergence).
 * 
 * El MACD es un indicador de momentum que muestra la relación entre dos medias móviles
 * exponenciales del precio. Consta de tres componentes:
 * 
 * 1. **MACD Line**: Diferencia entre EMA rápida y EMA lenta
 *    Formula: MACD = EMA(rápida) - EMA(lenta)
 * 
 * 2. **Signal Line**: EMA de la línea MACD (típicamente 9 períodos)
 *    Formula: Signal = EMA(MACD, signalPeriod)
 * 
 * 3. **Histogram**: Diferencia entre MACD Line y Signal Line
 *    Formula: Histogram = MACD - Signal
 * 
 * El cruce de MACD Line con Signal Line genera señales de compra/venta.
 * El histograma muestra la fuerza del momentum.
 * 
 * @param {Array<Object>} values - Array de velas con campos 'close' y 'time'
 * @param {number} [fastPeriod=12] - Período de la EMA rápida (estándar: 12)
 * @param {number} [slowPeriod=26] - Período de la EMA lenta (estándar: 26)
 * @param {number} [signalPeriod=9] - Período de la línea de señal (estándar: 9)
 * @returns {{macdLine: Array, signalLine: Array, histogram: Array}} Objeto con tres arrays:
 *          - macdLine: Valores de la línea MACD
 *          - signalLine: Valores de la línea de señal
 *          - histogram: Valores del histograma
 * 
 * @example
 * const { macdLine, signalLine, histogram } = calcMACD(candles, 12, 26, 9);
 * 
 * @note Usa Map para alinear eficientemente los tiempos entre diferentes series EMA
 * @note Incrementa contador macdExecCount para debugging
 */
const calcMACD = (values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
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

/**
 * Motor de generación de señales de trading basado en análisis técnico multi-indicador.
 * 
 * Analiza velas y sus indicadores para generar señales de compra (BUY) o venta (SELL)
 * cuando se cumplen condiciones técnicas específicas. Cada señal incluye:
 * - Múltiples razones que justifican la acción
 * - Nivel de confianza basado en consenso de indicadores
 * - Contexto completo de valores de indicadores en ese momento
 * 
 * **Condiciones de señal BUY:**
 * - Cruce alcista: EMA corta cruza por encima de EMA larga
 * - RSI <= umbral de sobreventa (ej: 30)
 * - MACD cruza por encima de su línea de señal
 * - Histograma MACD > umbral positivo
 * 
 * **Condiciones de señal SELL:**
 * - Cruce bajista: EMA corta cruza por debajo de EMA larga
 * - RSI >= umbral de sobrecompra (ej: 70)
 * - MACD cruza por debajo de su línea de señal
 * - Histograma MACD < umbral negativo
 * 
 * @param {Array<Object>} candles - Array de velas con campos {time, open, high, low, close}
 * @param {Object} options - Opciones de configuración:
 * @param {Array} options.emaShort - Valores de EMA corta (ej: 20 períodos)
 * @param {Array} options.emaLong - Valores de EMA larga (ej: 50 períodos)
 * @param {Array} options.rsi - Valores de RSI
 * @param {Array} options.macdLine - Valores de línea MACD
 * @param {Array} options.macdSignal - Valores de línea de señal MACD
 * @param {Array} options.macdHistogram - Valores de histograma MACD
 * @param {Object} options.signalConfig - Configuración de umbrales y filtros:
 *   @param {boolean} options.signalConfig.useEMA - Activar señales basadas en EMA
 *   @param {boolean} options.signalConfig.useRSI - Activar señales basadas en RSI
 *   @param {boolean} options.signalConfig.useMACD - Activar señales basadas en MACD
 *   @param {number} options.signalConfig.rsiOversold - Umbral RSI sobreventa (default: 30)
 *   @param {number} options.signalConfig.rsiOverbought - Umbral RSI sobrecompra (default: 70)
 *   @param {number} options.signalConfig.macdHistogramThreshold - Umbral histograma MACD
 *   @param {number} options.signalConfig.minReasons - Mínimo de razones para emitir señal
 * 
 * @returns {{markers: Array, events: Array}} Objeto con dos arrays:
 *   - **markers**: Marcadores visuales para gráficos con posición, color, forma y texto
 *   - **events**: Eventos de trading detallados con id, acción, precio, razones y confianza
 * 
 * @example
 * const { markers, events } = calcSignals(candles, {
 *   emaShort: ema20,
 *   emaLong: ema50,
 *   rsi: rsi14,
 *   macdLine, macdSignal, macdHistogram,
 *   signalConfig: { rsiOversold: 30, rsiOverbought: 70, minReasons: 2 }
 * });
 * 
 * @note La confianza se calcula como: min(1, razones_cumplidas / indicadores_activos)
 * @note Solo genera señal si razones >= minReasons y no hay empate entre BUY/SELL
 */
const calcSignals = (candles, options = {}) => {
  const {
    emaShort = [],
    emaLong = [],
    rsi = [],
    macdLine = [],
    macdSignal = [],
    macdHistogram = [],
    signalConfig = DEFAULT_SIGNAL_CONFIG,
  } = options;

  if (!Array.isArray(candles) || candles.length === 0) {
    return { markers: [], events: [] };
  }

  const {
    useEMA,
    useRSI,
    useMACD,
    rsiOversold,
    rsiOverbought,
    macdHistogramThreshold,
    minReasons,
  } = { ...DEFAULT_SIGNAL_CONFIG, ...signalConfig };

  const emaShortMap = new Map(emaShort.map((p) => [p.time, p.value]));
  const emaLongMap = new Map(emaLong.map((p) => [p.time, p.value]));
  const rsiMap = new Map(rsi.map((p) => [p.time, p.value]));
  const macdMap = new Map(macdLine.map((p) => [p.time, p.value]));
  const macdSignalMap = new Map(macdSignal.map((p) => [p.time, p.value]));
  const macdHistogramMap = new Map(macdHistogram.map((p) => [p.time, p.value]));

  const markers = [];
  const events = [];

  let prevEmaDiff;
  let prevMacdDiff;
  candles.forEach((candle) => {
    const short = emaShortMap.get(candle.time);
    const long = emaLongMap.get(candle.time);
    const rsiValue = rsiMap.get(candle.time);
    const macdValue = macdMap.get(candle.time);
    const macdSignalValue = macdSignalMap.get(candle.time);
    const histogramValue = macdHistogramMap.get(candle.time);

    const reasonsBuy = [];
    const reasonsSell = [];

    if (useEMA && Number.isFinite(short) && Number.isFinite(long)) {
      const diff = short - long;
      if (prevEmaDiff !== undefined) {
        if (prevEmaDiff < 0 && diff >= 0) reasonsBuy.push('Cruce EMA 20/50 alcista');
        if (prevEmaDiff > 0 && diff <= 0) reasonsSell.push('Cruce EMA 20/50 bajista');
      }
      prevEmaDiff = diff;
    }

    if (useRSI && Number.isFinite(rsiValue)) {
      if (rsiValue <= rsiOversold) reasonsBuy.push(`RSI <= ${rsiOversold}`);
      if (rsiValue >= rsiOverbought) reasonsSell.push(`RSI >= ${rsiOverbought}`);
    }

    if (useMACD && Number.isFinite(macdValue) && Number.isFinite(macdSignalValue)) {
      const macdDiff = macdValue - macdSignalValue;
      if (prevMacdDiff !== undefined) {
        if (prevMacdDiff < 0 && macdDiff >= 0) reasonsBuy.push('MACD cruza por encima de la senal');
        if (prevMacdDiff > 0 && macdDiff <= 0) reasonsSell.push('MACD cruza por debajo de la senal');
      }
      prevMacdDiff = macdDiff;

      if (Number.isFinite(histogramValue)) {
        if (histogramValue > macdHistogramThreshold) {
          reasonsBuy.push('Histograma MACD > umbral');
        } else if (histogramValue < -macdHistogramThreshold) {
          reasonsSell.push('Histograma MACD < -umbral');
        }
      }
    }

    const activeIndicators = [
      useEMA && Number.isFinite(short) && Number.isFinite(long),
      useRSI && Number.isFinite(rsiValue),
      useMACD && Number.isFinite(macdValue) && Number.isFinite(macdSignalValue),
    ].filter(Boolean).length;

    const reasons = reasonsBuy.length >= reasonsSell.length ? reasonsBuy : reasonsSell;
    const action = reasons.length && reasonsBuy.length !== reasonsSell.length
      ? (reasonsBuy.length > reasonsSell.length ? 'BUY' : 'SELL')
      : null;

    if (!action || reasons.length < minReasons) return;

    const confidence = activeIndicators
      ? Math.min(1, reasons.length / activeIndicators)
      : 0.25;

    const marker =
      action === 'BUY'
        ? {
            time: candle.time,
            position: 'belowBar',
            color: '#20c997',
            shape: 'arrowUp',
            text: 'Compra',
          }
        : {
            time: candle.time,
            position: 'aboveBar',
            color: '#ff6b6b',
            shape: 'arrowDown',
            text: 'Venta',
          };

    markers.push(marker);
    events.push({
      id: `${candle.time}-${action}`,
      time: candle.time,
      action,
      price: candle.close,
      reasons,
      confidence,
      context: {
        rsi: rsiValue,
        emaShort: short,
        emaLong: long,
        macd: macdValue,
        macdSignal: macdSignalValue,
        macdHistogram: histogramValue,
      },
    });
  });

  return { markers, events };
};

export const useMarketData = ({
  symbol,
  interval = '1hour',
  limit = 120,
  signalConfig = DEFAULT_SIGNAL_CONFIG,
  algoParams = DEFAULT_ALGORITHM_PARAMS,
  datasetId,
  strategyCode,
  periodStart,
  periodEnd,
}) => {
  const [state, setState] = useState({
    candles: [],
    loading: false,
    error: '',
  });
  const [remoteAnalytics, setRemoteAnalytics] = useState(null);
  const [macdBackend, setMacdBackend] = useState(null);

  /**
   * Effect 1: Obtención de velas (candles) desde el backend
   * 
   * Se ejecuta cuando cambian: symbol, interval, limit, datasetId, strategyCode, periodStart, periodEnd
   * 
   * Flujo:
   * 1. Debounce de 500ms para evitar requests en cambios rápidos
   * 2. Activa estado loading
   * 3. Llama fetchCandles con parámetros de configuración
   * 4. Si exitoso: actualiza state.candles y registra período obtenido
   * 5. Si falla: maneja rate limiting y muestra error apropiado
   * 
   * Manejo de errores:
   * - Rate limit (429): Mensaje informativo sobre uso de cache
   * - Otros errores: Mensaje genérico
   * - Sin datos: Error descriptivo sugiriendo cambiar parámetros
   */
  useEffect(() => {
    let alive = true;
    let timeoutId;
    timeoutId = setTimeout(() => {
      console.log(`📊 Solicitando ${limit} velas de ${symbol} en intervalo ${interval}`);
      setState((prev) => ({ ...prev, loading: true, error: '' }));
      fetchCandles({
        symbol,
        interval,
        limit,
        datasetId,
        strategyCode,
        from: periodStart,
        to: periodEnd,
      })
        .then(({ candles }) => {
          if (!alive) return;
          if (!candles || candles.length === 0) {
            setState({ candles: [], loading: false, error: 'No se encontraron datos para el intervalo seleccionado. Prueba con otro rango o instrumento.' });
            return;
          }
          const firstTime = new Date(candles[0].time * 1000);
          const lastTime = new Date(candles[candles.length - 1].time * 1000);
          const daysCovered = (lastTime - firstTime) / (1000 * 60 * 60 * 24);
          const formatDate = (date) => {
            return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
          };
          console.log(`✅ Recibidas ${candles.length} velas. Período: ${formatDate(firstTime)} - ${formatDate(lastTime)} (~${Math.round(daysCovered)} días)`);
          setState({ candles, loading: false, error: '' });
        })
        .catch((err) => {
          if (!alive) return;
          let errorMessage;
          if (err?.isRateLimit || err?.response?.status === 429) {
            errorMessage = 'Límite de peticiones alcanzado. Usando datos en cache...';
          } else {
            errorMessage = err?.message || 'No se pudieron obtener las velas.';
          }
          setState({
            candles: [],
            loading: false,
            error: errorMessage,
          });
        });
    }, 500);
    return () => {
      alive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [symbol, interval, limit, datasetId, strategyCode, periodStart, periodEnd]);

  /**
   * Effect 2: Obtención de analytics pre-calculados desde el backend
   * 
   * Se ejecuta cuando cambian: state.candles, signalConfig, algoParams, symbol, interval
   * 
   * Propósito:
   * Intentar obtener indicadores y señales ya calculados en el backend para:
   * - Reducir carga computacional en el cliente
   * - Garantizar consistencia en cálculos
   * - Mejorar performance en dispositivos limitados
   * 
   * Flujo:
   * 1. Verifica que existan velas cargadas
   * 2. Envía candles y configuración al backend vía fetchAnalytics
   * 3. Si exitoso: guarda resultado en remoteAnalytics
   * 4. Si falla: setea remoteAnalytics a null (activará cálculo local)
   * 
   * El resultado incluye (si disponible):
   * - Indicadores: EMA, SMA, RSI, MACD completo
   * - Señales de trading generadas
   * - Divergencias detectadas
   * - Parámetros aplicados
   */
  useEffect(() => {
    let alive = true;
    const loadAnalytics = async () => {
      if (!state.candles.length) {
        setRemoteAnalytics(null);
        return;
      }
      try {
        const result = await fetchAnalytics({
          candles: state.candles,
          params: {
            signalConfig,
            algoParams,
            symbol,
            interval,
          },
        });
        if (alive) {
          setRemoteAnalytics(result);
        }
      } catch (e) {
        console.debug('[Analytics] backend analytics failed, fallback local:', e?.message || e);
        if (alive) setRemoteAnalytics(null);
      }
    };
    loadAnalytics();
    return () => { alive = false; };
  }, [state.candles, signalConfig, algoParams, symbol, interval]);

  /**
   * Effect 3: Obtención de indicador MACD desde endpoint específico del backend
   * 
   * Se ejecuta cuando cambian: state.candles, symbol, interval, limit, signalConfig.useMACD
   * 
   * Propósito:
   * Obtener cálculo de MACD desde un endpoint dedicado del backend (posiblemente más
   * optimizado o usando fuente externa). Solo se ejecuta si:
   * - Existen velas cargadas
   * - Se especificó un símbolo
   * - La configuración indica usar MACD (signalConfig.useMACD === true)
   * 
   * Flujo:
   * 1. Valida condiciones de ejecución
   * 2. Llama fetchMacd con parámetros de símbolo/intervalo
   * 3. Si exitoso: guarda en macdBackend (será usado prioritariamente)
   * 4. Si falla: setea null y usa cálculo local como fallback
   * 
   * Ventaja:
   * Permite usar fuentes especializadas de MACD (ej: API Binance, TradingView)
   * mientras mantiene capacidad de cálculo local
   */
  useEffect(() => {
    let alive = true;
    const shouldFetchMacd = signalConfig?.useMACD;

    if (!state.candles.length || !symbol || !shouldFetchMacd) {
      setMacdBackend(null);
      return undefined;
    }

    fetchMacd({ symbol, interval, limit })
      .then((data) => {
        if (!alive) return;
        setMacdBackend(data);
      })
      .catch((err) => {
        console.warn('[MACD backend] fallback a cálculo local:', err?.message || err);
        if (alive) setMacdBackend(null);
      });

    return () => {
      alive = false;
    };
  }, [state.candles, symbol, interval, limit, signalConfig?.useMACD]);

  /**
   * Memoización de analytics: cálculo inteligente de indicadores y señales
   * 
   * **Estrategia de cálculo:**
   * 1. Si remoteAnalytics disponible → usar directamente (backend hizo el trabajo)
   * 2. Si no → calcular localmente todos los indicadores
   * 
   * **Proceso de cálculo local:**
   * 
   * A. Preparación:
   *    - Merge de parámetros de algoritmos con defaults
   *    - Validación de candles disponibles
   * 
   * B. Cálculo de indicadores:
   *    - EMA rápida/lenta: Medias móviles exponenciales configurables
   *    - SMA larga: Media móvil simple para tendencia de fondo
   *    - RSI: Índice de fuerza relativa con período configurable
   *    - MACD: Usa backend si disponible, sino calcula localmente
   * 
   * C. Detección de divergencias:
   *    - Alinea series de precio (highs/lows) con RSI por índice de vela
   *    - Busca divergencias alcistas/bajistas usando findDivergences
   *    - Configurable: ventana de picos, distancia máxima, cambios mínimos
   * 
   * D. Generación de señales:
   *    - Construye objeto de indicadores alineados por índice
   *    - Ejecuta computeSignals (motor de señales multi-indicador)
   *    - Enriquece señales con contexto (symbol, interval)
   * 
   * E. Resultado:
   *    - Arrays de indicadores listos para visualización
   *    - Señales de trading accionables
   *    - Divergencias detectadas
   *    - Parámetros efectivos aplicados
   * 
   * **Dependencias de memoización:**
   * Se recalcula solo cuando cambian:
   * - state.candles (nuevos datos)
   * - signalConfig (umbrales/filtros)
   * - symbol/interval (cambio de instrumento/timeframe)
   * - algoParams (períodos de indicadores)
   * - remoteAnalytics (llegó respuesta de backend)
   * 
   * **Optimizaciones:**
   * - Reutiliza MACD de backend si disponible (evita cálculo pesado)
   * - Deshabilita MACD completamente si signalConfig.useMACD = false
   * - Usa Maps para alineación eficiente de series temporales
   * - Prepara arrays indexados para detección rápida de divergencias
   */
const analytics = useMemo(() => {
  // Preferir analytics entregados por backend (ya calculados, optimizados)
  if (remoteAnalytics) {
    return remoteAnalytics;
  }

  const { candles } = state;
  const mergedAlgo = mergeAlgorithmParams(algoParams);
  if (!Array.isArray(candles) || candles.length === 0) {
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
  }

  const emaFastPeriod = Number(mergedAlgo.emaFast) || 20;
  const emaSlowPeriod = Number(mergedAlgo.emaSlow) || 50;
  const smaLongPeriod = Number(mergedAlgo.smaLong) || 200;
  const rsiPeriod = Number(mergedAlgo.rsiPeriod) || 14;
  const macdFastPeriod = Number(mergedAlgo.macdFast) || 12;
  const macdSlowPeriod = Number(mergedAlgo.macdSlow) || 26;
  const macdSignalPeriod = Number(mergedAlgo.macdSignal) || 9;
  const divergenceConfig = mergedAlgo.divergence || {};

  // indicadores configurables
  const ema20 = calcEMA(candles, emaFastPeriod);
  const ema50 = calcEMA(candles, emaSlowPeriod);
  const sma200 = calcSMA(candles, smaLongPeriod);
  const rsi14 = calcRSI(candles, rsiPeriod);
  const macdCalc = macdBackend && macdBackend.macdLine?.length
    ? macdBackend
    : calcMACD(candles, macdFastPeriod, macdSlowPeriod, macdSignalPeriod);

  let macdLine = macdCalc.macdLine || [];
  let macdSignal = macdCalc.signalLine || macdCalc.macdSignal || [];
  let macdHistogram = macdCalc.macdHistogram || macdCalc.histogram || [];

  if (!signalConfig.useMACD) {
    macdLine = [];
    macdSignal = [];
    macdHistogram = [];
  }

  // ============================================================================
  // SECCIÓN: DETECCIÓN DE DIVERGENCIAS
  // ============================================================================
  // Las divergencias ocurren cuando el precio y un indicador (RSI) se mueven en
  // direcciones opuestas, señalando posibles reversiones de tendencia.
  //
  // Tipos de divergencias:
  // - Divergencia alcista (bullish): Precio hace mínimos más bajos pero RSI hace
  //   mínimos más altos → posible reversión al alza
  // - Divergencia bajista (bearish): Precio hace máximos más altos pero RSI hace
  //   máximos más bajos → posible reversión a la baja
  //
  // Para detectarlas necesitamos series alineadas por índice:
  // - priceHighSeries: Precios máximos (para detectar picos en tendencia alcista)
  // - priceLowSeries: Precios mínimos (para detectar valles en tendencia bajista)
  // - rsiValuesByIndex: RSI alineado por índice con candles
  // ============================================================================
  
  // Extraer precios máximos para análisis de divergencias bajistas
  const priceHighSeries = candles.map((c) => c.high);
  const priceLowSeries = candles.map((c) => c.low);

  // Alinear RSI con el índice de candles: creamos un array donde rsiValuesByIndex[i] corresponde a candles[i]
  const rsiValuesByIndex = new Array(candles.length).fill(undefined);
  if (Array.isArray(rsi14) && rsi14.length > 0) {
    const rsiTimeMap = new Map(rsi14.map((r) => [r.time, r.value]));
    for (let i = 0; i < candles.length; i++) {
      rsiValuesByIndex[i] = rsiTimeMap.get(candles[i].time);
    }
  }

  // --- Detectar divergencias (usamos highs vs RSI por defecto) ---
  // Ajusta peakWindow / tolerancias según el activo/timeframe
  const divergenceParams = {
    peakWindow: Number(divergenceConfig.peakWindow) || 3,
    maxBarsBetweenPeaks: Number(divergenceConfig.maxBarsBetweenPeaks) || 60,
    minPriceChangePct: Number(divergenceConfig.minPriceChangePct) || 0.002,
    minIndicatorChangePct: Number(divergenceConfig.minIndicatorChangePct) || 0.01,
    maxPeakDistance: Number(divergenceConfig.maxPeakDistance) || 8,
  };
  const divergences = findDivergences(priceHighSeries, rsiValuesByIndex, divergenceParams);

  // --- Construir objeto de indicadores para el motor de señales ---
  // Nota: computeSignals espera arrays/alineados o al menos datos accesibles; aquí pasamos
  // arrays sencillos (valores por índice) para rsi y los arrays de macd por índice.
  const indicators = {
    rsi: rsiValuesByIndex, // aligned by candles index
    bb: null, // si luego calculas bandas, pon aquí { upper: [], mid: [], lower: [] }
    macd: {
      macd: (macdLine || []).map((m) => m.value),
      signal: (macdSignal || []).map((s) => s.value),
      hist: (macdHistogram || []).map((h) => h.value),
    },
    ema20: (ema20 || []).map((e) => e.value),
    ema50: (ema50 || []).map((e) => e.value),
  };

  // --- Ejecutar motor de señales ---
  // computeSignals debe devolver un array de señales (cada señal con timeIndex o time, action, reasons, confidence, price)
  const computedSignals = computeSignals(candles, indicators, divergences, {
    rsiOversold: signalConfig.rsiOversold,
    rsiOverbought: signalConfig.rsiOverbought,
    macdHistogramThreshold: signalConfig.macdHistogramThreshold,
    minReasons: signalConfig.minReasons,
  }) || [];

  // Enriquecer señales con contexto básico (symbol/interval) para consumir en la UI
  const tradeSignals = computedSignals.map((s) => ({ ...s, symbol, interval }));

  return {
    ema20,
    ema50,
    sma200,
    rsi14,
    macdLine,
    macdSignal,
    macdHistogram,
    signals: computedSignals,
    tradeSignals,
    divergences,
    appliedAlgoParams: {
      emaFastPeriod,
      emaSlowPeriod,
      smaLongPeriod,
      rsiPeriod,
      macdFastPeriod,
      macdSlowPeriod,
      macdSignalPeriod,
      divergence: divergenceParams,
    },
  };
}, [state.candles, signalConfig, symbol, interval, algoParams, remoteAnalytics]);

  /**
   * Retorna objeto combinado con:
   * - Estado de carga (candles, loading, error)
   * - Analytics calculados (indicadores, señales, divergencias)
   * 
   * Este objeto es consumido por componentes para:
   * - Renderizar gráficos (useMarketCharts)
   * - Mostrar notificaciones de señales
   * - Persistir señales en base de datos
   * - Análisis y backtesting
   */
  return {
    ...state,
    ...analytics,
  };
};

/**
 * Utilidades de análisis técnico exportadas como funciones puras.
 * 
 * **Propósito:**
 * Permite usar las funciones de cálculo fuera del contexto React:
 * - Testing unitario sin montar componentes
 * - Scripts de backtesting
 * - Pipelines de procesamiento batch
 * - Cálculos en Web Workers
 * - Futuros modelos de Machine Learning
 * 
 * **Funciones incluidas:**
 * - calcEMA: Cálculo de Media Móvil Exponencial
 * - calcSMA: Cálculo de Media Móvil Simple
 * - calcRSI: Cálculo de Índice de Fuerza Relativa (Wilder)
 * - calcMACD: Cálculo de MACD completo (línea, señal, histograma)
 * - calcSignals: Motor de generación de señales multi-indicador
 * 
 * @example
 * // Uso en tests
 * import { marketAnalyticsUtils } from './useMarketData';
 * const ema = marketAnalyticsUtils.calcEMA(mockCandles, 20);
 * expect(ema.length).toBeGreaterThan(0);
 * 
 * @example
 * // Uso en backtesting script
 * import { marketAnalyticsUtils } from './hooks/useMarketData';
 * const rsi = marketAnalyticsUtils.calcRSI(historicalData, 14);
 * const signals = marketAnalyticsUtils.calcSignals(historicalData, { rsi, ... });
 */
export const marketAnalyticsUtils = {
  calcEMA,
  calcSMA,
  calcRSI,
  calcMACD,
  calcSignals,
};











