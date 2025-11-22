const mongoose = require('mongoose');
const { getCosmosConnection } = require('../../../config/connectToMongoDB');
const cfg = require('../../../config/dotenvXConfig');

const strongSignalSchema = new mongoose.Schema({
  strategy_code: { type: String, required: true, index: true },
  instrument_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  divergence_type: { type: String, enum: ['bullish', 'bearish'], required: true },
  ts: { type: Date, required: true, index: true },
  timeframe: { type: String },
  score: { type: Number, default: 0 },
  price_delta_pct: { type: Number },
  indicator_delta_pct: { type: Number },
  confidence: { type: Number, min: 0, max: 1, default: 0.5 },
  features_json: mongoose.Schema.Types.Mixed,
  createdAt: Date,
  updatedAt: Date,
}, { versionKey: false });

strongSignalSchema.index({ instrument_id: 1, ts: -1 });
strongSignalSchema.index({ strategy_code: 1, score: -1 });

const cosmosConn = getCosmosConnection && getCosmosConnection();

if (cosmosConn && typeof cosmosConn.model === 'function') {
  module.exports = cosmosConn.models.StrongSignal
    || cosmosConn.model('StrongSignal', strongSignalSchema, cfg.COSMOS_STRONG_SIGNALS_COLLECTION);
} else {
  console.warn('[CosmosDB] StrongSignal usando la conexión primaria de Mongo (modo fallback).');
  module.exports = mongoose.models.StrongSignal
    || mongoose.model('StrongSignal', strongSignalSchema);
}
