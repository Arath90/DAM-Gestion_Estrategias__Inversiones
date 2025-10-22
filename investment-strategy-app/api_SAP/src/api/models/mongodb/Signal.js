const mongoose = require('mongoose');

/**
 * Signal
 * Señales generadas por estrategias cuantitativas. Alimentan dashboards y pipelines de ejecucion automatica.
 */
module.exports = mongoose.models.Signal || mongoose.model('Signal',
  new mongoose.Schema({
    // Codigo de la estrategia que emitio la señal.
    strategy_code: { type: String, required: true, index: true },
    // Instrumento objetivo. ObjectId permite usar populate hacia Instrument.
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true },
    // Momento exacto en el que se genero la señal.
    ts: { type: Date, required: true, index: true },
    // Accion recomendada. Enum acota los valores validos (BUY, SELL, opciones...).
    action: { type: String, enum: ['BUY_CALL', 'SELL_PUT', 'OPEN_SPREAD', 'CLOSE_SPREAD', 'BUY', 'SELL'], required: true },
    // Relacion con el subyacente (ITM/ATM/OTM) almacenada como etiqueta textual.
    moneyness: { type: String, enum: ['ITM', 'ATM', 'OTM'], required: true },
    // Nivel de confianza entre 0 y 1 para calibrar ejecucion automatica.
    confidence: { type: Number, min: 0, max: 1, required: true },
    // Caracteristicas utilizadas por el modelo; Mixed sirve para almacenar JSON arbitrario.
    features_json: mongoose.Schema.Types.Mixed,
    // Justificacion textual para usuarios humanos.
    rationale: { type: String, required: true },
    // Auditoria.
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ strategy_code: 1, instrument_id: 1, ts: 1, action: 1 }, { unique: true })
);
