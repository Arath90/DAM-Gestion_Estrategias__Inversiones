const cfg = require('../../config/dotenvXConfig');
//src/api/services/candlesExternal.service.js
/**
 * Servicio encargado de obtener velas historicas desde un proveedor externo.
 *
 * El objetivo es desacoplar el origen de datos de Candles del almacenamiento interno.
 * La API publica a utilizar puede variar; por eso la implementacion intenta ser flexible:
 * - Usa la URL base definida en CANDLES_API_URL.
 * - Permite enviar llaves como query param (CANDLES_API_KEY_PARAM) o encabezado (CANDLES_API_KEY_HEADER).
 * - Permite enviar encabezados adicionales mediante CANDLES_API_EXTRA_HEADERS (formato "Header: valor;Otro: valor").
 */

/** Pequeño helper para seleccionar claves alternativas. */
const pick = (source, keys, fallback) => {
  if (!source) return fallback;
  for (const key of keys) {
    if (key in source && source[key] != null) return source[key];
  }
  return fallback;
};

/**
 * Convierte timestamps provenientes del proveedor (string o epoch) a instancias Date ISO.
 */
const parseTimestamp = (value) => {
  if (value == null) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'number') {
    // si viene en segundos convertir a ms
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return null;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) return parseTimestamp(numeric);
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const ensureDate = (value, fallback) => {
  if (!value) return fallback;
  const parsed = parseTimestamp(value);
  return parsed || fallback;
};

/** Parsea encabezados adicionales definidos como "Header: valor;Otro: valor". */
function parseExtraHeaders(raw = '') {
  const headers = {};
  if (!raw || typeof raw !== 'string') return headers;
  const pairs = raw.split(';').map(s => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [key, ...rest] = pair.split(':');
    if (!key || !rest.length) continue;
    headers[key.trim()] = rest.join(':').trim();
  }
  return headers;
}

/** Obtiene la funcion fetch disponible (Node 18+ ya la expone globalmente). */
async function getFetch() {
  if (typeof fetch === 'function') return fetch.bind(globalThis);
  const err = new Error('El entorno no expone fetch (requiere Node 18+).');
  err.status = 500;
  throw err;
}

/** Formatea una fecha a YYYY-MM-DD requerido por varios proveedores (Polygon inclusive). */
const formatDate = date => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Determina multiplier/timespan/duracion en ms a partir de un intervalo como 1min,5min,1h. */
function parseInterval(interval = '1min') {
  const match = String(interval).trim().match(/^(\d+)([a-zA-Z]+)/);
  if (!match) {
    return { multiplier: 1, timespan: 'minute', durationMs: 60_000 };
  }

  const multiplier = Number(match[1]) || 1;
  const unitRaw = match[2].toLowerCase();
  let timespan = 'minute';
  let durationMs = 60_000;

  if (unitRaw.startsWith('min')) {
    timespan = 'minute';
    durationMs = multiplier * 60_000;
  } else if (unitRaw.startsWith('hour') || unitRaw.startsWith('h')) {
    timespan = 'hour';
    durationMs = multiplier * 60 * 60_000;
  } else if (unitRaw.startsWith('day') || unitRaw.startsWith('d')) {
    timespan = 'day';
    durationMs = multiplier * 24 * 60 * 60_000;
  } else {
    // fallback a minutos
    durationMs = multiplier * 60_000;
    timespan = 'minute';
  }

  return { multiplier, timespan, durationMs };
}

/**
 * Llama al proveedor externo de velas segun la configuracion de entorno.
 * Soporta plantillas tipo Polygon (CANDLES_API_URL con placeholders {ticker},{multiplier},{timespan},{from},{to}).
 */
