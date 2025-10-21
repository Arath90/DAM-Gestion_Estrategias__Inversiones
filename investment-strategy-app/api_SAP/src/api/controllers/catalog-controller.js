const cds = require('@sap/cds');
const { BITACORA, DATA, AddMSG, OK, FAIL } = require('../../middlewares/respPWA.handler');
const { makeCrudHandlers } = require('../services/crud.service');

// ===== Mongoose models =====
const Instrument = require('../models/mongodb/Instrument');
const MLDataset  = require('../models/mongodb/MLDataset');
const Execution  = require('../models/mongodb/Execution');
const DailyPnl   = require('../models/mongodb/DailyPnl');
const Order      = require('../models/mongodb/Order');
const RiskLimit  = require('../models/mongodb/RiskLimit');
const Position   = require('../models/mongodb/Position');
const Signal     = require('../models/mongodb/Signal');
const Backtest   = require('../models/mongodb/Backtest');
const Candle     = require('../models/mongodb/Candle');
const MLModel    = require('../models/mongodb/MLModel');
const NewsArticle = require('../models/mongodb/NewsArticle');
const OptionChainSnapshot = require('../models/mongodb/OptionChainSnapshot');
const OptionChainSnapshotItem = require('../models/mongodb/OptionChainSnapshotItem');
const OptionQuote = require('../models/mongodb/OptionQuote');

// --- Controller helpers (HTTP/bitácora), no CRUD ---
const isStrict = ['true','1','yes','on'].includes(String(process.env.STRICT_HTTP_ERRORS || '').toLowerCase());

const readUser = (req) =>
  req?.req?.query?.LoggedUser ||
  req?.req?.headers?.['x-logged-user'] ||
  req?.data?.LoggedUser ||
  req?.data?.loggedUser ||
  'anonymous';

const normalizeDb = (v='MongoDB') => {
  const s = String(v).trim().toLowerCase();
  if (['mongodb','mongo','mongo-db'].includes(s)) return 'mongo';
  if (s === 'hana') return 'hana';
  return 'mongo';
};

const extractId = (req) =>
  req?.data?.ID || req?.req?.params?.ID || req?.req?.params?.id || req?.req?.query?.ID || req?.req?.query?.id || null;

const readQueryBounds = (req) => ({
  top:  Number(req._query?.$top  ?? 0),
  skip: Number(req._query?.$skip ?? 0),
});

const controlParams = new Set(['ProcessType','LoggedUser','$top','$skip','dbServer','db']);

const parseLiteral = (raw='') => {
  const v = raw.trim();
  if (!v.length) return v;
  if (v === 'null') return null;
  if (v === 'undefined') return undefined;
  if (v === 'true') return true;
  if (v === 'false') return false;
  const num = Number(v);
  if (!Number.isNaN(num) && v === String(num)) return num;
  return v;
};

const parseODataFilter = (expr='') => {
  const result = {};
  const parts = String(expr).split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    // contains(tolower(field),'value')
    let match = part.match(/^contains\s*\(\s*tolower\(\s*([\w.]+)\s*\)\s*,\s*'([^']*)'\s*\)\s*$/i);
    if (match) {
      const [, field, value] = match;
      result[field] = { $regex: value, $options: 'i' };
      continue;
    }
    // contains(field,'value')
    match = part.match(/^contains\s*\(\s*([\w.]+)\s*,\s*'([^']*)'\s*\)\s*$/i);
    if (match) {
      const [, field, value] = match;
      result[field] = { $regex: value };
      continue;
    }
    // field eq/ne 'value' or value without quotes
    match = part.match(/^([\w.]+)\s+(eq|ne)\s+(.+)$/i);
    if (match) {
      const [, field, op, rawValue] = match;
      const cleaned = rawValue.replace(/^'(.*)'$/, '$1');
      const parsedValue = parseLiteral(cleaned);
      if (op.toLowerCase() === 'eq') result[field] = parsedValue;
      else if (op.toLowerCase() === 'ne') result[field] = { $ne: parsedValue };
      continue;
    }
    // fallback: ignore clause we can't understand
  }
  return result;
};

const buildFilter = (q={}) => {
  const filter = {};
  for (const [key, value] of Object.entries(q)) {
    if (controlParams.has(key)) continue;
    if (key === '$filter') {
      Object.assign(filter, parseODataFilter(value));
      continue;
    }
    filter[key] = value;
  }
  return filter;
};

