/**
 * Utilidades para manejo de formularios
 */

/**
 * Crea un objeto de formulario vacío a partir de una configuración de campos
 * @param {Array} fieldConfig - Array de configuración de campos
 * @returns {Object}
 */
export const createBlankForm = (fieldConfig) => {
  return fieldConfig.reduce((acc, field) => {
    acc[field.name] = '';
    return acc;
  }, {});
};

/**
 * Construye un formulario a partir de un objeto de datos
 * @param {Object} data - Datos del backend
 * @param {Array} fieldConfig - Configuración de campos
 * @param {Function} transformer - Función para transformar valores (opcional)
 * @returns {Object}
 */
export const buildFormFromData = (data, fieldConfig, transformer = null) => {
  const form = createBlankForm(fieldConfig);
  
  fieldConfig.forEach(({ name, type }) => {
    const value = data[name];
    
    if (transformer) {
      form[name] = transformer(value, type);
    } else if (type === 'datetime-local' && value) {
      form[name] = toDateInput(value);
    } else {
      form[name] = value != null ? String(value) : '';
    }
  });
  
  return form;
};

/**
 * Sanitiza un payload eliminando campos vacíos y convirtiendo tipos
 * @param {Object} formData - Datos del formulario
 * @param {Array} fieldConfig - Configuración de campos
 * @returns {Object}
 */
export const sanitizePayload = (formData, fieldConfig) => {
  const payload = {};
  
  fieldConfig.forEach(({ name, type }) => {
    const value = formData[name];
    
    if (!value || value === '') {
      return; // Skip campos vacíos
    }
    
    if (type === 'number') {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        payload[name] = num;
      }
    } else if (type === 'datetime-local') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        payload[name] = date.toISOString();
      }
    } else {
      payload[name] = value;
    }
  });
  
  return payload;
};

/**
 * Maneja el cambio de un campo en el formulario
 * @param {Object} formState - Estado actual del formulario
 * @param {string} fieldName - Nombre del campo
 * @param {*} value - Nuevo valor
 * @returns {Object} - Nuevo estado del formulario
 */
export const handleFieldChange = (formState, fieldName, value) => {
  return {
    ...formState,
    [fieldName]: value,
  };
};

// Re-export de utilidades de validación para conveniencia
import { toDateInput } from './validation';
export { toDateInput };
