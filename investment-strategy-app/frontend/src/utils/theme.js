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
    import('../assets/colors/projectColors-dark.css');
  } else {
    document.documentElement.classList.remove('dark');
    import('../assets/colors/projectColors.css');
  }
}

export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
}
