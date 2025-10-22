const mongoose = require('mongoose');

/**
 * RiskLimit
 * Configura topes operativos por cuenta para proteger contra desviaciones de riesgo.
 */
module.exports = mongoose.models.RiskLimit || mongoose.model('RiskLimit',
  new mongoose.Schema({
    // Cuenta monitoreada. Se mantiene unico para aplicar un perfil por cuenta.
    account: { type: String, unique: true, required: true },
    // Perdida diaria maxima antes de bloquear operaciones.
    max_daily_loss: Number,
    // Valor nocional maximo permitido en posiciones abiertas.
    max_position_value: Number,
    // Tamaño maximo por orden.
    max_order_size: Number,
    // Limites en griegas para estrategias de opciones.
    max_gamma: Number,
    max_vega: Number,
    // Auditoria.
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
);
