const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  ib_order_id: { type: Number, required: true },
  client_oid: { type: String, unique: true },
  parent_client_oid: { type: String },
  account: { type: String, required: true },
  instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
  side: { type: String, enum: ['BUY', 'SELL'], required: true },
  order_type: { type: String, required: true },
  qty: { type: Number, required: true },
  limit_price: { type: Number },
  aux_price: { type: Number },
  tif: { type: String, enum: ['DAY', 'GTC', 'GTD'] },
  status: { type: String, required: true },
  placed_at: { type: Date, default: Date.now },
  last_update: { type: Date },
  meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;