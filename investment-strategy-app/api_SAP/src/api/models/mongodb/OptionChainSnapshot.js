const mongoose = require('mongoose');

module.exports = mongoose.models.OptionChainSnapshot || mongoose.model('OptionChainSnapshot',
  new mongoose.Schema({
    underlying_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    ts: { type: Date, required: true }
  }, { timestamps: true })
);
