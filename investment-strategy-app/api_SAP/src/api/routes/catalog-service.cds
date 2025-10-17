using inv from '../models/schema';

@impl: 'src/api/controllers/catalog-controller.js'
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
