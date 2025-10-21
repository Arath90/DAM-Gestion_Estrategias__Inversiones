//src/components/layout/Header.jsx
import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import './Header.css';

const Header = ({ title }) => {
  const { user } = useAuth();
  // Depuración: ver el usuario en consola
  console.log('Usuario logeado:', user);

  // Iniciales: si hay nombre, usar iniciales, si no, usar email, si no, 'IN'
  let initials = 'IN';
  if (user) {
    if (user.name && typeof user.name === 'string') {
      initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase();
    } else if (user.email && typeof user.email === 'string') {
      initials = user.email.slice(0, 2).toUpperCase();
    }
  }

  // Mostrar nombre, email o 'Invitado'
  const displayName = user?.name || user?.email || 'Invitado';

  return (
    <header className="dashboard-header">
      <h1>{title}</h1>
      <div className="user-info">
        <span>Usuario: {displayName}</span>
        <div className="user-avatar">{initials}</div>
      </div>
    </header>
  );
};

export default Header;
