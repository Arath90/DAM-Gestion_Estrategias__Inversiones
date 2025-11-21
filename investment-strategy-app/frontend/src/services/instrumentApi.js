import axios from '../config/apiClient';
import { BASE_PARAMS, keyFor, unwrapResponse } from './odataClient';

const withParams = (overrides) => ({ ...BASE_PARAMS, ...overrides });

export const fetchInstruments = async ({ top = 50 } = {}) => {
  const params = withParams({ ProcessType: 'READ', $top: top });
  const { data } = await axios.get('/Instruments', { params });
  return unwrapResponse(data);
};

export const createInstrument = async (payload) => {
  const params = withParams({ ProcessType: 'CREATE' });
  const { data } = await axios.post('/Instruments', payload, { params });
  return unwrapResponse(data)[0] || payload;
};

export const updateInstrument = async (id, payload) => {
  const params = withParams({ ProcessType: 'UPDATE' });
  const { data } = await axios.patch(`/Instruments${keyFor(id)}`, payload, { params });
  return unwrapResponse(data)[0] || payload;
};

export const deleteInstrument = async (id) => {
  const params = withParams({ ProcessType: 'DELETE' });
  await axios.delete(`/Instruments${keyFor(id)}`, { params });
};
