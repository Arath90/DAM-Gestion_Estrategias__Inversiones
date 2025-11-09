const cds = require("@sap/cds");
const mongoose = require("mongoose");
const {
  BITACORA,
  DATA,
  AddMSG,
  OK,
  FAIL,
} = require("../../middlewares/respPWA.handler");
const { makeCrudHandlers } = require("../services/crud.service");
const { analyzeRSIAndDivergences } = require('../services/indicators.service');
const { fetchCandlesForInstrument } = require('../services/candlesExternal.service');

// === Mongoose models expuestos a traves del servicio OData ===
const Instrument = require("../models/mongodb/Instrument");
const MLDataset = require("../models/mongodb/MLDataset");
const Execution = require("../models/mongodb/Execution");
const DailyPnl = require("../models/mongodb/DailyPnl");
const Order = require("../models/mongodb/Order");
const RiskLimit = require("../models/mongodb/RiskLimit");
const Position = require("../models/mongodb/Position");
const Signal = require("../models/mongodb/Signal");
const Backtest = require("../models/mongodb/Backtest");
const MLModel = require("../models/mongodb/MLModel");
const NewsArticle = require("../models/mongodb/NewsArticle");
const OptionChainSnapshot = require("../models/mongodb/OptionChainSnapshot");
const OptionChainSnapshotItem = require("../models/mongodb/OptionChainSnapshotItem");
const OptionQuote = require("../models/mongodb/OptionQuote");
const SecUser = require("../models/mongodb/SecUser");
const StrategiesModel = require("../models/mongodb/Strategies");

// ============================================================================
// Helper utilities reutilizados por todos los handlers
// ============================================================================

const isStrict = ["true", "1", "yes", "on"].includes(
  String(process.env.STRICT_HTTP_ERRORS || "").toLowerCase()
);

/**
 * Determina el usuario logueado a partir de distintos lugares del request.
 * CAP puede entregar el usuario en req.data mientras que el middleware Express
 * lo expone en req.req (que corresponde al Request original de Express).
 */
function readUser(req) {
  return (
    req?.req?.query?.LoggedUser ||
    req?.req?.sessionUser?.email || // inyectado por sessionAuth (Express layer)
    req?.sessionUser?.email || // fallback directo si viene sin el wrapper
    req?.req?.headers?.["x-logged-user"] ||
    req?.data?.LoggedUser ||
    req?.data?.loggedUser ||
    "anonymous"
  );
}

/** Normaliza la bandera de base de datos para delegar a Mongo o HANA. */
function normalizeDb(value = "MongoDB") {
  const normalized = String(value).trim().toLowerCase();
  if (["mongodb", "mongo", "mongo-db"].includes(normalized)) return "mongo";
  if (normalized === "hana") return "hana";
  return "mongo";
}

/** Extrae el ID suministrado por CAP/Express (params, query o body). */
function extractId(req) {
  return (
    req?.data?.ID ||
    req?.req?.params?.ID ||
    req?.req?.params?.id ||
    req?.req?.query?.ID ||
    req?.req?.query?.id ||
    null
  );
}

/** Lee parametros $top y $skip de CAP (se encuentran en req._query). */
function readQueryBounds(req) {
  return {
    top: Number(req._query?.$top ?? 0),
    skip: Number(req._query?.$skip ?? 0),
  };
}

const CONTROL_PARAMS = new Set([
  "ProcessType",
  "LoggedUser",
  "$top",
  "$skip",
  "$orderby",
  "dbServer",
  "db",
]);

const DEFAULT_CANDLES_INTERVAL = process.env.CANDLES_DEFAULT_INTERVAL || "1min";
const DEFAULT_CANDLES_LIMIT = Number(process.env.CANDLES_DEFAULT_LIMIT || 60);

/** Intenta transformar valores literales a booleanos/numero/null cuando provienen de filtros. */
function parseLiteral(raw = "") {
  const value = raw.trim();
  if (!value.length) return value;
  if (value === "null") return null;
  if (value === "undefined") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && value === String(numeric)) return numeric;
  return value;
}

/** Convierte nombres con sufijo _ID en su version camelCase utilizada en Mongo (_id). */
function normalizeFieldName(field = "") {
  if (field === "ID") return "_id";
  return field.replace(/_ID$/g, "_id");
}

/**
 * Analiza expresiones $filter simples (eq/ne y contains) y las traduce a criterios Mongo.
 * No soporta toda la gramatic OData; solo los patrones usados por el frontend.
 */
