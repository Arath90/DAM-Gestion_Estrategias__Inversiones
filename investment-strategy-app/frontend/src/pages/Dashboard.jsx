import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import Datasets from './Datasets';
import { ShellBar, SideNavigation, SideNavigationItem, Button } from '@ui5/webcomponents-react';
import Inicio from './Inicio';
import Instrumentos from './Instrumentos';
import Mercado from './Mercado';
import Estrategias from './Estrategias';
import Rendimiento from './Rendimiento';
import Ordenes from './Ordenes';
import Riesgos from './Riesgos';
import Configuracion from './Configuracion';

const menuOptions = [
  { key: 'inicio', text: 'Inicio', icon: 'home' },
  { key: 'instrumentos', text: 'Instrumentos', icon: 'tools-opportunity' },
  { key: 'mercado', text: 'Mercado', icon: 'trend-up' },
  { key: 'estrategias', text: 'Estrategias', icon: 'bo-strategy-management' },
  { key: 'datasets', text: 'Datasets', icon: 'database' },
  { key: 'rendimiento', text: 'Rendimiento', icon: 'line-chart' },
  { key: 'ordenes', text: 'Órdenes', icon: 'sales-order' },
  { key: 'riesgos', text: 'Riesgos', icon: 'shield' },
  { key: 'configuracion', text: 'Configuración', icon: 'settings' }
];

const Dashboard = ({ panelContent }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  const handleMenuToggle = () => setCollapsed((prev) => !prev);
  const handleMenuClick = (key) => {
    navigate(`/dashboard/${key}`);
  };

  if (!user) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-shellbar">
          <div className="shellbar-title">Estrategias de Inversión</div>
          <div className="shellbar-user" title="No autenticado">Acceso restringido</div>
        </div>
        <div className="main-content">
          <h2>Acceso restringido</h2>
          <p>Por favor inicia sesión para acceder al sistema.</p>
        </div>
      </div>
    );
  }

  const displayName = user.name || user.email || 'Usuario';
  // Determinar la ruta activa
  const activeKey = location.pathname.replace('/dashboard/', '') || 'inicio';

  return (
    <div className={`dashboard-container${collapsed ? ' collapsed' : ''}`}>  
      <div className="dashboard-shellbar">
        <div className="shellbar-title">Estrategias de Inversión</div>
        <div className="shellbar-user" title={displayName}>
          {displayName.length > 22 ? displayName.slice(0, 22) + '...' : displayName}
        </div>
      </div>
      <div className="dashboard-content">
        <nav className={`side-nav${collapsed ? ' collapsed' : ''}`}>  
          <div className="side-logo" onClick={handleMenuToggle} style={{cursor: 'pointer'}}>
            <div className="dashboard-logo img-logo" aria-label="Logo" />
          </div>
          <ul className="menu-list">
            {menuOptions.map(opt => (
              <li
                key={opt.key}
                className={`menu-item${activeKey === opt.key ? ' active' : ''}${collapsed ? ' collapsed' : ''}`}
                onClick={() => handleMenuClick(opt.key)}
              >
                <span className="icon">
                  <ui5-icon name={opt.icon}></ui5-icon>
                </span>
                {!collapsed && <span className="menu-text">{opt.text}</span>}
              </li>
            ))}
          </ul>
        </nav>
        <main className="main-content">
          {panelContent}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;