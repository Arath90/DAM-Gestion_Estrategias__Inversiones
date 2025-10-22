const mongoose = require('mongoose');

/**
 * Backtest
 * Guarda la ejecucion historica de una estrategia de trading sobre un dataset concreto.
 * La estructura permanece flexible (params_json/metrics_json) por lo que se usa Mongo para almacenar JSON arbitrario.
 */
module.exports = mongoose.models.Backtest || mongoose.model('Backtest',
  new mongoose.Schema({
    strategy_code: { type: String, required: true, index: true },
    // Se apoya en ObjectId porque enlaza directamente con la coleccion MLDataset.
    dataset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MLDataset', required: true, index: true },
    // Parametros utilizados durante el run (JSON dinamico). Se usa Mixed para admitir estructuras flexibles.
    params_json: mongoose.Schema.Types.Mixed,
    // Inicio y fin del periodo evaluado; Date preserva fecha y hora para recrear el backtest.
    period_start: { type: Date, required: true, index: true },
    period_end: { type: Date, required: true, index: true },
    // Resultados (KPIs) generados por la estrategia. Mixed permite diferentes formatos de salida.
    metrics_json: mongoose.Schema.Types.Mixed,
    // Auditoria generada por Mongo (se almacenan tal cual para trazabilidad).
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ strategy_code: 1, dataset_id: 1, period_start: 1, period_end: 1 }, { unique: true })
);
