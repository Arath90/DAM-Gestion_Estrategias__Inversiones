import boom from '@hapi/boom';
import MLDataset from '../models/mlDataset.js';

// GET /ml-datasets
export const getMLDatasets = async (req, res, next) => {
  try {
    const items = await MLDataset.find().sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (err) {
    next(err);
  }
};

// GET /ml-datasets/:id
export const getMLDatasetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw boom.badRequest('El parámetro id no es un ObjectId válido.');
    }
    const item = await MLDataset.findById(id);
    if (!item) throw boom.notFound('MLDataset no encontrado.');
    res.status(200).json(item);
  } catch (err) {
    next(err);
  }
};

// POST /ml-datasets
export const createMLDataset = async (req, res, next) => {
  try {
    const created = await MLDataset.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

// PUT /ml-datasets/:id
export const updateMLDataset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await MLDataset.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) throw boom.notFound('MLDataset no encontrado.');
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// DELETE /ml-datasets/:id
export const deleteMLDataset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await MLDataset.findByIdAndDelete(id);
    if (!deleted) throw boom.notFound('MLDataset no encontrado.');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
