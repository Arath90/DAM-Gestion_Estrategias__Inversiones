const mongoose = require('mongoose');

module.exports = mongoose.models.Execution || mongoose.model('Execution',
  new mongoose.Schema({
    exec_id: { type: String, unique: true, required: true, trim: true },
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true }, // minúscula
    ts: { type: Date, required: true, index: true },
    price: Number,
    qty: Number,
    commission: { type: Number, default: 0 },
    pnl: { type: Number, default: 0 },
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ order_id: 1, ts: -1 })
);
