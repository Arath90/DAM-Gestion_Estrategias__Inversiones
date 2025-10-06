import api from '../config/apiClient';

// Util: arma key de OData con ID string. El ID en MongoDB es un string.
const key = (id) => `('${encodeURIComponent(id)}')`;
const keyV2 = (id) => `(ID='${encodeURIComponent(id)}')`; // Formato alternativo visto en tu odata.js

/** Normaliza la respuesta de OData v4 que a veces viene en { value: [...] } */
const odataNormalize = (data) => (Array.isArray(data?.value) ? data.value : data);

/** Función CRUD genérica */
const createCrudApiService = (entityName) => ({
  list: async ({ top = 20, skip = 0, filter, orderby } = {}) => {
    const q = new URLSearchParams();
    if (top) q.set('$top', top);
    if (skip) q.set('$skip', skip);
    if (filter) q.set('$filter', filter);
    if (orderby) q.set('$orderby', orderby);
    const url = `/${entityName}${q.toString() ? `?${q}` : ''}`;
    const { data } = await api.get(url);
    return odataNormalize(data);
  },
  get: async (id) => {
    const { data } = await api.get(`/${entityName}${keyV2(id)}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post(`/${entityName}`, payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.patch(`/${entityName}${keyV2(id)}`, payload);
    return data;
  },
  remove: async (id) => {
    await api.delete(`/${entityName}${keyV2(id)}`);
    return true;
  },
});

// Exportar una API para cada entidad
export const InstrumentsAPI = createCrudApiService('Instruments');
export const MLDatasetsAPI = createCrudApiService('MLDatasets');
export const ExecutionsAPI = createCrudApiService('Executions');
export const DailyPnlsAPI = createCrudApiService('DailyPnls');
export const OrdersAPI = createCrudApiService('Orders');
export const RiskLimitsAPI = createCrudApiService('RiskLimits');
export const PositionsAPI = createCrudApiService('Positions');
export const SignalsAPI = createCrudApiService('Signals');
export const BacktestsAPI = createCrudApiService('Backtests');
export const CandlesAPI = createCrudApiService('Candles');
export const MLModelsAPI = createCrudApiService('MLModels');
export const NewsArticlesAPI = createCrudApiService('NewsArticles');
export const OptionChainSnapshotsAPI = createCrudApiService('OptionChainSnapshots');
export const OptionChainSnapshotItemsAPI = createCrudApiService('OptionChainSnapshotItems');
export const OptionQuotesAPI = createCrudApiService('OptionQuotes');