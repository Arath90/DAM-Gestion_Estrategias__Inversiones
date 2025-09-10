import { useState, useCallback } from 'react';

export const useSidebar = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarLocked, setSidebarLocked] = useState(false);

  const handleSidebarMouseEnter = useCallback(() => {
    if (!sidebarLocked) setSidebarOpen(true);
  }, [sidebarLocked]);

  const handleSidebarMouseLeave = useCallback(() => {
    if (!sidebarLocked) setSidebarOpen(false);
  }, [sidebarLocked]);

  const handleSidebarLogoClick = useCallback(() => {
    setSidebarLocked((prev) => {
      const newLocked = !prev;
      if (!newLocked) setSidebarOpen(false);
      else setSidebarOpen(true);
      return newLocked;
    });
  }, []);

  return {
    sidebarOpen,
    sidebarLocked,
    handleSidebarMouseEnter,
    handleSidebarMouseLeave,
    handleSidebarLogoClick,
  };
};
