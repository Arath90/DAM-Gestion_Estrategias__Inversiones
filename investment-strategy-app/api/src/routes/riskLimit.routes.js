import { Router } from 'express';
import {
  getRiskLimits,
  getRiskLimitById,
  createRiskLimit,
  updateRiskLimit,
  deleteRiskLimit
} from '../controllers/riskLimit.controller.js';

const router = Router();

router.get('/', getRiskLimits);
router.get('/:id', getRiskLimitById);
router.post('/', createRiskLimit);
router.put('/:id', updateRiskLimit);
router.delete('/:id', deleteRiskLimit);

export default router;
