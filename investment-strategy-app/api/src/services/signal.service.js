import boom from '@hapi/boom';
import mongoose from 'mongoose';
import Signal from '../models/signal.js';

export const getSignalList = async () => {
  try { return await Signal.find().sort({ ts: -1 }); }
  catch (err) { throw boom.internal(err); }
};

export const getSignalItem = async (id) => {
  try { return await Signal.findById(id); }
  catch (err) { throw boom.internal(err); }
};

export const postSignalItem = async (data) => {
  if (!mongoose.Types.ObjectId.isValid(data.instrument_id))
    throw boom.badRequest('instrument_id no es un ObjectId válido.');
  try { return await (new Signal(data)).save(); }
  catch (err) {
    if (err.code === 11000) throw boom.conflict('Señal duplicada para (strategy_code, instrument_id, ts, action).');
    throw err;
  }
};

export const putSignalItem = async (id, data) => {
  if (data.instrument_id && !mongoose.Types.ObjectId.isValid(data.instrument_id))
    throw boom.badRequest('instrument_id no es un ObjectId válido.');
  try { return await Signal.findByIdAndUpdate(id, data, { new: true, runValidators: true }); }
  catch (err) {
    if (err.code === 11000) throw boom.conflict('Señal duplicada para (strategy_code, instrument_id, ts, action).');
    throw boom.internal(err);
  }
};

export const deleteSignalItem = async (id) => {
  try { return await Signal.findByIdAndDelete(id); }
  catch (err) { throw boom.internal(err); }
};
