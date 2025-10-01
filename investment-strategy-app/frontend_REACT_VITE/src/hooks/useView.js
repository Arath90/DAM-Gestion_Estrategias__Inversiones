import { useState, useCallback } from 'react';

export const useView = (initialView = 'dashboard') => {
  const [activeView, setActiveView] = useState(initialView);

  const handleViewChange = useCallback((viewId) => {
    setActiveView(viewId);
  }, []);

  return {
    activeView,
    handleViewChange,
  };
};
