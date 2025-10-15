const mongoose = require('mongoose');

module.exports = mongoose.models.Backtest || mongoose.model('Backtest',
  new mongoose.Schema({
    strategy_code: { type: String, required: true, index: true },
    dataset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MLDataset', required: true, index: true }, // minúscula
    params_json: mongoose.Schema.Types.Mixed,
    period_start: { type: Date, required: true, index: true },
    period_end: { type: Date, required: true, index: true },
    metrics_json: mongoose.Schema.Types.Mixed,
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ strategy_code: 1, dataset_id: 1, period_start: 1, period_end: 1 }, { unique: true })
);
