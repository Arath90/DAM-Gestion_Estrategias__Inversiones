/**
 * Pruebas unitarias para las utilidades de analytics (marketAnalyticsUtils).
 * Aclara a nuevos contribuidores como validar los cruces EMA/MACD y el fallback de RSI.
 *
 * TODO: extender cobertura con escenarios de short/long signals combinados y casos edge (datos vacios).
 */
import { marketAnalyticsUtils } from '../useMarketData';

const { calcSignals, calcRSI } = marketAnalyticsUtils;

const buildCandles = (closes) =>
  closes.map((close, idx) => ({
    time: idx + 1,
    open: close,
    close,
    high: close + 1,
    low: close - 1,
    volume: 1000 + idx,
  }));

describe('marketAnalyticsUtils.calcSignals', () => {
  it('genera una senal BUY cuando la EMA corta cruza al alza la EMA larga', () => {
    const candles = buildCandles([100, 101, 102]);
    const emaShort = [
      { time: 1, value: 99.5 },
      { time: 2, value: 100.2 },
      { time: 3, value: 102.1 },
    ];
    const emaLong = [
      { time: 1, value: 100.5 },
      { time: 2, value: 100.4 },
      { time: 3, value: 100.3 },
    ];

    const { events } = calcSignals(candles, {
      emaShort,
      emaLong,
      signalConfig: { useEMA: true, useRSI: false, useMACD: false, minReasons: 1 },
    });

    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('BUY');
    expect(events[0].reasons.join(' ')).toContain('EMA');
  });

  it('genera una senal SELL cuando el MACD cruza por debajo de la linea de senal', () => {
    const candles = buildCandles([100, 99, 98, 97]);
    const macdLine = [
      { time: 1, value: 0.6 },
      { time: 2, value: 0.4 },
      { time: 3, value: 0.2 },
      { time: 4, value: -0.1 },
    ];
    const macdSignal = [
      { time: 1, value: 0.3 },
      { time: 2, value: 0.35 },
      { time: 3, value: 0.32 },
      { time: 4, value: 0.1 },
    ];
    const macdHistogram = macdLine.map((point, idx) => ({
      time: point.time,
      value: point.value - macdSignal[idx].value,
    }));

    const { events } = calcSignals(candles, {
      macdLine,
      macdSignal,
      macdHistogram,
      signalConfig: {
        useEMA: false,
        useRSI: false,
        useMACD: true,
        macdHistogramThreshold: 0,
        minReasons: 1,
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('SELL');
    expect(events[0].reasons.join(' ')).toContain('MACD');
  });
});

describe('marketAnalyticsUtils.calcRSI', () => {
  it('calcula RSI aun con menos velas que el periodo por defecto', () => {
    const candles = buildCandles([10, 11, 10.5, 11.2, 10.9]);
    const rsi = calcRSI(candles, 14);
    expect(rsi.length).toBeGreaterThan(0);
    expect(rsi[0].value).toBeGreaterThan(0);
    expect(rsi[0].value).toBeLessThanOrEqual(100);
  });
});

