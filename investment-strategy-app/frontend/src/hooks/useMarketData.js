import { useEffect, useMemo, useState } from 'react';
import { fetchCandles, fetchMacd, fetchAnalytics } from '../services/marketData';
import { DEFAULT_SIGNAL_CONFIG } from '../constants/strategyProfiles';
import { DEFAULT_ALGORITHM_PARAMS, mergeAlgorithmParams } from '../constants/algorithmDefaults';
import { findDivergences } from '../utils/divergences';
import { computeSignals } from '../utils/signals';
import {
  calcEMA,
  calcSMA,
  calcRSI,
  calcMACD,
  calcSignals,
} from '../utils/marketAlgorithms';
import {
  alignRSIWithCandles,
  extractPriceSeries,
  buildIndicatorsObject,
  enrichSignalsWithContext,
  parseAlgorithmParams,
  parseDivergenceConfig,
  formatDateForLog,
  calculatePeriodStats,
  createEmptyAnalytics,
} from '../utils/marketAnalytics';




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
    const timeoutId = setTimeout(async () => {
      console.log(`📊 Solicitando ${limit} velas de ${symbol} en intervalo ${interval}`);
      setState((prev) => ({ ...prev, loading: true, error: '' }));
      
      try {
        const { candles } = await fetchCandles({
          symbol,
          interval,
          limit,
          datasetId,
          strategyCode,
          from: periodStart,
          to: periodEnd,
        });
        
        if (!alive) return;
        
        if (!candles || candles.length === 0) {
          setState({
            candles: [],
            loading: false,
            error: 'No se encontraron datos para el intervalo seleccionado. Prueba con otro rango o instrumento.',
          });
          return;
        }
        
        const stats = calculatePeriodStats(candles);
        if (stats) {
          console.log(
            `✅ Recibidas ${stats.count} velas. Período: ${formatDateForLog(stats.firstTime)} - ${formatDateForLog(stats.lastTime)} (~${stats.daysCovered} días)`
          );
        }
        
        setState({ candles, loading: false, error: '' });
      } catch (err) {
        if (!alive) return;
        
        const errorMessage =
          err?.isRateLimit || err?.response?.status === 429
            ? 'Límite de peticiones alcanzado. Usando datos en cache...'
            : err?.message || 'No se pudieron obtener las velas.';
        
        setState({ candles: [], loading: false, error: errorMessage });
      }
    }, 500);
    
    return () => {
      alive = false;
      clearTimeout(timeoutId);
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
  if (remoteAnalytics) {
    return remoteAnalytics;
  }

  const { candles } = state;
  const mergedAlgo = mergeAlgorithmParams(algoParams);
  
  if (!Array.isArray(candles) || candles.length === 0) {
    return createEmptyAnalytics(mergedAlgo);
  }

  // Parsear parámetros de algoritmos
  const {
    emaFastPeriod,
    emaSlowPeriod,
    smaLongPeriod,
    rsiPeriod,
    macdFastPeriod,
    macdSlowPeriod,
    macdSignalPeriod,
  } = parseAlgorithmParams(mergedAlgo);

  // Calcular indicadores técnicos
  const ema20 = calcEMA(candles, emaFastPeriod);
  const ema50 = calcEMA(candles, emaSlowPeriod);
  const sma200 = calcSMA(candles, smaLongPeriod);
  const rsi14 = calcRSI(candles, rsiPeriod);
  
  // MACD: usar backend si disponible, sino calcular localmente
  const macdCalc =
    macdBackend && macdBackend.macdLine?.length
      ? macdBackend
      : calcMACD(candles, macdFastPeriod, macdSlowPeriod, macdSignalPeriod);

  let macdLine = macdCalc.macdLine || [];
  let macdSignal = macdCalc.signalLine || macdCalc.macdSignal || [];
  let macdHistogram = macdCalc.macdHistogram || macdCalc.histogram || [];

  // Deshabilitar MACD si no está configurado
  if (!signalConfig.useMACD) {
    macdLine = [];
    macdSignal = [];
    macdHistogram = [];
  }

  // Extraer series de precios y alinear RSI
  const { priceHighSeries, priceLowSeries } = extractPriceSeries(candles);
  const rsiValuesByIndex = alignRSIWithCandles(candles, rsi14);

  // Detectar divergencias
  const divergenceParams = parseDivergenceConfig(mergedAlgo.divergence);
  const divergences = findDivergences(priceHighSeries, rsiValuesByIndex, divergenceParams);

  // Construir objeto de indicadores para motor de señales
  const indicators = buildIndicatorsObject({
    rsiValuesByIndex,
    macdLine,
    macdSignal,
    macdHistogram,
    ema20,
    ema50,
  });

  // Generar señales de trading
  const computedSignals =
    computeSignals(candles, indicators, divergences, {
      rsiOversold: signalConfig.rsiOversold,
      rsiOverbought: signalConfig.rsiOverbought,
      macdHistogramThreshold: signalConfig.macdHistogramThreshold,
      minReasons: signalConfig.minReasons,
    }) || [];

  // Enriquecer señales con contexto
  const tradeSignals = enrichSignalsWithContext(computedSignals, symbol, interval);

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
}, [state.candles, signalConfig, symbol, interval, algoParams, remoteAnalytics, macdBackend]);

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