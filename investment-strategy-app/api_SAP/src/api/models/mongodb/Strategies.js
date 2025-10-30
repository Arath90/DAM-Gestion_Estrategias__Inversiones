const mongoose = require('mongoose');

const StrategySchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },

    // Requeridos por la lógica de negocio
    strategy_code: { type: String, required: true, index: true },
    dataset_id: { type: mongoose.Schema.Types.Mixed, ref: 'MLDataset', required: true, index: true },
    period_start: { type: Date, required: true, index: true },
    period_end:   { type: Date, required: true, index: true },

    // Campos que la UI ya envía/lee (opcionales)
    name: String,
    type: String,          // Regla / ML / Discrecional
    status: String,        // Draft / Live / Paused / Archived
    owner: String,
    frequency: String,     // 1D / 1H / Intradía
    capitalAllocated: Number,
    tags: [String],
    description: String,

    // JSON flexibles
    params_json: mongoose.Schema.Types.Mixed,
    metrics_json: mongoose.Schema.Types.Mixed,

    // Auditoría
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() }
  },
  { versionKey: false, minimize: false }
);

// Único por combinación clave
StrategySchema.index(
  { strategy_code: 1, dataset_id: 1, period_start: 1, period_end: 1 },
  { unique: true }
);

// Mantén updatedAt fresco
StrategySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});
StrategySchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Salida: mapear _id -> ID para el frontend
StrategySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.ID = String(ret._id);
    delete ret._id;
    return ret;
  }
});
StrategySchema.set('toObject', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.ID = String(ret._id);
    delete ret._id;
    return ret;
  }
});

module.exports = mongoose.models.Strategies || mongoose.model('Strategies', StrategySchema);
