import React from 'react';
import './Header.css';

const Header = ({ title }) => (
  <header className="dashboard-header">
    <h1>{title}</h1>
    <div className="user-info">
      <span>Usuario: Alex Martinez</span>
      <div className="user-avatar">AM</div>
    </div>
  </header>
);

export default Header;
