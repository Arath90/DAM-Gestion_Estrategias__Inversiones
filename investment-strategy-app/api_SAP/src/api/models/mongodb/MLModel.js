const mongoose = require('mongoose');

module.exports = mongoose.models.MLModel || mongoose.model('MLModel',
  new mongoose.Schema({
    name: { type: String, required: true },
    algo: { type: String, required: true },
    trainedAt: { type: Date, default: Date.now },
    metricsJson: mongoose.Schema.Types.Mixed,
    featureImportance: mongoose.Schema.Types.Mixed
  }, { timestamps: true })
);
