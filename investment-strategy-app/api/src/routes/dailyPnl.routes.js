import { Router } from 'express';
import {
  getDailyPnls,
  getDailyPnlById,
  createDailyPnl,
  updateDailyPnl,
  deleteDailyPnl,
} from '../controllers/dailyPnl.controller.js';

const router = Router();

router.get('/', getDailyPnls);
router.get('/:id', getDailyPnlById);
router.post('/', createDailyPnl);
router.put('/:id', updateDailyPnl);
router.delete('/:id', deleteDailyPnl);

export default router;
