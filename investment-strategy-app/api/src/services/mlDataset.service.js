import boom from '@hapi/boom';
import MLDataset from '../models/mlDataset.js';

export const getMLDatasetList = async () => {
  try {
    return await MLDataset.find().sort({ createdAt: -1 });
  } catch (err) {
    throw boom.internal(err);
  }
};

export const getMLDatasetItem = async (id) => {
  try {
    return await MLDataset.findById(id);
  } catch (err) {
    throw boom.internal(err);
  }
};

export const postMLDatasetItem = async (data) => {
  try {
    const doc = new MLDataset(data);
    return await doc.save();
  } catch (err) {
    throw err; // deja pasar errores de validación de Mongoose
  }
};

export const putMLDatasetItem = async (id, data) => {
  try {
    return await MLDataset.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  } catch (err) {
    throw boom.internal(err);
  }
};

export const deleteMLDatasetItem = async (id) => {
  try {
    return await MLDataset.findByIdAndDelete(id);
  } catch (err) {
    throw boom.internal(err);
  }
};
