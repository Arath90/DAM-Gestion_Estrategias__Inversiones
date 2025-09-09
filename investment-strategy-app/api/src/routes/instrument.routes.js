import express from 'express';
import { getInstruments, createInstrument } from '../controllers/instrument.controller.js';

const router = express.Router();

router.get('/', getInstruments);
router.post('/', createInstrument);

export default router;