const mongoose = require('mongoose');

/**
 * OptionChainSnapshot
 * Representa la fotografia completa de una cadena de opciones en un instante dado.
 */
module.exports = mongoose.models.OptionChainSnapshot || mongoose.model('OptionChainSnapshot',
  new mongoose.Schema({
    // Instrumento subyacente (ObjectId). Se indexa para consultar historicos por activo.
    underlying_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    // Timestamp del snapshot; Date para conservar zona horaria y precision.
    ts: { type: Date, required: true }
  }, { timestamps: true })
);
