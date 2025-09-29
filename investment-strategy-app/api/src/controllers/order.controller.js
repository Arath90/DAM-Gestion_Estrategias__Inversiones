import boom from '@hapi/boom';
import mongoose from 'mongoose';
import Order from '../models/order.js';

export const getOrders = async (req, res, next) => {
  try {
    const items = await Order.find().sort({ placed_at: -1, createdAt: -1 });
    res.status(200).json(items);
  } catch (err) { next(err); }
};

export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const item = await Order.findById(id);
    if (!item) throw boom.notFound('Order no encontrada.');
    res.status(200).json(item);
  } catch (err) { next(err); }
};

export const createOrder = async (req, res, next) => {
  try {
    const { instrument_id } = req.body;
    if (!mongoose.Types.ObjectId.isValid(instrument_id))
      throw boom.badRequest('instrument_id no es un ObjectId válido.');

    const created = await Order.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    // Duplicados de client_oid, etc.
    if (err.code === 11000) return next(boom.conflict('client_oid ya existe.'));
    next(err);
  }
};

export const updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');

    if (req.body.instrument_id && !mongoose.Types.ObjectId.isValid(req.body.instrument_id))
      throw boom.badRequest('instrument_id no es un ObjectId válido.');

    const updated = await Order.findByIdAndUpdate(id, req.body, {
      new: true, runValidators: true
    });
    if (!updated) throw boom.notFound('Order no encontrada.');
    res.status(200).json(updated);
  } catch (err) {
    if (err.code === 11000) return next(boom.conflict('client_oid ya existe.'));
    next(err);
  }
};

export const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');

    const deleted = await Order.findByIdAndDelete(id);
    if (!deleted) throw boom.notFound('Order no encontrada.');
    res.status(204).send();
  } catch (err) { next(err); }
};
