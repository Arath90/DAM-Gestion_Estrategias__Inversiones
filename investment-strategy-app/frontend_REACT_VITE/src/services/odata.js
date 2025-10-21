// src/services/odata.js
import api from '../config/apiClient';

const keyV2 = (id) => `(ID='${encodeURIComponent(id)}')`;

const collectDataRes = (node) => {
  if (!node || typeof node !== 'object') return [];
  const bucket = [];

  const dataRes = node.dataRes;
  if (Array.isArray(dataRes)) bucket.push(...dataRes);
  else if (dataRes && typeof dataRes === 'object') bucket.push(dataRes);

  if (Array.isArray(node.data)) {
    for (const entry of node.data) {
      bucket.push(...collectDataRes(entry));
    }
  }
  return bucket;
};

const normalize = (data) => {
  if (Array.isArray(data?.value)) {
    const collected = data.value.flatMap(collectDataRes);
    return collected.length ? collected : data.value;
  }
  const collected = collectDataRes(data);
  if (collected.length) return collected.length === 1 ? collected[0] : collected;
  return data;
};

const ensureArray = (x) => {
  if (Array.isArray(x)) return x;
  if (x == null) return [];
  return [x];
};

const unwrapSingle = (data) => {
  const normalized = normalize(data);
  return Array.isArray(normalized) ? normalized[0] ?? null : normalized;
};

const BASE_PARAMS = { dbServer: 'MongoDB' };

const buildReadParams = (opts = {}, overrides = {}) => {
  const { top, skip, filter, orderby } = opts;
  const params = { ...BASE_PARAMS, ProcessType: 'READ', ...overrides };
  if (top != null) params.$top = top;
  if (skip != null) params.$skip = skip;
  if (filter) params.$filter = filter;
  if (orderby) params.$orderby = orderby;
  return params;
};

const buildActionParams = (processType, overrides = {}) => ({
  ...BASE_PARAMS,
  ProcessType: processType,
  ...overrides,
});

const buildQueryString = (params = {}) => {
  const qp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    qp.set(key, value);
  });
  return qp.toString().replace(/\+/g, '%20');
};

const createCrudApiService = (entity) => ({
  list: async ({ top = 20, skip = 0, filter, orderby, params: extraParams } = {}) => {
    const params = buildReadParams({ top, skip, filter, orderby }, extraParams);
    const qs = buildQueryString(params);
    const url = qs ? `/${entity}?${qs}` : `/${entity}`;
    const { data } = await api.get(url);
    return ensureArray(normalize(data));
  },
  get: async (id, params) => {
    const qs = buildQueryString(buildReadParams({}, params));
    const url = qs ? `/${entity}${keyV2(id)}?${qs}` : `/${entity}${keyV2(id)}`;
    const { data } = await api.get(url);
    return unwrapSingle(data);
  },
  create: async (payload, params) => {
    const qs = buildQueryString(buildActionParams('CREATE', params));
    const url = qs ? `/${entity}?${qs}` : `/${entity}`;
    const { data } = await api.post(url, payload);
    return unwrapSingle(data);
  },
  update: async (id, payload, params) => {
    const qs = buildQueryString(buildActionParams('UPDATE', params));
    const url = qs ? `/${entity}${keyV2(id)}?${qs}` : `/${entity}${keyV2(id)}`;
    const { data } = await api.patch(url, payload);
    return unwrapSingle(data);
  },
  remove: async (id, params) => {
    const qs = buildQueryString(buildActionParams('DELETE', params));
    const url = qs ? `/${entity}${keyV2(id)}?${qs}` : `/${entity}${keyV2(id)}`;
    const { data } = await api.delete(url);
    const res = unwrapSingle(data);
    return res ?? true;
  },
});

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
