## API_SAP - Integración con Azure Cosmos DB

- Configura las variables `COSMOSDB_ENDPOINT`, `COSMOSDB_KEY`, `COSMOSDB_DATABASE` y `COSMOSDB_CONTAINER` en `.env` (ya están referenciadas por `src/config/dotenvXConfig.js`).
- Instala las dependencias actualizadas (`@azure/cosmos`) ejecutando `npm install` dentro de `api_SAP`.
- La conexión se inicializa en `src/config/conectionToAzureCosmosDB.js` y queda disponible tanto para las rutas Express (`/api/strong-signals`) como para la entidad OData `StrongSignals`.
- Todas las operaciones OData sobre `StrongSignals` se atienden desde Cosmos DB; recuerda incluir `ProcessType` en las llamadas CAP igual que con las demás entidades.
- El pipeline queda unificado:
  - `analyzeRSIAndDivergences/analyzeIndicators` pueden activar `persistStrong` (desde el backend o pasando flags en `/api/indicators/analytics`) para enviar automáticamente las divergencias fuertes a Cosmos.
  - El frontend puede seguir generando registros manuales vía `POST /api/strong-signals`.
  - Desde CAP/OData, la entidad `StrongSignals` y la acción `DetectDivergences` permiten crear/leer/actualizar/eliminar y además disparar la persistencia en Cosmos cuando `persistStrong` e `instrument_id` vienen en la petición.
