const mongoose = require('mongoose');

/**
 * Execution
 * Detalla cada llenado proveniente del broker. Permite reconciliar ordenes y calcular PnL granular.
 */
module.exports = mongoose.models.Execution || mongoose.model('Execution',
  new mongoose.Schema({
    // Identificador unico del broker (ej. "ABC12345"). String para preservar formato textual.
    exec_id: { type: String, unique: true, required: true, trim: true },
    // Orden asociada. ObjectId enlaza con la coleccion Order.
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
    // Momento exacto de la ejecucion.
    ts: { type: Date, required: true, index: true },
    // Precio y cantidad ejecutada. Number (double) facilita calculos financieros.
    price: Number,
    qty: Number,
    // Costos de la ejecucion y PnL incremental.
    commission: { type: Number, default: 0 },
    pnl: { type: Number, default: 0 },
    // Auditoria Mongo.
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ order_id: 1, ts: -1 })
);
