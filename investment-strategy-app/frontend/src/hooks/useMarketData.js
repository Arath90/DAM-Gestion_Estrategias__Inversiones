import { useEffect, useMemo, useState } from 'react';
import { fetchCandles } from '../services/marketData';

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
 * TODO: integrar controles para parametrizar periodos desde la UI (actualmente fijos
 *  en EMA20/EMA50/SMA200/RSI14/MACD 12-26-9) y persistir las preferencias por usuario.
 */



// Reglas por defecto para decidir cuando disparar una senal. Mercado.jsx permite sobreescribir algunas.
const DEFAULT_SIGNAL_CONFIG = {
  useEMA: true,
  useRSI: true,
  useMACD: true,
  rsiOversold: 30,
  rsiOverbought: 70,
  macdHistogramThreshold: 0.15,
  minReasons: 1,
};

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

const calcRSI = (values, period = 14) => {
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

const calcMACD = (values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
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
  interval,
  limit,
  signalConfig = DEFAULT_SIGNAL_CONFIG,
}) => {
  const [state, setState] = useState({
    candles: [],
    loading: false,
    error: '',
  });

  useEffect(() => {
    let alive = true;
    let timeoutId;
    
    // Debounce de 500ms para evitar múltiples requests (aumentado por rate limiting)
    timeoutId = setTimeout(() => {
      console.log(`📊 Solicitando ${limit} velas de ${symbol} en intervalo ${interval}`);
      setState((prev) => ({ ...prev, loading: true, error: '' }));
      fetchCandles({ symbol, interval, limit })
        .then(({ candles }) => {
          if (!alive) return;
          
          // Calcular período cubierto
          if (candles && candles.length > 0) {
            const firstTime = new Date(candles[0].time * 1000);
            const lastTime = new Date(candles[candles.length - 1].time * 1000);
            const daysCovered = (lastTime - firstTime) / (1000 * 60 * 60 * 24);
            const formatDate = (date) => {
              return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
            };
            console.log(`✅ Recibidas ${candles.length} velas. Período: ${formatDate(firstTime)} - ${formatDate(lastTime)} (~${Math.round(daysCovered)} días)`);
          }
          
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
  }, [symbol, interval, limit]);

  const analytics = useMemo(() => {
    const { candles } = state;
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
      };
    }

    const ema20 = calcEMA(candles, 20);
    const ema50 = calcEMA(candles, 50);
    const sma200 = calcSMA(candles, 200);
    const rsi14 = calcRSI(candles, 14);
  const { macdLine, signalLine: macdSignal, histogram: macdHistogram } = calcMACD(candles);
  const { markers: signals, events: tradeSignals } = calcSignals(candles, {
    emaShort: ema20,
    emaLong: ema50,
    rsi: rsi14,
      macdLine,
      macdSignal,
    macdHistogram,
    signalConfig,
  });

  // TODO: exponer tambien estadisticas agregadas (ej. volatilidad, ATR) para enriquecer la bandeja y el backend.
  const enrichedSignals = tradeSignals.map((signal) => ({
    ...signal,
    symbol,
    interval,
  }));

    return {
      ema20,
      ema50,
      sma200,
      rsi14,
      macdLine,
      macdSignal,
      macdHistogram,
      signals,
      tradeSignals: enrichedSignals,
    };
  }, [state.candles, signalConfig, symbol, interval]);

  return {
    ...state,
    ...analytics,
  };
};

export const marketAnalyticsUtils = {
  calcEMA,
  calcSMA,
  calcRSI,
  calcMACD,
  calcSignals,
};

