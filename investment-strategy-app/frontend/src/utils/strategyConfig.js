// src/utils/strategyConfig.js
// ---------------------------------------------------------
// Utilidades para gestionar la configuración de estrategias
// ---------------------------------------------------------

import { 
  DEFAULT_INDICATOR_SETTINGS,
  DEFAULT_SIGNAL_CONFIG,
  hydrateStrategyProfile,
} from '../constants/strategyProfiles';

/**
 * Obtiene la configuración hidratada de una estrategia
 * @param {Object} strategy - Estrategia seleccionada
 * @returns {Object} - { indicatorSettings, signalConfig }
 */
export const getStrategyConfig = (strategy) => {
  return hydrateStrategyProfile(strategy);
};

/**
 * Combina configuración por defecto con configuración de estrategia y settings.
 * @param {Object} strategySignalConfig - Config de señales de la estrategia
 * @param {Object} settings - Configuración de indicadores activos
 * @returns {Object} - Configuración de señales combinada
 */
export const mergeSignalConfig = (strategySignalConfig = {}, settings = {}) => {
  const merged = { ...DEFAULT_SIGNAL_CONFIG, ...strategySignalConfig };

  return {
    ...merged,
    useEMA: settings.ema20 && settings.ema50 && merged.useEMA !== false,
    useRSI: settings.rsi && merged.useRSI !== false,
    useMACD: settings.macd && merged.useMACD !== false,
    // 🔹 AHORA acepta tanto settings.bollinger como settings.bb
    useBB: (settings.bollinger ?? settings.bb) && merged.useBB !== false,
  };
};

/**
 * Prepara indicadores en formato simplificado para eventos
 * @param {Object} indicators - Objeto con arrays de indicadores
 * @returns {Object} - Indicadores en formato simplificado
 */
export const prepareIndicatorsForEvents = (indicators) => {
  const { ema20, ema50, rsi14, macdLine, macdSignal, macdHistogram } = indicators;
  
  return {
    ema20: (ema20 || []).map(e => e?.value ?? null),
    ema50: (ema50 || []).map(e => e?.value ?? null),
    rsi: (rsi14 || []).map(r => r?.value ?? null),
    macd: {
      macd: (macdLine || []).map(m => m?.value ?? null),
      signal: (macdSignal || []).map(s => s?.value ?? null),
      hist: (macdHistogram || []).map(h => h?.value ?? null),
    },
  };
};
