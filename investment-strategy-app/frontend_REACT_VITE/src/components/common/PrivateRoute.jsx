
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Simula verificación de usuario (puedes ajustar el delay si tienes API real)
    const timer = setTimeout(() => setChecking(false), 400);
    return () => clearTimeout(timer);
  }, [user]);

  if (checking) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader">Verificando usuario...</div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
};

export default PrivateRoute;
