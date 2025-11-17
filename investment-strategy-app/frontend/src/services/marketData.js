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

export async function fetchCandles({
  symbol,
  interval = '1hour',
  limit = 120,
  offset = 0,
  datasetId,
  strategyCode,
  from,
  to,
}) {
  if (!symbol && !datasetId && !strategyCode) throw new Error('symbol o dataset/strategy requerido');
 
  // Mapear intervalos personalizados a intervalos soportados por la API
  const intervalMapping = {
    '15min': '15min',
    '30min': '30min', 
    '1hour': '1hour',
    '2hour': '2hour',
    '4hour': '4hour',
    '6hour': '6hour',
    '8hour': '8hour',
    '12hour': '12hour',
    '1day': '1day',
    // Mapear intervalos personalizados a intervalos existentes como fallback
    '3week': '1day',   // 3 semanas -> datos diarios
    '4week': '1day',   // 4 semanas -> datos diarios  
    '2week': '1day',   // 2 semanas -> datos diarios
    '3day': '1day',    // 3 días -> datos diarios
    '4day': '1day',    // 4 días -> datos diarios
    '5min': '1hour',   // 5 minutos -> datos por hora
    '10min': '1hour',  // 10 minutos -> datos por hora
  };
  
  const apiInterval = intervalMapping[interval] || '1hour';
  
  // Ajustar límite si estamos usando un intervalo de fallback
  let adjustedLimit = limit;
  if (apiInterval !== interval) {
    console.log(`[marketData] Intervalo personalizado ${interval} mapeado a ${apiInterval}`);
    // Aumentar el límite para compensar el intervalo diferente
    if (interval.includes('week')) {
      adjustedLimit = Math.min(limit * 7, 2000); // Más datos para intervalos semanales
    } else if (interval.includes('day') && !interval.includes('1day')) {
      adjustedLimit = Math.min(limit * 3, 1000); // Más datos para intervalos de múltiples días
    }
  }
  
  const cacheKey = `${symbol || 'auto'}-${datasetId || 'no-ds'}-${strategyCode || 'no-strat'}-${from || 'no-from'}-${to || 'no-to'}-${interval}-${limit}-${offset}`;
  
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
    interval: apiInterval, // Usar el intervalo mapeado
    limit: adjustedLimit,
    offset,
    ...(datasetId ? { dataset_id: datasetId } : {}),
    ...(strategyCode ? { strategy_code: strategyCode } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
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
        interval: interval, // Devolver el intervalo original solicitado
        candles: normalizeCandles(data?.data || data),
      };
      
      // Guardar en cache con timestamp largo
      requestCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });
      
      console.log(`[marketData] ${result.candles.length} velas obtenidas para ${symbol} (${interval} -> ${apiInterval})`);
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
      
      // Para otros errores, verificar si podemos usar cache como fallback
      if (cached) {
        console.warn(`[marketData] Error en petición, usando datos en cache como fallback:`, error.message);
        return cached.data;
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

export async function fetchMacd({ symbol, interval = '1hour', limit = 120, fast = 12, slow = 26, signal = 9 }) {
  if (!symbol) throw new Error('symbol requerido');

  const params = {
    symbol,
    tf: interval,
    limit,
    fast,
    slow,
    signal,
  };

  const { data } = await axios.get(buildUrl('/api/indicators/macd'), { params, timeout: 20000 });

  const mapSeries = (series = []) =>
    Array.isArray(series)
      ? series
          .map((p) => ({
            time: new Date(p.time || p.ts || 0).getTime() / 1000,
            value: Number(p.value),
          }))
          .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      : [];

  return {
    macdLine: mapSeries(data?.macdLine || data?.macd || []),
    macdSignal: mapSeries(data?.signalLine || data?.signal || []),
    macdHistogram: mapSeries(data?.histogram || []),
  };
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

