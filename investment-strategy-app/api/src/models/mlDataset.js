const mongoose = require('mongoose');

const mlDatasetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  spec_json: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
});

const MLDataset = mongoose.model('MLDataset', mlDatasetSchema);

module.exports = MLDataset;