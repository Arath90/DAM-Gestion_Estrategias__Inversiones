const mongoose = require('mongoose');

/**
 * AlgorithmSetting
 * Preferencias de algoritmos por usuario y alcance (estrategia o instrumento).
 */
const AlgorithmSettingSchema = new mongoose.Schema(
  {
    user_email: { type: String, required: true, index: true },
    scope_type: { type: String, required: true, enum: ['strategy', 'instrument'], index: true },
    scope_ref: { type: String, required: true },
    strategy_id: { type: String },
    instrument_key: { type: String },
    interval: { type: String },
    params_json: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, minimize: false }
);

AlgorithmSettingSchema.index(
  { user_email: 1, scope_type: 1, scope_ref: 1 },
  { unique: true }
);

AlgorithmSettingSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (!this.createdAt) this.createdAt = new Date();
  next();
});

AlgorithmSettingSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

AlgorithmSettingSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.ID = String(ret._id);
    delete ret._id;
    return ret;
  },
});
AlgorithmSettingSchema.set('toObject', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.ID = String(ret._id);
    delete ret._id;
    return ret;
  },
});

module.exports =
  mongoose.models.AlgorithmSetting ||
  mongoose.model('AlgorithmSetting', AlgorithmSettingSchema);
