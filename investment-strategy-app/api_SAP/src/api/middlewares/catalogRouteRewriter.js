'use strict';
// src/api/middlewares/catalogRouteRewriter.js
const { URLSearchParams } = require('url');

function safeDecode(value) {
  if (typeof value !== 'string') return value;
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

function normalizeDb(value) {
  if (!value) return null;
  const decoded = safeDecode(value).trim().toLowerCase();
  if (!decoded) return null;
  if (decoded === 'mongodb' || decoded === 'mongo' || decoded === 'mongo-db') return 'mongo';
  if (decoded === 'hana') return 'hana';
  return decoded;
}

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

module.exports = function registerCatalogRouteRewriter(app) {
  if (!app || typeof app.use !== 'function') return;

  app.use('/odata/v4/catalog', (req, res, next) => {
    const segments = req.path.split('/').filter(Boolean);
    if (!segments.length) return next();

    const operation = (segments[0] || '').toLowerCase();
    // soportar más verbos además de get*
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
    if (loggedUser && !searchParams.has('loggedUser')) searchParams.set('loggedUser', loggedUser);

    req.query = Object.fromEntries(searchParams.entries());
    if (normalizedDb) req.catalogDbTarget = normalizedDb;
    else if (req.query && req.query.db) req.catalogDbTarget = req.query.db;
    if (loggedUser) req.catalogLoggedUser = loggedUser;

    let rewrittenPath = '';
    // determinar método HTTP a aplicar en base a la operación
    let targetMethod = req.method; // por defecto mantener el método original si se prefiere
    if (operation === 'getall') {
      rewrittenPath = `/${entitySegment}`;
      targetMethod = 'GET';
    } else if (operation === 'getbyid') {
      const idSegment = remaining[0];
      if (!idSegment) {
        res.status(400).json({ error: 'ID segment is required for getById.' });
        return;
      }
      const id = safeDecode(idSegment);
      const sanitizedId = (id || '').replace(/'/g, "''");
      rewrittenPath = `/${entitySegment}('${sanitizedId}')`;
      targetMethod = 'GET';
    } else if (operation === 'create') {
      rewrittenPath = `/${entitySegment}`;
      targetMethod = 'POST';
    } else if (operation === 'update') {
      const idSegment = remaining[0];
      if (!idSegment) {
        res.status(400).json({ error: 'ID segment is required for update.' });
        return;
      }
      const id = safeDecode(idSegment);
      const sanitizedId = (id || '').replace(/'/g, "''");
      rewrittenPath = `/${entitySegment}('${sanitizedId}')`;
      targetMethod = 'PUT';
    } else if (operation === 'patch') {
      const idSegment = remaining[0];
      if (!idSegment) {
        res.status(400).json({ error: 'ID segment is required for patch.' });
        return;
      }
      const id = safeDecode(idSegment);
      const sanitizedId = (id || '').replace(/'/g, "''");
      rewrittenPath = `/${entitySegment}('${sanitizedId}')`;
      targetMethod = 'PATCH';
    } else if (operation === 'delete') {
      const idSegment = remaining[0];
      if (!idSegment) {
        res.status(400).json({ error: 'ID segment is required for delete.' });
        return;
      }
      const id = safeDecode(idSegment);
      const sanitizedId = (id || '').replace(/'/g, "''");
      rewrittenPath = `/${entitySegment}('${sanitizedId}')`;
      targetMethod = 'DELETE';
    }

    const queryString = searchParams.toString();
    req.catalogRewrittenPath = rewrittenPath;
    req.url = queryString ? `${rewrittenPath}?${queryString}` : rewrittenPath;
    // actualizar el método para que Express/otros middlewares lo procesen correctamente
    req.method = targetMethod;

    next();
  });
};
