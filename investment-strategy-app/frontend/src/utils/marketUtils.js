/**
 * Utilidades para el componente Market
 */
import { priceFormatter, INTERVALS, TRADE_MODES } from '../constants/marketConstants';

/**
 * Construye el mensaje del toast para notificaciones de señales
 */
export const buildToastMessage = (signal, mode) => {
  const actionLabel = signal.action === 'BUY' ? 'Compra' : 'Venta';
  const priceLabel = priceFormatter.format(signal.price ?? 0);
  const prefix = mode === TRADE_MODES.auto ? 'Auto' : 'Aviso';
  const reasons = signal.reasons?.join(' | ') || 'Sin razones';
  return `${prefix}: ${actionLabel} ${signal.symbol} @ ${priceLabel} (${reasons})`;
};

/**
 * Calcula el límite de velas necesario para cubrir 1 año según el intervalo
 */
export const getLimitForInterval = (interval) => {
  // Si el intervalo es personalizado (ej: '15min', '2hour', '4week', etc.)
  const match = interval.match(/^(\d+)(min|hour|day|week)$/);
  if (match) {
    const value = parseInt(match[1], 10);
    const type = match[2];
    
    // Calcular cuántas velas necesitamos para 1 año
    let velasPorAno;
    switch (type) {
      case 'min':
        // 525600 minutos en un año / valor minutos por vela
        velasPorAno = Math.floor(525600 / value);
        break;
      case 'hour':
        // 8760 horas en un año / valor horas por vela
        velasPorAno = Math.floor(8760 / value);
        break;
      case 'day':
        // 365 días en un año / valor días por vela
        velasPorAno = Math.floor(365 / value);
        break;
      case 'week':
        // 52 semanas en un año / valor semanas por vela
        velasPorAno = Math.floor(52 / value);
        break;
      default:
        velasPorAno = 365;
    }
    
    // Limitar a máximo 10000 velas para evitar rate limiting
    return Math.min(velasPorAno, 10000);
  }
  
  // Intervalos predefinidos
  switch (interval) {
    case '1day': return 365; // 365 días = 1 año
    case '12hour': return 730; // 730 períodos de 12h = 1 año
    case '8hour': return 1095; // 1095 períodos de 8h = 1 año
    case '6hour': return 1460; // 1460 períodos de 6h = 1 año
    case '4hour': return 2190; // 2190 períodos de 4h = 1 año
    case '2hour': return 2000; // Limitado a 2000 para evitar rate limit
    case '1hour': return 2000; // Limitado a 2000 para evitar rate limit (~83 días)
    default: return 365;
  }
};

/**
 * Convierte intervalos a segundos por vela
 */
export const getSecondsPerCandle = (interval) => {
  // Si el intervalo es personalizado (ej: '15min', '2hour', '4week', etc.)
  const match = interval.match(/^(\d+)(min|hour|day|week)$/);
  if (match) {
    const value = parseInt(match[1], 10);
    const type = match[2];
    switch (type) {
      case 'min': return value * 60; // minutos a segundos
      case 'hour': return value * 3600; // horas a segundos
      case 'day': return value * 86400; // días a segundos
      case 'week': return value * 604800; // semanas a segundos (7 días)
      default: return 3600;
    }
  }
  
  // Intervalos predefinidos
  switch (interval) {
    case '1hour': return 3600;
    case '2hour': return 7200;
    case '4hour': return 14400;
    case '6hour': return 21600;
    case '8hour': return 28800;
    case '12hour': return 43200;
    case '1day': return 86400;
    default: return 3600;
  }
};

/**
 * Detecta automáticamente niveles de soporte (mínimos locales)
 */
export const detectSupportLevels = (candles) => {
  if (!candles || !candles.length) return [];
  
  const localMinSupports = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const prev = candles[i - 1].low;
    const curr = candles[i].low;
    const next = candles[i + 1].low;
    if (curr < prev && curr < next) {
      localMinSupports.push(curr);
    }
  }
  
  // Devolver los 3 soportes más significativos
  return [...new Set(localMinSupports)]
    .sort((a, b) => a - b)
    .slice(0, 3);
};

/**
 * Detecta automáticamente niveles de resistencia (máximos locales)
 */
export const detectResistanceLevels = (candles) => {
  if (!candles || !candles.length) return [];
  
  const localMaxResistances = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const prev = candles[i - 1].high;
    const curr = candles[i].high;
    const next = candles[i + 1].high;
    if (curr > prev && curr > next) {
      localMaxResistances.push(curr);
    }
  }
  
  // Devolver las 3 resistencias más significativas
  return [...new Set(localMaxResistances)]
    .sort((a, b) => b - a)
    .slice(0, 3);
};

