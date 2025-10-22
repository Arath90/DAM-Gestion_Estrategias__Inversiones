const mongoose = require('mongoose');

/**
 * NewsArticle
 * Registra noticias relevantes para instrumentos/estrategias a fin de cruzarlas con señales y riesgos.
 */
module.exports = mongoose.models.NewsArticle || mongoose.model('NewsArticle',
  new mongoose.Schema({
    // Codigo del proveedor de noticias (permite filtrar por fuente).
    provider_code: { type: String, required: true },
    // Identificador interno del articulo dentro del proveedor.
    article_id: { type: String, required: true },
    // Simbolo principal afectado.
    symbol: { type: String, required: true },
    // CONID relacionado para enlazar con el catalogo de instrumentos.
    conid: { type: Number, required: true },
    // Momento exacto de publicacion.
    published_at: { type: Date, required: true },
    // Titular y contenido de la noticia.
    headline: { type: String, required: true },
    body: { type: String, required: true },
    // Sentimiento calculado (-1..1). Number permite aplicar validaciones min/max.
    sentiment: { type: Number, min: -1, max: 1 },
    // Lista de temas etiquetados. Array de String para filtrar rapidamente por topicos.
    topics: [String]
  }, { timestamps: true })
);
