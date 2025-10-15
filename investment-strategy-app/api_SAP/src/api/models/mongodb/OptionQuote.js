const mongoose = require('mongoose');

module.exports = mongoose.models.OptionQuote || mongoose.model('OptionQuote',
  new mongoose.Schema({
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    ts: { type: Date, required: true },
    bid: Number,
    ask: Number,
    last: Number,
    bid_size: Number,
    ask_size: Number,
    last_size: Number,
    iv: Number,
    delta: Number,
    gamma: Number,
    theta: Number,
    vega: Number,
    opt_price: Number,
    und_price: Number
  }, { timestamps: true })
);