function parseODataFilter(expr = "") {
  const result = {};
  const parts = String(expr)
    .split(/\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    let match = part.match(
      /^contains\s*\(\s*tolower\(\s*([\w.]+)\s*\)\s*,\s*'([^']*)'\s*\)\s*$/i
    );
    if (match) {
      const [, field, value] = match;
      result[normalizeFieldName(field)] = { $regex: value, $options: "i" };
      continue;
    }

    match = part.match(/^contains\s*\(\s*([\w.]+)\s*,\s*'([^']*)'\s*\)\s*$/i);
    if (match) {
      const [, field, value] = match;
      result[normalizeFieldName(field)] = { $regex: value };
      continue;
    }

    match = part.match(/^([\w.]+)\s+(eq|ne)\s+(.+)$/i);
    if (match) {
      const [, field, op, rawValue] = match;
      const cleaned = rawValue.replace(/^'(.*)'$/, "$1");
      const parsedValue = parseLiteral(cleaned);
      const name = normalizeFieldName(field);
      if (op.toLowerCase() === "eq") result[name] = parsedValue;
      else if (op.toLowerCase() === "ne") result[name] = { $ne: parsedValue };
    }
  }

  return result;
}

/** Traduce expresiones $orderby a un objeto { campo: direccion } compatible con Mongo. */
function parseOrderBy(raw = "") {
  const clauses = {};
  const parts = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    const [field, dir] = part.split(/\s+/);
    if (!field) continue;
    const direction = String(dir || "asc").toLowerCase();
    clauses[normalizeFieldName(field)] = direction === "desc" ? -1 : 1;
  }

  return Object.keys(clauses).length ? clauses : null;
}

function readOrderBy(req) {
  const raw = req?._query?.$orderby ?? req?.req?.query?.$orderby;
  if (!raw) return null;
  return parseOrderBy(raw);
}

/** Construye un filtro Mongo a partir de los query params OData. */
function buildFilter(query = {}) {
  const filter = {};

  for (const [key, value] of Object.entries(query)) {
    if (CONTROL_PARAMS.has(key)) continue;

    if (key === "$filter") {
      Object.assign(filter, parseODataFilter(value));
      continue;
    }

    const normalizedKey = normalizeFieldName(key);
    filter[normalizedKey] =
      typeof value === "string" ? parseLiteral(value) : value;
  }

  return filter;
}

/**
 * Obtiene velas desde el proveedor externo para el instrumento solicitado.
 */
async function handleCandlesRead({ filter = {}, req, top, skip, orderby }) {
  const candidateInstrumentId =
    filter.instrument_id ||
    filter.instrument_ID ||
    req?.req?.query?.instrument_ID ||
    req?.req?.query?.instrument_id ||
    extractId(req);

  const candidateSymbol =
    filter.symbol ||
    filter.ticker ||
    req?.req?.query?.symbol ||
    req?.req?.query?.ticker;

  const candidateConid =
    filter.ib_conid ||
    filter.conid ||
    req?.req?.query?.ib_conid ||
    req?.req?.query?.conid;

  let instrument = null;

  if (candidateInstrumentId) {
    if (mongoose.isValidObjectId(candidateInstrumentId)) {
      instrument = await Instrument.findById(candidateInstrumentId).lean();
    } else if (!Number.isNaN(Number(candidateInstrumentId))) {
      instrument = await Instrument.findOne({
        ib_conid: Number(candidateInstrumentId),
      }).lean();
    }
    if (!instrument) {
      instrument = await Instrument.findOne({
        symbol: candidateInstrumentId,
      }).lean();
    }
  }

  if (!instrument && candidateSymbol) {
    instrument = await Instrument.findOne({ symbol: candidateSymbol }).lean();
  }

  if (!instrument && candidateConid) {
    const conidValue = Number(candidateConid);
    instrument = await Instrument.findOne({
      ib_conid: Number.isNaN(conidValue) ? candidateConid : conidValue,
    }).lean();
  }

  if (!instrument) {
    if (candidateSymbol) {
      instrument = { _id: candidateSymbol, symbol: candidateSymbol };
    } else {
      const err = new Error(
        "Instrumento no encontrado o sin identificador valido."
      );
      err.status = 404;
      throw err;
    }
  }

  if (!instrument.symbol) {
    const err = new Error(
      "El instrumento no tiene simbolo configurado, no se pueden consultar velas."
    );
    err.status = 400;
    throw err;
  }

  const interval =
    filter.bar_size || req?.req?.query?.bar_size || DEFAULT_CANDLES_INTERVAL;
  const topNum = Number(top);
  const skipNum = Number(skip);
  const limit =
    Number.isFinite(topNum) && topNum > 0 ? topNum : DEFAULT_CANDLES_LIMIT;
  const offset = Number.isFinite(skipNum) && skipNum > 0 ? skipNum : 0;
  const fromOverride = req?.req?.query?.from || req?.req?.query?.fromDate;
  const toOverride = req?.req?.query?.to || req?.req?.query?.toDate;

  const instrumentIdStr = instrument._id?.toString
    ? instrument._id.toString()
    : String(instrument._id);

  const candles = await fetchCandlesForInstrument({
    instrumentId: instrumentIdStr,
    symbol: instrument.symbol,
    interval,
    limit,
    offset,
    from: fromOverride,
    to: toOverride,
  });

  const sorted = Array.isArray(candles) ? candles.slice() : [];
  if (orderby && orderby.ts === -1) {
    sorted.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }

  return sorted.map((candle) => {
    const ts = candle.ts instanceof Date ? candle.ts : new Date(candle.ts);
    return {
      ID: `${instrumentIdStr}-${ts.getTime()}`,
      instrument_ID: instrumentIdStr,
      bar_size: candle.bar_size || interval,
      ts: ts.toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      trade_count: candle.trade_count,
      wap: candle.wap,
      createdAt: candle.createdAt || null,
      updatedAt: candle.updatedAt || null,
    };
  });
}

