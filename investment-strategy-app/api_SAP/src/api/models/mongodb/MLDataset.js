const mongoose = require('mongoose');

/**
 * MLDataset
 * Describe datasets utilizados para entrenar modelos de machine learning (features, origen, configuraciones).
 */
module.exports = mongoose.models.MLDataset || mongoose.model('MLDataset',
  new mongoose.Schema({
    // Nombre legible unico para referenciar el dataset.
    name: { type: String, unique: true, required: true, trim: true },
    // Descripcion funcional; String por ser texto corto.
    description: String,
    // Esquema de features o parametros serializados. Mixed permite JSON arbitrario.
    spec_json: mongoose.Schema.Types.Mixed,
    // CONID relacionado cuando el dataset esta vinculado a un instrumento especifico.
    instrument_conid: Number,
    // Auditoria automatica.
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }, { versionKey: false })
);
