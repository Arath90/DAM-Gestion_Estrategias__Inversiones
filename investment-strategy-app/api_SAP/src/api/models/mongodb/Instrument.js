// src/api/models/mongodb/Instrument.js
const mongoose = require('mongoose');

module.exports = mongoose.models.Instrument || mongoose.model(
  'Instrument',
  new mongoose.Schema({
    ib_conid: { type: Number, unique: true, required: true },
    symbol:   { type: String, required: true },
    sec_type: { type: String, required: true },
    exchange: String, currency: String, multiplier: String,
    last_trade_date: Date, trading_class: String, underlying_conid: Number,
    created_at: { type: Date, default: Date.now }
  }, { versionKey: false })
);
