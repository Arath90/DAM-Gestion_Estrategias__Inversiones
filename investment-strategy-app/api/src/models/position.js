const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  account: {
    type: String,
    required: true
  },
  instrument_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instrument',
    required: true
  },
  qty: {
    type: Number,
    required: true
  },
  avg_price: {
    type: Number,
    required: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Position = mongoose.model('Position', positionSchema);

module.exports = Position;