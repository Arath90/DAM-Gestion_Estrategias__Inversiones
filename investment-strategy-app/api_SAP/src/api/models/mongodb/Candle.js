const mongoose = require('mongoose');

/**
 * Candle
 * Representa una barra OHLC agregada para un instrumento en una resolucion determinada.
 * Se almacena en Mongo para permitir historicos extensos con consultas rapidas por indices compuestos.
 */
module.exports = mongoose.models.Candle || mongoose.model('Candle',
  new mongoose.Schema({
    // ObjectId del instrumento al que pertenece la vela.
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true },
    // Tamaño de la barra (ej. "1min"). Texto porque se expresa como etiqueta.
    bar_size: { type: String, required: true, index: true },
    // Timestamp de la barra, Date para conservar zona y hora exacta.
    ts: { type: Date, required: true, index: true },
    // Precios OHLC: se utilizan Number (double) porque Mongo trabaja con double por defecto y necesitamos decimales.
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    // Volumen de negociacion y numero de trades; se guardan como Number para facilitar agregaciones.
    volume: Number,
    wap: Number,        // Weighted average price, requiere decimales.
    trade_count: Number,
    // Timestamps de auditoria.
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ instrument_id: 1, bar_size: 1, ts: 1 }, { unique: true })
);
