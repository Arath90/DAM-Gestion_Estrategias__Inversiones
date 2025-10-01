//src/apiroutes/handlers.js
const cds = require('@sap/cds');
const mongoose = require('mongoose');

/* ========= Conexión única a Mongo ========= */
let ready;
async function ensureMongo() {
  if (!ready) {
    ready = mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB || 'Inversiones',
    });
  }
  return ready;
}

/* ========= Helpers de mapeo ========= */
const mapOut = (doc) => {
  const o = doc?.toObject ? doc.toObject() : doc;
  const { _id, __v, ...rest } = o || {};
  return { ID: _id?.toString?.(), ...rest };
};
const mapIn = (data) => {
  const { ID, ...rest } = data || {};
  return rest;
};

/* ========= Adaptador CRUD genérico ========= */
function registerCRUD(srv, cdsEntity, Model, opts = {}) {
  const { uniqueCheck, beforeCreate, beforeUpdate } = opts;

  // READ
  srv.on('READ', cdsEntity, async (req) => {
    if (req.data.ID) {
      const doc = await Model.findById(req.data.ID);
      return doc ? [mapOut(doc)] : [];
    }
    const top  = Number(req._query?.$top ?? 0);
    const skip = Number(req._query?.$skip ?? 0);
    let q = Model.find();
    if (skip) q = q.skip(skip);
    if (top)  q = q.limit(top);
    const docs = await q;
    return docs.map(mapOut);
  });

  // CREATE
  srv.on('CREATE', cdsEntity, async (req) => {
    if (beforeCreate) await beforeCreate(req);
    if (uniqueCheck) await uniqueCheck(req);
    const created = await Model.create(mapIn(req.data));
    return mapOut(created);
  });

  // UPDATE
  srv.on('UPDATE', cdsEntity, async (req) => {
    if (!req.data.ID) req.reject(400, 'ID requerido');
    if (beforeUpdate) await beforeUpdate(req);
    const updated = await Model.findByIdAndUpdate(req.data.ID, mapIn(req.data), { new: true, runValidators: true });
    if (!updated) req.reject(404, 'No encontrado');
    return mapOut(updated);
  });

  // DELETE
  srv.on('DELETE', cdsEntity, async (req) => {
    const ok = await Model.findByIdAndDelete(req.data.ID);
    if (!ok) req.reject(404, 'No encontrado');
  });
}

/* ========= Schemas Mongoose ========= */
// Instruments
const Instrument = mongoose.models.Instrument || mongoose.model('Instrument', new mongoose.Schema({
  ib_conid: { type: Number, unique: true, required: true },
  symbol:   { type: String, required: true },
  sec_type: { type: String, required: true },
  exchange: String, currency: String, multiplier: String,
  last_trade_date: Date, trading_class: String, underlying_conid: Number,
  created_at: { type: Date, default: Date.now }
}, { versionKey: false }));

// MLDatasets
const MLDataset = mongoose.models.MLDataset || mongoose.model('MLDataset', new mongoose.Schema({
  name: { type: String, unique: true, required: true, trim: true },
  description: String,
  spec_json: mongoose.Schema.Types.Mixed,
  instrument_conid: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false }));

// Execution (order_id en minúsculas)
const Execution = mongoose.models.Execution || mongoose.model('Execution', new mongoose.Schema({
  exec_id: { type: String, unique: true, required: true, trim: true },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true }, // <-- minúscula
  ts: { type: Date, required: true, index: true },
  price: Number, qty: Number, commission: { type: Number, default: 0 }, pnl: { type: Number, default: 0 },
  createdAt: Date, updatedAt: Date
}, { versionKey: false }).index({ order_id:1, ts:-1 }));

// DailyPnls
const DailyPnl = mongoose.models.DailyPnl || mongoose.model('DailyPnl', new mongoose.Schema({
  account: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  realized: { type: Number, default: 0 },
  unrealized: { type: Number, default: 0 },
  createdAt: Date, updatedAt: Date
}, { versionKey: false }).index({ account:1, date:1 }, { unique: true }));


// Order (instrument_id minúscula y enums como en tu modelo ESM)
const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({
  ib_order_id: Number,
  client_oid: { type: String, unique: true, sparse: true, trim: true },
  parent_client_oid: { type: String, index: true, trim: true },
  account: { type: String, required: true },
  instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true }, // <-- minúscula
  side: { type: String, enum: ['BUY','SELL'], required: true },
  order_type: { type: String, enum: ['MKT','LMT','STP','STP_LMT','MOC','LOC'], required: true },
  qty: { type: Number, required: true, min: 0 },
  limit_price: { type: Number, min: 0 },
  aux_price: { type: Number, min: 0 },
  tif: { type: String, enum: ['DAY','GTC','GTD'], default: 'DAY' },
  status: { type: String, enum: ['NEW','PENDING','PARTIALLY_FILLED','FILLED','CANCELED','REJECTED'], default: 'NEW', index: true },
  placed_at: { type: Date, default: Date.now, index: true },
  last_update: Date,
  meta: mongoose.Schema.Types.Mixed,
  createdAt: Date, updatedAt: Date
}, { versionKey: false }).index({ account:1, placed_at:-1 }));

