import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const UserMenu = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="user-menu">
      <span>Bienvenido, {user.name || user.email}</span>
      <button onClick={logout}>Cerrar sesión</button>
    </div>
  );
};

export default UserMenu;
