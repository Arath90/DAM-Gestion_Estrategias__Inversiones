//src/api/controllers/catalog-controller.js

// ============================================================================
// CatalogController
// ---------------------------------------------------------------------------
// Servicio principal de CAP que expone el "catálogo" de entidades de trading
// (Instrumentos, Datasets, Estrategias, Velas, etc.) a través de OData.
// 
// La filosofía es:
//   - CAP maneja el protocolo OData / HTTP.
//   - Mongoose maneja la persistencia en MongoDB.
//   - Este controlador traduce entre ambos mundos:
//       * Normaliza query params ($filter, $orderby, $top, $skip).
//       * Decide a qué modelo de Mongo delegar.
//       * Envuelve todas las operaciones en una bitácora uniforme (BITACORA).
//       * Centraliza manejo de errores y códigos HTTP (wrapAndRespond).
//
// Para la mayoría de entidades, el CRUD real lo construye makeCrudHandlers()
// y aquí solo se registran los handlers generados.
// Las velas (Candles) son especiales: se leen desde un proveedor externo.
// Además se define una acción personalizada: DetectDivergences.
// ============================================================================

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
const {
  getAllStrongSignals,
  addStrongSignal,
  updateStrongSignalById,
  deleteStrongSignalById,
  persistStrongSignalsFromDivergences,
} = require('../services/strongSignals.azureCosmos.service');

// === Modelos Mongoose expuestos a través del servicio OData ===============

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
const AlgorithmSetting = require("../models/mongodb/AlgorithmSetting");

// ============================================================================
// Helpers generales reutilizados por todos los handlers
// ============================================================================

// Si STRICT_HTTP_ERRORS está activo, se intenta devolver errores
// formateados como CAP (req.error). Si no, se responde con FAIL(bitacora).
const isStrict = ["true", "1", "yes", "on"].includes(
  String(process.env.STRICT_HTTP_ERRORS || "").toLowerCase()
);

/**
 * Obtiene el usuario actual desde diferentes orígenes posibles:
 *   - Query param LoggedUser (usado por el frontend).
 *   - req.req.sessionUser.email (inyectado por middleware Express).
 *   - Encabezado x-logged-user.
 *   - Datos de CAP (req.data).
 * Si no hay nadie, se usa "anonymous".
 */
function readUser(req) {
  return (
    req?.req?.query?.LoggedUser ||
    req?.req?.sessionUser?.email || // inyectado por sesión en capa Express
    req?.sessionUser?.email ||       // fallback si CAP monta sessionUser directo
    req?.req?.headers?.["x-logged-user"] ||
    req?.data?.LoggedUser ||
    req?.data?.loggedUser ||
    "anonymous"
  );
}

/**
 * Normaliza el origen de base de datos (Mongo vs HANA).
 * Por ahora la implementación real solo usa Mongo, pero se deja el switch.
 */
function normalizeDb(value = "MongoDB") {
  const normalized = String(value).trim().toLowerCase();
  if (["mongodb", "mongo", "mongo-db"].includes(normalized)) return "mongo";
  if (normalized === "hana") return "hana";
  return "mongo";
}

/**
 * Extrae un ID de la request (tanto CAP como Express).
 * CAP monta los datos en req.data, Express usa params/query.
 */
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

/**
 * Lee parámetros $top y $skip que CAP coloca en req._query.
 * Si no vienen, se asume 0.
 */
function readQueryBounds(req) {
  return {
    top: Number(req._query?.$top ?? 0),
    skip: Number(req._query?.$skip ?? 0),
  };
}

// Parámetros de control que NO deben convertirse en filtros Mongo.
const CONTROL_PARAMS = new Set([
  "ProcessType",
  "LoggedUser",
  "$top",
  "$skip",
  "$orderby",
  "dbServer",
  "db",
]);

// Defaults para lectura de velas externas.
const DEFAULT_CANDLES_INTERVAL = process.env.CANDLES_DEFAULT_INTERVAL || "1min";
const DEFAULT_CANDLES_LIMIT = Number(process.env.CANDLES_DEFAULT_LIMIT || 60);

/**
 * Intenta convertir un literal de texto a:
 *   - boolean (true/false)
 *   - null / undefined
 *   - number (si es numérico limpio)
 * En otro caso, regresa el string original.
 */
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

/**
 * Convierte nombres con sufijo "ID" o "_ID" al formato usado en Mongo:
 *   - "ID"        => "_id"
 *   - "instrument_ID" => "instrument_id"
 * (para luego mapear a ObjectId si el modelo lo requiere).
 */
