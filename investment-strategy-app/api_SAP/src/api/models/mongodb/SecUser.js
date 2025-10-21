const mongoose = require('mongoose');

module.exports = mongoose.models.SecUser || mongoose.model('SecUser',
  new mongoose.Schema({
    name: { type: String, required: true, index: true },
    email: { type: String,required: true, index: true },
    pass: { type: String, required: true },
    createdAt: Date,
    updatedAt: Date
  },{ versionKey: false }));
