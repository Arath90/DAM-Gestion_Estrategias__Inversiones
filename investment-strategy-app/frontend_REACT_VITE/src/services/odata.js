// src/services/odata.js
import api from '../config/apiClient';

// --- Utilidades OData ---
const keyV2 = (id) => `(ID='${encodeURIComponent(id)}')`;
const normalize = (data) => (Array.isArray(data?.value) ? data.value : data);
const ensureArray = (x) => (Array.isArray(x) ? x : []);

// --- CRUD genérico ---
const createCrudApiService = (entity) => ({
  list: async ({ top = 20, skip = 0, filter, orderby } = {}) => {
    const q = new URLSearchParams();
    if (top != null) q.set('$top', top);
    if (skip) q.set('$skip', skip);
    if (filter) q.set('$filter', filter);
    if (orderby) q.set('$orderby', orderby);
    const url = `/${entity}${q.toString() ? `?${q}` : ''}`;
    const { data } = await api.get(url);
    return ensureArray(normalize(data));
  },
  get: async (id) => (await api.get(`/${entity}${keyV2(id)}`)).data,
  create: async (payload) => (await api.post(`/${entity}`, payload)).data,
  update: async (id, payload) => (await api.patch(`/${entity}${keyV2(id)}`, payload)).data,
  remove: async (id) => { await api.delete(`/${entity}${keyV2(id)}`); return true; },
});

// --- Exporta todas las entidades ---
export const InstrumentsAPI              = createCrudApiService('Instruments');
export const MLDatasetsAPI               = createCrudApiService('MLDatasets');
export const ExecutionsAPI               = createCrudApiService('Executions');
export const DailyPnlsAPI                = createCrudApiService('DailyPnls');
export const OrdersAPI                   = createCrudApiService('Orders');
export const RiskLimitsAPI               = createCrudApiService('RiskLimits');
export const PositionsAPI                = createCrudApiService('Positions');
export const SignalsAPI                  = createCrudApiService('Signals');
export const BacktestsAPI                = createCrudApiService('Backtests');
export const CandlesAPI                  = createCrudApiService('Candles');
export const MLModelsAPI                 = createCrudApiService('MLModels');
export const NewsArticlesAPI             = createCrudApiService('NewsArticles');
export const OptionChainSnapshotsAPI     = createCrudApiService('OptionChainSnapshots');
export const OptionChainSnapshotItemsAPI = createCrudApiService('OptionChainSnapshotItems');
export const OptionQuotesAPI             = createCrudApiService('OptionQuotes');
