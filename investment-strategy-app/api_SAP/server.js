const express = require('express');
const cds = require('@sap/cds');
const cors = require('cors');

module.exports = async (options) => {
  try {
    const app = express();
    app.use(express.json({ limit: '500kb' }));
    app.use(cors());

    // landing simple
    app.get('/', (req, res) => {
      res.end(`SAP CDS está en ejecución en ${req.url}`);
    });

    // expón un router propio si necesitas paths fuera de OData
    // const router = express.Router();
    // app.use('/api', router);

    // integra CAP
    options.app = app;
    options.app.httpServer = await cds.server(options);

    return options.app.httpServer;
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};
