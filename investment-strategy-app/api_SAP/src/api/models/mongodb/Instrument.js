const mongoose = require('mongoose');

/**
 * Instrument
 * Catalogo maestro de instrumentos sincronizados desde IBKR.
 * Se almacena en Mongo para centralizar metadata compartida entre multiples colecciones.
 */
module.exports = mongoose.models.Instrument || mongoose.model(
  'Instrument',
  new mongoose.Schema({
    // Identificador numerico oficial de Interactive Brokers; se indexa para buscar rapidamente por CONID.
    ib_conid: { type: Number, unique: true, required: true },
    // Simbolo bursatil (alfanumerico). String permite mayusculas y sufijos.
    symbol:   { type: String, required: true },
    // Tipo de instrumento (STK, FUT, OPT...).
    sec_type: { type: String, required: true },
    // Exchange y moneda se dejan como String porque son codigos cortos.
    exchange: String,
    currency: String,
    // Multiplicador puede venir como texto ("1", "100", incluso valores fraccionarios).
    multiplier: String,
    // Metadata adicional opcional.
    last_trade_date: Date,
    trading_class: String,
    underlying_conid: Number,
    // Fecha de alta en la base local.
    created_at: { type: Date, default: Date.now }
  }, { versionKey: false })
);
