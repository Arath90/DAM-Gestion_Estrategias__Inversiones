const mongoose = require('mongoose');

const executionSchema = new mongoose.Schema({
  exec_id: { type: String, required: true, unique: true },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  ts: { type: Date, required: true },
  price: { type: Number },
  qty: { type: Number },
  commission: { type: Number },
  pnl: { type: Number }
}, { timestamps: true });

const Execution = mongoose.model('Execution', executionSchema);

module.exports = Execution;