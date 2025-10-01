import { Router } from 'express';
import {
  getSignals, getSignalById, createSignal, updateSignal, deleteSignal
} from '../controllers/signal.controller.js';

const router = Router();

router.get('/', getSignals);
router.get('/:id', getSignalById);
router.post('/', createSignal);
router.put('/:id', updateSignal);
router.delete('/:id', deleteSignal);

export default router;
