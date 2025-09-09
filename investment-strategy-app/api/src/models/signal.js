const mongoose = require('mongoose');

const signalSchema = new mongoose.Schema({
  strategy_code: {
    type: String,
    required: true
  },
  instrument_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instrument',
    required: true
  },
  ts: {
    type: Date,
    required: true
  },
  action: {
    type: String,
    enum: ['BUY_CALL', 'SELL_PUT', 'OPEN_SPREAD', 'CLOSE_SPREAD', 'BUY', 'SELL'],
    required: true
  },
  moneyness: {
    type: String,
    enum: ['ITM', 'ATM', 'OTM'],
    required: true
  },
  confidence: {
    type: Number,
    required: true
  },
  features_json: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  rationale: {
    type: String,
    required: true
  }
}, { timestamps: true });

const Signal = mongoose.model('Signal', signalSchema);

module.exports = Signal;