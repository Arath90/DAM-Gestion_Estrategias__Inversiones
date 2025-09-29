import boom from '@hapi/boom';
import RiskLimit from '../models/riskLimit.js';

export const getRiskLimitList = async () => {
  try { return await RiskLimit.find().sort({ account: 1 }); }
  catch (err) { throw boom.internal(err); }
};

export const getRiskLimitItem = async (id) => {
  try { return await RiskLimit.findById(id); }
  catch (err) { throw boom.internal(err); }
};

export const postRiskLimitItem = async (data) => {
  try { return await (new RiskLimit(data)).save(); }
  catch (err) {
    if (err.code === 11000) throw boom.conflict('Ya existe un RiskLimit para esa account.');
    throw err;
  }
};

export const putRiskLimitItem = async (id, data) => {
  try {
    return await RiskLimit.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (err) {
    if (err.code === 11000) throw boom.conflict('Ya existe un RiskLimit para esa account.');
    throw boom.internal(err);
  }
};

export const deleteRiskLimitItem = async (id) => {
  try { return await RiskLimit.findByIdAndDelete(id); }
  catch (err) { throw boom.internal(err); }
};
