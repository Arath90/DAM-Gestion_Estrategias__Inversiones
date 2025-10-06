import axios from 'axios';

const API_BASE =
  (import.meta?.env?.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()) ||
  'http://localhost:4004/odata/v4/catalog'; // fallback seguro en dev

// 🔎 Log claro en consola para verificar qué URL usa el front
if (typeof window !== 'undefined') {
  // Evita spamear en producción si quieres
  // eslint-disable-next-line no-console
  console.info('[API] baseURL =', API_BASE);
}

const api = axios.create({
  baseURL: API_BASE.replace(/\/$/, ''), // sin trailing slash
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  // withCredentials: true, // <- descomenta si tu CAP usa cookies/sesión
});

// Manejo de errores con mensaje legible
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