/**
 * Valida si un intervalo personalizado es válido
 */
export const isValidCustomInterval = (interval) => {
  const pattern = /^(\d+)(min|hour|day|week)$/;
  if (!pattern.test(interval)) return false;
  
  const match = interval.match(pattern);
  const value = parseInt(match[1], 10);
  const type = match[2];
  
  // Validaciones por tipo
  switch (type) {
    case 'min':
      return value >= 1 && value <= 1440; // Máximo 1 día en minutos
    case 'hour':
      return value >= 1 && value <= 168; // Máximo 1 semana en horas
    case 'day':
      return value >= 1 && value <= 365; // Máximo 1 año en días
    case 'week':
      return value >= 1 && value <= 52; // Máximo 1 año en semanas
    default:
      return false;
  }
};

/**
 * Recolecta nodos de estrategia de una respuesta anidada
 */
export const collectStrategyNodes = (node) => {
  if (!node || typeof node !== 'object') return [];
  const bucket = [];
  if (Array.isArray(node.dataRes)) bucket.push(...node.dataRes);
  else if (node.dataRes && typeof node.dataRes === 'object') bucket.push(node.dataRes);
  if (Array.isArray(node.data)) node.data.forEach((entry) => bucket.push(...collectStrategyNodes(entry)));
  return bucket;
};

/**
 * Normaliza la respuesta de estrategias desde la API
 */
export const normalizeStrategiesResponse = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload.value)) {
    const collected = payload.value.flatMap(collectStrategyNodes);
    return collected.length ? collected : payload.value;
  }
  const collected = collectStrategyNodes(payload);
  if (collected.length) return collected;
  if (Array.isArray(payload)) return payload;
  if (payload.data) return normalizeStrategiesResponse(payload.data);
  return [payload];
};

/**
 * Asigna claves identificadoras a la lista de estrategias
 */
export const attachStrategyKey = (list = []) =>
  list.map((item, idx) => ({
    ...item,
    __frontendId:
      item.ID || item._id || item.strategy_code || item.name || `strategy-${idx}`,
  }));

/**
 * Obtiene la clave identificadora de una estrategia
 */
export const getStrategyKey = (strategy) => strategy?.__frontendId || '';

/**
 * Formatea un intervalo personalizado para mostrar
 */
export const formatCustomInterval = (interval) => {
  const match = interval.match(/^(\d+)(min|hour|day|week)$/);
  if (!match) return interval;
  
  const value = parseInt(match[1], 10);
  const type = match[2];
  
  const typeLabels = {
    min: value === 1 ? 'min' : 'min',
    hour: value === 1 ? 'h' : 'h',
    day: value === 1 ? 'd' : 'd',
    week: value === 1 ? 'sem' : 'sem'
  };
  
  return `${value}${typeLabels[type]}`;
};

/**
 * Obtiene el label completo de un intervalo (predefinido o personalizado)
 */
export const getIntervalLabel = (interval) => {
  // Primero buscar en intervalos predefinidos
  const predefined = INTERVALS.find((it) => it.value === interval);
  if (predefined) return predefined.fullLabel;
  
  // Si es personalizado, formatear apropiadamente
  const match = interval.match(/^(\d+)(min|hour|day|week)$/);
  if (match) {
    const value = parseInt(match[1], 10);
    const type = match[2];
    
    const typeLabels = {
      min: value === 1 ? 'Minuto' : 'Minutos',
      hour: value === 1 ? 'Hora' : 'Horas', 
      day: value === 1 ? 'Día' : 'Días',
      week: value === 1 ? 'Semana' : 'Semanas'
    };
    
    return `${value} ${typeLabels[type]}`;
  }
  
  // Fallback al valor original
  return interval;
};

/**
 * Formatea la confianza como porcentaje
 */
export const formatConfidence = (confidence) => `${Math.round((confidence || 0) * 100)}%`;

/**
 * Genera el rango de tiempo para el último año
 */
export const generateYearRange = () => {
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 24 * 60 * 60;
  return { from: oneYearAgo, to: now };
};

/**
 * Filtra las velas para mostrar solo el último año
 */
export const filterCandlesLastYear = (candles) => {
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 24 * 60 * 60;
  return candles.filter(c => c.time >= oneYearAgo && c.time <= now);
};