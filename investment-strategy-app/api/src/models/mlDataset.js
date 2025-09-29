import mongoose from 'mongoose';

const mlDatasetSchema = new mongoose.Schema(
  {
    // Nombre legible del dataset (único por conveniencia)
    name: { type: String, required: true, trim: true, unique: true },

    // Descripción corta opcional
    description: { type: String, trim: true },

    // Esquema/definición del dataset (puede ser libre)
    spec_json: { type: mongoose.Schema.Types.Mixed, required: true },

    // (Opcional) Relaciona con un instrumento si aplica
    instrument_conid: { type: Number, index: true }, // ej. 265598 para AAPL
  },
  {
    // Crea createdAt/updatedAt automáticos
    timestamps: true,
    // Evita __v
    versionKey: false,
  }
);

// Índices recomendados
mlDatasetSchema.index({ name: 1 }, { unique: true });
mlDatasetSchema.index({ instrument_conid: 1, createdAt: -1 });

const MLDataset = mongoose.model('MLDataset', mlDatasetSchema);
export default MLDataset;
