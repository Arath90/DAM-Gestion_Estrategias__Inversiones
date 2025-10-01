import mongoose from 'mongoose';

const SIGNAL_ACTIONS = ['BUY_CALL', 'SELL_PUT', 'OPEN_SPREAD', 'CLOSE_SPREAD', 'BUY', 'SELL'];
const MONEYNESS = ['ITM', 'ATM', 'OTM'];

const signalSchema = new mongoose.Schema(
  {
    strategy_code: { type: String, required: true, trim: true, index: true },
    instrument_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Instrument',
      required: true,
      index: true
    },
    ts: { type: Date, required: true, index: true }, // timestamp de la señal
    action: { type: String, enum: SIGNAL_ACTIONS, required: true },
    moneyness: { type: String, enum: MONEYNESS, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 }, // 0..1
    features_json: { type: mongoose.Schema.Types.Mixed, required: true },
    rationale: { type: String, required: true, trim: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Útil para no duplicar señales de la misma estrategia/instrument/ts/action
signalSchema.index({ strategy_code: 1, instrument_id: 1, ts: 1, action: 1 }, { unique: true });
signalSchema.index({ ts: -1 });

const Signal = mongoose.model('Signal', signalSchema);
export default Signal;
export { SIGNAL_ACTIONS, MONEYNESS };
