const mongoose = require('mongoose');

/**
 * Position
 * Foto actual de las posiciones abiertas por cuenta e instrumento.
 */
module.exports = mongoose.models.Position || mongoose.model('Position',
  new mongoose.Schema({
    // Cuenta propietaria de la posicion.
    account: { type: String, required: true, index: true },
    // Instrumento referenciado, almacenado como ObjectId para usar populate.
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true },
    // Cantidad total en cartera. Number permite valores fraccionarios.
    qty: { type: Number, required: true },
    // Precio promedio ponderado de la posicion.
    avg_price: { type: Number, required: true, min: 0 },
    // Auditoria.
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ account: 1, instrument_id: 1 }, { unique: true })
);
