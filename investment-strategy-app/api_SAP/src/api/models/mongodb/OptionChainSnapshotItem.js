const mongoose = require('mongoose');

module.exports = mongoose.models.OptionChainSnapshotItem || mongoose.model('OptionChainSnapshotItem',
  new mongoose.Schema({
    snapshot_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OptionChainSnapshot', required: true },
    option_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    strike: { type: Number, required: true },
    right: { type: String, enum: ['C','P'], required: true },
    expiration: { type: Date, required: true },
    bid: Number,
    ask: Number,
    iv: Number,
    delta: Number,
    gamma: Number,
    theta: Number,
    vega: Number
  }, { timestamps: true })
);
