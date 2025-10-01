import boom from '@hapi/boom';
import mongoose from 'mongoose';
import Position from '../models/position.js';

export const getPositionList = async () => {
  try { return await Position.find().sort({ updatedAt: -1 }); }
  catch (err) { throw boom.internal(err); }
};

export const getPositionItem = async (id) => {
  try { return await Position.findById(id); }
  catch (err) { throw boom.internal(err); }
};

export const postPositionItem = async (data) => {
  if (!mongoose.Types.ObjectId.isValid(data.instrument_id))
    throw boom.badRequest('instrument_id no es un ObjectId válido.');
  try { return await (new Position(data)).save(); }
  catch (err) {
    if (err.code === 11000) throw boom.conflict('Ya existe una Position para (account, instrument).');
    throw err;
  }
};

export const putPositionItem = async (id, data) => {
  if (data.instrument_id && !mongoose.Types.ObjectId.isValid(data.instrument_id))
    throw boom.badRequest('instrument_id no es un ObjectId válido.');
  try { return await Position.findByIdAndUpdate(id, data, { new: true, runValidators: true }); }
  catch (err) {
    if (err.code === 11000) throw boom.conflict('Ya existe una Position para (account, instrument).');
    throw boom.internal(err);
  }
};

export const deletePositionItem = async (id) => {
  try { return await Position.findByIdAndDelete(id); }
  catch (err) { throw boom.internal(err); }
};
