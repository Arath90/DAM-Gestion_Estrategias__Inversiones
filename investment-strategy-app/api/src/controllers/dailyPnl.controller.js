import boom from '@hapi/boom';
import mongoose from 'mongoose';
import DailyPnl from '../models/dailyPnl.js';

export const getDailyPnls = async (req, res, next) => {
  try {
    const items = await DailyPnl.find().sort({ date: -1 });
    res.status(200).json(items);
  } catch (err) { next(err); }
};

export const getDailyPnlById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const item = await DailyPnl.findById(id);
    if (!item) throw boom.notFound('DailyPnl no encontrado.');
    res.status(200).json(item);
  } catch (err) { next(err); }
};

export const createDailyPnl = async (req, res, next) => {
  try {
    const created = await DailyPnl.create(req.body);
    res.status(201).json(created);
  } catch (err) { next(err); }
};

export const updateDailyPnl = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const updated = await DailyPnl.findByIdAndUpdate(id, req.body, {
      new: true, runValidators: true,
    });
    if (!updated) throw boom.notFound('DailyPnl no encontrado.');
    res.status(200).json(updated);
  } catch (err) { next(err); }
};

export const deleteDailyPnl = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const deleted = await DailyPnl.findByIdAndDelete(id);
    if (!deleted) throw boom.notFound('DailyPnl no encontrado.');
    res.status(204).send();
  } catch (err) { next(err); }
};
