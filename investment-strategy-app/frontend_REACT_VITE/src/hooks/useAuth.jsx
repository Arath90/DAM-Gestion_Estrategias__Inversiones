import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const USERS_KEY = 'auth_users';
const USER_KEY = 'auth_user';

function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
}

function saveCurrentUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getCurrentUser());

  const login = ({ email, password }) => {
    const users = getUsers();
    const found = users.find(u => u.email === email && u.password === password);
    if (found) {
      setUser(found);
      saveCurrentUser(found);
      return true;
    }
    return false;
  };

  const register = ({ name, email, password }) => {
    const users = getUsers();
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'El correo ya está registrado' };
    }
    const newUser = { name, email, password };
    users.push(newUser);
    saveUsers(users);
    setUser(newUser);
    saveCurrentUser(newUser);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
