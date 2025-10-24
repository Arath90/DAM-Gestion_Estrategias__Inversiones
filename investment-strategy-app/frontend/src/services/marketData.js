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

export async function fetchCandles({ symbol, interval = '1hour', limit = 120, offset = 0 }) {
  if (!symbol) throw new Error('symbol requerido');
  const params = {
    symbol,
    interval,
    limit,
    offset,
  };

  const { data } = await axios.get(buildUrl('/api/candles/prev'), {
    params,
    paramsSerializer: { serialize: serializeParams },
  });
  return {
    symbol: data?.symbol || symbol,
    interval: data?.interval || interval,
    candles: normalizeCandles(data?.data || data),
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

