const mongoose = require('mongoose');

const newsArticleSchema = new mongoose.Schema({
  provider_code: {
    type: String,
    required: true,
  },
  article_id: {
    type: String,
    required: true,
  },
  symbol: {
    type: String,
    required: true,
  },
  conid: {
    type: Number,
    required: true,
  },
  published_at: {
    type: Date,
    required: true,
  },
  headline: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  sentiment: {
    type: Number,
    min: -1,
    max: 1,
  },
  topics: {
    type: [String],
  },
}, { timestamps: true });

const NewsArticle = mongoose.model('NewsArticle', newsArticleSchema);

module.exports = NewsArticle;