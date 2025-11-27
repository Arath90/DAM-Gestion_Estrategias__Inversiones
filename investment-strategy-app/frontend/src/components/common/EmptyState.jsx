import React from 'react';

/**
 * EmptyState - Componente para estados vacíos
 * 
 * @param {Object} props
 * @param {string} props.title - Título del estado vacío
 * @param {string} props.message - Mensaje descriptivo
 * @param {string} props.icon - Emoji o icono
 * @param {React.ReactNode} props.action - Acción opcional (botón, link, etc.)
 */
const EmptyState = ({ 
  title = 'No hay datos', 
  message = '', 
  icon = '📭',
  action 
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-message">{message}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
};

export default EmptyState;
