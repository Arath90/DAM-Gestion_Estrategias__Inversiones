const mongoose = require('mongoose');

/**
 * OptionChainSnapshotItem
 * Detalla cada contrato dentro de un snapshot de cadena de opciones.
 * Se guarda separado para permitir consultas por strike/derecho sin traer todo el snapshot.
 */
module.exports = mongoose.models.OptionChainSnapshotItem || mongoose.model('OptionChainSnapshotItem',
  new mongoose.Schema({
    // Snapshot padre. ObjectId para relacionar rapidamente.
    snapshot_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OptionChainSnapshot', required: true },
    // Instrumento opcion especifico.
    option_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    // Precio de ejercicio, Number doble para soportar decimales.
    strike: { type: Number, required: true },
    // Derecho: Call (C) o Put (P). Se limita via enum.
    right: { type: String, enum: ['C', 'P'], required: true },
    // Fecha de expiracion (solo fecha).
    expiration: { type: Date, required: true },
    // Bid/ask y griegas como Number para permitir agregaciones y visualizaciones.
    bid: Number,
    ask: Number,
    iv: Number,
    delta: Number,
    gamma: Number,
    theta: Number,
    vega: Number
  }, { timestamps: true })
);
