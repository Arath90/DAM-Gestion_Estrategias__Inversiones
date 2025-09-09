import mongoose from 'mongoose';

const instrumentSchema = new mongoose.Schema({
  ib_conid: { type: Number, unique: true, required: true },
  symbol: { type: String, required: true },
  sec_type: { type: String, required: true },
  exchange: { type: String },
  currency: { type: String },
  multiplier: { type: String },
  last_trade_date: { type: Date },
  trading_class: { type: String },
  underlying_conid: { type: Number },
  created_at: { type: Date, default: Date.now }
});

const Instrument = mongoose.model('Instrument', instrumentSchema);

export default Instrument;