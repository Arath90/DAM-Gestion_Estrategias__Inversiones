import { DEFAULT_SIGNAL_CONFIG } from '../../constants/strategyProfiles';
const DEFAULT_BB_CONFIG = {
  useBB: true,
  bbTouchSensitivity: 0.0, // margen para considerar "toque"
  bbSqueezeThreshold: 0.015, // % entre bandas para considerar squeeze
};

/**
 * Generates buy/sell signals combining EMA crossovers, RSI thresholds and MACD context.
 *
 * @param {Array<Object>} candles - Candle array with { time, close }.
 * @param {Object} options - Indicator series plus signalConfig.
 * @returns {{markers: Array, events: Array}} Signal markers and structured events.
 */
export const calcSignals = (candles, options = {}) => {
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

  const mergedConfig = {
    ...DEFAULT_SIGNAL_CONFIG,
    ...DEFAULT_BB_CONFIG,
    ...signalConfig,
  };

  const {
    useEMA,
    useRSI,
    useMACD,
    rsiOversold,
    rsiOverbought,
    macdHistogramThreshold,
    bbTouchSensitivity,
    bbSqueezeThreshold,
    minReasons,
  } = { ...DEFAULT_SIGNAL_CONFIG, ...signalConfig };

  const emaShortMap = new Map(emaShort.map((p) => [p.time, p.value]));
  const emaLongMap = new Map(emaLong.map((p) => [p.time, p.value]));
  const rsiMap = new Map(rsi.map((p) => [p.time, p.value]));
  const macdMap = new Map(macdLine.map((p) => [p.time, p.value]));
  const macdSignalMap = new Map(macdSignal.map((p) => [p.time, p.value]));
  const macdHistogramMap = new Map(macdHistogram.map((p) => [p.time, p.value]));
  const bbMiddleMap = new Map(bbMiddle.map((p) => [p.time, p.value]));
  const bbUpperMap = new Map(bbUpper.map((p) => [p.time, p.value]));
  const bbLowerMap = new Map(bbLower.map((p) => [p.time, p.value]));

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
    const bbMid = bbMiddleMap.get(time);
    const bbUp = bbUpperMap.get(time);
    const bbLow = bbLowerMap.get(time);

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

      if (
      useBB &&
      Number.isFinite(bbMid) &&
      Number.isFinite(bbUp) &&
      Number.isFinite(bbLow)
    ) {
      // toque banda inferior
      if (close <= bbLow * (1 + bbTouchSensitivity)) {
        reasonsBuy.push('Precio tocó banda inferior');
      }

      // toque banda superior
      if (close >= bbUp * (1 - bbTouchSensitivity)) {
        reasonsSell.push('Precio tocó banda superior');
      }

      // breakout alcista
      if (close > bbUp) {
        reasonsBuy.push('Breakout alcista sobre banda superior');
      }

      // breakout bajista
      if (close < bbLow) {
        reasonsSell.push('Breakout bajista bajo banda inferior');
      }

      // squeeze detection
      const bandRange = (bbUp - bbLow) / bbMid;
      if (bandRange < bbSqueezeThreshold) {
        reasonsBuy.push('Squeeze detectado (volatilidad baja)');
      }
    }

    const activeIndicators = [
      useEMA && Number.isFinite(short) && Number.isFinite(long),
      useRSI && Number.isFinite(rsiValue),
      useMACD && Number.isFinite(macdValue) && Number.isFinite(macdSignalValue),
      useBB && Number.isFinite(bbMid) && Number.isFinite(bbUp),
    ].filter(Boolean).length;

    const reasons = reasonsBuy.length >= reasonsSell.length ? reasonsBuy : reasonsSell;
    const action =
      reasons.length && reasonsBuy.length !== reasonsSell.length
        ? reasonsBuy.length > reasonsSell.length
          ? 'BUY'
          : 'SELL'
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
        bbUp,
        bbMid,
        bbLow,
      },
    });
  });

  return { markers, events };
};
