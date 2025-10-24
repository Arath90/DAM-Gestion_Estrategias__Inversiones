'use strict';

const { getSession } = require('../services/session.service');

// Busca el token en headers, query o body. Permitimos varios alias para flexibilidad.
const pickToken = (req) =>
  req.headers['x-session-token'] ||
  req.headers['x-session'] ||
  req.query?.sessionToken ||
  req.query?.token ||
  req.body?.sessionToken ||
  null;

// Solo protegemos las rutas CAP (/odata/v4/catalog). El resto (candles públicos y auth) queda libre.
const shouldGuard = (req) => {
  if (!req || typeof req.path !== 'string') return false;
  return req.path.startsWith('/odata/v4/catalog');
};

module.exports = function registerSessionAuth(app) {
  if (!app || typeof app.use !== 'function') return;

  app.use((req, res, next) => {
    if (!shouldGuard(req) || req.method === 'OPTIONS') return next();

    const token = pickToken(req);
    const session = getSession(token);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Sesion requerida o expirada.',
      });
    }

    // Guardamos info para las capas siguientes (CAP, controllers, etc.).
    req.sessionToken = token;
    req.sessionUser = session.user;

    if (session.user?.email) {
      // CAP espera LoggedUser por header/query, así que lo rellenamos aquí.
      req.headers['x-logged-user'] = session.user.email;
      if (req.query) req.query.LoggedUser = req.query.LoggedUser || session.user.email;
    }

    return next();
  });
};
