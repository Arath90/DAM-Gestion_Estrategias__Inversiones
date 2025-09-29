import boom from '@hapi/boom';
import mongoose from 'mongoose';
import Execution from '../models/execution.js';

export const getExecutions = async (req, res, next) => {
  try {
    const items = await Execution.find().sort({ ts: -1, createdAt: -1 });
    res.status(200).json(items);
  } catch (err) { next(err); }
};

export const getExecutionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const item = await Execution.findById(id);
    if (!item) throw boom.notFound('Execution no encontrada.');
    res.status(200).json(item);
  } catch (err) { next(err); }
};

export const createExecution = async (req, res, next) => {
  try {
    const { order_id } = req.body;
    if (order_id && !mongoose.Types.ObjectId.isValid(order_id))
      throw boom.badRequest('order_id no es un ObjectId válido.');
    const created = await Execution.create(req.body);
    res.status(201).json(created);
  } catch (err) { next(err); }
};

export const updateExecution = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    if (req.body.order_id && !mongoose.Types.ObjectId.isValid(req.body.order_id))
      throw boom.badRequest('order_id no es un ObjectId válido.');
    const updated = await Execution.findByIdAndUpdate(id, req.body, {
      new: true, runValidators: true,
    });
    if (!updated) throw boom.notFound('Execution no encontrada.');
    res.status(200).json(updated);
  } catch (err) { next(err); }
};

export const deleteExecution = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const deleted = await Execution.findByIdAndDelete(id);
    if (!deleted) throw boom.notFound('Execution no encontrada.');
    res.status(204).send();
  } catch (err) { next(err); }
};
