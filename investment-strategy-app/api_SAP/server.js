//Server.js
const express = require('express');
const cds = require('@sap/cds');
const cors = require('cors');
//USANDO CORS PARA PERMITIR PETICIONES DESDE OTROS DOMINIOS
module.exports = async (options) => {
  try {
    const app = express();
    app.use(express.json({ limit: '500kb' }));
    app.use(cors());
// Middleware para manejar errores JSON inválidos 
    app.get('/', (req, res) => {
      res.end(`SAP CDS está en ejecución en ${req.url}`);
    });

    // Iniciar el servidor CDS
    options.app = app;
    options.app.httpServer = await cds.server(options);
    return options.app.httpServer;
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};
