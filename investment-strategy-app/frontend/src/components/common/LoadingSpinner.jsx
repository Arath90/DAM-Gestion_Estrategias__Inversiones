import React from 'react';

/**
 * LoadingSpinner - Componente de carga reutilizable
 * 
 * @param {Object} props
 * @param {string} props.message - Mensaje a mostrar durante la carga
 * @param {string} props.size - Tamaño del spinner (small, medium, large)
 */
const LoadingSpinner = ({ message = 'Cargando...', size = 'medium' }) => {
  const sizeClass = `spinner-${size}`;

  return (
    <div className="loading-spinner-container">
      <div className={`loading-spinner ${sizeClass}`}>
        <div className="spinner"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
