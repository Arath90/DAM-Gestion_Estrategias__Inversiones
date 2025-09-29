import { Router } from 'express';
import {
  getExecutions,
  getExecutionById,
  createExecution,
  updateExecution,
  deleteExecution,
} from '../controllers/execution.controller.js';

const router = Router();

router.get('/', getExecutions);
router.get('/:id', getExecutionById);
router.post('/', createExecution);
router.put('/:id', updateExecution);
router.delete('/:id', deleteExecution);

export default router;
