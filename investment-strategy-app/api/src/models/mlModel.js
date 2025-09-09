const mongoose = require('mongoose');

const mlModelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  algo: { type: String, required: true },
  trainedAt: { type: Date, default: Date.now },
  metricsJson: { type: mongoose.Schema.Types.Mixed },
  featureImportance: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

const MLModel = mongoose.model('MLModel', mlModelSchema);

module.exports = MLModel;