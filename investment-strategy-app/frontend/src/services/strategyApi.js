import axios from '../config/apiClient';
import { BASE_PARAMS, keyFor, unwrapResponse } from './odataClient';

const withParams = (overrides) => ({ ...BASE_PARAMS, ...overrides });

export const fetchStrategies = async () => {
  const params = withParams({ ProcessType: 'READ', $top: 50 });
  const { data } = await axios.get('/Strategies', { params });
  return unwrapResponse(data);
};

export const fetchDatasets = async () => {
  const params = withParams({ ProcessType: 'READ', $top: 100 });
  const { data } = await axios.get('/MLDatasets', { params });
  return unwrapResponse(data);
};

export const createStrategy = async (payload) => {
  const params = withParams({ ProcessType: 'CREATE' });
  const { data } = await axios.post('/Strategies', payload, { params });
  return unwrapResponse(data)[0] || payload;
};

export const updateStrategy = async (id, payload) => {
  const params = withParams({ ProcessType: 'UPDATE' });
  const { data } = await axios.patch(`/Strategies${keyFor(id)}`, payload, { params });
  return unwrapResponse(data)[0] || payload;
};

export const deleteStrategy = async (id) => {
  const params = withParams({ ProcessType: 'DELETE' });
  await axios.delete(`/Strategies${keyFor(id)}`, { params });
};

export const fetchModelComponents = async () => {
  const params = withParams({ ProcessType: 'READ', $top: 500 });
  const { data } = await axios.get('/MLModels', { params });
  return unwrapResponse(data);
};
