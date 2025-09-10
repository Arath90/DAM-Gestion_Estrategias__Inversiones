import mongoose from 'mongoose';
//instrument es el modelo de los instrumentos financieros
const instrumentSchema = new mongoose.Schema({
  ib_conid: { type: Number, unique: true, required: true },
  //ib_conid es el identificador unico de cada instrumento en Interactive Brokers
  symbol: { type: String, required: true },
  //symbol es el simbolo del instrumento financiero
  sec_type: { type: String, required: true },
  //sec_type es el tipo de instrumento financiero (ej. STK, OPT, FUT, etc.)
  exchange: { type: String },
  //exchange es la bolsa donde se negocia el instrumento
  currency: { type: String },
  //currency es la moneda en la que se negocia el instrumento
  multiplier: { type: String },
  //multiplier es el multiplicador del instrumento (ej. 100 para opciones)
  last_trade_date: { type: Date },
  //last_trade_date es la fecha del ultimo trade (para futuros y opciones)
  trading_class: { type: String },
  //trading_class es la clase de trading del instrumento
  underlying_conid: { type: Number },
  //underlying_conid es el identificador unico del instrumento subyacente (para opciones)
  created_at: { type: Date, default: Date.now }
  //created_at es la fecha de creacion del registro
});

const Instrument = mongoose.model('Instrument', instrumentSchema);

export default Instrument;