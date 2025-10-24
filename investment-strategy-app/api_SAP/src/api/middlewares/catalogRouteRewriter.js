'use strict';

/**
 * catalogRouteRewriter
 *
 * Express middleware que convierte rutas simplificadas en llamadas OData validas para CAP.
 * Permite consumir la API con patrones como:
 *   /odata/v4/catalog/getAll/<db&&user>/<Entity>
 *   /odata/v4/catalog/getById/<db&&user>/<Entity>/<ID>
 * y los reescribe como endpoints CAP estandar (GET /Entity, POST /Entity, etc.).
 *
 * Ademas normaliza parametros de base de datos (Mongo/HANA) y usuario logueado, insertandolos
 * en req.query para que el controller pueda leerlos de forma consistente.
 */
const { URLSearchParams } = require('url');

/** Decodifica una cadena sin lanzar si esta corrupta. */
function safeDecode(value) {
  if (typeof value !== 'string') return value;
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

/** Convierte la bandera de base de datos recibida en URL a un identificador normalizado. */
function normalizeDb(value) {
  if (!value) return null;
  const decoded = safeDecode(value).trim().toLowerCase();
  if (!decoded) return null;
  if (decoded === 'mongodb' || decoded === 'mongo' || decoded === 'mongo-db') return 'mongo';
  if (decoded === 'hana') return 'hana';
  return decoded;
}

/** Construye un URLSearchParams a partir de la url original del request. */
function buildSearchParams(originalUrl) {
  const params = new URLSearchParams();
  if (typeof originalUrl !== 'string') return params;

  const questionIndex = originalUrl.indexOf('?');
  if (questionIndex < 0) return params;

  const raw = originalUrl.slice(questionIndex + 1);
  if (!raw) return params;

  const existing = new URLSearchParams(raw);
  for (const [key, value] of existing.entries()) {
    params.append(key, value);
  }
  return params;
}

/**
 * Registra el middleware sobre el path base /odata/v4/catalog.
 * Se invoca antes que CAP para que Express reescriba la ruta y el metodo HTTP.
 */
module.exports = function registerCatalogRouteRewriter(app) {
  if (!app || typeof app.use !== 'function') return;

  app.use('/odata/v4/catalog', (req, res, next) => {
    const segments = req.path.split('/').filter(Boolean);
    if (!segments.length) return next();

    const operation = (segments[0] || '').toLowerCase();
    const supported = new Set(['getall', 'getbyid', 'create', 'update', 'patch', 'delete']);
    if (!supported.has(operation)) return next();

    const contextSegment = segments[1] || '';
    const entitySegment = segments[2];
    if (!entitySegment) {
      res.status(400).json({ error: 'Entity segment is required.' });
      return;
    }

    const remaining = segments.slice(3);
    const [rawDb, rawUser] = contextSegment.split('&&');
    const normalizedDb = normalizeDb(rawDb);
    const loggedUser = safeDecode(rawUser);

    const searchParams = buildSearchParams(req.originalUrl || '');
    if (normalizedDb && !searchParams.has('db')) searchParams.set('db', normalizedDb);
    // Si el middleware de sesión detectó usuario, lo forzamos como LoggedUser para CAP.
    const sessionEmail = req.sessionUser?.email || req.catalogLoggedUser;
    if (sessionEmail && !searchParams.has('LoggedUser')) searchParams.set('LoggedUser', sessionEmail);
    if (loggedUser && !searchParams.has('loggedUser')) searchParams.set('loggedUser', loggedUser);

    req.query = Object.fromEntries(searchParams.entries());
    if (normalizedDb) req.catalogDbTarget = normalizedDb;
    else if (req.query && req.query.db) req.catalogDbTarget = req.query.db;
    if (sessionEmail) req.catalogLoggedUser = sessionEmail;
    else if (loggedUser) req.catalogLoggedUser = loggedUser;

    let rewrittenPath = '';
    let targetMethod = req.method;

    const appendId = (idSegment, verb) => {
      if (!idSegment) {
        res.status(400).json({ error: `ID segment is required for ${operation}.` });
        return null;
      }
      const id = safeDecode(idSegment);
      const sanitizedId = (id || '').replace(/'/g, "''");
      rewrittenPath = `/${entitySegment}('${sanitizedId}')`;
      targetMethod = verb;
      return true;
    };

    if (operation === 'getall') {
      rewrittenPath = `/${entitySegment}`;
      targetMethod = 'GET';
    } else if (operation === 'getbyid') {
      if (!appendId(remaining[0], 'GET')) return;
    } else if (operation === 'create') {
      rewrittenPath = `/${entitySegment}`;
      targetMethod = 'POST';
    } else if (operation === 'update') {
      if (!appendId(remaining[0], 'PUT')) return;
    } else if (operation === 'patch') {
      if (!appendId(remaining[0], 'PATCH')) return;
    } else if (operation === 'delete') {
      if (!appendId(remaining[0], 'DELETE')) return;
    }

    const queryString = searchParams.toString();
    req.catalogRewrittenPath = rewrittenPath;
    req.url = queryString ? `${rewrittenPath}?${queryString}` : rewrittenPath;
    req.method = targetMethod;

    next();
  });
};
