import mongoose from 'mongoose';

const executionSchema = new mongoose.Schema(
  {
    exec_id: { type: String, required: true, trim: true, unique: true }, // id de la ejecución (broker)
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true }, // referencia a Order
    ts: { type: Date, required: true, index: true }, // timestamp de ejecución
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true },
    commission: { type: Number, default: 0 },
    pnl: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// índices recomendados
executionSchema.index({ exec_id: 1 }, { unique: true });
executionSchema.index({ ts: -1 });
executionSchema.index({ order_id: 1, ts: -1 });

const Execution = mongoose.model('Execution', executionSchema);
export default Execution;