const statusByMethod = (method) =>
  ({ CREATE: 201, READ: 200, UPDATE: 200, DELETE: 200 }[method] || 200);

function setHttpStatus(req, code) {
  const res = req?._?.res || req?.res;
  if (res && !res.headersSent && typeof res.status === "function")
    res.status(code);
}

/**
 * Envueltorios de bitacora y manejo de errores uniformes para cada operacion CRUD.
 */
async function wrapAndRespond(req, method, api, process, fn) {
  const bitacora = BITACORA();
  const data = DATA();

  const LoggedUser = readUser(req);
  const ProcessType = req?.req?.query?.ProcessType;
  const dbServerRaw =
    req?.req?.query?.dbServer || req?.req?.query?.db || "MongoDB";
  const db = normalizeDb(dbServerRaw);
  const id = extractId(req);
  const { top, skip } = readQueryBounds(req);
  const filter = buildFilter(req?.req?.query || {});
  const orderby = readOrderBy(req);
  const body = req?.data;

  bitacora.loggedUser = LoggedUser;
  bitacora.processType = ProcessType || "";
  bitacora.dbServer = db;
  bitacora.process = process;

  try {
    if (!ProcessType) {
      const err = new Error("Missing query param: ProcessType");
      err.status = 400;
      err.messageUSR = "Debe especificar el tipo de proceso (ProcessType).";
      throw err;
    }

    const result = await fn({
      req,
      db,
      id,
      top,
      skip,
      filter,
      orderby,
      body,
      LoggedUser,
      ProcessType,
    });

    const status = statusByMethod(method);
    setHttpStatus(req, status);

    data.method = method;
    data.api = api;
    data.status = status;
    data.messageUSR = "Operacion realizada con exito";
    data.messageDEV = `OK ${api} [db:${db}]`;
    data.loggedUser = LoggedUser;
    data.ProcessType = ProcessType;
    data.dbServer = db;
    data.dataRes = result;

    AddMSG(bitacora, data, "OK", status, true);
    return OK(bitacora);
  } catch (err) {
    const status = err?.status || 500;

    data.method = method;
    data.api = api;
    data.status = status;
    data.messageUSR =
      err?.messageUSR ||
      (status >= 500
        ? "Ocurrio un error interno."
        : "La operacion no se pudo completar.");
    data.messageDEV = err?.messageDEV || err?.message || String(err);
    data.loggedUser = LoggedUser;
    data.ProcessType = ProcessType;
    data.dbServer = db;
    data.dataRes = { error: err?.stack || String(err) };

    AddMSG(bitacora, data, "FAIL", status, true);

    if (isStrict && typeof req.error === "function") {
      try {
        req.error({
          code: status >= 500 ? "Internal-Server-Error" : "Bad-Request",
          status,
          message: data.messageUSR,
          target: data.messageDEV,
          "@Common.numericSeverity": status >= 500 ? 4 : 2,
          details: [{ message: data.messageDEV }],
        });
        return;
      } catch (_) {
        // Si CAP falla al generar el error, continuamos con la respuesta generica.
      }
    }

    setHttpStatus(req, status);
    return FAIL(bitacora);
  }
}

