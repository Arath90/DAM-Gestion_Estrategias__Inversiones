using inv from '../models/schema';


/**
 * CatalogService
 *
 * Define el conjunto de entidades expuestas por CAP sobre la ruta /odata/v4/catalog.
 * Cada "projection on inv.<Entity>" genera un EntitySet OData con los verbos basicos:
 *   - GET /odata/v4/catalog/Entity
 *   - GET /odata/v4/catalog/Entity('ID')
 *   - POST /odata/v4/catalog/Entity
 *   - PATCH/PUT/DELETE /odata/v4/catalog/Entity('ID')
 *
 * La implementacion real vive en src/api/controllers/catalog-controller.js, donde delegamos
 * el CRUD hacia MongoDB (o HANA) a traves de crud.service.js.
 */
@impl: 'src/api/controllers/catalog-controller.js'
service CatalogService {

  action DetectDivergences(
    symbol: String,
    tf: String,
    period: Integer,
    swing: Integer,
    minDistance: Integer,
    rsiHigh: Integer,
    rsiLow: Integer,
    useZones: Boolean
  ) returns array of {
    type    : String;
    idx1    : Integer;
    idx2    : Integer;
    strength: Decimal(9,6);
  };

  entity Instruments               as projection on inv.Instruments;
  entity MLDatasets                as projection on inv.MLDatasets;
  entity Executions                as projection on inv.Executions;
  entity DailyPnls                 as projection on inv.DailyPnls;
  entity Orders                    as projection on inv.Orders;
  entity RiskLimits                as projection on inv.RiskLimits;
  entity Positions                 as projection on inv.Positions;
  entity Signals                   as projection on inv.Signals;
  entity Backtests                 as projection on inv.Backtests;
  entity Candles                   as projection on inv.Candles;
  entity MLModels                  as projection on inv.MLModels;
  entity NewsArticles              as projection on inv.NewsArticles;
  entity OptionChainSnapshots      as projection on inv.OptionChainSnapshots;
  entity OptionChainSnapshotItems  as projection on inv.OptionChainSnapshotItems;
  entity OptionQuotes              as projection on inv.OptionQuotes;
  entity SecUsers                  as projection on inv.SecUsers;
  entity Strategies                as projection on inv.Strategies;
}