async function fetchFromProvider({ symbol, multiplier, timespan, from, to, limit }) {
  if (!cfg.CANDLES_API_URL) {
    const err = new Error('CANDLES_API_URL no esta configurado.');
    err.status = 503;
    throw err;
  }

  const template = cfg.CANDLES_API_URL;
  const isPrevEndpoint = template.includes('/prev');

  if (isPrevEndpoint) {
    if (!symbol) {
      const err = new Error('El endpoint de barras previas requiere un ticker (symbol).');
      err.status = 400;
      throw err;
    }

    let urlString = template
      .replace('{ticker}', encodeURIComponent(symbol))
      .replace('{indicesTicker}', encodeURIComponent(symbol))
      .replace('{symbol}', encodeURIComponent(symbol));

    const url = new URL(urlString);

    if (cfg.CANDLES_API_KEY) {
      if (cfg.CANDLES_API_KEY_HEADER) {
        // se agregara en headers mas adelante
      } else if (cfg.CANDLES_API_KEY_PARAM) {
        url.searchParams.set(cfg.CANDLES_API_KEY_PARAM, cfg.CANDLES_API_KEY);
      }
    }

    if (cfg.CANDLES_API_DEFAULT_QUERY) {
      const pairs = cfg.CANDLES_API_DEFAULT_QUERY.split('&').map(s => s.trim()).filter(Boolean);
      for (const pair of pairs) {
        const [key, ...rest] = pair.split('=');
        if (!key || !rest.length) continue;
        if (!url.searchParams.has(key)) url.searchParams.set(key, rest.join('='));
      }
    }

    const headers = {
      ...parseExtraHeaders(cfg.CANDLES_API_EXTRA_HEADERS),
    };
    if (cfg.CANDLES_API_KEY && cfg.CANDLES_API_KEY_HEADER) {
      headers[cfg.CANDLES_API_KEY_HEADER] = cfg.CANDLES_API_KEY;
    }

    const fetchFn = await getFetch();
    const response = await fetchFn(url.toString(), { headers });
    if (!response.ok) {
      const err = new Error(`Proveedor de velas respondio ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const payload = await response.json();
    const records = Array.isArray(payload)
      ? payload
      : pick(payload, ['results', 'data'], []);

    if (!Array.isArray(records)) {
      const err = new Error('El proveedor no devolvio resultados en el formato esperado.');
      err.status = 502;
      throw err;
    }

    return records;
  }

  const replacements = {
    '{ticker}': symbol,
    '{optionsTicker}': symbol,
    '{symbol}': symbol,
    '{multiplier}': String(multiplier),
    '{timespan}': timespan,
    '{from}': from,
    '{to}': to,
  };

  let hadPlaceholder = false;
  let urlString = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    if (urlString.includes(placeholder) && value != null) {
      hadPlaceholder = true;
      urlString = urlString.split(placeholder).join(encodeURIComponent(value));
    }
  }

  let url;
  if (hadPlaceholder) {
    url = new URL(urlString);
  } else {
    url = new URL(template);
    if (symbol) url.searchParams.set('symbol', symbol);
    if (multiplier) url.searchParams.set('multiplier', String(multiplier));
    if (timespan) url.searchParams.set('timespan', timespan);
    if (from) url.searchParams.set('from', from);
    if (to) url.searchParams.set('to', to);
  }

  if (limit && !url.searchParams.has('limit')) url.searchParams.set('limit', String(limit));

  if (cfg.CANDLES_API_KEY) {
    if (cfg.CANDLES_API_KEY_HEADER) {
      // lo agregaremos como header mas adelante
    } else if (cfg.CANDLES_API_KEY_PARAM) {
      url.searchParams.set(cfg.CANDLES_API_KEY_PARAM, cfg.CANDLES_API_KEY);
    }
  }

  if (cfg.CANDLES_API_DEFAULT_QUERY) {
    const pairs = cfg.CANDLES_API_DEFAULT_QUERY.split('&').map(s => s.trim()).filter(Boolean);
    for (const pair of pairs) {
      const [key, ...rest] = pair.split('=');
      if (!key || !rest.length) continue;
      if (!url.searchParams.has(key)) url.searchParams.set(key, rest.join('='));
    }
  }

  const headers = {
    ...parseExtraHeaders(cfg.CANDLES_API_EXTRA_HEADERS),
  };
  if (cfg.CANDLES_API_KEY && cfg.CANDLES_API_KEY_HEADER) {
    headers[cfg.CANDLES_API_KEY_HEADER] = cfg.CANDLES_API_KEY;
  }

  const fetchFn = await getFetch();
  const response = await fetchFn(url.toString(), { headers });
  if (!response.ok) {
    const err = new Error(`Proveedor de velas respondio ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  const records = Array.isArray(payload)
    ? payload
    : pick(payload, ['data', 'candles', 'results', 'items'], []);

  if (!Array.isArray(records)) {
    const err = new Error('El proveedor no devolvio un arreglo reconocible (data/candles/results).');
    err.status = 502;
    throw err;
  }

  return records;
}

/**
 * Normaliza un registro de vela del proveedor a la estructura expuesta por CAP.
 */
function normalizeCandleRecord(record, { instrumentId, interval }) {
  const tsValue = pick(record, ['ts', 't', 'timestamp', 'time', 'datetime', 'date', 'T', 'start'], null);
  const ts = parseTimestamp(tsValue);
  if (!ts) return null;

  const normalizeNumber = (value, fallbackKeys = []) => {
    if (value != null && value !== '') return Number(value);
    for (const key of fallbackKeys) {
      if (key in record && record[key] != null && record[key] !== '') return Number(record[key]);
    }
    return undefined;
  };

  const open = normalizeNumber(record.open, ['o', 'Open']);
  const high = normalizeNumber(record.high, ['h', 'High']);
  const low = normalizeNumber(record.low, ['l', 'Low']);
  const close = normalizeNumber(record.close, ['c', 'Close']);
  const volume = normalizeNumber(record.volume, ['v', 'Volume']);
  const tradeCount = normalizeNumber(record.trade_count, ['tradeCount', 'n', 'count']);
  const wap = normalizeNumber(record.wap, ['vwap', 'VWAP', 'vw']);

  return {
    instrument_ID: instrumentId,
    bar_size: interval,
    ts,
    open,
    high,
    low,
    close,
    volume,
    trade_count: tradeCount,
    wap,
  };
}

/**
 * Obtiene velas normalizadas para un instrumento usando el proveedor externo.
 */
async function fetchCandlesForInstrument({ instrumentId, symbol, interval = '1min', limit = 60, offset = 0, from, to }) {
  const isPrevEndpoint = cfg.CANDLES_API_URL && cfg.CANDLES_API_URL.includes('/prev');

  if (isPrevEndpoint) {
    const rawPrevRecords = await fetchFromProvider({ symbol });
    const normalizedPrev = rawPrevRecords
      .map(record => normalizeCandleRecord(record, { instrumentId, interval: '1day' }))
      .filter(Boolean)
      .sort((a, b) => new Date(a.ts) - new Date(b.ts));
    const offsetApplied = offset ? normalizedPrev.slice(offset) : normalizedPrev;
    return limit ? offsetApplied.slice(0, limit) : offsetApplied;
  }

  const { multiplier, timespan, durationMs } = parseInterval(interval);
  const totalNeeded = limit + (offset || 0);
  const now = new Date();
  const toDate = ensureDate(to, now);
  let fromDate = ensureDate(from, null);
  if (!fromDate) {
    fromDate = new Date(toDate.getTime() - Math.max(totalNeeded, 1) * durationMs);
  }
  if (fromDate > toDate) {
    fromDate = new Date(toDate.getTime() - Math.max(totalNeeded, 1) * durationMs);
  }

  const rawRecords = await fetchFromProvider({
    symbol,
    multiplier,
    timespan,
    from: formatDate(fromDate),
    to: formatDate(toDate),
    limit: totalNeeded,
  });

  const normalized = rawRecords
    .map(record => normalizeCandleRecord(record, { instrumentId, interval }))
    .filter(Boolean)
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));

  const sliced = offset ? normalized.slice(offset) : normalized;
  return limit ? sliced.slice(0, limit) : sliced;
}

module.exports = {
  fetchCandlesForInstrument,
};
