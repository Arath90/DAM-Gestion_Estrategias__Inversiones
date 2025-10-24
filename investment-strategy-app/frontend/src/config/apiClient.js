import axios from 'axios';

// URL base del servicio OData. Si no hay env, asumimos localhost.
const API_BASE =
  (import.meta?.env?.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()) ||
  'http://localhost:4004/odata/v4/catalog'; // fallback local en desarrollo

// Simple log para saber a qué endpoint estamos apuntando cuando corre el front.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info('[API] baseURL =', API_BASE);
}

const api = axios.create({
  baseURL: API_BASE.replace(/\/$/, ''),
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  // withCredentials: true, // habilitar si CAP usa sesion basada en cookies
});

// Este helper lee el token guardado por useAuth y nos lo entrega para adjuntarlo en cada request.
const readStoredSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem('auth_user') || 'null');
  } catch (err) {
    console.warn('[api] auth_user no se pudo parsear, ignoro token:', err);
    return null;
  }
};

// Interceptor antes de salir al backend: pegamos token y LoggedUser a la request.
api.interceptors.request.use((config) => {
  const session = readStoredSession();
  if (!session) return config;

  const nextConfig = config;
  nextConfig.headers = nextConfig.headers || {};

  if (session.token) {
    nextConfig.headers['X-Session-Token'] = session.token; // backend lo usa para validar sesión.
  }

  const email = session.email;
  if (email) {
    nextConfig.params = nextConfig.params || {};
    if (nextConfig.params.LoggedUser == null) {
      nextConfig.params.LoggedUser = email; // CAP espera este parámetro para saber quién es.
    }
  }

  return nextConfig;
});

// Interceptor de respuesta, mantiene el log de errores original para debug rápido.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err?.response?.data?.error?.message ||
      err?.response?.statusText ||
      err.message;
    console.error('API error:', msg, '->', err?.config?.url);
    return Promise.reject(err);
  }
);

export default api;
