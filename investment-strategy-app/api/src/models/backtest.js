const mongoose = require('mongoose');

const backtestSchema = new mongoose.Schema({
  strategy_code: {
    type: String,
    required: true
  },
  dataset_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MLDataset',
    required: true
  },
  params_json: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  period_start: {
    type: Date,
    required: true
  },
  period_end: {
    type: Date,
    required: true
  },
  metrics_json: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

const Backtest = mongoose.model('Backtest', backtestSchema);

module.exports = Backtest;