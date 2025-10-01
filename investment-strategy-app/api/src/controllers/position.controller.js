import boom from '@hapi/boom';
import mongoose from 'mongoose';
import Position from '../models/position.js';

export const getPositions = async (req, res, next) => {
  try {
    const items = await Position.find().sort({ updatedAt: -1 });
    res.status(200).json(items);
  } catch (err) { next(err); }
};

export const getPositionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const item = await Position.findById(id);
    if (!item) throw boom.notFound('Position no encontrada.');
    res.status(200).json(item);
  } catch (err) { next(err); }
};

export const createPosition = async (req, res, next) => {
  try {
    const { instrument_id } = req.body;
    if (!mongoose.Types.ObjectId.isValid(instrument_id))
      throw boom.badRequest('instrument_id no es un ObjectId válido.');
    const created = await Position.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 11000) return next(boom.conflict('Ya existe una Position para (account, instrument).'));
    next(err);
  }
};

export const updatePosition = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    if (req.body.instrument_id && !mongoose.Types.ObjectId.isValid(req.body.instrument_id))
      throw boom.badRequest('instrument_id no es un ObjectId válido.');
    const updated = await Position.findByIdAndUpdate(id, req.body, {
      new: true, runValidators: true
    });
    if (!updated) throw boom.notFound('Position no encontrada.');
    res.status(200).json(updated);
  } catch (err) {
    if (err.code === 11000) return next(boom.conflict('Ya existe una Position para (account, instrument).'));
    next(err);
  }
};

export const deletePosition = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const deleted = await Position.findByIdAndDelete(id);
    if (!deleted) throw boom.notFound('Position no encontrada.');
    res.status(204).send();
  } catch (err) { next(err); }
};
