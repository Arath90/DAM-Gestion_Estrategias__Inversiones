import express from 'express';
import { getInstruments, getInstrumentById, createInstrument } from '../controllers/instrument.controller.js';

const router = express.Router();

router.get('/', getInstruments);
router.get('/:id', getInstrumentById); // <-- Agrega esta línea
router.post('/', createInstrument);

export default router;