const mongoose = require('mongoose');

module.exports = mongoose.models.Signal || mongoose.model('Signal',
  new mongoose.Schema({
    strategy_code: { type: String, required: true, index: true },
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true }, // minúscula
    ts: { type: Date, required: true, index: true },
    action: { type: String, enum: ['BUY_CALL','SELL_PUT','OPEN_SPREAD','CLOSE_SPREAD','BUY','SELL'], required: true },
    moneyness: { type: String, enum: ['ITM','ATM','OTM'], required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    features_json: mongoose.Schema.Types.Mixed,
    rationale: { type: String, required: true },
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ strategy_code: 1, instrument_id: 1, ts: 1, action: 1 }, { unique: true })
);
