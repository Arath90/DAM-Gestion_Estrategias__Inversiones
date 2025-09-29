import boom from '@hapi/boom';
import Execution from '../models/execution.js';
import mongoose from 'mongoose';

export const getExecutionList = async () => {
  try { return await Execution.find().sort({ ts: -1 }); }
  catch (err) { throw boom.internal(err); }
};

export const getExecutionItem = async (id) => {
  try { return await Execution.findById(id); }
  catch (err) { throw boom.internal(err); }
};

export const postExecutionItem = async (data) => {
  if (data.order_id && !mongoose.Types.ObjectId.isValid(data.order_id))
    throw boom.badRequest('order_id no es un ObjectId válido.');
  try { return await (new Execution(data)).save(); }
  catch (err) { throw err; }
};

export const putExecutionItem = async (id, data) => {
  try {
    return await Execution.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (err) { throw boom.internal(err); }
};

export const deleteExecutionItem = async (id) => {
  try { return await Execution.findByIdAndDelete(id); }
  catch (err) { throw boom.internal(err); }
};
