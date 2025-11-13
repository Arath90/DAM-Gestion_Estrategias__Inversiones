const mongoose = require('mongoose');

/**
 * MLModel
 * Versiona modelos entrenados y describe configuraciones (datasets, componentes).
 */
module.exports =
  mongoose.models.MLModel ||
  mongoose.model(
    'MLModel',
    new mongoose.Schema(
      {
        // Nombre descriptivo del modelo entrenado o contenedor.
        name: { type: String, required: true },
        // Algoritmo o arquitectura (ej. "xgboost", "lstm") o tipo lógico.
        algo: { type: String, required: true },
        // Fecha en que se completó el entrenamiento o última actualización.
        trainedAt: { type: Date, default: Date.now },
        // Métricas de evaluación almacenadas como JSON dinámico.
        metricsJson: mongoose.Schema.Types.Mixed,
        // Importancias de features u otras señales explicativas (JSON flexible).
        featureImportance: mongoose.Schema.Types.Mixed,
        // Clasificación del registro (TRAINED_MODEL, DATASET_COMPONENTS, etc.).
        model_type: { type: String, default: 'TRAINED_MODEL', index: true },
        // Referencia al dataset asociado cuando el modelo describe componentes.
        dataset_id: { type: mongoose.Schema.Types.Mixed, index: true },
        dataset_name: { type: String },
        // Componentes/indicadores serializados (JSON flexible).
        components_json: mongoose.Schema.Types.Mixed,
        // Metadata adicional (ej. specMeta del dataset).
        metadata_json: mongoose.Schema.Types.Mixed,
      },
      { timestamps: true }
    )
  );

