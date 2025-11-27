/**
 * Utilidades para validación de datos
 */

/**
 * Valida un email
 * @param {string} email 
 * @returns {boolean}
 */
export const validateEmail = (email) => {
  if (!email) return false;
  return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
};

/**
 * Valida que un valor sea un número válido
 * @param {*} value 
 * @returns {boolean}
 */
export const isValidNumber = (value) => {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  return !Number.isNaN(num) && Number.isFinite(num);
};

/**
 * Convierte un valor a número o null
 * @param {*} value 
 * @returns {number|null}
 */
export const toNumberOrNull = (value) => {
  if (!value || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

/**
 * Convierte una fecha a formato ISO o null
 * @param {string|Date} value 
 * @returns {string|null}
 */
export const toISOOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Convierte una fecha ISO a formato para input datetime-local
 * @param {string|Date} value 
 * @returns {string}
 */
export const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  
  const pad = (n) => `${n}`.padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

/**
 * Valida un objeto contra un esquema de campos
 * @param {Object} data - Datos a validar
 * @param {Array} schema - Array de configuración de campos con reglas
 * @returns {Object} { isValid: boolean, errors: Object }
 */
export const validateFormData = (data, schema) => {
  const errors = {};
  let isValid = true;

  schema.forEach(field => {
    const value = data[field.name];
    
    // Campo requerido
    if (field.required && (!value || value === '')) {
      errors[field.name] = `${field.label} es requerido`;
      isValid = false;
    }
    
    // Validación de tipo
    if (value && field.type === 'number' && !isValidNumber(value)) {
      errors[field.name] = `${field.label} debe ser un número válido`;
      isValid = false;
    }
    
    // Validación personalizada
    if (value && field.validate && !field.validate(value)) {
      errors[field.name] = field.errorMessage || `${field.label} no es válido`;
      isValid = false;
    }
  });

  return { isValid, errors };
};
