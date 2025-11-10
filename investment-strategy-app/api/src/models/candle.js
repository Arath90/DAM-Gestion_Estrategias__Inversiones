import mongoose from 'mongoose';

const candleSchema = new mongoose.Schema({
  instrument_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instrument',
    required: true
  },
  bar_size: {
    type: String,
    required: true
  },
  ts: {
    type: Date,
    required: true
  },
  open: {
    type: Number
  },
  high: {
    type: Number
  },
  low: {
    type: Number
  },
  close: {
    type: Number
  },
  volume: {
    type: Number
  },
  wap: {
    type: Number
  },
  trade_count: {
    type: Number
  }
}, { timestamps: true });

const Candle = mongoose.model('Candle', candleSchema);

export default Candle;


/*const mongoose = require('mongoose');

const candleSchema = new mongoose.Schema({
  instrument_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instrument',
    required: true
  },
  bar_size: {
    type: String,
    required: true
  },
  ts: {
    type: Date,
    required: true
  },
  open: {
    type: Number
  },
  high: {
    type: Number
  },
  low: {
    type: Number
  },
  close: {
    type: Number
  },
  volume: {
    type: Number
  },
  wap: {
    type: Number
  },
  trade_count: {
    type: Number
  }
}, { timestamps: true });

const Candle = mongoose.model('Candle', candleSchema);

module.exports = Candle;*/ 