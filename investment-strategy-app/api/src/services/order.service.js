import boom from '@hapi/boom';
import mongoose from 'mongoose';
import Order from '../models/order.js';

export const getOrderList = async () => {
  try { return await Order.find().sort({ placed_at: -1 }); }
  catch (err) { throw boom.internal(err); }
};

export const getOrderItem = async (id) => {
  try { return await Order.findById(id); }
  catch (err) { throw boom.internal(err); }
};

export const postOrderItem = async (data) => {
  if (!mongoose.Types.ObjectId.isValid(data.instrument_id))
    throw boom.badRequest('instrument_id no es un ObjectId válido.');
  try { return await (new Order(data)).save(); }
  catch (err) {
    if (err.code === 11000) throw boom.conflict('client_oid ya existe.');
    throw err;
  }
};

export const putOrderItem = async (id, data) => {
  try {
    if (data.instrument_id && !mongoose.Types.ObjectId.isValid(data.instrument_id))
      throw boom.badRequest('instrument_id no es un ObjectId válido.');
    return await Order.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (err) {
    if (err.code === 11000) throw boom.conflict('client_oid ya existe.');
    throw boom.internal(err);
  }
};

export const deleteOrderItem = async (id) => {
  try { return await Order.findByIdAndDelete(id); }
  catch (err) { throw boom.internal(err); }
};


//hola 