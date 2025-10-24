import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

// Contexto central del login: cualquiera en el front puede preguntar "quién está logueado".
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const USER_KEY = 'auth_user'; // clave fija en localStorage donde guardamos la sesión serializada.

// Esta función traduce la URL del servicio OData (la que ya existía) a la base REST donde vive /api/auth.
const resolveApiHost = () => {
  const odataBase =
    (import.meta?.env?.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()) ||
    'http://localhost:4004/odata/v4/catalog';

  // Quitamos la parte /odata/... para quedarnos con http://backend:4004
  return odataBase.replace(/\/odata\/v4\/catalog\/?$/i, '');
};

const AUTH_BASE = resolveApiHost();

// Cliente Axios dedicado solo para login/register/logout. No mezclamos con apiClient general.
const authClient = axios.create({
  baseURL: AUTH_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// Helpers chiquitos para leer y escribir el usuario en localStorage.
const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch (err) {
    console.warn('[auth] payload de auth_user inválido, lo ignoramos:', err);
    return null;
  }
};

const saveCurrentUser = (payload) => {
  localStorage.setItem(USER_KEY, JSON.stringify(payload));
};

const clearCurrentUser = () => {
  localStorage.removeItem(USER_KEY);
};

// Armamos el paquete final que guardamos en localStorage: datos visibles + token de sesión.
const buildSessionUser = (user, token, expiresAt) => ({
  ...user,
  token,
  expiresAt,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getCurrentUser());

  // Si otra pestaña cambia la sesión, al refrescar tomamos la última versión guardada.
  useEffect(() => {
    const storedUser = getCurrentUser();
    if (storedUser && (!user || storedUser.token !== user.token)) {
      setUser(storedUser);
    }
  }, [user]);

  // Login -> pegamos a /api/auth/login, guardamos token + user y devolvemos estado al componente.
  const login = async ({ email, password }) => {
    try {
      const { data } = await authClient.post('/api/auth/login', { email, password });
      if (!data?.success || !data?.token || !data?.user) {
        return { success: false, error: data?.message || 'No se pudo iniciar sesión.' };
      }

      const sessionUser = buildSessionUser(data.user, data.token, data.expiresAt);
      setUser(sessionUser);
      saveCurrentUser(sessionUser);
      return { success: true, user: sessionUser };
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Error al iniciar sesión.';
      return { success: false, error: message };
    }
  };

  // Registro -> similar al login pero usando /api/auth/register y recibiendo sesión al vuelo.
  const register = async ({ name, email, password, user: username }) => {
    try {
      const { data } = await authClient.post('/api/auth/register', {
        name,
        email,
        password,
        user: username,
      });

      if (!data?.success || !data?.token || !data?.user) {
        return { success: false, error: data?.message || 'No se pudo registrar el usuario.' };
      }

      const sessionUser = buildSessionUser(data.user, data.token, data.expiresAt);
      setUser(sessionUser);
      saveCurrentUser(sessionUser);
      return { success: true, user: sessionUser };
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Error al registrar el usuario.';
      return { success: false, error: message };
    }
  };

  // Logout -> avisamos al backend para invalidar token y limpiamos localStorage.
  const logout = async () => {
    const token = user?.token || getCurrentUser()?.token;

    if (token) {
      try {
        await authClient.post(
          '/api/auth/logout',
          {},
          { headers: { 'X-Session-Token': token } },
        );
      } catch (err) {
        console.warn('[auth.logout] El backend no respondió, seguimos igual:', err?.message || err);
      }
    }

    setUser(null);
    clearCurrentUser();
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
