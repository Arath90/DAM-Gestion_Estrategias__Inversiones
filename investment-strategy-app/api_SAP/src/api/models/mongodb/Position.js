const mongoose = require('mongoose');

module.exports = mongoose.models.Position || mongoose.model('Position',
  new mongoose.Schema({
    account: { type: String, required: true, index: true },
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true }, // minúscula
    qty: { type: Number, required: true },
    avg_price: { type: Number, required: true, min: 0 },
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ account: 1, instrument_id: 1 }, { unique: true })
);
