const mongoose = require('mongoose');

/**
 * OptionQuote
 * Guarda cotizaciones puntuales de contratos de opciones para alimentar graficos y calculos de riesgo.
 */
module.exports = mongoose.models.OptionQuote || mongoose.model('OptionQuote',
  new mongoose.Schema({
    // Vuelve a enlazar contra el instrumento opcion extendido en la coleccion Instrument.
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
    // Momento en que se recibio la cotizacion.
    ts: { type: Date, required: true },
    // Bid/ask/last: Number (double) para soportar decimales.
    bid: Number,
    ask: Number,
    last: Number,
    // Tamaños de mercado, guardados como Number para operar agregaciones.
    bid_size: Number,
    ask_size: Number,
    last_size: Number,
    // Greeks y volatilidad implicita usados en risk management.
    iv: Number,
    delta: Number,
    gamma: Number,
    theta: Number,
    vega: Number,
    // Precio teorico de la opcion y precio observado del subyacente.
    opt_price: Number,
    und_price: Number
  }, { timestamps: true })
);
