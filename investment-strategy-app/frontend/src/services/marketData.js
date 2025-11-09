import axios from 'axios';

const API_BASE =
  (import.meta?.env?.VITE_BACKEND_URL && String(import.meta.env.VITE_BACKEND_URL).trim()) ||
  'http://localhost:4004';

const buildUrl = (path) => `${API_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

const serializeParams = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, value);
  });
  return searchParams.toString().replace(/\+/g, '%20');
};

const normalizeCandles = (payload) => {
  if (!payload) return [];
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  return rows
    .map((row) => ({
      time: new Date(row.ts || row.time || row.datetime || row.date || row.timestamp || row.t).getTime() / 1000,
      open: Number(row.open ?? row.o),
      high: Number(row.high ?? row.h),
      low: Number(row.low ?? row.l),
      close: Number(row.close ?? row.c),
      volume: Number(row.volume ?? row.v ?? row.Volume ?? 0),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.time) &&
        Number.isFinite(row.open) &&
        Number.isFinite(row.high) &&
        Number.isFinite(row.low) &&
        Number.isFinite(row.close),
    )
    .sort((a, b) => a.time - b.time);
};

// Cache para evitar requests duplicadas
const requestCache = new Map();
const CACHE_TTL = 60000; // 60 segundos - más tiempo para evitar rate limiting

// Promesa pendiente para evitar múltiples requests simultáneos
const pendingRequests = new Map();

// Timestamp del último error 429 para implementar backoff exponencial
let lastRateLimitTime = 0;
let rateLimitBackoffMs = 5000; // Empezar con 5 segundos

export async function fetchCandles({ symbol, interval = '1hour', limit = 120, offset = 0 }) {
  if (!symbol) throw new Error('symbol requerido');
  
  const cacheKey = `${symbol}-${interval}-${limit}-${offset}`;
  
  // 1. Verificar si hay una petición en progreso
  if (pendingRequests.has(cacheKey)) {
    console.log(`[marketData] Reutilizando petición en curso: ${cacheKey}`);
    return pendingRequests.get(cacheKey);
  }
  
  // 2. Verificar cache (siempre usar cache si existe, incluso si está expirado)
  const cached = requestCache.get(cacheKey);
  
  // 3. Si hay rate limit activo y tenemos cache, usarlo sin hacer request
  const timeSinceLastRateLimit = Date.now() - lastRateLimitTime;
  if (timeSinceLastRateLimit < rateLimitBackoffMs && cached) {
    console.warn(`[marketData] Rate limit activo (${Math.ceil((rateLimitBackoffMs - timeSinceLastRateLimit) / 1000)}s restantes), usando cache`);
    return cached.data;
  }
  
  // 4. Si el cache es reciente, usarlo
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[marketData] Usando datos en cache: ${cacheKey}`);
    return cached.data;
  }
  
  // 5. Hacer la petición solo si no hay rate limit activo
  const params = {
    symbol,
    interval,
    limit,
    offset,
  };

  const requestPromise = axios.get(buildUrl('/api/candles/prev'), {
    params,
    paramsSerializer: { serialize: serializeParams },
    timeout: 30000, // 30 segundos de timeout
  })
    .then(({ data }) => {
      // Reset del backoff al tener éxito
      rateLimitBackoffMs = 5000;
      
      const result = {
        symbol: data?.symbol || symbol,
        interval: data?.interval || interval,
        candles: normalizeCandles(data?.data || data),
      };
      
      // Guardar en cache con timestamp largo
      requestCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });
      
      console.log(`[marketData] ${result.candles.length} velas obtenidas para ${symbol} (${interval})`);
      return result;
    })
    .catch((error) => {
      if (error.response?.status === 429) {
        // Implementar backoff exponencial
        lastRateLimitTime = Date.now();
        rateLimitBackoffMs = Math.min(rateLimitBackoffMs * 2, 60000); // Máximo 60 segundos
        
        console.warn(`[marketData] Rate limit alcanzado. Backoff de ${rateLimitBackoffMs / 1000}s activado`);
        
        // Si hay datos en cache, aunque sean viejos, úsalos
        if (cached) {
          console.log(`[marketData] Usando datos en cache por rate limit`);
          return cached.data;
        }
        
        // Si no hay cache, lanzar error amigable
        const err = new Error(`Límite de peticiones alcanzado. Espera ${rateLimitBackoffMs / 1000} segundos.`);
        err.isRateLimit = true;
        throw err;
      }
      throw error;
    })
    .finally(() => {
      // Limpiar la petición pendiente
      pendingRequests.delete(cacheKey);
    });
  
  // Guardar la promesa pendiente
  pendingRequests.set(cacheKey, requestPromise);
  
  return requestPromise;
}

export const DEFAULT_SYMBOLS = [
  { label: 'NASDAQ 100', value: 'I:NDX' },
  { label: 'S&P 500', value: 'I:SPX' },
  { label: 'EUR/USD', value: 'C:EURUSD' },
  { label: 'BTC/USD', value: 'X:BTCUSD' },
  { label: 'ETH/USD', value: 'X:ETHUSD' },
  { label: 'AAPL', value: 'AAPL' },
  { label: 'MSFT', value: 'MSFT' },
];