// RiskLimits
const RiskLimit = mongoose.models.RiskLimit || mongoose.model('RiskLimit', new mongoose.Schema({
  account: { type: String, unique: true, required: true },
  max_daily_loss: Number,
  max_position_value: Number,
  max_order_size: Number,
  max_gamma: Number,
  max_vega: Number,
  createdAt: Date, updatedAt: Date
}, { versionKey: false }));


// Position (instrument_id minúscula)
const Position = mongoose.models.Position || mongoose.model('Position', new mongoose.Schema({
  account: { type: String, required: true, index: true },
  instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true }, // <-- minúscula
  qty: { type: Number, required: true },
  avg_price: { type: Number, required: true, min: 0 },
  createdAt: Date, updatedAt: Date
}, { versionKey: false }).index({ account:1, instrument_id:1 }, { unique: true }));

// Signal (instrument_id minúscula)
const Signal = mongoose.models.Signal || mongoose.model('Signal', new mongoose.Schema({
  strategy_code: { type: String, required: true, index: true },
  instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true }, // <-- minúscula
  ts: { type: Date, required: true, index: true },
  action: { type: String, enum: ['BUY_CALL','SELL_PUT','OPEN_SPREAD','CLOSE_SPREAD','BUY','SELL'], required: true },
  moneyness: { type: String, enum: ['ITM','ATM','OTM'], required: true },
  confidence: { type: Number, min: 0, max: 1, required: true },
  features_json: mongoose.Schema.Types.Mixed,
  rationale: { type: String, required: true },
  createdAt: Date, updatedAt: Date
}, { versionKey: false }).index({ strategy_code:1, instrument_id:1, ts:1, action:1 }, { unique: true }));


// Backtest (dataset_id minúscula)
const Backtest = mongoose.models.Backtest || mongoose.model('Backtest', new mongoose.Schema({
  strategy_code: { type: String, required: true, index: true },
  dataset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MLDataset', required: true, index: true }, // <-- minúscula
  params_json: mongoose.Schema.Types.Mixed,
  period_start: { type: Date, required: true, index: true },
  period_end: { type: Date, required: true, index: true },
  metrics_json: mongoose.Schema.Types.Mixed,
  createdAt: Date, updatedAt: Date
}, { versionKey: false }).index({ strategy_code:1, dataset_id:1, period_start:1, period_end:1 }, { unique: true }));

// Candle (instrument_id minúscula)
const Candle = mongoose.models.Candle || mongoose.model('Candle', new mongoose.Schema({
  instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true }, // <-- minúscula
  bar_size: { type: String, required: true, index: true },
  ts: { type: Date, required: true, index: true },
  open: Number, high: Number, low: Number, close: Number,
  volume: Number, wap: Number, trade_count: Number,
  createdAt: Date, updatedAt: Date
}, { versionKey: false }).index({ instrument_id:1, bar_size:1, ts:1 }, { unique: true }));

// MLModel
const MLModel = mongoose.models.MLModel || mongoose.model('MLModel', new mongoose.Schema({
  name: { type: String, required: true },
  algo: { type: String, required: true },
  trainedAt: { type: Date, default: Date.now },
  metricsJson: mongoose.Schema.Types.Mixed,
  featureImportance: mongoose.Schema.Types.Mixed
}, { timestamps: true }));

// NewsArticle
const NewsArticle = mongoose.models.NewsArticle || mongoose.model('NewsArticle', new mongoose.Schema({
  provider_code: { type: String, required: true },
  article_id: { type: String, required: true },
  symbol: { type: String, required: true },
  conid: { type: Number, required: true },
  published_at: { type: Date, required: true },
  headline: { type: String, required: true },
  body: { type: String, required: true },
  sentiment: { type: Number, min: -1, max: 1 },
  topics: [String]
}, { timestamps: true }));

// OptionChainSnapshot
const OptionChainSnapshot = mongoose.models.OptionChainSnapshot || mongoose.model('OptionChainSnapshot', new mongoose.Schema({
  underlying_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
  ts: { type: Date, required: true }
}, { timestamps: true }));

