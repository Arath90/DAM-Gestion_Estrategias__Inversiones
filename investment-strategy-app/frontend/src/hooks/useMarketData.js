import { useEffect, useMemo, useState } from 'react';
import { fetchCandles, fetchMacd, fetchAnalytics } from '../services/marketData';
import { DEFAULT_SIGNAL_CONFIG } from '../constants/strategyProfiles';
import { DEFAULT_ALGORITHM_PARAMS, mergeAlgorithmParams } from '../constants/algorithmDefaults';

import { findDivergences } from '../utils/divergences';
import { computeSignals } from '../utils/signals';




/**
 * Hook centralizado para analytics de mercado.
 *
 * Objetivo pedagogico:
 *  - Enseñar el flujo completo desde la obtencion de datos crudos (velas) hasta la
 *    generacion de señales de trading listas para consumir por la UI o persistir.
 *
 * Relacion entre modulos:
 *  - consume fetchCandles (services/marketData) para hablar con la API CAP.
 *  - produce arreglos normalizados de indicadores (EMA, SMA, RSI, MACD) que
 *    useMarketCharts convierte en renderizaciones Lightweight Charts.
 *  - entrega un arreglo tradeSignals con metadata enriquecida que Mercado.jsx usa
 *    tanto para notificaciones como para persistir en Signal.js a traves de tradingSignals.js.
 *
 * Consideraciones:
 *  - Cada indicador se calcula en memoria para evitar depender de servicios externos
 *    en tiempo real; esto facilita pruebas unitarias y la lectura del algoritmo.
 *  - El hook exporta marketAnalyticsUtils para que otros modulos (tests, futuros
 *    pipelines ML) puedan reutilizar las formulas sin requerir React.
 *
 * 
 */



// EMA: suaviza la serie usando factor k; accessor permite reutilizarla sobre cualquier campo numérico.
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

// Contadores de ejecuciones para depuración
let rsiExecCount = 0;
let macdExecCount = 0;

// SMA: media móvil simple de `period` barras para tener una referencia lenta de tendencia.
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

// RSI de Wilder con semilla dinámica: se acorta el periodo si hay pocas velas para no devolver vacío.
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

// MACD clásico: EMA rápida - EMA lenta + señal/histograma; separa cálculo para poder reutilizar map de tiempos.
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

// Motor simple de señales: cruces EMA, umbrales RSI y cruces/umbral de MACD generan markers/events.
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

  // Solicitar analytics completos al backend (RSI/MACD/EMA/SMA/divergencias/señales)
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

const analytics = useMemo(() => {
  // Preferir analytics entregados por backend
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

  // --- Preparar series alineadas para detección de divergencias ---
  // price series: preferimos usar highs para detectar bearish peaks y lows para bullish
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

  return {
    ...state,
    ...analytics,
  };
};

// Utils exportados para tests o consumidores no React.
export const marketAnalyticsUtils = {
  calcEMA,
  calcSMA,
  calcRSI,
  calcMACD,
  calcSignals,
};











