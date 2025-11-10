import { Router } from 'express';
import { getCandles } from '../controllers/candle.controller.js';

const router = Router();

// GET /api/candles/prev?instrument_id=...&interval=...&limit=...&from=...&to=...
router.get('/prev', getCandles);

export default router;