// OptionChainSnapshotItem
const OptionChainSnapshotItem = mongoose.models.OptionChainSnapshotItem || mongoose.model('OptionChainSnapshotItem', new mongoose.Schema({
  snapshot_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OptionChainSnapshot', required: true },
  option_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
  strike: { type: Number, required: true },
  right: { type: String, enum: ['C','P'], required: true },
  expiration: { type: Date, required: true },
  bid: Number, ask: Number, iv: Number, delta: Number, gamma: Number, theta: Number, vega: Number
}, { timestamps: true }));

// OptionQuote
const OptionQuote = mongoose.models.OptionQuote || mongoose.model('OptionQuote', new mongoose.Schema({
  instrument_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument', required: true },
  ts: { type: Date, required: true },
  bid: Number, ask: Number, last: Number,
  bid_size: Number, ask_size: Number, last_size: Number,
  iv: Number, delta: Number, gamma: Number, theta: Number, vega: Number,
  opt_price: Number, und_price: Number
}, { timestamps: true }));

/* ========= Implementación CAP ========= */
module.exports = cds.service.impl(async function () {
  await ensureMongo();

  const {
    Instruments, MLDatasets, Executions, DailyPnls, Orders, RiskLimits,
    Positions, Signals, Backtests, Candles,
    MLModels, NewsArticles, OptionChainSnapshots, OptionChainSnapshotItems, OptionQuotes
  } = this.entities;

  const unique = (Model, whereFn, msg) => async (req) => {
    const w = whereFn?.(req); if (!w) return;
    const found = await Model.findOne(w);
    if (found) req.reject(409, msg);
  };

  /* iguales a antes salvo nombres minúsculas */
  registerCRUD(this, Instruments, Instrument, {
    uniqueCheck: unique(Instrument, r => ({ ib_conid: r.data.ib_conid }), 'ib_conid ya existe'),
  });
  registerCRUD(this, MLDatasets, MLDataset, {
    uniqueCheck: unique(MLDataset, r => ({ name: r.data.name }), 'MLDataset.name ya existe'),
  });
  registerCRUD(this, Executions, Execution, {
    uniqueCheck: unique(Execution, r => ({ exec_id: r.data.exec_id }), 'exec_id ya existe'),
  });
  registerCRUD(this, DailyPnls, DailyPnl, {
    uniqueCheck: unique(DailyPnl, r => ({ account: r.data.account, date: r.data.date }), 'DailyPnl duplicado (account,date)'),
  });
  registerCRUD(this, Orders, Order);
  registerCRUD(this, RiskLimits, RiskLimit, {
    uniqueCheck: unique(RiskLimit, r => ({ account: r.data.account }), 'RiskLimit ya existe para account'),
  });
  registerCRUD(this, Positions, Position, {
    uniqueCheck: unique(Position, r => ({ account: r.data.account, instrument_id: r.data.instrument_id }), 'Position duplicada (account,instrument)'),
  });
  registerCRUD(this, Signals, Signal, {
    uniqueCheck: unique(Signal, r => ({ strategy_code: r.data.strategy_code, instrument_id: r.data.instrument_id, ts: r.data.ts, action: r.data.action }), 'Signal duplicada'),
  });
  registerCRUD(this, Backtests, Backtest, {
    uniqueCheck: unique(Backtest, r => ({ strategy_code: r.data.strategy_code, dataset_id: r.data.dataset_id, period_start: r.data.period_start, period_end: r.data.period_end }), 'Backtest duplicado'),
  });
  registerCRUD(this, Candles, Candle, {
    uniqueCheck: unique(Candle, r => ({ instrument_id: r.data.instrument_id, bar_size: r.data.bar_size, ts: r.data.ts }), 'Candle duplicada'),
  });

  /* nuevos */
  registerCRUD(this, MLModels, MLModel);
  registerCRUD(this, NewsArticles, NewsArticle, {
    uniqueCheck: unique(NewsArticle, r => ({ provider_code: r.data.provider_code, article_id: r.data.article_id }), 'Artículo duplicado (provider_code, article_id)'),
  });
  registerCRUD(this, OptionChainSnapshots, OptionChainSnapshot, {
    uniqueCheck: unique(OptionChainSnapshot, r => ({ underlying_id: r.data.underlying_id, ts: r.data.ts }), 'Snapshot duplicado (underlying, ts)'),
  });
  registerCRUD(this, OptionChainSnapshotItems, OptionChainSnapshotItem, {
    uniqueCheck: unique(OptionChainSnapshotItem, r => ({ snapshot_id: r.data.snapshot_id, option_id: r.data.option_id }), 'Item duplicado (snapshot, option)'),
  });
  registerCRUD(this, OptionQuotes, OptionQuote, {
    uniqueCheck: unique(OptionQuote, r => ({ instrument_id: r.data.instrument_id, ts: r.data.ts }), 'Quote duplicado (instrument, ts)'),
  });
});

