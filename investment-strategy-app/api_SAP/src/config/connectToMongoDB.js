const mongoose = require('mongoose');
const cfg = require('./dotenvXConfig');

mongoose.set('debug', false);

(async () => {
  try {
    const conn = await mongoose.connect(cfg.CONNECTION_STRING, {
      dbName: cfg.DATABASE,
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ Mongo conectado:', conn.connection.name);
  } catch (err) {
    console.error('❌ Error Mongo:', err.message);
  }
  mongoose.connection.on('error', e => console.error('Mongo error:', e));
  mongoose.connection.on('disconnected', () => console.warn('Mongo disconnected'));
})();
