const mongoose = require('mongoose');
const { fetchCandlesForInstrument } = require('../services/candlesExternal.service');
const Instrument = require('../models/mongodb/Instrument');
const MLDataset = require('../models/mongodb/MLDataset');
const StrategiesModel = require('../models/mongodb/Strategies');

/**
 * Registra una ruta REST sencilla para consumir velas previas directamente desde el proveedor externo.
 * Ejemplo: GET /api/candles/prev?symbol=I:NDX
 */
module.exports = function registerPublicCandlesRoute(app) {
  if (!app || typeof app.get !== 'function') return;

  app.get('/api/candles/prev', async (req, res) => {
    const {
      symbol,
      limit,
      offset,
      interval,
      dataset_id: datasetIdParam,
      strategy_code: strategyParam,
      from,
      to,
    } = req.query || {};

    if (!symbol && !datasetIdParam && !strategyParam) {
      return res.status(400).json({
        error: {
          message: 'Debe proporcionar "symbol" o dataset/strategy.',
          statusCode: 400,
          code: '400',
        },
      });
    }

    try {
      let dataset = null;
      let strategy = null;
      if (strategyParam) {
        const filter = mongoose.isValidObjectId(strategyParam)
          ? { _id: strategyParam }
          : { strategy_code: strategyParam };
        strategy = await StrategiesModel.findOne(filter).lean();
      }

      const effectiveDatasetId =
        datasetIdParam ||
        (strategy?.dataset_id &&
          (strategy.dataset_id.ID ||
            strategy.dataset_id._id ||
            strategy.dataset_id));

      if (effectiveDatasetId) {
        const dsFilter = mongoose.isValidObjectId(effectiveDatasetId)
          ? { _id: effectiveDatasetId }
          : { name: effectiveDatasetId };
        dataset = await MLDataset.findOne(dsFilter).lean();
      }

      let resolvedInstrument = null;
      const numericLimit = Number(limit);
      const numericOffset = Number(offset);
      const picker = async (sym, conid) => {
        if (sym) {
          const inst = await Instrument.findOne({ symbol: sym }).lean();
          if (inst) return inst;
        }
        if (conid != null) {
          const conv = Number(conid);
          const inst = await Instrument.findOne({
            ib_conid: Number.isNaN(conv) ? conid : conv,
          }).lean();
          if (inst) return inst;
        }
        return null;
      };

      resolvedInstrument =
        (await picker(symbol, null)) ||
        (await picker(
          dataset?.spec_json?.symbol || dataset?.spec_json?.ticker,
          dataset?.instrument_conid,
        ));

      if (!resolvedInstrument && (dataset || strategy)) {
        return res.status(404).json({
          error: {
            message: 'No se pudo resolver instrumento para dataset/estrategia.',
            statusCode: 404,
            code: '404',
          },
        });
      }

      const candles = await fetchCandlesForInstrument({
        instrumentId: resolvedInstrument?._id || symbol,
        symbol: resolvedInstrument?.symbol || symbol,
        interval: interval || '1day',
        limit: Number.isFinite(numericLimit) && numericLimit > 0 ? numericLimit : 1,
        offset: Number.isFinite(numericOffset) && numericOffset > 0 ? numericOffset : 0,
        from,
        to,
      });

      return res.json({
        symbol: resolvedInstrument?.symbol || symbol,
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

