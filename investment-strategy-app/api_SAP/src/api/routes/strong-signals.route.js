const express = require('express');
const router = express.Router();

const {
  getAllStrongSignals,
  addStrongSignal,
  updateStrongSignalById,
  deleteStrongSignalById,
} = require('../services/strongSignals.azureCosmos.service');

router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token, X-Session, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

router.get('/strong-signals', async (req, res) => {
  try {
    const result = await getAllStrongSignals({ data: req.query });
    if (result?.error) {
      return res.status(400).json({ success: false, message: result.error });
    }
    return res.json({ success: true, value: result.value || [] });
  } catch (error) {
    console.error('[strong-signals] GET error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/strong-signals', async (req, res) => {
  try {
    const created = await addStrongSignal({ data: req.body });
    return res.status(201).json({ success: true, value: created });
  } catch (error) {
    console.error('[strong-signals] POST error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/strong-signals/:id', async (req, res) => {
  try {
    const result = await updateStrongSignalById({
      data: { ...req.body, id: req.params.id, strategy_code: req.body?.strategy_code || req.query?.strategy_code },
    });
    if (result?.error) {
      return res.status(404).json({ success: false, message: result.error });
    }
    return res.json({ success: true, value: result });
  } catch (error) {
    console.error('[strong-signals] PATCH error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/strong-signals/:id', async (req, res) => {
  try {
    const result = await deleteStrongSignalById({
      data: { id: req.params.id, strategy_code: req.query?.strategy_code || req.body?.strategy_code },
    });
    if (result?.error) {
      return res.status(result.error === 'Registro no encontrado' ? 404 : 400).json({
        success: false,
        message: result.error,
      });
    }
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[strong-signals] DELETE error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
