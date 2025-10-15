const mongoose = require('mongoose');

module.exports = mongoose.models.Candle || mongoose.model('Candle',
  new mongoose.Schema({
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true }, // minúscula
    bar_size: { type: String, required: true, index: true },
    ts: { type: Date, required: true, index: true },
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number,
    wap: Number,
    trade_count: Number,
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ instrument_id: 1, bar_size: 1, ts: 1 }, { unique: true })
);
