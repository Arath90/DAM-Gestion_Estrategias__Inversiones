import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema(
  {
    account: { type: String, required: true, trim: true, index: true },
    instrument_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Instrument',
      required: true,
      index: true
    },
    qty: { type: Number, required: true },             // posición neta
    avg_price: { type: Number, required: true, min: 0 } // costo promedio
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Una posición por (account, instrument)
positionSchema.index({ account: 1, instrument_id: 1 }, { unique: true });

const Position = mongoose.model('Position', positionSchema);
export default Position;