/**
 * CatalogController
 *
 * Expone entidades OData y delega la logica CRUD a makeCrudHandlers (Mongo/HANA).
 * wrapAndRespond centraliza bitacoras, mensajes y manejo de errores.
 */
class CatalogController extends cds.ApplicationService {
  async init() {
    const {
      Instruments,
      MLDatasets,
      Executions,
      DailyPnls,
      Orders,
      RiskLimits,
      Positions,
      Signals,
      Backtests,
      Candles,
      MLModels,
      NewsArticles,
      OptionChainSnapshots,
      OptionChainSnapshotItems,
      OptionQuotes,
      SecUsers,
      Strategies,
    } = this.entities;

    /**
     * Helper para registrar cada entidad.
     * makeCrudHandlers crea los handlers CRUD especificos para el modelo Mongo.
     */
    const registerEntity = (Entity, Model, opts) => {
      if (!Entity) return;
      const handlers = makeCrudHandlers(Entity, Model, opts || {});

      this.on("READ", Entity, (req) =>
        wrapAndRespond(
          req,
          "READ",
          `READ ${Entity.name}`,
          `Lectura de ${Entity.name}`,
          (ctx) => handlers.READ(ctx)
        )
      );
      this.on("CREATE", Entity, (req) =>
        wrapAndRespond(
          req,
          "CREATE",
          `CREATE ${Entity.name}`,
          `Creacion de ${Entity.name}`,
          (ctx) => handlers.CREATE(ctx)
        )
      );
      this.on("UPDATE", Entity, (req) =>
        wrapAndRespond(
          req,
          "UPDATE",
          `UPDATE ${Entity.name}`,
          `Actualizacion de ${Entity.name}`,
          (ctx) => handlers.UPDATE(ctx)
        )
      );
      this.on("DELETE", Entity, (req) =>
        wrapAndRespond(
          req,
          "DELETE",
          `DELETE ${Entity.name}`,
          `Eliminacion de ${Entity.name}`,
          (ctx) => handlers.DELETE(ctx)
        )
      );
    };

    // Reglas de unicidad por entidad (evitan duplicados frecuentes).
    registerEntity(Instruments, Instrument, {
      uniqueCheck: async (r) => {
        if (!r?.data?.ib_conid) return;
        const found = await Instrument.findOne({ ib_conid: r.data.ib_conid });
        if (found) r.reject(409, "ib_conid ya existe");
      },
    });

    registerEntity(MLDatasets, MLDataset, {
      uniqueCheck: async (r) => {
        if (!r?.data?.name) return;
        const found = await MLDataset.findOne({ name: r.data.name });
        if (found) r.reject(409, "MLDataset.name ya existe");
      },
    });

    registerEntity(Executions, Execution, {
      uniqueCheck: async (r) => {
        if (!r?.data?.exec_id) return;
        const found = await Execution.findOne({ exec_id: r.data.exec_id });
        if (found) r.reject(409, "exec_id ya existe");
      },
    });

    registerEntity(DailyPnls, DailyPnl, {
      uniqueCheck: async (r) => {
        const { account, date } = r.data || {};
        if (!account || !date) return;
        const found = await DailyPnl.findOne({ account, date });
        if (found) r.reject(409, "DailyPnl duplicado");
      },
    });

    registerEntity(Orders, Order);

    registerEntity(RiskLimits, RiskLimit, {
      uniqueCheck: async (r) => {
        if (!r?.data?.account) return;
        const found = await RiskLimit.findOne({ account: r.data.account });
        if (found) r.reject(409, "RiskLimit ya existe");
      },
    });

    registerEntity(Positions, Position, {
      uniqueCheck: async (r) => {
        const { account, instrument_id } = r.data || {};
        if (!account || !instrument_id) return;
        const found = await Position.findOne({ account, instrument_id });
        if (found) r.reject(409, "Position duplicada");
      },
    });

    registerEntity(Signals, Signal, {
      uniqueCheck: async (r) => {
        const { strategy_code, instrument_id, ts, action } = r.data || {};
        if (!strategy_code || !instrument_id || !ts || !action) return;
        const found = await Signal.findOne({
          strategy_code,
          instrument_id,
          ts,
          action,
        });
        if (found) r.reject(409, "Signal duplicada");
      },
    });

    registerEntity(Backtests, Backtest, {
      uniqueCheck: async (r) => {
        const { strategy_code, dataset_id, period_start, period_end } =
          r.data || {};
        if (!strategy_code || !dataset_id || !period_start || !period_end)
          return;
        const found = await Backtest.findOne({
          strategy_code,
          dataset_id,
          period_start,
          period_end,
        });
        if (found) r.reject(409, "Backtest duplicado");
      },
    });

    if (Candles) {
      // Las velas ahora se consultan en un proveedor externo y son de solo lectura.
      const rejectCandlesWrite = async () => {
        const err = new Error("Candles es de solo lectura (datos externos).");
        err.status = 405;
        throw err;
      };

      this.on("READ", Candles, (req) =>
        wrapAndRespond(
          req,
          "READ",
          `READ ${Candles.name}`,
          `Lectura de ${Candles.name} (proveedor externo)`,
          (ctx) => handleCandlesRead(ctx)
        )
      );

      ["CREATE", "UPDATE", "DELETE"].forEach((method) => {
        this.on(method, Candles, (req) =>
          wrapAndRespond(
            req,
            method,
            `${method} ${Candles.name}`,
            `Operacion no disponible en ${Candles.name}`,
            rejectCandlesWrite
          )
        );
      });
    }

    registerEntity(MLModels, MLModel);

    registerEntity(NewsArticles, NewsArticle, {
      uniqueCheck: async (r) => {
        const { provider_code, article_id } = r.data || {};
        if (!provider_code || !article_id) return;
        const found = await NewsArticle.findOne({ provider_code, article_id });
        if (found) r.reject(409, "Articulo duplicado");
      },
    });

    registerEntity(OptionChainSnapshots, OptionChainSnapshot, {
      uniqueCheck: async (r) => {
        const { underlying_id, ts } = r.data || {};
        if (!underlying_id || !ts) return;
        const found = await OptionChainSnapshot.findOne({ underlying_id, ts });
        if (found) r.reject(409, "Snapshot duplicado");
      },
    });

    registerEntity(OptionChainSnapshotItems, OptionChainSnapshotItem, {
      uniqueCheck: async (r) => {
        const { snapshot_id, option_id } = r.data || {};
        if (!snapshot_id || !option_id) return;
        const found = await OptionChainSnapshotItem.findOne({
          snapshot_id,
          option_id,
        });
        if (found) r.reject(409, "Item duplicado");
      },
    });

    registerEntity(OptionQuotes, OptionQuote, {
      uniqueCheck: async (r) => {
        const { instrument_id, ts } = r.data || {};
        if (!instrument_id || !ts) return;
        const found = await OptionQuote.findOne({ instrument_id, ts });
        if (found) r.reject(409, "Quote duplicado");
      },
    });

    registerEntity(SecUsers, SecUser, {
      uniqueCheck: async (r) => {
        const { secuser_id, ts } = r.data || {};
        if (!secuser_id || !ts) return;
        const found = await SecUser.findOne({ secuser_id, ts });
        if (found) r.reject(409, "Usuario duplicado");
      },
    });

    registerEntity(Strategies, StrategiesModel, {
      uniqueCheck: async (r) => {
        if (!r?.data?.code) return;
        const found = await StrategiesModel.findOne({ code: r.data.code });
        if (found) r.reject(409, "Strategy.code ya existe");
      }
    });

    // Acción DetectDivergences (actualizada con validaciones y valores por defecto)
    this.on('DetectDivergences', async req => {
      const { symbol, tf, period, swing, minDistance, rsiHigh, rsiLow, useZones } = req.data;
      if (!symbol) return req.error(400, 'symbol requerido');

      const candles = await fetchCandlesForInstrument({ symbol, tf, limit: 1000 });
      const { signals } = await analyzeRSIAndDivergences(candles, {
        period: +period || 14,
        swingLen: +swing || 5,
        minDistance: +minDistance || 5,
        rsiHigh: +rsiHigh || 70,
        rsiLow: +rsiLow || 30,
        useZones: !!useZones
      });

      return signals.map(s => ({
        type: s.type,
        idx1: s.idx1,
        idx2: s.idx2,
        strength: s.strength
      }));
    });

    return super.init();
  }
}

module.exports = CatalogController;
