const mongoose = require('mongoose');

/**
 * DailyPnl
 * Consolida ganancias y perdidas por cuenta a nivel diario.
 * Se usa para dashboards y controles de riesgo historico.
 */
module.exports = mongoose.models.DailyPnl || mongoose.model('DailyPnl',
  new mongoose.Schema({
    // Cuenta o portfolio al que corresponde el registro. String permite usar trim e indices textuales.
    account: { type: String, required: true, trim: true },
    // Fecha contable (sin hora). Se usa Date para apoyar consultas por rango y timezone aware.
    date: { type: Date, required: true },
    // PnL realizado del dia. Number (double) para manejar centavos y operaciones aritmeticas.
    realized: { type: Number, default: 0 },
    // PnL no realizado (mark-to-market) en el cierre.
    unrealized: { type: Number, default: 0 },
    // Auditoria generada por Mongo (creado/actualizado).
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ account: 1, date: 1 }, { unique: true })
);
