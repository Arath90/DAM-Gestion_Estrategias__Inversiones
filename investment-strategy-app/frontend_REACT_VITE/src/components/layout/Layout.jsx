//src/components/layout/Layout.jsx
import React from 'react';
import { useSidebar } from '../../hooks/useSidebar';
import { useView } from '../../hooks/useView';
import { navigationItems } from '../../config/navigationConfig';
import Sidebar from './Sidebar';
import Header from './Header';
import DashboardView from '../views/DashboardView';
import InstrumentList from '../jsx/InstrumentList';
import './Layout.css';

const viewComponents = {
  dashboard: DashboardView,
  instruments: InstrumentList,
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

  const CurrentView = viewComponents[activeView] || DashboardView;
  const currentViewInfo = navigationItems.find(item => item.id === activeView) || { title: 'Dashboard' };

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
