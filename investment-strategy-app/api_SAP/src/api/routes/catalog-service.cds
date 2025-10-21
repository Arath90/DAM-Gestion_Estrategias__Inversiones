using inv from '../models/schema';
//nombre de la ruta catalog---> catalog-service--->/odata/v4/catalog/
// Cada entity ... as projection on inv.* crea un EntitySet con los verbos estándar:
// GET /odata/v4/catalog/Instruments
// GET /odata/v4/catalog/Instruments('ID')
// POST /odata/v4/catalog/Instruments
// PATCH/PUT/DELETE /odata/v4/catalog/Instruments('ID')
@impl: 'src/api/controllers/catalog-controller.js'
//CAP, al recibir una petición, llama a tu controller.
//en el controller, registramos los handlers (this.on('READ' ... )) y delegamos la lógica CRUD real al servicio (crud.service.js).
service CatalogService {
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
}
