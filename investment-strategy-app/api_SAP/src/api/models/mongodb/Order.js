const mongoose = require('mongoose');

module.exports = mongoose.models.Order || mongoose.model('Order',
  new mongoose.Schema({
    ib_order_id: Number,
    client_oid: { type: String, unique: true, sparse: true, trim: true },
    parent_client_oid: { type: String, index: true, trim: true },
    account: { type: String, required: true },
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true }, // minúscula
    side: { type: String, enum: ['BUY','SELL'], required: true },
    order_type: { type: String, enum: ['MKT','LMT','STP','STP_LMT','MOC','LOC'], required: true },
    qty: { type: Number, required: true, min: 0 },
    limit_price: { type: Number, min: 0 },
    aux_price: { type: Number, min: 0 },
    tif: { type: String, enum: ['DAY','GTC','GTD'], default: 'DAY' },
    status: { type: String, enum: ['NEW','PENDING','PARTIALLY_FILLED','FILLED','CANCELED','REJECTED'], default: 'NEW', index: true },
    placed_at: { type: Date, default: Date.now, index: true },
    last_update: Date,
    meta: mongoose.Schema.Types.Mixed,
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ account: 1, placed_at: -1 })
);
