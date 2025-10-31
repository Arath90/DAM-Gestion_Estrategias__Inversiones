// Utilidad para manejar el tema global (claro/oscuro) y persistir preferencia en localStorage
const THEME_KEY = 'theme_mode';

export function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

export function setStoredTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}


export function applyTheme(theme) {
  // Usar clase .dark para modo oscuro, nada para claro
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
}
