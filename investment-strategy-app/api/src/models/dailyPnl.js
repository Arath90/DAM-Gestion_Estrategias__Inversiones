const mongoose = require('mongoose');

const dailyPnlSchema = new mongoose.Schema({
  account: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: Date,
    required: true
  },
  realized_pnl: {
    type: Number,
    required: true
  },
  unrealized_pnl: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

const DailyPnl = mongoose.model('DailyPnl', dailyPnlSchema);

module.exports = DailyPnl;