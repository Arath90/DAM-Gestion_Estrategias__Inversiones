const mongoose = require('mongoose');

/**
 * MLModel
 * Versiona modelos entrenados, registrando algoritmo, metrica y explicabilidad.
 */
module.exports = mongoose.models.MLModel || mongoose.model('MLModel',
  new mongoose.Schema({
    // Nombre descriptivo del modelo entrenado.
    name: { type: String, required: true },
    // Algoritmo o arquitectura (ej. "xgboost", "lstm").
    algo: { type: String, required: true },
    // Fecha en que se completo el entrenamiento.
    trainedAt: { type: Date, default: Date.now },
    // Metricas de evaluacion almacenadas como JSON dinamico.
    metricsJson: mongoose.Schema.Types.Mixed,
    // Importancias de features u otras señales explicativas (JSON flexible).
    featureImportance: mongoose.Schema.Types.Mixed
  }, { timestamps: true })
);