const statusByMethod = (m) => ({ CREATE:201, READ:200, UPDATE:200, DELETE:200 }[m] || 200);
const setHttpStatus = (req, code) => {
  const res = req?._?.res || req.res;
  if (res && !res.headersSent && typeof res.status === 'function') res.status(code);
};

// Wrapper del controller: valida, arma bitácora y responde
async function wrapAndRespond(req, method, api, process, fn) {
  const bitacora = BITACORA();
  const data = DATA();

  const LoggedUser  = readUser(req);
  const ProcessType = req?.req?.query?.ProcessType;
  const dbServerRaw = req?.req?.query?.dbServer || req?.req?.query?.db || 'MongoDB';
  const db = normalizeDb(dbServerRaw);
  const id = extractId(req);
  const { top, skip } = readQueryBounds(req);
  const filter = buildFilter(req?.req?.query || {});
  const body = req?.data;

  bitacora.loggedUser  = LoggedUser;
  bitacora.processType = ProcessType || '';
  bitacora.dbServer    = db;
  bitacora.process     = process;

  try {
    if (!ProcessType) {
      const e = new Error('Missing query param: ProcessType');
      e.status = 400; e.messageUSR = 'Debe especificar el tipo de proceso (ProcessType).';
      throw e;
    }

    const result = await fn({ req, db, id, top, skip, filter, body, LoggedUser, ProcessType });

    const status = statusByMethod(method);
    setHttpStatus(req, status);

    data.method = method;
    data.api = api;
    data.status = status;
    data.messageUSR = 'Operación realizada con éxito';
    data.messageDEV = `OK ${api} [db:${db}]`;
    data.loggedUser = LoggedUser;
    data.ProcessType = ProcessType;
    data.dbServer = db;
    data.dataRes = result;

    AddMSG(bitacora, data, 'OK', status, true);
    return OK(bitacora);

  } catch (err) {
    const status = err?.status || 500;

    data.method = method;
    data.api = api;
    data.status = status;
    data.messageUSR = err?.messageUSR || (status >= 500 ? 'Ocurrió un error interno.' : 'La operación no se pudo completar.');
    data.messageDEV = err?.messageDEV || err?.message || String(err);
    data.loggedUser = LoggedUser;
    data.ProcessType = ProcessType;
    data.dbServer = db;
    data.dataRes = { error: err?.stack || String(err) };

    AddMSG(bitacora, data, 'FAIL', status, true);

    if (isStrict && typeof req.error === 'function') {
      try {
        req.error({
          code: status >= 500 ? 'Internal-Server-Error' : 'Bad-Request',
          status,
          message: data.messageUSR,
          target: data.messageDEV,
          '@Common.numericSeverity': status >= 500 ? 4 : 2,
          details: [{ message: data.messageDEV }],
        });
        return;
      } catch (_) {}
    }

    setHttpStatus(req, status);
    return FAIL(bitacora);
  }
}

