const mongoose = require('mongoose');

const riskLimitSchema = new mongoose.Schema({
  account: {
    type: String,
    required: true,
    unique: true
  },
  max_daily_loss: {
    type: Number,
    required: true
  },
  max_position_value: {
    type: Number,
    required: true
  },
  max_order_size: {
    type: Number,
    required: true
  },
  max_gamma: {
    type: Number,
    required: true
  },
  max_vega: {
    type: Number,
    required: true
  }
}, { timestamps: true });

const RiskLimit = mongoose.model('RiskLimit', riskLimitSchema);

module.exports = RiskLimit;