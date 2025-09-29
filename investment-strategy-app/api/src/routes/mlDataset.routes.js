import { Router } from 'express';
import {
  getMLDatasets,
  getMLDatasetById,
  createMLDataset,
  updateMLDataset,
  deleteMLDataset,
} from '../controllers/mlDataset.controller.js';

const router = Router();

router.get('/', getMLDatasets);
router.get('/:id', getMLDatasetById);
router.post('/', createMLDataset);
router.put('/:id', updateMLDataset);
router.delete('/:id', deleteMLDataset);
// src/routes/mlDataset.routes.js
router.get('/by-name/:name', async (req, res, next) => {
  try {
    const item = await MLDataset.findOne({ name: req.params.name });
    if (!item) throw boom.notFound('MLDataset no encontrado.');
    res.json(item);
  } catch (e) { next(e); }
});

export default router;
