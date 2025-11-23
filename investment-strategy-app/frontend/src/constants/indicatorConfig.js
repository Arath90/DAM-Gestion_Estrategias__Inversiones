export const INDICATOR_CONFIG = {
    "RSI": {
      "name": "Índice de Fuerza Relativa (RSI)",
      "properties": [
        { "id": "RSI_period", "label": "Período (N)", "type": "number", "default": 14, "min": 1, "required": true, "placeholder": 14 },
        { "id": "RSI_overbought", "label": "Nivel de Sobrecompra", "type": "number", "default": 70, "min": 50, "placeholder": 70 },
        { "id": "RSI_oversold", "label": "Nivel de Sobrevanta", "type": "number", "default": 30, "max": 50, "placeholder": 30 }
      ]
    },
    "MACD": {
      "name": "Divergencia/Convergencia (MACD)",
      "properties": [
        { "id": "MACD_fast_period", "label": "EMA Rápida", "type": "number", "default": 12, "min": 1, "required": true, "placeholder": 12 },
        { "id": "MACD_slow_period", "label": "EMA Lenta", "type": "number", "default": 26, "min": 1, "required": true, "placeholder": 26 },
        { "id": "MACD_signal_period", "label": "Período Señal", "type": "number", "default": 9, "min": 1, "required": true, "placeholder": 9 }
      ]
    },
    "BOLLINGER": {
      "name": "Bandas de Bollinger",
      "properties": [
        { "id": "BB_period", "label": "Período", "type": "number", "default": 20, "min": 1, "required": true },
        { "id": "BB_stddev", "label": "Desviación estándar", "type": "number", "default": 2, "min": 1, "required": true }
      ]
    },
    "EMA": {
      "name": "Media Móvil Exponencial (EMA)",
      "properties": [
        { "id": "EMA_period", "label": "Período", "type": "number", "default": 20, "min": 1, "required": true, "placeholder": 20 }
      ]
    },
    "SMA": {
      "name": "Media Móvil Simple (SMA)",
      "properties": [
        { "id": "SMA_period", "label": "Período", "type": "number", "default": 20, "min": 1, "required": true, "placeholder": 20 }
      ]
    }
};

export const INDICATOR_TOGGLE_TO_CONFIG = {
  rsi: 'RSI',
  macd: 'MACD',
  bollinger: 'BOLLINGER',
  ema20: 'EMA',
  ema50: 'EMA',
  sma200: 'SMA',
  volume: null,
  signals: null,
};

const INDICATOR_DEFAULT_PARAMS_MAP = Object.values(INDICATOR_CONFIG).reduce(
  (acc, config) => {
    (config.properties || []).forEach((prop) => {
      acc[prop.id] =
        prop.default !== undefined && prop.default !== null
          ? String(prop.default)
          : '';
    });
    return acc;
  },
  {},
);

export const buildIndicatorDefaultParams = () => ({
  ...INDICATOR_DEFAULT_PARAMS_MAP,
});
