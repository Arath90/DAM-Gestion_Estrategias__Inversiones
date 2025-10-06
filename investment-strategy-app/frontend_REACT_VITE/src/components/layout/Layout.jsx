import React, { useEffect } from 'react';
import { useSidebar } from '../../hooks/useSidebar';
import { useView } from '../../hooks/useView';
import { navigationItems } from '../../config/navigationConfig';
import Sidebar from './Sidebar';
import Header from './Header';
import DashboardLean from '../views/DashboardLean';
import InstrumentsFast from '../views/InstrumentsFast';
import './Layout.css';

const viewComponents = {
  dashboard: DashboardLean,
  instruments: InstrumentsFast,
};

const Layout = () => {
  const {
    sidebarOpen,
    sidebarLocked,
    handleSidebarMouseEnter,
    handleSidebarMouseLeave,
    handleSidebarLogoClick,
  } = useSidebar();

  const { activeView, handleViewChange } = useView('dashboard');

  const CurrentView = viewComponents[activeView] || DashboardLean;
  const currentViewInfo = navigationItems.find(item => item.id === activeView) || { title: 'Dashboard' };

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') e.preventDefault(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="dashboard-container">
      <Sidebar
        isOpen={sidebarOpen}
        isLocked={sidebarLocked}
        activeView={activeView}
        navigationItems={navigationItems}
        handleMouseEnter={handleSidebarMouseEnter}
        handleMouseLeave={handleSidebarMouseLeave}
        handleLogoClick={handleSidebarLogoClick}
        handleNavClick={handleViewChange}
      />
      <main className="main-content">
        <Header title={currentViewInfo.title} />
        <CurrentView />
      </main>
    </div>
  );
};

export default Layout;
