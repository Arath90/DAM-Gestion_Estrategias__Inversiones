const mongoose = require('mongoose');

const optionChainSnapshotItemSchema = new mongoose.Schema({
  snapshot_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OptionChainSnapshot',
    required: true
  },
  option_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instrument',
    required: true
  },
  strike: {
    type: Number,
    required: true
  },
  right: {
    type: String,
    enum: ['C', 'P'],
    required: true
  },
  expiration: {
    type: Date,
    required: true
  },
  bid: {
    type: Number
  },
  ask: {
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
  }
}, { timestamps: true });

const OptionChainSnapshotItem = mongoose.model('OptionChainSnapshotItem', optionChainSnapshotItemSchema);

module.exports = OptionChainSnapshotItem;