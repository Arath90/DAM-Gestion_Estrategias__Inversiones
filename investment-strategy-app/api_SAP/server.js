// server.js
const express = require('express');
const cds     = require('@sap/cds');
const cors    = require('cors');

const registerCatalogRouteRewriter = require('./src/api/middlewares/catalogRouteRewriter');

// 1) .env y Mongo ANTES de cds.server
require('@dotenvx/dotenvx').config();
require('./src/config/connectToMongoDB');

module.exports = async (o = {}) => {
  try {
    const app = express();
    app.use(express.json({ limit: '500kb' }));
    app.use(cors());
    registerCatalogRouteRewriter(app);

    o.app = app;                       // expón express a CAP
    const srv = await cds.server(o);   // arranca CAP

    return srv;
  } catch (err) {
    console.error('Error starting server', err);
    process.exit(1);
  }
};
