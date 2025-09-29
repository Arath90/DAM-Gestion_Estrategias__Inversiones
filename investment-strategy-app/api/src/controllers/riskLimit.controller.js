import boom from '@hapi/boom';
import mongoose from 'mongoose';
import RiskLimit from '../models/riskLimit.js';

export const getRiskLimits = async (req, res, next) => {
  try {
    const items = await RiskLimit.find().sort({ account: 1 });
    res.status(200).json(items);
  } catch (err) { next(err); }
};

export const getRiskLimitById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const item = await RiskLimit.findById(id);
    if (!item) throw boom.notFound('RiskLimit no encontrado.');
    res.status(200).json(item);
  } catch (err) { next(err); }
};

export const createRiskLimit = async (req, res, next) => {
  try {
    const created = await RiskLimit.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 11000) return next(boom.conflict('Ya existe un RiskLimit para esa account.'));
    next(err);
  }
};

export const updateRiskLimit = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const updated = await RiskLimit.findByIdAndUpdate(id, req.body, {
      new: true, runValidators: true
    });
    if (!updated) throw boom.notFound('RiskLimit no encontrado.');
    res.status(200).json(updated);
  } catch (err) {
    if (err.code === 11000) return next(boom.conflict('Ya existe un RiskLimit para esa account.'));
    next(err);
  }
};

export const deleteRiskLimit = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    const deleted = await RiskLimit.findByIdAndDelete(id);
    if (!deleted) throw boom.notFound('RiskLimit no encontrado.');
    res.status(204).send();
  } catch (err) { next(err); }
};
