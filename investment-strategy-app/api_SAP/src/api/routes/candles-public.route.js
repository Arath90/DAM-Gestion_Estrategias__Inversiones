const { fetchCandlesForInstrument } = require('../services/candlesExternal.service');

/**
 * Registra una ruta REST sencilla para consumir velas previas directamente desde el proveedor externo.
 * Ejemplo: GET /api/candles/prev?symbol=I:NDX
 */
module.exports = function registerPublicCandlesRoute(app) {
  if (!app || typeof app.get !== 'function') return;

  app.get('/api/candles/prev', async (req, res) => {
    const { symbol, limit, offset, interval } = req.query || {};

    if (!symbol) {
      return res.status(400).json({
        error: {
          message: 'Debe proporcionar el parametro query "symbol" (ticker a consultar).',
          statusCode: 400,
          code: '400',
        },
      });
    }

    try {
      const numericLimit = Number(limit);
      const numericOffset = Number(offset);
      const candles = await fetchCandlesForInstrument({
        instrumentId: symbol,
        symbol,
        interval: interval || '1day',
        limit: Number.isFinite(numericLimit) && numericLimit > 0 ? numericLimit : 1,
        offset: Number.isFinite(numericOffset) && numericOffset > 0 ? numericOffset : 0,
      });

      return res.json({
        symbol,
        interval: interval || '1day',
        count: candles.length,
        data: candles,
      });
    } catch (err) {
      const status = err?.status || 500;
      return res.status(status).json({
        error: {
          message: err?.message || 'No se pudieron obtener las velas.',
          statusCode: status,
          code: String(status),
          details: err?.details,
        },
      });
    }
  });
};

