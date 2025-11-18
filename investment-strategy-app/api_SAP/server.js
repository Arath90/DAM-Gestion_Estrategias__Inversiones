// server.js
const express = require('express');
const cds     = require('@sap/cds');
const cors    = require('cors');

const registerCatalogRouteRewriter = require('./src/api/middlewares/catalogRouteRewriter');
const registerSessionAuth = require('./src/api/middlewares/sessionAuth');
const registerAuthRoutes = require('./src/api/routes/auth.route');
const registerPublicCandlesRoute = require('./src/api/routes/candles-public.route');
const indicatorsRoute = require('./src/api/routes/indicators.route');
// 1) .env y Mongo ANTES de cds.server para que los servicios CAP usen las conexiones ya inicializadas.
require('@dotenvx/dotenvx').config();
require('./src/config/connectToMongoDB');

module.exports = async (o = {}) => {
  try {
    const app = express();
    app.use('/api', indicatorsRoute);     // indicadores técnicos y utilidades públicas
    app.use(express.json({ limit: '500kb' })); // parseo de JSON defensivo
    app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: {
        message: 'Invalid JSON in request body',
        statusCode: 400,
        code: '400'
      }
    });
  }
  next(err);
});
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
      : true;

    app.use(cors({
      origin: allowedOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-Session-Token', 'X-Session', 'X-Requested-With'],
      exposedHeaders: ['X-Session-Token'],
    }));

    registerAuthRoutes(app);            // /api/auth -> login/register/logout (sin protección)
    registerSessionAuth(app);           // middleware global que protege /odata/* con token
    registerCatalogRouteRewriter(app);  // traduce rutas friendly a OData
    registerPublicCandlesRoute(app);    // endpoint público histórico que queda abierto

    o.app = app;                       // expón express a CAP
    const srv = await cds.server(o);   // arranca CAP

    return srv;
  } catch (err) {
    console.error('Error starting server', err);
    process.exit(1);
  }
};
