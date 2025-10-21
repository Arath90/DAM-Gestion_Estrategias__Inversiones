#!/usr/bin/env node
/**
 * Seed sample market activity for the AAPL instrument so the UI has data to display.
 *
 * Usage:
 *   node scripts/seedAaplSampleData.js
 */

const path = require('path');
const mongoose = require('mongoose');

// Ensure environment variables are loaded (uses dotenvx like the app)
require('@dotenvx/dotenvx').config({ path: path.resolve(__dirname, '..', '.env') });

const cfg = require('../src/config/dotenvXConfig');

const Instrument = require('../src/api/models/mongodb/Instrument');
const Candle = require('../src/api/models/mongodb/Candle');
const Order = require('../src/api/models/mongodb/Order');
const Execution = require('../src/api/models/mongodb/Execution');
const Position = require('../src/api/models/mongodb/Position');
const Signal = require('../src/api/models/mongodb/Signal');
const DailyPnl = require('../src/api/models/mongodb/DailyPnl');
const OptionQuote = require('../src/api/models/mongodb/OptionQuote');

const AAPL_ID = '66f000000000000000000001';

const asObjectId = (hex) => new mongoose.Types.ObjectId(hex);
const ensureObjectId = (value) => {
  if (!value) return null;
  return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));
};

const now = () => new Date();

const minuteBars = () => {
  const base = new Date('2025-09-29T13:30:00Z');
  const samples = [
    { open: 189.12, high: 189.37, low: 188.92, close: 189.20, volume: 1287400, trade_count: 1524 },
    { open: 189.20, high: 189.55, low: 189.10, close: 189.44, volume: 1129800, trade_count: 1401 },
    { open: 189.44, high: 189.73, low: 189.28, close: 189.60, volume: 956700, trade_count: 1219 },
    { open: 189.60, high: 189.88, low: 189.42, close: 189.72, volume: 1043200, trade_count: 1344 },
    { open: 189.72, high: 189.91, low: 189.40, close: 189.55, volume: 883200, trade_count: 1187 },
    { open: 189.55, high: 189.68, low: 189.21, close: 189.36, volume: 792150, trade_count: 1022 },
    { open: 189.36, high: 189.44, low: 189.02, close: 189.18, volume: 864650, trade_count: 1104 },
    { open: 189.18, high: 189.33, low: 188.94, close: 189.05, volume: 915210, trade_count: 1160 },
    { open: 189.05, high: 189.45, low: 188.98, close: 189.41, volume: 998760, trade_count: 1235 },
    { open: 189.41, high: 189.90, low: 189.32, close: 189.82, volume: 1345760, trade_count: 1568 },
    { open: 189.82, high: 190.04, low: 189.61, close: 189.96, volume: 1483200, trade_count: 1705 },
    { open: 189.96, high: 190.22, low: 189.84, close: 190.10, volume: 1526400, trade_count: 1784 },
    { open: 190.10, high: 190.34, low: 189.95, close: 190.28, volume: 1632300, trade_count: 1891 },
    { open: 190.28, high: 190.47, low: 190.10, close: 190.35, volume: 1508700, trade_count: 1710 },
    { open: 190.35, high: 190.60, low: 190.24, close: 190.41, volume: 1423400, trade_count: 1632 },
  ];

  return samples.map((sample, idx) => ({
    bar_size: '1min',
    ts: new Date(base.getTime() + idx * 60_000),
    open: sample.open,
    high: sample.high,
    low: sample.low,
    close: sample.close,
    volume: sample.volume,
    trade_count: sample.trade_count,
    wap: Number(((sample.high + sample.low + sample.close) / 3).toFixed(4)),
    createdAt: now(),
    updatedAt: now(),
  }));
};

const sampleSignals = (instrumentId) => ([
  {
    strategy_code: 'MEAN_REVERSION_V1',
    instrument_id: instrumentId,
    ts: new Date('2025-09-29T14:05:00Z'),
    action: 'BUY',
    moneyness: 'ATM',
    confidence: 0.74,
    rationale: 'RSI oversold on 5min with strong order flow imbalance.',
    features_json: { rsi5: 28.4, orderflowScore: 0.62 },
    createdAt: now(),
    updatedAt: now(),
  },
  {
    strategy_code: 'TREND_BREAKOUT_V2',
    instrument_id: instrumentId,
    ts: new Date('2025-09-29T15:10:00Z'),
    action: 'SELL',
    moneyness: 'ATM',
    confidence: 0.66,
    rationale: 'Break below VWAP with weakening breadth.',
    features_json: { vwapDistance: -0.32, advDecline: 0.41 },
    createdAt: now(),
    updatedAt: now(),
  },
]);

const sampleOrders = (instrumentId) => ([
  {
    client_oid: 'AAPL-20250929-LONG',
    account: 'PAPER',
    instrument_id: instrumentId,
    side: 'BUY',
    order_type: 'MKT',
    qty: 100,
    status: 'FILLED',
    placed_at: new Date('2025-09-29T14:06:00Z'),
    last_update: new Date('2025-09-29T14:06:15Z'),
    createdAt: now(),
    updatedAt: now(),
  },
  {
    client_oid: 'AAPL-20250929-SCALP',
    account: 'PAPER',
    instrument_id: instrumentId,
    side: 'SELL',
    order_type: 'LMT',
    qty: 50,
    limit_price: 190.75,
    status: 'PENDING',
    placed_at: new Date('2025-09-29T15:12:00Z'),
    createdAt: now(),
    updatedAt: now(),
  },
]);