class CatalogController extends cds.ApplicationService {
  async init() {
    const {
      Instruments, MLDatasets, Executions, DailyPnls, Orders, RiskLimits,
      Positions, Signals, Backtests, Candles,
      MLModels, NewsArticles, OptionChainSnapshots, OptionChainSnapshotItems, OptionQuotes
    } = this.entities;

    // Utilidad para registrar una entidad
    const registerEntity = (Entity, Model, opts) => {
      if (!Entity) return;
      const h = makeCrudHandlers(Entity, Model, opts || {});
      this.on('READ',   Entity, (req) => wrapAndRespond(req, 'READ',   `READ ${Entity.name}`,   `Lectura de ${Entity.name}`,   (ctx) => h.READ(ctx)));
      this.on('CREATE', Entity, (req) => wrapAndRespond(req, 'CREATE', `CREATE ${Entity.name}`, `Creación de ${Entity.name}`, (ctx) => h.CREATE(ctx)));
      this.on('UPDATE', Entity, (req) => wrapAndRespond(req, 'UPDATE', `UPDATE ${Entity.name}`, `Actualización de ${Entity.name}`, (ctx) => h.UPDATE(ctx)));
      this.on('DELETE', Entity, (req) => wrapAndRespond(req, 'DELETE', `DELETE ${Entity.name}`, `Eliminación de ${Entity.name}`, (ctx) => h.DELETE(ctx)));
    };

    // ===== Unique checks por entidad =====
    registerEntity(Instruments, Instrument, {
      uniqueCheck: async (r) => {
        if (!r?.data?.ib_conid) return;
        const found = await Instrument.findOne({ ib_conid: r.data.ib_conid });
        if (found) r.reject(409, 'ib_conid ya existe');
      },
    });

    registerEntity(MLDatasets, MLDataset, {
      uniqueCheck: async (r) => {
        if (!r?.data?.name) return;
        const found = await MLDataset.findOne({ name: r.data.name });
        if (found) r.reject(409, 'MLDataset.name ya existe');
      },
    });

    registerEntity(Executions, Execution, {
      uniqueCheck: async (r) => {
        if (!r?.data?.exec_id) return;
        const found = await Execution.findOne({ exec_id: r.data.exec_id });
        if (found) r.reject(409, 'exec_id ya existe');
      },
    });

    registerEntity(DailyPnls, DailyPnl, {
      uniqueCheck: async (r) => {
        const { account, date } = r.data || {};
        if (!account || !date) return;
        const found = await DailyPnl.findOne({ account, date });
        if (found) r.reject(409, 'DailyPnl duplicado');
      },
    });

    registerEntity(Orders, Order); // sin unique por ahora

    registerEntity(RiskLimits, RiskLimit, {
      uniqueCheck: async (r) => {
        if (!r?.data?.account) return;
        const found = await RiskLimit.findOne({ account: r.data.account });
        if (found) r.reject(409, 'RiskLimit ya existe');
      },
    });

    registerEntity(Positions, Position, {
      uniqueCheck: async (r) => {
        const { account, instrument_id } = r.data || {};
        if (!account || !instrument_id) return;
        const found = await Position.findOne({ account, instrument_id });
        if (found) r.reject(409, 'Position duplicada');
      },
    });

    registerEntity(Signals, Signal, {
      uniqueCheck: async (r) => {
        const { strategy_code, instrument_id, ts, action } = r.data || {};
        if (!strategy_code || !instrument_id || !ts || !action) return;
        const found = await Signal.findOne({ strategy_code, instrument_id, ts, action });
        if (found) r.reject(409, 'Signal duplicada');
      },
    });

    registerEntity(Backtests, Backtest, {
      uniqueCheck: async (r) => {
        const { strategy_code, dataset_id, period_start, period_end } = r.data || {};
        if (!strategy_code || !dataset_id || !period_start || !period_end) return;
        const found = await Backtest.findOne({ strategy_code, dataset_id, period_start, period_end });
        if (found) r.reject(409, 'Backtest duplicado');
      },
    });

    registerEntity(Candles, Candle, {
      uniqueCheck: async (r) => {
        const { instrument_id, bar_size, ts } = r.data || {};
        if (!instrument_id || !bar_size || !ts) return;
        const found = await Candle.findOne({ instrument_id, bar_size, ts });
        if (found) r.reject(409, 'Candle duplicada');
      },
    });

    registerEntity(MLModels, MLModel); // sin unique por ahora

    registerEntity(NewsArticles, NewsArticle, {
      uniqueCheck: async (r) => {
        const { provider_code, article_id } = r.data || {};
        if (!provider_code || !article_id) return;
        const found = await NewsArticle.findOne({ provider_code, article_id });
        if (found) r.reject(409, 'Artículo duplicado');
      },
    });

    registerEntity(OptionChainSnapshots, OptionChainSnapshot, {
      uniqueCheck: async (r) => {
        const { underlying_id, ts } = r.data || {};
        if (!underlying_id || !ts) return;
        const found = await OptionChainSnapshot.findOne({ underlying_id, ts });
        if (found) r.reject(409, 'Snapshot duplicado');
      },
    });

    registerEntity(OptionChainSnapshotItems, OptionChainSnapshotItem, {
      uniqueCheck: async (r) => {
        const { snapshot_id, option_id } = r.data || {};
        if (!snapshot_id || !option_id) return;
        const found = await OptionChainSnapshotItem.findOne({ snapshot_id, option_id });
        if (found) r.reject(409, 'Item duplicado');
      },
    });

    registerEntity(OptionQuotes, OptionQuote, {
      uniqueCheck: async (r) => {
        const { instrument_id, ts } = r.data || {};
        if (!instrument_id || !ts) return;
        const found = await OptionQuote.findOne({ instrument_id, ts });
        if (found) r.reject(409, 'Quote duplicado');
      },
    });

    return super.init();
  }
}

module.exports = CatalogController;
