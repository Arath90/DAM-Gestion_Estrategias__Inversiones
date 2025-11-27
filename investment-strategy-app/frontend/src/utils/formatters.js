/**
 * Utilidades para formateo de datos
 */

/**
 * Formatea un número con separadores de miles
 * @param {number} value 
 * @param {number} decimals - Número de decimales
 * @returns {string}
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const num = Number(value);
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  });
};

/**
 * Formatea un precio con símbolo de moneda
 * @param {number} value 
 * @param {string} currency - Código de moneda (USD, EUR, etc.)
 * @returns {string}
 */
export const formatPrice = (value, currency = 'USD') => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
};

/**
 * Formatea un porcentaje
 * @param {number} value - Valor entre 0 y 1, o porcentaje directo
 * @param {boolean} isDecimal - Si el valor está en formato decimal (0-1)
 * @returns {string}
 */
export const formatPercentage = (value, isDecimal = true) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const percentage = isDecimal ? value * 100 : value;
  return `${percentage.toFixed(2)}%`;
};

/**
 * Formatea una fecha a formato legible
 * @param {string|Date} value 
 * @param {Object} options - Opciones de formato (dateStyle, timeStyle, year, month, day, hour, minute, etc.)
 * @returns {string}
 */
export const formatDate = (value, options = {}) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  
  // Si se usan dateStyle o timeStyle, usar toLocaleString
  if (options.dateStyle || options.timeStyle) {
    return date.toLocaleString('es-ES', options);
  }
  
  // De lo contrario, usar opciones individuales con toLocaleDateString
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  
  return date.toLocaleDateString('es-ES', defaultOptions);
};

/**
 * Formatea una fecha con hora
 * @param {string|Date} value 
 * @returns {string}
 */
export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Trunca un texto largo agregando puntos suspensivos
 * @param {string} text 
 * @param {number} maxLength 
 * @returns {string}
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

/**
 * Capitaliza la primera letra de un texto
 * @param {string} text 
 * @returns {string}
 */
export const capitalize = (text) => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Formatea un volumen de trading
 * @param {number} value 
 * @returns {string}
 */
export const formatVolume = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  
  const num = Number(value);
  
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  }
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`;
  }
  
  return num.toLocaleString('en-US');
};
