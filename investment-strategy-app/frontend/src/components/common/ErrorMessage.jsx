import React from 'react';

/**
 * ErrorMessage - Componente para mostrar mensajes de error
 * 
 * @param {Object} props
 * @param {string} props.message - Mensaje de error
 * @param {Function} props.onDismiss - Callback para cerrar el mensaje
 * @param {string} props.type - Tipo de mensaje (error, warning, info)
 */
const ErrorMessage = ({ message, onDismiss, type = 'error' }) => {
  if (!message) return null;

  return (
    <div className={`error-message ${type}`}>
      <div className="error-content">
        <span className="error-icon">⚠️</span>
        <p className="error-text">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="error-dismiss"
          onClick={onDismiss}
          aria-label="Cerrar mensaje"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
