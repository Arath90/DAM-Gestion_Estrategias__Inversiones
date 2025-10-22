const mongoose = require('mongoose');

/**
 * Order
 * Representa una instruccion enviada al broker. Se mantiene historico para reconciliacion y auditoria.
 */
module.exports = mongoose.models.Order || mongoose.model('Order',
  new mongoose.Schema({
    // Identificador entero nativo de IBKR (no siempre presente, por eso no required).
    ib_order_id: Number,
    // Client Order ID (string unico). Se marca sparse para permitir nulos sin romper el indice.
    client_oid: { type: String, unique: true, sparse: true, trim: true },
    // Enlace a orden padre en estrategias OCO/OSO.
    parent_client_oid: { type: String, index: true, trim: true },
    // Cuenta responsable de la operacion.
    account: { type: String, required: true },
    // Instrumento objetivo. ObjectId permite uso directo con populate.
    instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true },
    // Direccion de la orden (solo BUY o SELL).
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    // Tipo de orden soportado.
    order_type: { type: String, enum: ['MKT', 'LMT', 'STP', 'STP_LMT', 'MOC', 'LOC'], required: true },
    // Cantidad solicitada (Number double) con validacion minima en cero.
    qty: { type: Number, required: true, min: 0 },
    // Precios limite/auxiliares cuando aplican.
    limit_price: { type: Number, min: 0 },
    aux_price: { type: Number, min: 0 },
    // Time in force textual.
    tif: { type: String, enum: ['DAY', 'GTC', 'GTD'], default: 'DAY' },
    // Estado actual de la orden.
    status: { type: String, enum: ['NEW', 'PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED'], default: 'NEW', index: true },
    // Fecha/hora de colocacion y ultima actualizacion recibida.
    placed_at: { type: Date, default: Date.now, index: true },
    last_update: Date,
    // Metadata adicional dinamica (por ejemplo, informacion del algoritmo/estrategia que la genero).
    meta: mongoose.Schema.Types.Mixed,
    // Auditoria generada por Mongo.
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
  .index({ account: 1, placed_at: -1 })
);
