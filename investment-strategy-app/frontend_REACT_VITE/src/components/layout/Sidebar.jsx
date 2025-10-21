// src/components/layout/Sidebar.jsx
import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import './Sidebar.css';

const SidebarButton = ({ item, isActive, onClick, isSidebarOpen }) => (
  <button
    className={`sidebar-btn${isActive ? ' active' : ''}`}
    title={item.title}
    onClick={() => onClick(item.id)}
  >
    <span role="img" aria-label={item.label}>{item.icon}</span>
    {isSidebarOpen && <span className="sidebar-label">{item.title}</span>}
  </button>
);

const Sidebar = ({
  isOpen,
  isLocked,
  activeView,
  navigationItems,
  handleMouseEnter,
  handleMouseLeave,
  handleLogoClick,
  handleNavClick,
}) => {
  const sidebarClasses = `sidebar${isOpen ? ' sidebar-open' : ''}${isLocked ? ' sidebar-locked' : ''}`;
  const logoClasses = `sidebar-logo${isLocked ? ' sidebar-logo-locked' : ''}`;
  const { logout, user } = useAuth();

  return (
    <aside
      className={sidebarClasses}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={logoClasses}
        onClick={handleLogoClick}
        style={{ cursor: 'pointer' }}
        title={isLocked ? 'Desbloquear menu' : 'Bloquear menu'}
      >
        INV
      </div>
      <nav className="sidebar-nav">
        {navigationItems.map((item) => (
          <SidebarButton
            key={item.id}
            item={item}
            isActive={activeView === item.id}
            onClick={handleNavClick}
            isSidebarOpen={isOpen}
          />
        ))}
        {user && (
          <button
            className="sidebar-btn logout-btn"
            onClick={() => {
              if (window.confirm('¿Seguro que quieres cerrar sesión?')) logout();
            }}
            style={{ marginTop: '2rem' }}
          >
            <span role="img" aria-label="logout">🔒</span>
            {isOpen && <span className="sidebar-label">Cerrar sesión</span>}
          </button>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
