const mongoose = require('mongoose');

const optionChainSnapshotSchema = new mongoose.Schema({
  underlying_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instrument',
    required: true
  },
  ts: {
    type: Date,
    required: true
  }
}, { timestamps: true });

const OptionChainSnapshot = mongoose.model('OptionChainSnapshot', optionChainSnapshotSchema);

module.exports = OptionChainSnapshot;