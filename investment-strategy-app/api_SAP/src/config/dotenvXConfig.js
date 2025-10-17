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
};
