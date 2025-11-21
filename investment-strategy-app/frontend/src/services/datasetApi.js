import axios from '../config/apiClient';
import { BASE_PARAMS, keyFor, unwrapResponse } from './odataClient';

const withParams = (overrides) => ({ ...BASE_PARAMS, ...overrides });

export const fetchDatasets = async ({ top = 100 } = {}) => {
  const params = withParams({ ProcessType: 'READ', $top: top });
  const { data } = await axios.get('/MLDatasets', { params });
  return unwrapResponse(data);
};

export const createDataset = async (payload) => {
  const params = withParams({ ProcessType: 'CREATE' });
  const { data } = await axios.post('/MLDatasets', payload, { params });
  return unwrapResponse(data)[0] || payload;
};

export const updateDataset = async (id, payload) => {
  const params = withParams({ ProcessType: 'UPDATE' });
  const { data } = await axios.patch(`/MLDatasets${keyFor(id)}`, payload, { params });
  return unwrapResponse(data)[0] || payload;
};

export const deleteDataset = async (id) => {
  const params = withParams({ ProcessType: 'DELETE' });
  await axios.delete(`/MLDatasets${keyFor(id)}`, { params });
};

export const fetchDatasetModels = async ({ top = 500 } = {}) => {
  const params = withParams({ ProcessType: 'READ', $top: top });
  const { data } = await axios.get('/MLModels', { params });
  return unwrapResponse(data);
};

export const createDatasetModel = async (payload) => {
  const params = withParams({ ProcessType: 'CREATE' });
  const { data } = await axios.post('/MLModels', payload, { params });
  return unwrapResponse(data)[0] || payload;
};

export const updateDatasetModel = async (id, payload) => {
  const params = withParams({ ProcessType: 'UPDATE' });
  const { data } = await axios.patch(`/MLModels${keyFor(id)}`, payload, { params });
  return unwrapResponse(data)[0] || payload;
};

export const deleteDatasetModel = async (id) => {
  const params = withParams({ ProcessType: 'DELETE' });
  await axios.delete(`/MLModels${keyFor(id)}`, { params });
};
