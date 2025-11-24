export const INDICATOR_TOGGLES = [
  { key: 'ema20', label: 'EMA 20', icon: '📈', defaultValue: true },
  { key: 'ema50', label: 'EMA 50', icon: '📈', defaultValue: true },
  { key: 'sma200', label: 'SMA 200', icon: '📉', defaultValue: false },
  { key: 'volume', label: 'Volumen', icon: '📊', defaultValue: true },
  { key: 'rsi', label: 'RSI', icon: '⚡', defaultValue: true },
  { key: 'macd', label: 'MACD', icon: '〰️', defaultValue: true },
  { key: 'signals', label: 'Señales', icon: '🎯', defaultValue: true },
  { key: 'bb', label: 'Bandas de Bollinger', icon: '⭕', defaultValue: true },
];

export const DEFAULT_INDICATOR_SETTINGS = INDICATOR_TOGGLES.reduce((acc, item) => {
  acc[item.key] = item.defaultValue !== undefined ? item.defaultValue : true;
  return acc;
}, {});

export const DEFAULT_SIGNAL_CONFIG = {
  useEMA: true,
  useRSI: true,
  useMACD: true,
  bb: true,
  rsiOversold: 30,
  rsiOverbought: 70,
  macdHistogramThreshold: 0.15,
  minReasons: 1,
};

export const STRATEGY_SIGNAL_FIELDS = [
  { key: 'macdHistogramThreshold', label: 'Umbral histograma MACD', step: 0.01 },
  { key: 'rsiOversold', label: 'RSI sobreventa' },
  { key: 'rsiOverbought', label: 'RSI sobrecompra' },
  { key: 'minReasons', label: 'Mínimo de razones', step: 1, min: 1 },
];

export const INDICATOR_LABEL_MAP = INDICATOR_TOGGLES.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

const toObject = (source) => {
  if (!source) return {};
  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof source === 'object') return { ...source };
  return {};
};

export const hydrateStrategyProfile = (strategy = null) => {
  const paramsBag = toObject(
    strategy?.params_bag || strategy?.paramsBag || strategy?.params || strategy?.params_json,
  );

  const indicatorsFromField = toObject(strategy?.indicators);
  // Si no hay indicadores persistidos, no activamos ninguno por defecto para evitar mostrar/usar indicadores no seleccionados.
  const baseIndicatorDefaults = {};

  const indicatorSettings = {
    ...baseIndicatorDefaults,
    ...indicatorsFromField,
    ...(paramsBag.indicator_settings ||
      strategy?.indicator_settings ||
      strategy?.indicatorSettings ||
      {}),
  };

  const signalConfigRaw = {
    ...DEFAULT_SIGNAL_CONFIG,
    ...(paramsBag.signal_config || strategy?.signal_config || strategy?.signalConfig || {}),
  };

  const signalConfig = {
    ...signalConfigRaw,
    useEMA:
      !!indicatorSettings.ema20 && !!indicatorSettings.ema50 && (signalConfigRaw.useEMA !== false),
    useRSI: !!indicatorSettings.rsi && (signalConfigRaw.useRSI !== false),
    useMACD: !!indicatorSettings.macd && (signalConfigRaw.useMACD !== false),
  };

  return { indicatorSettings, signalConfig, paramsBag };
};

export const describeIndicators = (settings = {}) =>
  INDICATOR_TOGGLES.filter(({ key }) => settings[key])
    .map(({ label }) => label)
    .join(', ');
