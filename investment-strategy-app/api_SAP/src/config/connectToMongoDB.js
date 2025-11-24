const mongoose = require('mongoose');
const cfg = require('./dotenvXConfig');

mongoose.set('debug', false);

let cosmosConnection = null;

(async () => {
  try {
    const conn = await mongoose.connect(cfg.CONNECTION_STRING, {
      dbName: cfg.DATABASE,
      serverSelectionTimeoutMS: 10000,
    });
    console.log('�o. Mongo conectado:', conn.connection.name);
  } catch (err) {
    console.error('�?O Error Mongo:', err.message);
  }

  mongoose.connection.on('error', (e) => console.error('Mongo error:', e));
  mongoose.connection.on('disconnected', () => console.warn('Mongo disconnected'));

  if (!cfg.COSMOS_CONNECTION_STRING) {
    console.warn('[CosmosDB] COSMOS_CONNECTION_STRING no definido. Se omite la conexion secundaria.');
    return;
  }

  try {
    cosmosConnection = mongoose.createConnection(cfg.COSMOS_CONNECTION_STRING, {
      dbName: cfg.COSMOS_DATABASE,
      serverSelectionTimeoutMS: 10000,
    });

    cosmosConnection.asPromise()
      .then((conn) => {
        console.log('[CosmosDB] Conexion establecida con base:', conn.name);
      })
      .catch((err) => {
        console.error('[CosmosDB] Error al conectar:', err.message);
      });

    cosmosConnection.on('error', (e) => console.error('[CosmosDB] Error:', e));
    cosmosConnection.on('disconnected', () => console.warn('[CosmosDB] Conexion perdida'));
  } catch (err) {
    console.error('[CosmosDB] Error inesperado inicializando la conexion:', err.message);
    cosmosConnection = null;
  }
})();

module.exports = {
  getCosmosConnection: () => cosmosConnection,
};
