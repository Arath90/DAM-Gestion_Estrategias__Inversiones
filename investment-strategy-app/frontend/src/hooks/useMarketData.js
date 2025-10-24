import { useEffect, useMemo, useState } from 'react';
import { fetchCandles } from '../services/marketData';

const calcEMA = (values, period) => {
  if (!Array.isArray(values) || values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = [];
  let prev;
  values.forEach((v, idx) => {
    if (!Number.isFinite(v.close)) return;
    if (idx === 0) {
      prev = v.close;
    } else {
      prev = v.close * k + prev * (1 - k);
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
  if (!Array.isArray(values) || values.length <= period) return [];
  const rsi = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = values[i].close - values[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  gains /= period;
  losses /= period;

  const rs = losses === 0 ? 100 : gains / losses;
  rsi.push({ time: values[period].time, value: 100 - 100 / (1 + rs) });

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i].close - values[i - 1].close;
    let gain = 0;
    let loss = 0;
    if (diff >= 0) gain = diff;
    else loss = -diff;

    gains = (gains * (period - 1) + gain) / period;
    losses = (losses * (period - 1) + loss) / period;

    const rsStep = losses === 0 ? 100 : gains / (losses || 1e-9);
    rsi.push({ time: values[i].time, value: 100 - 100 / (1 + rsStep) });
  }

  return rsi;
};

const calcSignals = (candles, options = {}) => {
  const { emaShort = [], emaLong = [], rsi = [] } = options;
  const signals = [];
  if (!Array.isArray(candles) || candles.length === 0) return signals;

  const emaShortMap = new Map(emaShort.map((p) => [p.time, p.value]));
  const emaLongMap = new Map(emaLong.map((p) => [p.time, p.value]));
  const rsiMap = new Map(rsi.map((p) => [p.time, p.value]));

  let prevDiff;
  candles.forEach((candle) => {
    const short = emaShortMap.get(candle.time);
    const long = emaLongMap.get(candle.time);
    const rsiValue = rsiMap.get(candle.time);
    if (!Number.isFinite(short) || !Number.isFinite(long)) return;

    const diff = short - long;
    if (prevDiff !== undefined) {
      const crossedUp = prevDiff < 0 && diff >= 0;
      const crossedDown = prevDiff > 0 && diff <= 0;
      const rsiBuy = Number.isFinite(rsiValue) && rsiValue < 30;
      const rsiSell = Number.isFinite(rsiValue) && rsiValue > 70;

      if (crossedUp || rsiBuy) {
        signals.push({
          time: candle.time,
          position: 'belowBar',
          color: '#20c997',
          shape: 'arrowUp',
          text: 'Compra',
        });
      } else if (crossedDown || rsiSell) {
        signals.push({
          time: candle.time,
          position: 'aboveBar',
          color: '#ff6b6b',
          shape: 'arrowDown',
          text: 'Venta',
        });
      }
    }
    prevDiff = diff;
  });
  return signals;
};

export const useMarketData = ({ symbol, interval, limit }) => {
  const [state, setState] = useState({
    candles: [],
    loading: false,
    error: '',
  });

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    fetchCandles({ symbol, interval, limit })
      .then(({ candles }) => {
        if (!alive) return;
        setState({ candles, loading: false, error: '' });
      })
      .catch((err) => {
        if (!alive) return;
        setState({
          candles: [],
          loading: false,
          error: err?.message || 'No se pudieron obtener las velas.',
        });
      });
    return () => {
      alive = false;
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
        signals: [],
      };
    }

    const ema20 = calcEMA(candles, 20);
    const ema50 = calcEMA(candles, 50);
    const sma200 = calcSMA(candles, 200);
    const rsi14 = calcRSI(candles, 14);
    const signals = calcSignals(candles, { emaShort: ema20, emaLong: ema50, rsi: rsi14 });

    return { ema20, ema50, sma200, rsi14, signals };
  }, [state.candles]);

  return {
    ...state,
    ...analytics,
  };
};

