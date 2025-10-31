// Controlador para la página de Configuración
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getStoredTheme, setStoredTheme, applyTheme } from '../utils/theme';
import { useCallback } from 'react';

export function useConfiguracionController() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Logout: limpia sesión y redirige al login
  const onLogoutPress = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Tema: lee y cambia el modo
  const currentTheme = getStoredTheme();
  const onThemeSwitch = useCallback(() => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setStoredTheme(newTheme);
    applyTheme(newTheme);
    // Lanzar evento personalizado para notificar cambio de tema
    window.dispatchEvent(new Event('theme-changed'));
  }, [currentTheme]);

  return {
    onLogoutPress,
    currentTheme,
    onThemeSwitch,
  };
}
