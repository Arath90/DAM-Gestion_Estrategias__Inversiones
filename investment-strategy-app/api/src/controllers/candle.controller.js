import boom from '@hapi/boom';
import mongoose from 'mongoose';
import Candle from '../models/candle.js';

// GET /api/candles/prev?symbol=...&interval=...&limit=...&from=...&to=...
export const getCandles = async (req, res, next) => {
  try {
    const { instrument_id, interval, limit = 120, from, to } = req.query;
    if (!instrument_id || !mongoose.Types.ObjectId.isValid(instrument_id)) {
      throw boom.badRequest('instrument_id requerido y debe ser ObjectId válido.');
    }
    const query = {
      instrument_id,
      bar_size: interval,
    };
    if (from) query.ts = { ...query.ts, $gte: new Date(Number(from) * 1000) };
    if (to) query.ts = { ...query.ts, $lte: new Date(Number(to) * 1000) };
    const candles = await Candle.find(query)
      .sort({ ts: 1 })
      .limit(Number(limit));
    res.status(200).json({
      instrument_id,
      interval,
      candles,
    });
  } catch (err) {
    next(err);
  }
};
