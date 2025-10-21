//src/components/common/Card.jsx
import React from 'react';
import './Card.css';

const Card = ({ title, value, sub, subColor, tooltip, formula, isFlipped, onToggle }) => {
  const subClassName = `card-sub ${subColor || ''}`;

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle?.();
    }
  };

  return (
    <div
      className={`dashboard-card ${isFlipped ? 'card-flipped' : ''}`}
      title={tooltip || title}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={handleKey}
    >
      <div className="card-inner">
        <div className="card-face card-front">
          <span className="card-title">{title}</span>
          <span className="card-value">{value}</span>
          <span className={subClassName}>{sub}</span>
        </div>
        <div className="card-face card-back">
          <span className="card-formula-title">{title}</span>
          <p className="card-formula">{formula || 'Sin fórmula definida.'}</p>
          <span className="card-hint">Click para volver</span>
        </div>
      </div>
    </div>
  );
};

export default Card;
