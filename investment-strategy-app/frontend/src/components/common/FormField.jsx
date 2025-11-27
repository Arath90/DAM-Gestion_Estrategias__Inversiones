import React from 'react';

/**
 * FormField - Componente genérico reutilizable para campos de formulario
 * 
 * @param {Object} props
 * @param {string} props.label - Etiqueta del campo
 * @param {string} props.type - Tipo de input (text, number, datetime-local, etc.)
 * @param {string} props.name - Nombre del campo
 * @param {string} props.value - Valor actual del campo
 * @param {Function} props.onChange - Callback cuando cambia el valor
 * @param {string} props.placeholder - Texto placeholder
 * @param {string} props.step - Step para inputs numéricos
 * @param {boolean} props.disabled - Si el campo está deshabilitado
 * @param {string} props.className - Clases CSS adicionales
 */
const FormField = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder = '',
  step,
  disabled = false,
  className = '',
}) => {
  return (
    <label className={`form-field ${className}`}>
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        step={step}
        disabled={disabled}
      />
    </label>
  );
};

export default FormField;
