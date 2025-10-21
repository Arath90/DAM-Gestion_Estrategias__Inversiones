// src/config/apiClient.js
import axios from 'axios';

const API_BASE =
  (import.meta?.env?.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()) ||
  'http://localhost:4004/odata/v4/catalog'; // fallback local en desarrollo

// Simple log to verify which URL is being used
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
