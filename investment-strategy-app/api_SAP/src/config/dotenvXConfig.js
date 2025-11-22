const dotenvx = require('@dotenvx/dotenvx');
dotenvx.config();
//src/config/dotenvXConfig.js
module.exports = {
  HOST: process.env.HOST || 'localhost',
  PORT: process.env.PORT || '4004',
  API_URL: process.env.API_URL || '/api/v1',

  // lee ambos nombres (nuevo y antiguo)
  CONNECTION_STRING:
    process.env.CONNECTION_STRING ||
    process.env.MONGODB_URI || // <-- tu .env actual
    '',

  DATABASE:
    process.env.DATABASE ||
    process.env.MONGODB_DB ||  
    'Inversiones',

  COSMOS_CONNECTION_STRING:
    process.env.COSMOS_CONNECTION_STRING ||
    process.env.AZURE_COSMOS_CONNECTION_STRING ||
    '',

  COSMOS_DATABASE:
    process.env.COSMOS_DATABASE ||
    process.env.AZURE_COSMOS_DATABASE ||
    'InversionesSignals',

  COSMOS_STRONG_SIGNALS_COLLECTION:
    process.env.COSMOS_STRONG_SIGNALS_COLLECTION ||
    process.env.AZURE_COSMOS_STRONG_SIGNALS_COLLECTION ||
    'StrongSignals',

  // Configuracion del proveedor externo de velas
  CANDLES_API_URL: process.env.CANDLES_API_URL || '',
  CANDLES_API_KEY: process.env.CANDLES_API_KEY || '',
  CANDLES_API_KEY_PARAM: process.env.CANDLES_API_KEY_PARAM || 'apikey',
  CANDLES_API_KEY_HEADER: process.env.CANDLES_API_KEY_HEADER || '',
  CANDLES_API_EXTRA_HEADERS: process.env.CANDLES_API_EXTRA_HEADERS || '', // formato: "Header: valor;Otro: valor"
  CANDLES_API_DEFAULT_QUERY: process.env.CANDLES_API_DEFAULT_QUERY || '',
};