function normalizeFieldName(field = "") {
  if (field === "ID") return "_id";
  return field.replace(/_ID$/g, "_id");
}

/**
 * Traduce expresiones $filter simples (eq/ne y contains) a un objeto
 * de filtro compatible con Mongo:
 *
 *   $filter=field eq 'valor'
 *   $filter=contains(tolower(name),'abc')
 *
 * No es un parser OData completo; solo cubre los casos que el frontend usa.
 */
function parseODataFilter(expr = "") {
  const result = {};
  const parts = String(expr)
    .split(/\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    // contains(tolower(field),'value')
    let match = part.match(
      /^contains\s*\(\s*tolower\(\s*([\w.]+)\s*\)\s*,\s*'([^']*)'\s*\)\s*$/i
    );
    if (match) {
      const [, field, value] = match;
      result[normalizeFieldName(field)] = { $regex: value, $options: "i" };
      continue;
    }

    // contains(field,'value')
    match = part.match(/^contains\s*\(\s*([\w.]+)\s*,\s*'([^']*)'\s*\)\s*$/i);
    if (match) {
      const [, field, value] = match;
      result[normalizeFieldName(field)] = { $regex: value };
      continue;
    }

    // field eq/ne value
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

/**
 * Convierte la cadena $orderby de OData a un objeto:
 *   $orderby=field1 asc,field2 desc
 *   => { field1: 1, field2: -1 }
 */
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

/** Helper para leer $orderby desde CAP o desde Express. */
function readOrderBy(req) {
  const raw = req?._query?.$orderby ?? req?.req?.query?.$orderby;
  if (!raw) return null;
  return parseOrderBy(raw);
}

/**
 * Construye un filtro Mongo combinando:
 *   - $filter (expresión OData) -> parseODataFilter
 *   - cualquier otro query param (transformado con parseLiteral)
 *
 * Se ignoran params de control (ProcessType, dbServer, etc.).
 */
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

function mapStrongSignalOut(doc = {}) {
  if (!doc) return doc;
  const tsValue = doc.ts ? new Date(doc.ts) : null;
  const features = doc.features_json;
  let featuresJson = features;
  if (features != null && typeof features !== 'string') {
    try {
      featuresJson = JSON.stringify(features);
    } catch (_) {
      featuresJson = String(features);
    }
  }

  return {
    ID: doc.id || doc.ID || doc._id || null,
    strategy_code: doc.strategy_code || null,
    instrument_ID: doc.instrument_id || doc.instrument_ID || null,
    divergence_type: doc.divergence_type || null,
    timeframe: doc.timeframe || null,
    ts: tsValue ? tsValue.toISOString() : null,
    score: doc.score ?? null,
    price_delta_pct: doc.price_delta_pct ?? null,
    indicator_delta_pct: doc.indicator_delta_pct ?? null,
    confidence: doc.confidence ?? null,
    features_json: featuresJson ?? null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

/**
 * Obtiene velas desde el proveedor externo para un instrumento.
 *
 * La identificación del instrumento intenta varias fuentes:
 *   - instrument_ID / instrument_id
 *   - symbol / ticker
 *   - conid / ib_conid
 *   - dataset asociado a una estrategia (dataset.instrument_conid, dataset.spec_json.symbol)
 *
 * Si no se encuentra, responde 404.
 * Si el instrumento no tiene símbolo, responde 400.
 */
async function handleCandlesRead({ filter = {}, req, top, skip, orderby }) {
  // --- 1. Resolver el instrumento a partir de los filtros / query params ----

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

  // dataset y estrategia se usan para inferir el instrumento
  const datasetIdParam =
    filter.dataset_id ||
    req?.req?.query?.dataset_id ||
    req?.req?.query?.datasetId;

  const strategyParam =
    filter.strategy_code ||
    filter.strategy_id ||
    req?.req?.query?.strategy_code ||
    req?.req?.query?.strategyId;

  let instrument = null;
  let dataset = null;
  let strategy = null;

  // Si llega una estrategia, cargarla para extraer dataset_id / periodo
  if (strategyParam) {
    const findStrategy = mongoose.isValidObjectId(strategyParam)
      ? { _id: strategyParam }
      : { strategy_code: strategyParam };
    strategy = await StrategiesModel.findOne(findStrategy).lean();
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

  // Prioridad de resolución de instrumento:
  //   1) instrument_ID explícito
  //   2) symbol
  //   3) conid
  //   4) dataset.instrument_conid
  //   5) dataset.spec_json.symbol / ticker
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

  if (!instrument && dataset?.instrument_conid != null) {
    const conv = Number(dataset.instrument_conid);
    instrument = await Instrument.findOne({
      ib_conid: Number.isNaN(conv) ? dataset.instrument_conid : conv,
    }).lean();
  }

  if (
    !instrument &&
    dataset?.spec_json &&
    (dataset.spec_json.symbol || dataset.spec_json.ticker)
  ) {
    const dsSymbol = dataset.spec_json.symbol || dataset.spec_json.ticker;
    instrument = await Instrument.findOne({ symbol: dsSymbol }).lean();
  }

  // Como último recurso, si al menos hay symbol, se construye un "instrumento virtual"
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

  // --- 2. Parámetros de rango e intervalo para la consulta externa ----------

  const interval =
    filter.bar_size || req?.req?.query?.bar_size || DEFAULT_CANDLES_INTERVAL;

  const topNum = Number(top);
  const skipNum = Number(skip);

  const limit =
    Number.isFinite(topNum) && topNum > 0 ? topNum : DEFAULT_CANDLES_LIMIT;
  const offset = Number.isFinite(skipNum) && skipNum > 0 ? skipNum : 0;

  const fromOverride =
    req?.req?.query?.from ||
    req?.req?.query?.fromDate ||
    strategy?.period_start;

  const toOverride =
    req?.req?.query?.to ||
    req?.req?.query?.toDate ||
    strategy?.period_end;

  const instrumentIdStr = instrument._id?.toString
    ? instrument._id.toString()
    : String(instrument._id);

  // --- 3. Llamada al proveedor externo de velas -----------------------------

  const candles = await fetchCandlesForInstrument({
    instrumentId: instrumentIdStr,
    symbol: instrument.symbol,
    interval,
    limit,
    offset,
    from: fromOverride,
    to: toOverride,
  });

  // Orden opcional por ts si el $orderby era desc
  const sorted = Array.isArray(candles) ? candles.slice() : [];
  if (orderby && orderby.ts === -1) {
    sorted.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }

  // Normalizar al formato OData de la entidad Candles
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

// Mapea ProcessType a código HTTP recomendado.
const statusByMethod = (method) =>
  ({ CREATE: 201, READ: 200, UPDATE: 200, DELETE: 200 }[method] || 200);

/**
 * Intenta fijar el código HTTP en la respuesta Express subyacente.
 * CAP envuelve la respuesta, por eso se usan req._.res o req.res.
 */
function setHttpStatus(req, code) {
  const res = req?._?.res || req?.res;
  if (res && !res.headersSent && typeof res.status === "function")
    res.status(code);
}

/**
 * Envoltorio estándar para TODAS las operaciones CRUD:
 *   - Crea BITACORA y DATA.
 *   - Resuelve parámetros base (usuario, base de datos, id, filtros, etc.).
 *   - Ejecuta la función de negocio fn(...).
 *   - Registra éxito o error en bitácora.
 *   - Devuelve respuesta OK/FAIL homogénea.
 *
 * Si isStrict está activo, también intenta propagar el error como req.error
 * para que CAP genere una respuesta OData estándar.
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
    // Todas las operaciones OData deben indicar ProcessType.
    if (!ProcessType) {
      const err = new Error("Missing query param: ProcessType");
      err.status = 400;
      err.messageUSR = "Debe especificar el tipo de proceso (ProcessType).";
      throw err;
    }

    // fn es la función de negocio real (handlers.READ, CREATE, etc.)
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

    // Modo estricto: generamos error CAP (req.error) si es posible.
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
        // Si CAP falla al construir el error, continuamos con FAIL genérico.
      }
    }

    setHttpStatus(req, status);
    return FAIL(bitacora);
  }
}

/**
 * CatalogController
 *
 * Extiende cds.ApplicationService para:
 *   - Registrar todas las entidades CDS (this.entities).
 *   - Conectar cada entidad con su modelo Mongo (registerEntity).
 *   - Aplicar reglas de unicidad / permisos por entidad.
 *   - Exponer la acción DetectDivergences.
 */
class CatalogController extends cds.ApplicationService {
  async init() {
    // Extrae referencias a las entidades CDS definidas en el modelo.
    const {
      Instruments,
      MLDatasets,
      Executions,
      DailyPnls,
      Orders,
      RiskLimits,
      Positions,
      Signals,
      StrongSignals,
      Backtests,
      Candles,
      MLModels,
      NewsArticles,
      OptionChainSnapshots,
      OptionChainSnapshotItems,
      OptionQuotes,
      SecUsers,
      Strategies,
      AlgorithmSettings,
    } = this.entities;

    // ========================================================================
    // Helpers específicos para AlgorithmSettings (preferencias de usuario)
    // ========================================================================

    /**
     * Garantiza que:
     *   - El usuario esté autenticado.
     *   - scope_type / scope_ref estén definidos (strategy o instrument).
     *   - user_email se asigne al registro.
     *   - En UPDATE, el owner no pueda ser otro usuario.
     */
    const ensureAlgorithmScope = async (req) => {
      const email = readUser(req);
      if (!email || email === "anonymous") {
        const err = new Error("Usuario no autenticado.");
        err.status = 401;
        throw err;
      }

      req.data = req.data || {};
      let existing = null;
      const targetId = extractId(req);

      // En UPDATE/DELETE, validar ownership del documento
      if (targetId) {
        existing = await AlgorithmSetting.findById(targetId).lean();
        if (existing && existing.user_email && existing.user_email !== email) {
          const err = new Error("No autorizado a modificar esta configuracion.");
          err.status = 403;
          throw err;
        }
      }

      // Determinar scope_type (strategy | instrument)
      const scopeType =
        req.data.scope_type ||
        req?.req?.query?.scope_type ||
        existing?.scope_type ||
        (req.data.strategy_id ? "strategy" : "instrument");

      // Determinar scope_ref (id de estrategia o clave de instrumento)
      let scopeRef =
        req.data.scope_ref ||
        req?.req?.query?.scope_ref ||
        existing?.scope_ref ||
        (scopeType === "strategy" ? req.data.strategy_id : null);

      if (!scopeRef && scopeType === "instrument") {
        scopeRef =
          req.data.instrument_key ||
          req?.req?.query?.instrument_key ||
          req?.req?.query?.symbol ||
          existing?.scope_ref ||
          null;
      }

      if (!scopeRef) {
        const err = new Error("scope_ref requerido para guardar preferencias.");
        err.status = 400;
        throw err;
      }

      // Completar campos de ownership / scope
      req.data.user_email = email;
      req.data.scope_type = scopeType;
      req.data.scope_ref = scopeRef;

      if (scopeType === "strategy" && !req.data.strategy_id) {
        req.data.strategy_id = scopeRef;
      }

      if (scopeType === "instrument") {
        if (!req.data.instrument_key) {
          req.data.instrument_key =
            req.data.instrument_key ||
            req?.req?.query?.instrument_key ||
            req?.req?.query?.symbol ||
            existing?.instrument_key ||
            scopeRef;
        }
        if (!req.data.interval) {
          req.data.interval =
            req?.req?.query?.interval || existing?.interval || req.data.interval;
        }
      }

      // En CREATE, si no hay params_json, se inicializa vacío
      if (!targetId && req.data.params_json == null) req.data.params_json = {};
    };

    /**
     * Filtro de lectura: un usuario solo ve sus propias configuraciones.
     */
    const restrictAlgorithmRead = async (ctx) => {
      const email = readUser(ctx.req);
      if (!email || email === "anonymous") {
        const err = new Error("Usuario no autenticado.");
        err.status = 401;
        throw err;
      }
      ctx.filter = ctx.filter || {};
      ctx.filter.user_email = email;
      if (ctx.req?.req?.query?.scope_type) {
        ctx.filter.scope_type = ctx.req.req.query.scope_type;
      }
      if (ctx.req?.req?.query?.scope_ref) {
        ctx.filter.scope_ref = ctx.req.req.query.scope_ref;
      }
    };

    /**
     * Antes de borrar una configuración, valida que pertenezca al usuario.
     */
    const ensureAlgorithmOwnershipOnDelete = async (ctx) => {
      const email = readUser(ctx.req);
      if (!email || email === "anonymous") {
        const err = new Error("Usuario no autenticado.");
        err.status = 401;
        throw err;
      }
      if (!ctx.id) return;

      const doc =
        (await AlgorithmSetting.findById(ctx.id).lean()) ||
        (await AlgorithmSetting.findOne({
          $expr: { $eq: [{ $toString: '$_id' }, ctx.id] },
        }).lean());

      if (doc && doc.user_email && doc.user_email !== email) {
        const err = new Error("No autorizado a eliminar esta configuracion.");
        err.status = 403;
        throw err;
      }
    };

    // ========================================================================
    // Helper para registrar una entidad CDS mapeada a un modelo Mongoose
    // ========================================================================

    /**
     * Registra handlers CRUD para una entidad CDS delegando en makeCrudHandlers.
     * Opcionalmente recibe:
     *   - uniqueCheck: función async(r) para validar duplicados en CREATE.
     *   - beforeCreate / beforeUpdate / beforeRead / beforeDelete: hooks de dominio.
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

    // ========================================================================
    // Registro de entidades + reglas de unicidad
    // ========================================================================

    if (StrongSignals) {
      const readStrongSignals = async (ctx) => {
        const filter = ctx.filter || {};
        const query = {
          id: ctx.id,
          instrument_id: filter.instrument_id || filter.instrument_ID,
          strategy_code: filter.strategy_code,
          divergence_type: filter.divergence_type,
          timeframe: filter.timeframe,
          minScore: filter.minScore ?? filter.score,
        };

        if (Number.isFinite(ctx.top) && ctx.top > 0) query.limit = ctx.top;
        if (Number.isFinite(ctx.skip) && ctx.skip > 0) query.offset = ctx.skip;
        if (ctx.orderby && ctx.orderby.ts) {
          query.orderByTs = ctx.orderby.ts === -1 ? 'DESC' : 'ASC';
        }

        const result = await getAllStrongSignals({ data: query });
        if (result?.error) {
          const err = new Error(result.error);
          err.status = 400;
          throw err;
        }

        const rows = result?.value || [];
        if (ctx.id) {
          if (!rows.length) {
            const err = new Error('No encontrado');
            err.status = 404;
            throw err;
          }
          return [mapStrongSignalOut(rows[0])];
        }

        return rows.map(mapStrongSignalOut);
      };

      const createStrongSignal = async (ctx) => {
        const payload = ctx.body || {};
        const created = await addStrongSignal({ data: payload });
        const doc = Array.isArray(created) ? created[0] : created;
        return mapStrongSignalOut(doc);
      };

      const updateStrongSignal = async (ctx) => {
        if (!ctx.id) {
          const err = new Error('ID requerido');
          err.status = 400;
          throw err;
        }
        const payload = { ...(ctx.body || {}), id: ctx.id };
        const updated = await updateStrongSignalById({ data: payload });
        if (updated?.error) {
          const err = new Error(updated.error);
          err.status = updated.error === 'Registro no encontrado' ? 404 : 400;
          throw err;
        }
        const doc = Array.isArray(updated) ? updated[0] : updated;
        return mapStrongSignalOut(doc);
      };

      const deleteStrongSignal = async (ctx) => {
        if (!ctx.id) {
          const err = new Error('ID requerido');
          err.status = 400;
          throw err;
        }
        const result = await deleteStrongSignalById({ data: { id: ctx.id } });
        if (result?.error) {
          const err = new Error(result.error);
          err.status = result.error === 'Registro no encontrado' ? 404 : 400;
          throw err;
        }
        return { deleted: true, ID: ctx.id };
      };

      this.on('READ', StrongSignals, (req) =>
        wrapAndRespond(
          req,
          'READ',
          `READ ${StrongSignals.name}`,
          'Lectura de StrongSignals (Cosmos DB)',
          (ctx) => readStrongSignals({ ...ctx, db: 'cosmos' })
        )
      );
      this.on('CREATE', StrongSignals, (req) =>
        wrapAndRespond(
          req,
          'CREATE',
          `CREATE ${StrongSignals.name}`,
          'Creacion de StrongSignals (Cosmos DB)',
          (ctx) => createStrongSignal({ ...ctx, db: 'cosmos' })
        )
      );
      this.on('UPDATE', StrongSignals, (req) =>
        wrapAndRespond(
          req,
          'UPDATE',
          `UPDATE ${StrongSignals.name}`,
          'Actualizacion de StrongSignals (Cosmos DB)',
          (ctx) => updateStrongSignal({ ...ctx, db: 'cosmos' })
        )
      );
      this.on('DELETE', StrongSignals, (req) =>
        wrapAndRespond(
          req,
          'DELETE',
          `DELETE ${StrongSignals.name}`,
          'Eliminacion de StrongSignals (Cosmos DB)',
          (ctx) => deleteStrongSignal({ ...ctx, db: 'cosmos' })
        )
      );
    }

    registerEntity(Instruments, Instrument, {
      // Un instrumento se considera único por ib_conid.
      uniqueCheck: async (r) => {
        if (!r?.data?.ib_conid) return;
        const found = await Instrument.findOne({ ib_conid: r.data.ib_conid });
        if (found) r.reject(409, "ib_conid ya existe");
      },
    });

    // MLDatasets: el nombre funciona como slug único.
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
      // Un DailyPnl se identifica por (account, date).
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
      // Una Position es única por (account, instrument_id).
      uniqueCheck: async (r) => {
        const { account, instrument_id } = r.data || {};
        if (!account || !instrument_id) return;
        const found = await Position.findOne({ account, instrument_id });
        if (found) r.reject(409, "Position duplicada");
      },
    });

    registerEntity(Signals, Signal, {
      // Evita duplicar señales idénticas para la misma estrategia/instrumento/tiempo/acción.
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

    // Backtests: combinación de (strategy_code, dataset_id, period_start, period_end).
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

    // ========================================================================
    // Entidad especial: Candles (solo lectura, datos externos)
    // ========================================================================

    if (Candles) {
      // Las velas se consultan a un proveedor externo y no se guardan en Mongo.
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

      // Cualquier intento de CREATE/UPDATE/DELETE regresará 405.
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

    // ========================================================================
    // Resto de entidades "normales"
    // ========================================================================

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

    // Strategies: se identifica además por `code` human-readable.
    registerEntity(Strategies, StrategiesModel, {
      uniqueCheck: async (r) => {
        if (!r?.data?.code) return;
        const found = await StrategiesModel.findOne({ code: r.data.code });
        if (found) r.reject(409, "Strategy.code ya existe");
      }
    });

    // AlgorithmSettings: preferencias por usuario/estrategia/instrumento
    registerEntity(AlgorithmSettings, AlgorithmSetting, {
      beforeCreate: ensureAlgorithmScope,
      beforeUpdate: ensureAlgorithmScope,
      beforeRead:   restrictAlgorithmRead,
      beforeDelete: ensureAlgorithmOwnershipOnDelete,
    });

    // ========================================================================
    // Acción personalizada: DetectDivergences
    // ========================================================================
    // Permite al front solicitar divergencias RSI vs Precio para un símbolo,
    // sin tener que pasar por todo el motor de estrategias.
    //
    // Request (OData Action):
    //   {
    //     symbol: 'I:NDX',
    //     tf: '1day',
    //     period: 14,
    //     swing: 5,
    //     minDistance: 5,
    //     rsiHigh: 70,
    //     rsiLow: 30,
    //     useZones: true/false
    //   }
    //
    // Response:
    //   [
    //     { type: 'bearish_divergence', idx1, idx2, strength },
    //     ...
    //   ]
    this.on('DetectDivergences', async req => {
      const {
        symbol,
        tf,
        period,
        swing,
        minDistance,
        rsiHigh,
        rsiLow,
        useZones,
        instrument_id,
        persistStrong,
        minStrongScore,
        minStrongPriceDeltaPct,
        timeframe,
      } = req.data;
      if (!symbol) return req.error(400, 'symbol requerido');

      // 1) Descargar velas del proveedor externo
      const candles = await fetchCandlesForInstrument({ symbol, tf, limit: 1000 });

      // 2) Ejecutar análisis RSI + divergencias
      const { signals } = await analyzeRSIAndDivergences(candles, {
        period: +period || 14,
        swingLen: +swing || 5,
        minDistance: +minDistance || 5,
        rsiHigh: +rsiHigh || 70,
        rsiLow: +rsiLow || 30,
        useZones: !!useZones
      });

      if (persistStrong && instrument_id) {
        try {
          await persistStrongSignalsFromDivergences({
            divergences: signals,
            candles,
            instrument_id,
            strategy_code: 'RSI_DIVERGENCE',
            timeframe: timeframe || tf || null,
            minScore: minStrongScore ?? 0.75,
            minPriceDeltaPct: minStrongPriceDeltaPct ?? 1,
            extra: { source: 'DetectDivergences action' },
          });
        } catch (err) {
          console.error('[DetectDivergences] Cosmos persist error:', err);
        }
      }

      // 3) Responder solo los campos relevantes para el cliente
      return signals.map(s => ({
        type: s.type,
        idx1: s.idx1,
        idx2: s.idx2,
        strength: s.strength
      }));
    });

    // Llamar al init original de cds.ApplicationService
    return super.init();
  }
}

module.exports = CatalogController;
