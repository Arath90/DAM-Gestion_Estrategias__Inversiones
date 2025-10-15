const mongoose = require('mongoose');

module.exports = mongoose.models.DailyPnl || mongoose.model('DailyPnl',
  new mongoose.Schema({
    account: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    realized: { type: Number, default: 0 },
    unrealized: { type: Number, default: 0 },
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ account: 1, date: 1 }, { unique: true })
);
