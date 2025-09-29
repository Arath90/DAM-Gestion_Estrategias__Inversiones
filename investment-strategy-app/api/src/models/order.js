import mongoose from 'mongoose';

const ORDER_SIDES = ['BUY', 'SELL'];
const ORDER_TYPES = ['MKT', 'LMT', 'STP', 'STP_LMT', 'MOC', 'LOC'];
const TIFS = ['DAY', 'GTC', 'GTD'];
const ORDER_STATUS = [
  'NEW', 'PENDING', 'PARTIALLY_FILLED', 'FILLED',
  'CANCELED', 'REJECTED'
];

const orderSchema = new mongoose.Schema(
  {
    ib_order_id: { type: Number }, // si lo trae el broker; puede llegar después
    client_oid: { type: String, trim: true, unique: true, sparse: true },
    parent_client_oid: { type: String, trim: true, index: true },

    account: { type: String, required: true, trim: true },

    instrument_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Instrument',
      required: true,
      index: true
    },

    side: { type: String, enum: ORDER_SIDES, required: true },
    order_type: { type: String, enum: ORDER_TYPES, required: true },

    qty: { type: Number, required: true, min: 0.00000001 },

    limit_price: { type: Number, min: 0 },
    aux_price: { type: Number, min: 0 }, // stop/trigger price

    tif: { type: String, enum: TIFS, default: 'DAY' },

    status: { type: String, enum: ORDER_STATUS, default: 'NEW', index: true },

    placed_at: { type: Date, default: Date.now, index: true },
    last_update: { type: Date },

    meta: { type: mongoose.Schema.Types.Mixed }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Índices adicionales
orderSchema.index({ account: 1, placed_at: -1 });
orderSchema.index({ status: 1, placed_at: -1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
export { ORDER_SIDES, ORDER_TYPES, TIFS, ORDER_STATUS };
