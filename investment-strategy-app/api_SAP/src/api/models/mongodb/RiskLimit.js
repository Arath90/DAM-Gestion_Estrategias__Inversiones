const mongoose = require('mongoose');

module.exports = mongoose.models.RiskLimit || mongoose.model('RiskLimit',
  new mongoose.Schema({
    account: { type: String, unique: true, required: true },
    max_daily_loss: Number,
    max_position_value: Number,
    max_order_size: Number,
    max_gamma: Number,
    max_vega: Number,
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
);
