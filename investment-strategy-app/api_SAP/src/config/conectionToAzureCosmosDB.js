// src/config/conectionToAzureCosmosDB.js
// Inicializa un cliente de Azure Cosmos DB usando @azure/cosmos
const { CosmosClient } = require('@azure/cosmos');
const cfg = require('./dotenvXConfig');

let client = null;
let database = null;

if (cfg.COSMOSDB_ENDPOINT && cfg.COSMOSDB_KEY) {
  client = new CosmosClient({
    endpoint: cfg.COSMOSDB_ENDPOINT,
    key: cfg.COSMOSDB_KEY,
  });

  database = client.database(cfg.COSMOSDB_DATABASE);

  client
    .getDatabaseAccount()
    .then(() => {
      console.log('[CosmosDB] Database connected:', database.id);
    })
    .catch((error) => {
      console.error('[CosmosDB] Error connecting:', error);
    });
} else {
  console.warn('[CosmosDB] Variables de entorno incompletas. Conexion no inicializada.');
}

module.exports = {
  client,
  conectionAzureCosmosDB: (containerName = cfg.COSMOSDB_CONTAINER) => {
    if (!client || !containerName) {
      throw new Error('Cosmos DB client not initialized or containerName missing.');
    }
    return client.database(cfg.COSMOSDB_DATABASE).container(containerName);
  },
};
