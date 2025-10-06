//src/components/common/Card.jsx
import React from 'react';
import './Card.css';

const Card = ({ title, value, sub, subColor }) => {
  const subClassName = `card-sub ${subColor || ''}`;
  return (
    <div className="dashboard-card">
      <span className="card-title">{title}</span>
      <span className="card-value">{value}</span>
      <span className={subClassName}>{sub}</span>
    </div>
  );
};

export default Card;