const sampleExecutions = (orderId) => ([
  {
    exec_id: 'AAPL-20250929-LONG-1',
    order_id: orderId,
    ts: new Date('2025-09-29T14:06:07Z'),
    price: 189.58,
    qty: 100,
    commission: 0.4,
    pnl: 0,
    createdAt: now(),
    updatedAt: now(),
  },
]);

const samplePosition = (instrumentId) => ({
  account: 'PAPER',
  instrument_id: instrumentId,
  qty: 150,
  avg_price: 188.92,
  createdAt: now(),
  updatedAt: now(),
});

const sampleDailyPnls = () => ([
  {
    account: 'PAPER',
    date: new Date('2025-09-26T00:00:00Z'),
    realized: 1245.50,
    unrealized: 320.15,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    account: 'PAPER',
    date: new Date('2025-09-27T00:00:00Z'),
    realized: -340.25,
    unrealized: 410.72,
    createdAt: now(),
    updatedAt: now(),
  },
]);

const sampleOptionQuotes = (instrumentId) => ([
  {
    instrument_id: instrumentId,
    ts: new Date('2025-09-29T15:00:00Z'),
    bid: 4.85,
    ask: 4.95,
    last: 4.92,
    bid_size: 220,
    ask_size: 185,
    last_size: 40,
    iv: 0.29,
    delta: 0.54,
    gamma: 0.018,
    theta: -0.042,
    vega: 0.102,
    opt_price: 4.92,
    und_price: 189.78,
  },
]);

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(cfg.CONNECTION_STRING, {
    dbName: cfg.DATABASE,
    serverSelectionTimeoutMS: 5000,
  });

  const preferredId = asObjectId(AAPL_ID);
  let instrumentObjectId = preferredId;

  const existingInstrument = await Instrument.findOne({
    $or: [{ _id: preferredId }, { ib_conid: 265598 }],
  }).lean();

  if (existingInstrument) {
    instrumentObjectId = ensureObjectId(existingInstrument._id);
    console.log(`Using existing instrument _id ${instrumentObjectId.toString()}`);
  }

  console.log('Upserting instrument document...');
  await Instrument.updateOne(
    { _id: instrumentObjectId },
    {
      $set: {
        ib_conid: 265598,
        symbol: 'AAPL',
        sec_type: 'STK',
        exchange: 'NASDAQ',
        currency: 'USD',
        multiplier: '1',
        last_trade_date: new Date('2025-09-29T00:00:00Z'),
        trading_class: 'NMS',
        created_at: new Date('2025-09-29T10:00:00Z'),
      },
      $setOnInsert: { _id: instrumentObjectId },
    },
    { upsert: true }
  );

  console.log('Seeding candles...');
  const candleOps = minuteBars().map((doc) => ({
    updateOne: {
      filter: {
        instrument_id: instrumentObjectId,
        bar_size: doc.bar_size,
        ts: doc.ts,
      },
      update: { $set: { ...doc, instrument_id: instrumentObjectId } },
      upsert: true,
    },
  }));
  await Candle.bulkWrite(candleOps, { ordered: false });

  console.log('Seeding signals...');
  const signals = sampleSignals(instrumentObjectId);
  await Promise.all(signals.map((doc) => (
    Signal.updateOne(
      { strategy_code: doc.strategy_code, instrument_id: doc.instrument_id, ts: doc.ts, action: doc.action },
      { $set: doc },
      { upsert: true }
    )
  )));

  console.log('Seeding orders...');
  const orders = sampleOrders(instrumentObjectId);
  const savedOrders = [];
  for (const payload of orders) {
    const doc = await Order.findOneAndUpdate(
      { client_oid: payload.client_oid },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    savedOrders.push(doc);
  }

  console.log('Seeding executions...');
  const executions = sampleExecutions(savedOrders[0]?._id);
  for (const payload of executions) {
    if (!payload.order_id) continue;
    await Execution.updateOne(
      { exec_id: payload.exec_id },
      { $set: payload },
      { upsert: true }
    );
  }

  console.log('Seeding position...');
  const position = samplePosition(instrumentObjectId);
  await Position.updateOne(
    { account: position.account, instrument_id: position.instrument_id },
    { $set: position },
    { upsert: true }
  );

  console.log('Seeding daily PnL...');
  const pnlDocs = sampleDailyPnls();
  await Promise.all(pnlDocs.map((doc) => (
    DailyPnl.updateOne(
      { account: doc.account, date: doc.date },
      { $set: doc },
      { upsert: true }
    )
  )));

  console.log('Seeding option quotes...');
  const optionDocs = sampleOptionQuotes(instrumentObjectId);
  await Promise.all(optionDocs.map((doc) => (
    OptionQuote.updateOne(
      { instrument_id: doc.instrument_id, ts: doc.ts },
      { $set: doc },
      { upsert: true }
    )
  )));

  console.log('Done. Sample data ready.');
}

run()
  .catch((err) => {
    console.error(' Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
