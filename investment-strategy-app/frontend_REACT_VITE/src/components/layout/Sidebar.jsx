//src/components/layout/Sidebar.jsx
import React from 'react';
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
        title={isLocked ? 'Desbloquear menú' : 'Bloquear menú'}
      >
        ⚡
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
      </nav>
    </aside>
  );
};

export default Sidebar;
