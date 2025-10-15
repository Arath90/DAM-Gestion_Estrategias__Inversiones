const mongoose = require('mongoose');

module.exports = mongoose.models.MLDataset || mongoose.model('MLDataset',
  new mongoose.Schema({
    name: { type: String, unique: true, required: true, trim: true },
    description: String,
    spec_json: mongoose.Schema.Types.Mixed,
    instrument_conid: Number,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }, { versionKey: false })
);
