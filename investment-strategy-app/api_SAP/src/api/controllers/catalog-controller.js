// src/api/controllers/catalog-controller.js
const cds = require('@sap/cds');
//que hace este archivo y pq se llama catalog controller?
//Basicamente define un controlador en este caso dicho controlador es la clase CatalogController que extiende de cds.ApplicationService
// de dicha extension se heredan metodos y propiedades que permiten manejar las operaciones CRUD (Create, Read, Update, Delete) de manera estandarizada
//El controlador se encarga de gestionar las operaciones relacionadas con varias entidades del sistema, como instrumentos financieros, datasets de machine learning, ejecuciones de órdenes, etc. (todos los modelos de schema.cds)
//Cada una de estas entidades tiene su propio modelo de datos definido en archivos separados (por ejemplo, Instrument.js, MLDataset.js, etc.) y el controlador utiliza estos modelos para interactuar con la base de datos MongoDB.
// Modelos de  schema.cds
const Instrument = require('../models/mongodb/Instrument');
const MLDataset = require('../models/mongodb/MLDataset');
const Execution = require('../models/mongodb/Execution');
const DailyPnl = require('../models/mongodb/DailyPnl');
const Order = require('../models/mongodb/Order');
const RiskLimit = require('../models/mongodb/RiskLimit');
const Position = require('../models/mongodb/Position');
const Signal = require('../models/mongodb/Signal');
const Backtest = require('../models/mongodb/Backtest');
const Candle = require('../models/mongodb/Candle');
const MLModel = require('../models/mongodb/MLModel');
const NewsArticle = require('../models/mongodb/NewsArticle');
const OptionChainSnapshot = require('../models/mongodb/OptionChainSnapshot');
const OptionChainSnapshotItem = require('../models/mongodb/OptionChainSnapshotItem');
const OptionQuote = require('../models/mongodb/OptionQuote');
// Servicio CRUD que define operaciones estandarizadas, basicamente se importa la funcion registerCRUD que se encarga de registrar las operaciones CRUD para cada entidad.
const { registerCRUD } = require('../services/crud.service');
//esta clase como se menciona anteriormente extiende de cds.ApplicationService
class CatalogController extends cds.ApplicationService {
  async init() //se declara el metodo init que es asincrono y se ejecuta cuando el servicio se inicializa (donde init es un metodo heredado de cds.ApplicationService el cual directamente se sobreescribe por nuestra clase CatalogController)
  {
    const {//instancias de los modelos dentro de la clase 
      Instruments, MLDatasets, Executions, DailyPnls, Orders, RiskLimits,
      Positions, Signals, Backtests, Candles,
      MLModels, NewsArticles, OptionChainSnapshots, OptionChainSnapshotItems, OptionQuotes
    } = this.entities; //this.entities accede a las entidades definidas en el servicio CDS asociado a este controlador

    //unique es una funcion que verifica si un registro con ciertos criterios ya existe en la base de datos antes de permitir la creación de un nuevo registro
    //toma tres parametros: Model (el modelo de datos a consultar), whereFn (una funcion que genera la condicion de busqueda) y msg (mensaje de error si se encuentra un duplicado)
    const unique = (Model, whereFn, msg) => async (req) => {
      const w = whereFn?.(req); if (!w) return;
      const found = await Model.findOne(w);
      if (found) req.reject(409, msg);
    };
    //registerCRUD es una funcion que registra las operaciones CRUD para cada entidad 
    //tomando como parametros el controlador actual (this), la entidad CDS, el modelo de datos y opciones adicionales como uniqueCheck
    //uniqueCheck es una funcion que se ejecuta antes de crear un nuevo registro para verificar si ya existe un registro con los mismos criterios
    //si se encuentra un duplicado, se rechaza la solicitud con un error 409 (conflicto)
    //para cada entidad se define una verificacion de unicidad basada en ciertos campos clave 
    //osea 12 metodos CRUD con su respectiva verificacion de unicidad
    registerCRUD(this, Instruments, Instrument, {
      uniqueCheck: unique(Instrument, r => ({ ib_conid: r.data.ib_conid }), 'ib_conid ya existe'),
    });
    registerCRUD(this, MLDatasets, MLDataset, {
      uniqueCheck: unique(MLDataset, r => ({ name: r.data.name }), 'MLDataset.name ya existe'),
    });
    registerCRUD(this, Executions, Execution, {
      uniqueCheck: unique(Execution, r => ({ exec_id: r.data.exec_id }), 'exec_id ya existe'),
    });
    registerCRUD(this, DailyPnls, DailyPnl, {
      uniqueCheck: unique(DailyPnl, r => ({ account: r.data.account, date: r.data.date }), 'DailyPnl duplicado'),
    });
    registerCRUD(this, Orders, Order);
    registerCRUD(this, RiskLimits, RiskLimit, {
      uniqueCheck: unique(RiskLimit, r => ({ account: r.data.account }), 'RiskLimit ya existe'),
    });
    registerCRUD(this, Positions, Position, {
      uniqueCheck: unique(Position, r => ({ account: r.data.account, instrument_id: r.data.instrument_id }), 'Position duplicada'),
    });
    registerCRUD(this, Signals, Signal, {//en este caso la verificacion de unicidad es mas compleja 
      uniqueCheck: unique(Signal, r => ({//se verifica que no exista una señal con la misma estrategia, instrumento, timestamp y accion
        strategy_code: r.data.strategy_code, instrument_id: r.data.instrument_id, ts: r.data.ts, action: r.data.action
      }), 'Signal duplicada'),
    });
    registerCRUD(this, Backtests, Backtest, {
      uniqueCheck: unique(Backtest, r => ({//lo mismo que el anterior pero para backtest se usan mas campos porque son relacionados a datasets y periodos
        strategy_code: r.data.strategy_code, dataset_id: r.data.dataset_id,
        period_start: r.data.period_start, period_end: r.data.period_end
      }), 'Backtest duplicado'),
    });
    registerCRUD(this, Candles, Candle, {
      uniqueCheck: unique(Candle, r => ({//por ejemplo aqui candles tiene una relacion con instrumentos y un tamaño de barra especifico
        instrument_id: r.data.instrument_id, bar_size: r.data.bar_size, ts: r.data.ts
      }), 'Candle duplicada'),
    });

    registerCRUD(this, MLModels, MLModel);
    registerCRUD(this, NewsArticles, NewsArticle, {
      uniqueCheck: unique(NewsArticle, r => ({
        provider_code: r.data.provider_code, article_id: r.data.article_id
      }), 'Artículo duplicado'),
    });
    registerCRUD(this, OptionChainSnapshots, OptionChainSnapshot, {
      uniqueCheck: unique(OptionChainSnapshot, r => ({ underlying_id: r.data.underlying_id, ts: r.data.ts }), 'Snapshot duplicado'),
    });
    registerCRUD(this, OptionChainSnapshotItems, OptionChainSnapshotItem, {
      uniqueCheck: unique(OptionChainSnapshotItem, r => ({ snapshot_id: r.data.snapshot_id, option_id: r.data.option_id }), 'Item duplicado'),
    });
    registerCRUD(this, OptionQuotes, OptionQuote, {
      uniqueCheck: unique(OptionQuote, r => ({ instrument_id: r.data.instrument_id, ts: r.data.ts }), 'Quote duplicado'),
    });
    // Finalmente, se llama al método init de la clase base (cds.ApplicationService) para completar la inicialización del servicio.

    return super.init();
  }
}
//entonces porque es un controlador? 
//porque maneja las operaciones relacionadas con las entidades del sistema 
//y define la logica de negocio asociada a dichas operaciones
module.exports = CatalogController;
