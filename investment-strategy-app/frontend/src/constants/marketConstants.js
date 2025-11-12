/**
 * Constantes para el componente Market
 */

export const INTERVALS = [
  { label: '1D', fullLabel: '1 Día', value: '1day', group: 'largo' },
  { label: '12H', fullLabel: '12 Horas', value: '12hour', group: 'largo' },
  { label: '8H', fullLabel: '8 Horas', value: '8hour', group: 'medio' },
  { label: '6H', fullLabel: '6 Horas', value: '6hour', group: 'medio' },
  { label: '4H', fullLabel: '4 Horas', value: '4hour', group: 'medio' },
  { label: '2H', fullLabel: '2 Horas', value: '2hour', group: 'corto' },
  { label: '1H', fullLabel: '1 Hora', value: '1hour', group: 'corto' },
];

export const TRADE_MODES = {
  notify: 'notify',
  auto: 'auto',
};

export const INTERVAL_GROUPS = {
  largo: { label: 'Largo Plazo', color: '#10b981' },
  medio: { label: 'Medio Plazo', color: '#f59e0b' },
  corto: { label: 'Corto Plazo', color: '#ef4444' },
};

// Formatters reutilizables
export const priceFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const percentageFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Parámetros base para consultas de estrategias
export const STRATEGY_BASE_PARAMS = { 
  dbServer: 'MongoDB', 
  ProcessType: 'READ', 
  $top: 50 
};

// Configuraciones por defecto
export const DEFAULT_MARKET_STATE = {
  symbol: 'I:NDX',
  interval: '1day',
  tradeMode: TRADE_MODES.notify,
  settings: {
    ema20: true,
    ema50: true,
    sma200: true,
    rsi: true,
    macd: true,
    volume: true,
    supportResistance: true,
  },
};