const mongoose = require('mongoose');

const optionQuoteSchema = new mongoose.Schema({
  instrument_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instrument',
    required: true
  },
  ts: {
    type: Date,
    required: true
  },
  bid: {
    type: Number
  },
  ask: {
    type: Number
  },
  last: {
    type: Number
  },
  bid_size: {
    type: Number
  },
  ask_size: {
    type: Number
  },
  last_size: {
    type: Number
  },
  iv: {
    type: Number
  },
  delta: {
    type: Number
  },
  gamma: {
    type: Number
  },
  theta: {
    type: Number
  },
  vega: {
    type: Number
  },
  opt_price: {
    type: Number
  },
  und_price: {
    type: Number
  }
}, { timestamps: true });

const OptionQuote = mongoose.model('OptionQuote', optionQuoteSchema);

module.exports = OptionQuote;